"""
Kernel manager with kernel reuse, health monitoring, and proper cleanup.
"""

import asyncio
import shlex
import time
import os
import logging
from typing import Dict, Any, Optional
from jupyter_client import BlockingKernelClient, KernelManager
import nest_asyncio
from agent.config import Config
from agent.security import sanitize_pip_command, SecurityError
from agent.metrics import get_metrics

# Enable nested event loops
nest_asyncio.apply()

logger = logging.getLogger(__name__)

# Global kernel storage: session_id -> {km, kc, last_used, created_at, error_count, is_healthy}
kernels: Dict[str, Dict[str, Any]] = {}

# Global locks for per-session serialization
kernel_locks: Dict[str, asyncio.Lock] = {}

# Background task for cleanup
_cleanup_task: Optional[asyncio.Task] = None
_health_check_task: Optional[asyncio.Task] = None


def get_kernel_lock(session_id: str) -> asyncio.Lock:
    """Get or create an asyncio lock for a kernel session."""
    if session_id not in kernel_locks:
        kernel_locks[session_id] = asyncio.Lock()
    return kernel_locks[session_id]


def transform_pip(code: str) -> str:
    """
    Transform !pip install commands into Python code that runs inside the kernel.
    Now includes security checks.
    
    Handles:
    - !pip install X
    - %pip install X
    - !pip install X Y Z
    - !pip install --upgrade X
    - Multi-line cells (only first line checked)
    """
    # Check only the first line to avoid treating multi-line cells as pip args
    lines = code.split('\n')
    first_line = lines[0].strip()
    
    # Handle !pip and %pip magic commands (only on first line)
    if first_line.startswith("!pip ") or first_line.startswith("%pip "):
        # Security check
        try:
            sanitized_code, is_pip = sanitize_pip_command(code)
            if not is_pip:
                return sanitized_code
        except SecurityError as e:
            raise SecurityError(str(e))
        
        # Remove the ! or % prefix
        cmd = first_line.lstrip("!%")
        # Parse the command
        try:
            parts = shlex.split(cmd)
        except ValueError:
            # If parsing fails, return original code
            return code
        
        if len(parts) < 2 or parts[0] != "pip":
            return code  # Not a valid pip command
        
        # Get arguments after 'pip install' (skip 'pip' and 'install' subcommand)
        if len(parts) >= 2 and parts[1] == "install":
            args = parts[2:]  # Skip 'pip' and 'install'
        else:
            args = parts[1:]  # Just skip 'pip'
        
        # Build Python code that runs pip install in the kernel's process
        pip_code = (
            "import sys, subprocess\n"
            f"try:\n"
            f"    result = subprocess.run([sys.executable, '-m', 'pip', 'install'] + {repr(args)}, "
            f"capture_output=True, text=True, check=True)\n"
            f"    if result.stdout:\n"
            f"        print(result.stdout, end='')\n"
            f"    if result.stderr:\n"
            f"        print(result.stderr, end='', file=sys.stderr)\n"
            f"except subprocess.CalledProcessError as e:\n"
            f"    if e.stdout:\n"
            f"        print(e.stdout, end='')\n"
            f"    if e.stderr:\n"
            f"        print(e.stderr, end='', file=sys.stderr)\n"
            f"    print(f'pip install failed with return code {{e.returncode}}', file=sys.stderr)\n"
            f"    raise\n"
        )
        
        # If there are more lines, append them
        if len(lines) > 1:
            pip_code += '\n' + '\n'.join(lines[1:])
        
        return pip_code
    
    return code


def check_kernel_health(session_id: str) -> bool:
    """
    Check if a kernel is healthy.
    
    Args:
        session_id: Session identifier
        
    Returns:
        True if kernel is healthy, False otherwise
    """
    if session_id not in kernels:
        return False
    
    kernel_info = kernels[session_id]
    km = kernel_info.get('km')
    
    if not km:
        return False
    
    # Check if kernel process is alive
    if not km.is_alive():
        logger.warning(f"Kernel for session {session_id} is not alive")
        return False
    
    # Check error count - if too many errors, consider unhealthy
    error_count = kernel_info.get('error_count', 0)
    if error_count > 10:
        logger.warning(f"Kernel for session {session_id} has too many errors: {error_count}")
        return False
    
    return True


async def warmup_kernel(kc: BlockingKernelClient) -> bool:
    """
    Warmup kernel with a simple test execution.
    
    Args:
        kc: Kernel client
        
    Returns:
        True if warmup successful
    """
    try:
        # Execute a simple test
        msg_id = await asyncio.to_thread(kc.execute, "1+1", allow_stdin=False)
        
        # Wait for completion
        for _ in range(10):  # Max 10 attempts
            try:
                msg = await asyncio.wait_for(
                    asyncio.to_thread(kc.get_iopub_msg, timeout=0.1),
                    timeout=0.11
                )
                if msg.get('msg_type') == 'status' and msg.get('content', {}).get('execution_state') == 'idle':
                    return True
            except asyncio.TimeoutError:
                await asyncio.sleep(0.1)
                continue
        
        return False
    except Exception as e:
        logger.warning(f"Kernel warmup failed: {e}")
        return False


async def get_kernel(session_id: str, force_restart: bool = False) -> Dict[str, Any]:
    """
    Get or create a kernel for a session with health checks and graceful degradation.
    
    Args:
        session_id: Session identifier
        force_restart: Force restart even if kernel exists
        
    Returns:
        Dictionary with kernel info
    """
    # Check if we're at max kernels
    if len(kernels) >= Config.MAX_KERNELS:
        # Try to clean up old kernels first
        _cleanup_old_kernels()
        if len(kernels) >= Config.MAX_KERNELS:
            raise RuntimeError(f"Maximum number of kernels reached: {Config.MAX_KERNELS}")
    
    # Check existing kernel
    if session_id in kernels and not force_restart:
        kernel_info = kernels[session_id]
        
        # Check health
        if check_kernel_health(session_id):
            kernel_info['last_used'] = time.time()
            return kernel_info
        else:
            # Kernel is unhealthy, restart it
            logger.info(f"Kernel for session {session_id} is unhealthy, restarting")
            try:
                kc = kernel_info.get('kc')
                km = kernel_info.get('km')
                if kc:
                    kc.stop_channels()
                if km:
                    km.shutdown_kernel(now=True)
            except Exception as e:
                logger.warning(f"Error shutting down unhealthy kernel: {e}")
            del kernels[session_id]
            # Clean up lock if kernel is removed
            if session_id in kernel_locks:
                del kernel_locks[session_id]
    
    # Create new kernel with graceful error handling
    kernel_name = 'python3'
    agent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.exists(os.path.join(agent_dir, 'agent', 'uploads')):
        kernel_cwd = os.path.join(agent_dir, 'agent')
    elif os.path.exists(os.path.join(agent_dir, 'uploads')):
        kernel_cwd = agent_dir
    else:
        kernel_cwd = agent_dir
    
    km = None
    kc = None
    
    try:
        try:
            km = KernelManager(kernel_name=kernel_name)
            if hasattr(km, 'cwd'):
                km.cwd = kernel_cwd
            km.start_kernel()
        except Exception as e:
            logger.warning(f"Failed to start kernel {kernel_name}: {e}")
            # Try to find any available kernel
            from jupyter_client.kernelspec import KernelSpecManager
            ksm = KernelSpecManager()
            available_kernels = ksm.find_kernel_specs()
            if available_kernels:
                kernel_name = list(available_kernels.keys())[0]
                logger.info(f"Trying alternative kernel: {kernel_name}")
                km = KernelManager(kernel_name=kernel_name)
                if hasattr(km, 'cwd'):
                    km.cwd = kernel_cwd
                km.start_kernel()
            else:
                raise RuntimeError(
                    f"No Jupyter kernel found. Please install ipykernel:\n"
                    f"  python -m pip install ipykernel\n"
                    f"  python -m ipykernel install --user --name python3"
                ) from e
        
        kc = km.client()
        kc.start_channels()
        kc.wait_for_ready(timeout=5)
        
        # Warmup kernel
        warmup_success = await warmup_kernel(kc)
        if not warmup_success:
            logger.warning(f"Kernel warmup failed for session {session_id}, but continuing")
        
        # Set working directory
        try:
            agent_uploads_path = os.path.join(kernel_cwd, 'uploads')
            if os.path.exists(agent_uploads_path):
                kernel_cwd_escaped = kernel_cwd.replace('\\', '\\\\')
                setup_code = f"import os\nos.chdir(r'{kernel_cwd_escaped}')"
                kc.execute(setup_code, allow_stdin=False)
                # Use asyncio.sleep instead of time.sleep
                await asyncio.sleep(0.1)
        except Exception as e:
            logger.warning(f"Could not set kernel working directory: {e}")
        
        kernel_info = {
            'km': km,
            'kc': kc,
            'last_used': time.time(),
            'created_at': time.time(),
            'error_count': 0,
            'is_healthy': True
        }
        
        kernels[session_id] = kernel_info
        get_metrics().gauge('kernels.active', len(kernels))
        logger.info(f"Created new kernel for session {session_id}")
        
        return kernel_info
    
    except Exception as e:
        # Cleanup on failure
        if kc:
            try:
                kc.stop_channels()
            except:
                pass
        if km:
            try:
                km.shutdown_kernel(now=True)
            except:
                pass
        logger.error(f"Failed to create kernel for session {session_id}: {e}")
        raise


def mark_kernel_error(session_id: str):
    """Mark a kernel as having an error."""
    if session_id in kernels:
        kernels[session_id]['error_count'] = kernels[session_id].get('error_count', 0) + 1
        kernels[session_id]['is_healthy'] = False
        get_metrics().increment('kernels.errors', tags={'session_id': session_id})


def reset_kernel_state(session_id: str):
    """Reset kernel error state after successful execution."""
    if session_id in kernels:
        kernels[session_id]['error_count'] = 0
        kernels[session_id]['is_healthy'] = True


async def shutdown_kernel(session_id: str):
    """Shutdown a kernel for a session and clean up locks."""
    if session_id in kernels:
        kernel_info = kernels[session_id]
        kc = kernel_info.get('kc')
        km = kernel_info.get('km')
        
        try:
            if kc:
                kc.stop_channels()
            if km:
                km.shutdown_kernel(now=True)
        except Exception as e:
            logger.warning(f"Error shutting down kernel for session {session_id}: {e}")
        
        del kernels[session_id]
        
        # Clean up lock
        if session_id in kernel_locks:
            del kernel_locks[session_id]
        
        get_metrics().gauge('kernels.active', len(kernels))
        logger.info(f"Shutdown kernel for session {session_id}")


async def shutdown_all_kernels():
    """Shutdown all kernels and clean up all locks."""
    session_ids = list(kernels.keys())
    for session_id in session_ids:
        await shutdown_kernel(session_id)
    
    # Clear all locks
    kernel_locks.clear()
    logger.info("All kernels and locks cleaned up")


def _cleanup_old_kernels():
    """Clean up old or idle kernels."""
    current_time = time.time()
    to_remove = []
    
    for session_id, kernel_info in kernels.items():
        last_used = kernel_info.get('last_used', 0)
        created_at = kernel_info.get('created_at', 0)
        
        # Check idle timeout
        if current_time - last_used > Config.KERNEL_IDLE_TIMEOUT:
            to_remove.append(session_id)
            logger.info(f"Removing idle kernel for session {session_id}")
        # Check max lifetime
        elif current_time - created_at > Config.KERNEL_MAX_LIFETIME:
            to_remove.append(session_id)
            logger.info(f"Removing expired kernel for session {session_id}")
    
    # Remove kernels
    for session_id in to_remove:
        asyncio.create_task(shutdown_kernel(session_id))


async def _cleanup_task_loop():
    """Background task for cleaning up old kernels."""
    while True:
        try:
            await asyncio.sleep(60)  # Run every minute
            _cleanup_old_kernels()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")


async def _health_check_task_loop():
    """Background task for health checking kernels."""
    while True:
        try:
            await asyncio.sleep(Config.KERNEL_HEALTH_CHECK_INTERVAL)
            
            for session_id in list(kernels.keys()):
                if not check_kernel_health(session_id):
                    logger.warning(f"Kernel {session_id} failed health check")
                    # Mark as unhealthy, will be restarted on next use
                    kernels[session_id]['is_healthy'] = False
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in health check task: {e}")


def start_background_tasks():
    """Start background cleanup and health check tasks."""
    global _cleanup_task, _health_check_task
    if _cleanup_task is None or _cleanup_task.done():
        _cleanup_task = asyncio.create_task(_cleanup_task_loop())
    if _health_check_task is None or _health_check_task.done():
        _health_check_task = asyncio.create_task(_health_check_task_loop())
    logger.info("Background tasks started")


def stop_background_tasks():
    """Stop background tasks."""
    global _cleanup_task, _health_check_task
    if _cleanup_task:
        _cleanup_task.cancel()
    if _health_check_task:
        _health_check_task.cancel()
    logger.info("Background tasks stopped")


def interrupt_kernel(session_id: str):
    """
    Interrupt a running kernel execution.
    
    Args:
        session_id: Session identifier
    """
    if session_id in kernels:
        kernel_info = kernels[session_id]
        kc = kernel_info.get('kc')
        
        if kc:
            try:
                kc.interrupt()
                logger.info(f"Interrupted kernel for session {session_id}")
            except Exception as e:
                logger.error(f"Error interrupting kernel: {e}")
                raise


def get_kernel_count() -> int:
    """Get current number of active kernels."""
    return len(kernels)


def get_healthy_kernel_count() -> int:
    """Get number of healthy kernels."""
    return sum(1 for k in kernels.values() if k.get('is_healthy', False))
