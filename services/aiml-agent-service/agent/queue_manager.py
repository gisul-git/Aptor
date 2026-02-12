"""
Request queue management for execution requests.
"""

import asyncio
import time
import logging
from typing import Dict, Any, Optional, Callable
from collections import deque
from agent.config import Config
from agent.metrics import get_metrics

logger = logging.getLogger(__name__)

class QueueFullError(Exception):
    """Raised when queue is full."""
    pass

class QueueTimeoutError(Exception):
    """Raised when queue operation times out."""
    pass

class ExecutionQueue:
    """Queue for managing execution requests."""
    
    def __init__(self, max_size: int = None, timeout: int = None):
        self.max_size = max_size or Config.MAX_QUEUE_SIZE
        self.timeout = timeout or Config.QUEUE_TIMEOUT
        self.queue = asyncio.Queue(maxsize=self.max_size)
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.metrics = get_metrics()
    
    async def enqueue(self, session_id: str, run_id: str, execute_fn: Callable) -> Any:
        """
        Enqueue an execution request.
        
        Args:
            session_id: Session identifier
            run_id: Run identifier
            execute_fn: Async function to execute
            
        Returns:
            Execution result
            
        Raises:
            QueueFullError: If queue is full
            QueueTimeoutError: If operation times out
        """
        try:
            # Try to put in queue with timeout
            await asyncio.wait_for(
                self.queue.put((session_id, run_id, execute_fn)),
                timeout=self.timeout
            )
            self.metrics.increment('queue.enqueued', tags={'session_id': session_id})
        except asyncio.TimeoutError:
            self.metrics.increment('queue.enqueue_timeout')
            raise QueueTimeoutError(f"Queue enqueue timeout after {self.timeout}s")
        except Exception as e:
            self.metrics.increment('queue.enqueue_error')
            raise QueueFullError(f"Failed to enqueue: {e}")
        
        # Wait for execution to complete
        start_time = time.time()
        try:
            result = await execute_fn()
            elapsed = time.time() - start_time
            self.metrics.histogram('queue.execution_time', elapsed)
            self.metrics.increment('queue.completed', tags={'session_id': session_id})
            return result
        except Exception as e:
            self.metrics.increment('queue.execution_error', tags={'session_id': session_id})
            raise
    
    async def process_queue(self):
        """Process items from the queue (background task)."""
        while True:
            try:
                session_id, run_id, execute_fn = await self.queue.get()
                
                # Create task for execution
                task = asyncio.create_task(execute_fn())
                self.active_tasks[run_id] = task
                
                try:
                    result = await task
                    self.metrics.increment('queue.processed', tags={'session_id': session_id})
                except Exception as e:
                    logger.error(f"Queue execution error for {run_id}: {e}")
                    self.metrics.increment('queue.processing_error', tags={'session_id': session_id})
                finally:
                    self.active_tasks.pop(run_id, None)
                    self.queue.task_done()
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(1)  # Back off on error
    
    def get_queue_size(self) -> int:
        """Get current queue size."""
        return self.queue.qsize()
    
    def get_active_count(self) -> int:
        """Get number of active executions."""
        return len(self.active_tasks)

# Global queue instance
_queue: Optional[ExecutionQueue] = None

def get_queue() -> ExecutionQueue:
    """Get global queue instance."""
    global _queue
    if _queue is None:
        _queue = ExecutionQueue()
    return _queue

