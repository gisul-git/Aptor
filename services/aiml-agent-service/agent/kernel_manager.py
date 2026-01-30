"""
Kernel manager with kernel reuse and proper serialization.

Provides get_kernel() function that reuses kernels per session.
"""

import asyncio
import shlex
import time
from typing import Dict, Any, Optional
from jupyter_client import BlockingKernelClient, KernelManager
import nest_asyncio

# Enable nested event loops
nest_asyncio.apply()

# Global kernel storage: session_id -> {km, kc, last_used}
kernels: Dict[str, Dict[str, Any]] = {}

# Global locks for per-session serialization
kernel_locks: Dict[str, asyncio.Lock] = {}


def get_kernel_lock(session_id: str) -> asyncio.Lock:
    """Get or create an asyncio lock for a kernel session."""
    if session_id not in kernel_locks:
        kernel_locks[session_id] = asyncio.Lock()
    return kernel_locks[session_id]


def transform_pip(code: str) -> str:
    """
    Transform !pip install commands into Python code that runs inside the kernel.
    
    This ensures pip installs happen in the same process as the kernel,
    making packages immediately available for import.
    
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
        # Handle both 'pip install' and 'pip' (where install might be missing)
        if len(parts) >= 2 and parts[1] == "install":
            # Standard case: !pip install package1 package2
            args = parts[2:]  # Skip 'pip' and 'install'
        else:
            # Edge case: !pip package1 (no install subcommand)
            args = parts[1:]  # Just skip 'pip'
        
        # Build Python code that runs pip install in the kernel's process
        # Use sys.executable to ensure we use the same Python as the kernel
        # Capture output and print it manually because sys.stdout/stderr in Jupyter
        # kernels don't have fileno() and can't be passed directly to subprocess
        pip_code = (
            "import sys, subprocess\n"
            f"try:\n"
            f"    result = subprocess.run([sys.executable, '-m', 'pip', 'install'] + {repr(args)}, "
            f"capture_output=True, text=True, check=True)\n"
            f"    # Print captured output to kernel's stdout/stderr\n"
            f"    if result.stdout:\n"
            f"        print(result.stdout, end='')\n"
            f"    if result.stderr:\n"
            f"        print(result.stderr, end='', file=sys.stderr)\n"
            f"except subprocess.CalledProcessError as e:\n"
            f"    # Print error output if available\n"
            f"    if e.stdout:\n"
            f"        print(e.stdout, end='')\n"
            f"    if e.stderr:\n"
            f"        print(e.stderr, end='', file=sys.stderr)\n"
            f"    print(f'pip install failed with return code {{e.returncode}}', file=sys.stderr)\n"
            f"    raise\n"
        )
        
        # If there are more lines, append them (but don't process them as pip)
        if len(lines) > 1:
            pip_code += '\n' + '\n'.join(lines[1:])
        
        return pip_code
    
    return code


def get_kernel(session_id: str) -> Dict[str, Any]:
    """
    Get or create a kernel for a session.
    
    Reuses existing kernel if available. Creates new kernel if needed.
    Optimized for speed: kernels are cached and reused.
    
    Args:
        session_id: Session identifier
        
    Returns:
        Dictionary with 'km' (KernelManager), 'kc' (BlockingKernelClient), 'last_used' (timestamp)
    """
    if session_id in kernels:
        # Update last_used timestamp and return cached kernel
        kernels[session_id]['last_used'] = time.time()
        return kernels[session_id]
    
    # Create new kernel (only happens once per session)
    kernel_name = 'python3'
    
    # Set kernel working directory to agent directory (where uploads/ folder is)
    import os
    agent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.exists(os.path.join(agent_dir, 'agent', 'uploads')):
        kernel_cwd = os.path.join(agent_dir, 'agent')
    elif os.path.exists(os.path.join(agent_dir, 'uploads')):
        kernel_cwd = agent_dir
    else:
        kernel_cwd = agent_dir  # Default to project root
    
    try:
        km = KernelManager(kernel_name=kernel_name)
        # Set working directory for kernel
        if hasattr(km, 'cwd'):
            km.cwd = kernel_cwd
        km.start_kernel()
    except Exception as e:
        # Try to find any available kernel
        from jupyter_client.kernelspec import KernelSpecManager
        ksm = KernelSpecManager()
        available_kernels = ksm.find_kernel_specs()
        if available_kernels:
            kernel_name = list(available_kernels.keys())[0]
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
    # Use shorter timeout for faster startup (kernels usually ready quickly)
    kc.wait_for_ready(timeout=5)
    
    # Ensure kernel's working directory is set correctly
    # Execute code to change to agent directory if needed
    try:
        agent_uploads_path = os.path.join(kernel_cwd, 'uploads')
        if os.path.exists(agent_uploads_path):
            # Change kernel's working directory to agent directory
            # Use raw string and proper escaping for Windows paths
            kernel_cwd_escaped = kernel_cwd.replace('\\', '\\\\')
            setup_code = f"import os\nos.chdir(r'{kernel_cwd_escaped}')"
            kc.execute(setup_code, allow_stdin=False)
            # Wait a moment for it to execute - use time.sleep (synchronous)
            # time module is imported at top of file
            time.sleep(0.1)
    except Exception as e:
        print(f"[KernelManager] Warning: Could not set kernel working directory: {e}")
    
    kernel_info = {
        'km': km,
        'kc': kc,
        'last_used': time.time()
    }
    
    kernels[session_id] = kernel_info
    return kernel_info


async def shutdown_kernel(session_id: str):
    """Shutdown a kernel for a session."""
    if session_id in kernels:
        kernel_info = kernels[session_id]
        kc = kernel_info.get('kc')
        km = kernel_info.get('km')
        
        if kc:
            kc.stop_channels()
        if km:
            km.shutdown_kernel(now=True)
        
        del kernels[session_id]


async def shutdown_all_kernels():
    """Shutdown all kernels."""
    for session_id in list(kernels.keys()):
        await shutdown_kernel(session_id)


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
                # Send interrupt signal to kernel
                kc.interrupt()
                print(f"[KernelManager] Interrupted kernel for session {session_id}")
            except Exception as e:
                print(f"[KernelManager] Error interrupting kernel: {e}")
                raise

