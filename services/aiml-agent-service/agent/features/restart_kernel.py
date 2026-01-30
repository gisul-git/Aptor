"""
Restart kernel feature for agent.
Non-destructively adds restart functionality without modifying existing kernel_manager.
"""

from agent.kernel_manager import shutdown_kernel, get_kernel


async def restart_kernel(session_id: str) -> dict:
    """
    Restart kernel for a session (async version).
    
    This function:
    1. Shuts down the existing kernel
    2. Creates a new kernel (via get_kernel which will create if not exists)
    
    Args:
        session_id: Session identifier
        
    Returns:
        Dictionary with success status and message
    """
    try:
        # Shutdown existing kernel
        from agent.kernel_manager import shutdown_kernel
        await shutdown_kernel(session_id)
        
        # Small delay to ensure shutdown completes
        import asyncio
        await asyncio.sleep(0.1)
        
        # Get new kernel (will create if doesn't exist)
        get_kernel(session_id)
        
        return {
            'success': True,
            'message': f'Kernel restarted for session {session_id}'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Failed to restart kernel: {str(e)}'
        }

