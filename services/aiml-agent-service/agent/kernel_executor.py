"""
Kernel executor with proper message collection, correlation, and error recovery.
"""

import asyncio
import time
import logging
from queue import Empty as QueueEmpty
from typing import Dict, Any, Optional
from jupyter_client import BlockingKernelClient
from agent.kernel_manager import (
    transform_pip, get_kernel_lock, get_kernel, 
    mark_kernel_error, reset_kernel_state, check_kernel_health
)
from agent.config import Config
from agent.metrics import get_metrics

logger = logging.getLogger(__name__)


async def drain_iopub_messages(kc: BlockingKernelClient, timeout: float = 0.1) -> int:
    """
    Drain all pending IOPub messages to clear the queue.
    
    Args:
        kc: Kernel client
        timeout: Timeout for each message read
        
    Returns:
        Number of messages drained
    """
    drained = 0
    start_time = time.time()
    max_drain_time = 1.0  # Max 1 second for draining
    
    while time.time() - start_time < max_drain_time:
        try:
            msg = await asyncio.wait_for(
                asyncio.to_thread(kc.get_iopub_msg, timeout=timeout),
                timeout=timeout + 0.01
            )
            drained += 1
        except (asyncio.TimeoutError, QueueEmpty, Exception):
            break
    
    if drained > 0:
        logger.debug(f"Drained {drained} IOPub messages")
    
    return drained


async def execute_in_kernel(
    session_id: str,
    code: str,
    timeout: int = None,
    max_retries: int = 2
) -> Dict[str, Any]:
    """
    Execute code in a kernel session with proper message collection and error recovery.
    
    Args:
        session_id: Session identifier for kernel reuse
        code: Python code to execute (may include !pip install commands)
        timeout: Maximum execution time in seconds (defaults to Config.EXECUTION_TIMEOUT)
        max_retries: Maximum number of retries on transient errors
        
    Returns:
        Dictionary with:
        - status: "ok" | "timeout" | "error"
        - stdout: str
        - stderr: str
        - images: List[str] (base64 encoded PNG images)
        - error: Optional[Dict] with ename, evalue, traceback
    """
    timeout = timeout or Config.EXECUTION_TIMEOUT
    start_time = time.time()
    metrics = get_metrics()
    
    # Get lock for this session to serialize execution
    lock = get_kernel_lock(session_id)
    
    # Acquire lock - ensures only one execution at a time per session
    async with lock:
        # Get or create kernel for this session
        kernel_info = await get_kernel(session_id)
        kc: BlockingKernelClient = kernel_info['kc']
        
        # Transform !pip install commands (with security checks)
        try:
            transformed_code = transform_pip(code)
        except Exception as e:
            logger.error(f"Code transformation error: {e}")
            return {
                'status': 'error',
                'stdout': '',
                'stderr': f'Code transformation error: {str(e)}',
                'images': [],
                'error': {
                    'ename': 'SecurityError',
                    'evalue': str(e),
                    'traceback': []
                }
            }
        
        # Initialize result
        result: Dict[str, Any] = {
            'status': 'ok',
            'stdout': '',
            'stderr': '',
            'images': [],
            'error': None
        }
        
        stdout_parts = []
        stderr_parts = []
        images = []
        error_info = None
        total_output_size = 0
        
        # Retry loop for transient errors
        for attempt in range(max_retries + 1):
            try:
                # Check kernel health before execution
                if not check_kernel_health(session_id):
                    logger.warning(f"Kernel unhealthy for session {session_id}, restarting")
                    kernel_info = await get_kernel(session_id, force_restart=True)
                    kc = kernel_info['kc']
                
                # CRITICAL: Drain IOPub messages before execution to avoid stale messages
                await drain_iopub_messages(kc)
                
                # Send execute request
                msg_id = await asyncio.to_thread(kc.execute, transformed_code, allow_stdin=False)
                logger.debug(f"Execution started: msg_id={msg_id}, session={session_id}")
                
                # Message collection loop with correlation
                execution_complete = False
                poll_interval = 0.05  # 50ms polling interval
                consecutive_timeouts = 0
                max_consecutive_timeouts = 200  # 10 seconds of timeouts
                
                while not execution_complete:
                    # Check overall timeout
                    elapsed = time.time() - start_time
                    if elapsed >= timeout:
                        result['status'] = 'timeout'
                        result['stderr'] = f'Execution timeout after {timeout}s\n'
                        metrics.increment('executions.timeout', tags={'session_id': session_id})
                        break
                    
                    try:
                        # Get IOPub message
                        msg = await asyncio.wait_for(
                            asyncio.to_thread(kc.get_iopub_msg, timeout=poll_interval),
                            timeout=poll_interval + 0.01
                        )
                        
                        consecutive_timeouts = 0
                        
                        # CRITICAL: Correlate message with execution using parent header
                        parent_header = msg.get('parent_header', {})
                        msg_parent_id = parent_header.get('msg_id')
                        
                        # Only process messages for this execution
                        if msg_parent_id != msg_id:
                            logger.debug(f"Skipping message with mismatched parent_id: {msg_parent_id} != {msg_id}")
                            continue
                        
                        msg_type = msg['msg_type']
                        content = msg['content']
                        
                        if msg_type == 'stream':
                            stream_name = content.get('name', 'stdout')
                            text = content.get('text', '')
                            
                            # Check output size limit
                            text_size = len(text.encode('utf-8'))
                            if total_output_size + text_size > Config.MAX_OUTPUT_SIZE:
                                logger.warning(f"Output size limit reached, truncating")
                                remaining = Config.MAX_OUTPUT_SIZE - total_output_size
                                text = text[:remaining]
                                total_output_size = Config.MAX_OUTPUT_SIZE
                            else:
                                total_output_size += text_size
                            
                            if stream_name == 'stdout':
                                stdout_parts.append(text)
                            elif stream_name == 'stderr':
                                stderr_parts.append(text)
                        
                        elif msg_type == 'execute_result':
                            data = content.get('data', {})
                            
                            # Check image count limit
                            if 'image/png' in data and len(images) < Config.MAX_IMAGE_COUNT:
                                images.append(data['image/png'])
                            
                            if 'text/plain' in data:
                                text_content = str(data['text/plain'])
                                text_size = len(text_content.encode('utf-8'))
                                if total_output_size + text_size > Config.MAX_OUTPUT_SIZE:
                                    text_content = text_content[:Config.MAX_OUTPUT_SIZE - total_output_size]
                                    total_output_size = Config.MAX_OUTPUT_SIZE
                                else:
                                    total_output_size += text_size
                                stdout_parts.append(text_content)
                        
                        elif msg_type == 'display_data':
                            data = content.get('data', {})
                            
                            if 'image/png' in data and len(images) < Config.MAX_IMAGE_COUNT:
                                images.append(data['image/png'])
                            
                            if 'text/plain' in data:
                                text_content = str(data['text/plain'])
                                text_size = len(text_content.encode('utf-8'))
                                if total_output_size + text_size > Config.MAX_OUTPUT_SIZE:
                                    text_content = text_content[:Config.MAX_OUTPUT_SIZE - total_output_size]
                                    total_output_size = Config.MAX_OUTPUT_SIZE
                                else:
                                    total_output_size += text_size
                                stdout_parts.append(text_content)
                        
                        elif msg_type == 'error':
                            error_info = {
                                'ename': content.get('ename'),
                                'evalue': content.get('evalue'),
                                'traceback': content.get('traceback', [])
                            }
                        
                        elif msg_type == 'status':
                            execution_state = content.get('execution_state')
                            if execution_state == 'idle':
                                # Execution complete, check shell reply
                                try:
                                    reply = await asyncio.wait_for(
                                        asyncio.to_thread(kc.get_shell_msg, timeout=0.1),
                                        timeout=0.11
                                    )
                                    # Verify this reply is for our execution
                                    if reply.get('parent_header', {}).get('msg_id') == msg_id:
                                        if reply['msg_type'] == 'execute_reply':
                                            if reply['content']['status'] == 'error':
                                                error_info = {
                                                    'ename': reply['content'].get('ename'),
                                                    'evalue': reply['content'].get('evalue'),
                                                    'traceback': reply['content'].get('traceback', [])
                                                }
                                except (asyncio.TimeoutError, QueueEmpty):
                                    pass
                                
                                execution_complete = True
                                break
                    
                    except (asyncio.TimeoutError, QueueEmpty):
                        # QueueEmpty is expected when no messages are available (timeout)
                        # Treat it the same as asyncio.TimeoutError
                        consecutive_timeouts += 1
                        
                        # Check if kernel is still alive
                        if not kernel_info['km'].is_alive():
                            result['status'] = 'error'
                            error_info = {
                                'ename': 'KernelError',
                                'evalue': 'Kernel died during execution',
                                'traceback': []
                            }
                            metrics.increment('executions.kernel_died', tags={'session_id': session_id})
                            break
                        
                        # Too many timeouts might indicate a problem
                        if consecutive_timeouts > max_consecutive_timeouts:
                            logger.warning(f"Too many consecutive timeouts ({consecutive_timeouts})")
                            break
                        
                        await asyncio.sleep(poll_interval)
                        continue
                
                # Build final result
                result['stdout'] = ''.join(stdout_parts)
                result['stderr'] = ''.join(stderr_parts)
                result['images'] = images
                result['error'] = error_info
                
                if error_info:
                    result['status'] = 'error'
                    mark_kernel_error(session_id)
                    metrics.increment('executions.error', tags={'session_id': session_id})
                else:
                    reset_kernel_state(session_id)
                    metrics.increment('executions.success', tags={'session_id': session_id})
                
                # Record execution time
                elapsed = time.time() - start_time
                metrics.histogram('executions.duration', elapsed, tags={'session_id': session_id})
                
                logger.debug(f"Execution completed: status={result['status']}, elapsed={elapsed:.2f}s")
                return result
            
            except Exception as e:
                # QueueEmpty is expected when no messages are available - don't log as error
                if isinstance(e, QueueEmpty):
                    # This should have been caught in the inner handler, but if it propagates,
                    # it's not a real error - just means no messages were available
                    logger.debug(f"QueueEmpty during execution (expected): {e}")
                    # Treat as timeout and continue
                    result['status'] = 'ok'
                    result['stdout'] = ''.join(stdout_parts)
                    result['stderr'] = ''.join(stderr_parts)
                    result['images'] = images
                    result['error'] = error_info
                    reset_kernel_state(session_id)
                    metrics.increment('executions.success', tags={'session_id': session_id})
                    elapsed = time.time() - start_time
                    metrics.histogram('executions.duration', elapsed, tags={'session_id': session_id})
                    return result
                
                logger.error(f"Execution error (attempt {attempt + 1}/{max_retries + 1}): {e}", exc_info=True)
                
                # Check if it's a retryable error
                is_retryable = isinstance(e, (ConnectionError, TimeoutError, asyncio.TimeoutError))
                
                if attempt < max_retries and is_retryable:
                    logger.info(f"Retrying execution (attempt {attempt + 2}/{max_retries + 1})")
                    await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    # Try to get a fresh kernel
                    try:
                        kernel_info = await get_kernel(session_id, force_restart=True)
                        kc = kernel_info['kc']
                    except Exception as restart_error:
                        logger.error(f"Failed to restart kernel: {restart_error}")
                        break
                else:
                    # Final attempt failed or non-retryable error
                    result['status'] = 'error'
                    result['error'] = {
                        'ename': type(e).__name__,
                        'evalue': str(e),
                        'traceback': []
                    }
                    mark_kernel_error(session_id)
                    metrics.increment('executions.error', tags={'session_id': session_id})
                    break
        
        return result
