"""
Circuit Breaker Pattern for OpenAI API calls
Prevents wasting time on repeated failures when OpenAI is down
"""
import asyncio
import logging
import time
from typing import Callable, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker for API calls.
    
    - CLOSED: Normal operation, all requests go through
    - OPEN: Too many failures, reject requests immediately
    - HALF_OPEN: After timeout, allow one request to test if service recovered
    """
    
    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 60.0,
        expected_exception: type = Exception,
    ):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying again (HALF_OPEN)
            expected_exception: Exception type to catch
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitState.CLOSED
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection.
        
        Args:
            func: Async function to call
            *args, **kwargs: Arguments to pass to function
            
        Returns:
            Result from function
            
        Raises:
            Exception: If circuit is OPEN or function fails
        """
        async with self._lock:
            # Check if we should transition from OPEN to HALF_OPEN
            if self.state == CircuitState.OPEN:
                if self.last_failure_time and (time.time() - self.last_failure_time) >= self.recovery_timeout:
                    logger.info("Circuit breaker transitioning from OPEN to HALF_OPEN (testing recovery)")
                    self.state = CircuitState.HALF_OPEN
                else:
                    # Circuit is still open, reject immediately
                    raise Exception(
                        f"Circuit breaker is OPEN. Service is experiencing issues. "
                        f"Will retry in {self.recovery_timeout - (time.time() - self.last_failure_time):.0f}s"
                    )
        
        # Try to execute the function
        try:
            result = await func(*args, **kwargs)
            
            # Success! Reset failure count and close circuit
            async with self._lock:
                if self.state == CircuitState.HALF_OPEN:
                    logger.info("Circuit breaker: Service recovered, transitioning to CLOSED")
                self.failure_count = 0
                self.state = CircuitState.CLOSED
                self.last_failure_time = None
            
            return result
            
        except self.expected_exception as e:
            # Check if this is a permanent error (don't count towards circuit breaker)
            error_msg = str(e).lower()
            is_permanent_error = (
                "authentication" in error_msg or
                "api key" in error_msg or
                "invalid" in error_msg or
                "quota" in error_msg
            )
            
            if is_permanent_error:
                logger.error(f"Permanent error detected (not counted for circuit breaker): {e}")
                raise
            
            # Temporary error - count towards circuit breaker
            async with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                logger.warning(
                    f"Circuit breaker: Failure {self.failure_count}/{self.failure_threshold} - {e}"
                )
                
                # Check if we should open the circuit
                if self.failure_count >= self.failure_threshold:
                    self.state = CircuitState.OPEN
                    logger.error(
                        f"Circuit breaker OPENED after {self.failure_count} failures. "
                        f"Will retry in {self.recovery_timeout}s"
                    )
            
            raise
    
    def reset(self):
        """Manually reset the circuit breaker."""
        self.failure_count = 0
        self.state = CircuitState.CLOSED
        self.last_failure_time = None
        logger.info("Circuit breaker manually reset to CLOSED state")


# Global circuit breaker instance for OpenAI API
_openai_circuit_breaker: Optional[CircuitBreaker] = None


def get_openai_circuit_breaker() -> CircuitBreaker:
    """Get or create the global OpenAI circuit breaker."""
    global _openai_circuit_breaker
    if _openai_circuit_breaker is None:
        _openai_circuit_breaker = CircuitBreaker(
            failure_threshold=5,  # Open circuit after 5 consecutive failures
            recovery_timeout=120.0,  # Wait 2 minutes before testing recovery
            expected_exception=Exception,
        )
    return _openai_circuit_breaker
