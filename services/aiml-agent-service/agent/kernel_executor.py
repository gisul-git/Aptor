"""
Fast non-blocking kernel executor with optimized IOPub message collection.

Uses aggressive polling with minimal timeouts for fast execution.
"""

import asyncio
import time
from typing import Dict, Any
from jupyter_client import BlockingKernelClient
from agent.kernel_manager import transform_pip, get_kernel_lock, get_kernel


async def execute_in_kernel(
    session_id: str,
    code: str,
    timeout: int = 120
) -> Dict[str, Any]:
    """
    Execute code in a kernel session with fast non-blocking IOPub collection.
    
    Optimized for speed: uses very short timeouts (0.05s) and minimal sleeps.
    
    Args:
        session_id: Session identifier for kernel reuse
        code: Python code to execute (may include !pip install commands)
        timeout: Maximum execution time in seconds
        
    Returns:
        Dictionary with:
        - status: "ok" | "timeout" | "error"
        - stdout: str
        - stderr: str
        - images: List[str] (base64 encoded PNG images)
        - error: Optional[Dict] with ename, evalue, traceback
    """
    start_time = time.time()
    
    # Get lock for this session to serialize execution
    lock = get_kernel_lock(session_id)
    
    # Acquire lock - ensures only one execution at a time per session
    async with lock:
        # Get or create kernel for this session
        kernel_info = get_kernel(session_id)
        kc: BlockingKernelClient = kernel_info['kc']
        
        # Transform !pip install commands
        transformed_code = transform_pip(code)
        
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
        
        try:
            # Send execute request (non-blocking)
            msg_id = await asyncio.to_thread(kc.execute, transformed_code, allow_stdin=False)
            
            # Fast IOPub message collection loop
            # Use very short timeout (0.05s) for responsive polling
            execution_complete = False
            consecutive_timeouts = 0
            max_consecutive_timeouts = 20  # After 20 timeouts (1s), add tiny sleep
            poll_interval = 0.05  # 50ms polling interval
            
            while not execution_complete:
                # Check overall timeout
                elapsed = time.time() - start_time
                if elapsed >= timeout:
                    result['status'] = 'timeout'
                    result['stderr'] = f'Execution timeout after {timeout}s\n'
                    break
                
                try:
                    # Get IOPub message with very short timeout for fast polling (50ms)
                    msg = await asyncio.wait_for(
                        asyncio.to_thread(kc.get_iopub_msg, timeout=poll_interval),
                        timeout=poll_interval + 0.01
                    )
                    
                    consecutive_timeouts = 0  # Reset timeout counter
                    msg_type = msg['msg_type']
                    content = msg['content']
                    
                    if msg_type == 'stream':
                        stream_name = content.get('name', 'stdout')
                        text = content.get('text', '')
                        
                        if stream_name == 'stdout':
                            stdout_parts.append(text)
                        elif stream_name == 'stderr':
                            stderr_parts.append(text)
                    
                    elif msg_type == 'execute_result':
                        data = content.get('data', {})
                        if 'image/png' in data:
                            images.append(data['image/png'])
                        if 'text/plain' in data:
                            stdout_parts.append(str(data['text/plain']))
                    
                    elif msg_type == 'display_data':
                        data = content.get('data', {})
                        if 'image/png' in data:
                            images.append(data['image/png'])
                        if 'text/plain' in data:
                            stdout_parts.append(str(data['text/plain']))
                    
                    elif msg_type == 'error':
                        error_info = {
                            'ename': content.get('ename'),
                            'evalue': content.get('evalue'),
                            'traceback': content.get('traceback', [])
                        }
                        # Continue to wait for status: idle
                    
                    elif msg_type == 'status':
                        execution_state = content.get('execution_state')
                        if execution_state == 'idle':
                            # Execution complete, check shell reply for final status
                            try:
                                reply = await asyncio.wait_for(
                                    asyncio.to_thread(kc.get_shell_msg, timeout=0.05),
                                    timeout=0.06
                                )
                                if reply['msg_type'] == 'execute_reply':
                                    if reply['content']['status'] == 'error':
                                        # Override with shell reply error if present
                                        error_info = {
                                            'ename': reply['content'].get('ename'),
                                            'evalue': reply['content'].get('evalue'),
                                            'traceback': reply['content'].get('traceback', [])
                                        }
                            except asyncio.TimeoutError:
                                pass
                            
                            execution_complete = True
                            break
                
                except asyncio.TimeoutError:
                    consecutive_timeouts += 1
                    
                    # Check if kernel is still alive
                    if not kernel_info['km'].is_alive():
                        result['status'] = 'error'
                        error_info = {
                            'ename': 'KernelError',
                            'evalue': 'Kernel died during execution',
                            'traceback': []
                        }
                        break
                    
                    # Use await asyncio.sleep(0.05) as requested to avoid busy loops
                    await asyncio.sleep(poll_interval)
                    continue
            
            # Build final result
            result['stdout'] = ''.join(stdout_parts)
            result['stderr'] = ''.join(stderr_parts)
            result['images'] = images
            result['error'] = error_info
            
            if error_info:
                result['status'] = 'error'
        
        except Exception as e:
            result['status'] = 'error'
            result['error'] = {
                'ename': type(e).__name__,
                'evalue': str(e),
                'traceback': []
            }
        
        return result

