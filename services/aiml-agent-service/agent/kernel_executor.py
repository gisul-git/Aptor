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
                    
                    # Debug logging for message collection order
                    if msg_type in ['stream', 'execute_result', 'display_data']:
                        print(f"[KernelExecutor] 📨 Received {msg_type} message")
                    
                    if msg_type == 'stream':
                        stream_name = content.get('name', 'stdout')
                        text = content.get('text', '')
                        
                        print(f"[KernelExecutor] 📤 Stream message: name={stream_name}, text_length={len(text)}, text_preview={text[:100] if text else ''}")
                        
                        if stream_name == 'stdout':
                            stdout_parts.append(text)
                            print(f"[KernelExecutor] ✅ Added to stdout_parts (total parts: {len(stdout_parts)})")
                        elif stream_name == 'stderr':
                            stderr_parts.append(text)
                            print(f"[KernelExecutor] ✅ Added to stderr_parts (total parts: {len(stderr_parts)})")
                    
                    elif msg_type == 'execute_result':
                        data = content.get('data', {})
                        text_plain = data.get('text/plain', '') if 'text/plain' in data else ''
                        has_image = 'image/png' in data
                        
                        print(f"[KernelExecutor] 📊 Execute result: has_text_plain={bool(text_plain)}, text_length={len(str(text_plain))}, has_image={has_image}")
                        
                        if 'image/png' in data:
                            images.append(data['image/png'])
                            print(f"[KernelExecutor] ✅ Added image to images (total images: {len(images)})")
                        if 'text/plain' in data:
                            text_content = str(data['text/plain'])
                            stdout_parts.append(text_content)
                            print(f"[KernelExecutor] ✅ Added execute_result text to stdout_parts (length: {len(text_content)}, total parts: {len(stdout_parts)})")
                    
                    elif msg_type == 'display_data':
                        data = content.get('data', {})
                        text_plain = data.get('text/plain', '') if 'text/plain' in data else ''
                        has_image = 'image/png' in data
                        
                        print(f"[KernelExecutor] 🖼️ Display data: has_text_plain={bool(text_plain)}, text_length={len(str(text_plain))}, has_image={has_image}")
                        
                        if 'image/png' in data:
                            images.append(data['image/png'])
                            print(f"[KernelExecutor] ✅ Added image to images (total images: {len(images)})")
                        if 'text/plain' in data:
                            text_content = str(data['text/plain'])
                            stdout_parts.append(text_content)
                            print(f"[KernelExecutor] ✅ Added display_data text to stdout_parts (length: {len(text_content)}, total parts: {len(stdout_parts)})")
                    
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
            
            # Debug logging for final result
            print(f"[KernelExecutor] 📦 Final result: stdout_length={len(result['stdout'])}, stderr_length={len(result['stderr'])}, images_count={len(result['images'])}, stdout_parts_count={len(stdout_parts)}")
            if stdout_parts:
                print(f"[KernelExecutor] 📝 stdout_parts details:")
                for i, part in enumerate(stdout_parts):
                    print(f"  Part {i}: length={len(part)}, preview={part[:100] if part else '(empty)'}")
            if result['stdout']:
                print(f"[KernelExecutor] 📄 Final stdout preview (first 200 chars): {result['stdout'][:200]}")
            
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

