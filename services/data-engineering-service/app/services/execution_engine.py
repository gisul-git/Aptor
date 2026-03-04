"""
Docker-based code execution engine service.
"""

import asyncio
import docker
import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import structlog
import psutil
from contextlib import asynccontextmanager
from enum import Enum

from app.models.execution import (
    ExecutionResult, 
    ExecutionStatus, 
    ExecutionMode, 
    ValidationResult,
    ValidationError,
    CodeReview
)
from app.core.config import settings
from app.core.redis_client import get_redis, JobQueue, CacheManager

logger = structlog.get_logger()


class SecurityViolationType(Enum):
    """Types of security violations that can be detected."""
    RESOURCE_LIMIT_EXCEEDED = "resource_limit_exceeded"
    EXECUTION_TIMEOUT = "execution_timeout"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    CONTAINER_ESCAPE_ATTEMPT = "container_escape_attempt"
    NETWORK_ACCESS_ATTEMPT = "network_access_attempt"


class SecurityMonitor:
    """Monitors and logs security violations during code execution."""
    
    def __init__(self):
        self.logger = logger.bind(component="security_monitor")
        self.violations: List[Dict[str, Any]] = []
    
    async def log_violation(self, violation_type: SecurityViolationType, 
                          job_id: str, user_id: Optional[str], 
                          details: Dict[str, Any]) -> None:
        """Log a security violation."""
        violation = {
            'timestamp': datetime.utcnow().isoformat(),
            'violation_type': violation_type.value,
            'job_id': job_id,
            'user_id': user_id,
            'details': details
        }
        
        self.violations.append(violation)
        
        # Log to structured logger
        self.logger.warning("Security violation detected",
                          violation_type=violation_type.value,
                          job_id=job_id,
                          user_id=user_id,
                          details=details)
        
        # Store in Redis for monitoring dashboard
        try:
            redis_client = await get_redis()
            violation_key = f"security_violations:{datetime.utcnow().strftime('%Y-%m-%d')}"
            await redis_client.lpush(violation_key, json.dumps(violation, default=str))
            await redis_client.expire(violation_key, 86400 * 7)  # Keep for 7 days
        except Exception as e:
            self.logger.error("Failed to store security violation", error=str(e))
    
    async def get_recent_violations(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent security violations."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return [
            v for v in self.violations 
            if datetime.fromisoformat(v['timestamp']) > cutoff_time
        ]
    
    async def check_resource_violation(self, job_id: str, user_id: Optional[str], 
                                     resource_stats: Dict[str, float]) -> None:
        """Check for resource limit violations."""
        if resource_stats.get('memory_percent', 0) > 95:
            await self.log_violation(
                SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                job_id, user_id,
                {'resource': 'memory', 'usage_percent': resource_stats['memory_percent']}
            )
        
        if resource_stats.get('cpu_percent', 0) > 95:
            await self.log_violation(
                SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                job_id, user_id,
                {'resource': 'cpu', 'usage_percent': resource_stats['cpu_percent']}
            )


class ResourcePool:
    """Manages a pool of container resources for concurrent execution."""
    
    def __init__(self, max_concurrent_containers: int = 5):
        self.max_concurrent = max_concurrent_containers
        self.active_containers: Dict[str, Dict[str, Any]] = {}
        self.resource_usage: Dict[str, float] = {
            'total_memory_mb': 0.0,
            'total_cpu_percent': 0.0
        }
        self.logger = logger.bind(component="resource_pool")
    
    async def can_allocate_container(self) -> bool:
        """Check if a new container can be allocated."""
        if len(self.active_containers) >= self.max_concurrent:
            self.logger.info("Container limit reached", 
                           active=len(self.active_containers),
                           max_concurrent=self.max_concurrent)
            return False
        
        # Check system resources
        system_resources = self._get_system_resources()
        if system_resources['memory_percent'] > 80 or system_resources['cpu_percent'] > 80:
            self.logger.info("System resources too high for new container",
                           memory_percent=system_resources['memory_percent'],
                           cpu_percent=system_resources['cpu_percent'])
            return False
        
        return True
    
    async def allocate_container(self, job_id: str, user_id: Optional[str]) -> bool:
        """Allocate a container slot for a job."""
        if not await self.can_allocate_container():
            return False
        
        self.active_containers[job_id] = {
            'user_id': user_id,
            'allocated_at': datetime.utcnow(),
            'memory_mb': 0.0,
            'cpu_percent': 0.0
        }
        
        self.logger.info("Container allocated", 
                        job_id=job_id, 
                        active_count=len(self.active_containers))
        return True
    
    async def deallocate_container(self, job_id: str) -> None:
        """Deallocate a container slot."""
        if job_id in self.active_containers:
            container_info = self.active_containers.pop(job_id)
            
            # Update resource usage
            self.resource_usage['total_memory_mb'] -= container_info.get('memory_mb', 0.0)
            self.resource_usage['total_cpu_percent'] -= container_info.get('cpu_percent', 0.0)
            
            self.logger.info("Container deallocated", 
                           job_id=job_id, 
                           active_count=len(self.active_containers))
    
    async def update_container_usage(self, job_id: str, resource_stats: Dict[str, float]) -> None:
        """Update resource usage for a container."""
        if job_id in self.active_containers:
            old_memory = self.active_containers[job_id].get('memory_mb', 0.0)
            old_cpu = self.active_containers[job_id].get('cpu_percent', 0.0)
            
            new_memory = resource_stats.get('memory_usage_mb', 0.0)
            new_cpu = resource_stats.get('cpu_percent', 0.0)
            
            # Update container info
            self.active_containers[job_id]['memory_mb'] = new_memory
            self.active_containers[job_id]['cpu_percent'] = new_cpu
            
            # Update total usage
            self.resource_usage['total_memory_mb'] += (new_memory - old_memory)
            self.resource_usage['total_cpu_percent'] += (new_cpu - old_cpu)
    
    def _get_system_resources(self) -> Dict[str, float]:
        """Get current system resource usage."""
        try:
            return {
                'cpu_percent': psutil.cpu_percent(interval=0.1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent
            }
        except Exception:
            return {'cpu_percent': 0.0, 'memory_percent': 0.0, 'disk_percent': 0.0}
    
    async def get_pool_status(self) -> Dict[str, Any]:
        """Get current pool status."""
        return {
            'active_containers': len(self.active_containers),
            'max_concurrent': self.max_concurrent,
            'available_slots': self.max_concurrent - len(self.active_containers),
            'total_memory_usage_mb': self.resource_usage['total_memory_mb'],
            'total_cpu_usage_percent': self.resource_usage['total_cpu_percent'],
            'system_resources': self._get_system_resources()
        }


class ContainerResourceManager:
    """Manages Docker container resources and limits."""
    
    def __init__(self):
        self.active_containers: Dict[str, docker.models.containers.Container] = {}
        self.resource_usage: Dict[str, Dict[str, float]] = {}
        self.logger = logger.bind(component="resource_manager")
    
    def get_resource_limits(self) -> Dict[str, Any]:
        """Get container resource limits from configuration."""
        return {
            'mem_limit': settings.CONTAINER_MEMORY_LIMIT,
            'cpu_quota': int(float(settings.CONTAINER_CPU_LIMIT) * 100000),
            'cpu_period': 100000,
            'pids_limit': 100,  # Limit number of processes
            'ulimits': [
                docker.types.Ulimit(name='nofile', soft=1024, hard=1024),  # File descriptors
                docker.types.Ulimit(name='nproc', soft=50, hard=50),       # Processes
            ]
        }
    
    def get_security_options(self) -> Dict[str, Any]:
        """Get container security options for isolation."""
        return {
            'security_opt': [
                'no-new-privileges:true',  # Prevent privilege escalation
                'seccomp=unconfined'       # Allow syscalls needed by Spark
            ],
            'cap_drop': ['ALL'],           # Drop all capabilities
            'cap_add': ['SETUID', 'SETGID'],  # Only allow user switching
            'read_only': False,            # Allow writes to /tmp and /execution
            'tmpfs': {
                '/tmp': 'noexec,nosuid,size=100m',  # Temporary files
                '/var/tmp': 'noexec,nosuid,size=50m'
            },
            'network_mode': 'none'         # No network access
        }
    
    def monitor_container_resources(self, container: docker.models.containers.Container) -> Dict[str, float]:
        """Monitor container resource usage."""
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU usage percentage
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                       stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                          stats['precpu_stats']['system_cpu_usage']
            
            # Avoid division by zero
            if system_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage']['percpu_usage']) * 100.0
            else:
                cpu_percent = 0.0
            
            # Calculate memory usage in MB
            memory_usage = stats['memory_stats']['usage'] / (1024 * 1024)
            memory_limit = stats['memory_stats']['limit'] / (1024 * 1024)
            
            return {
                'cpu_percent': min(cpu_percent, 100.0),
                'memory_usage_mb': memory_usage,
                'memory_limit_mb': memory_limit,
                'memory_percent': (memory_usage / memory_limit) * 100.0
            }
        except Exception as e:
            self.logger.warning("Failed to get container stats", error=str(e))
            return {'cpu_percent': 0.0, 'memory_usage_mb': 0.0, 'memory_limit_mb': 0.0, 'memory_percent': 0.0}


class ExecutionEngine:
    """Docker-based PySpark code execution engine with resource management and security."""
    
    def __init__(self):
        self.docker_client = None
        self.resource_manager = ContainerResourceManager()
        self.resource_pool = ResourcePool(max_concurrent_containers=5)  # Fixed to use integer
        self.security_monitor = SecurityMonitor()
        self.logger = logger.bind(service="execution_engine")
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.job_queue_processor_running = False
        
        # Initialize Docker client lazily
        self._docker_initialized = False
    
    def _initialize_docker(self):
        """Initialize Docker client and ensure executor image is available."""
        if self._docker_initialized:
            return
        
        try:
            from app.services.docker_unix_client import DockerUnixClient
            
            # Use our custom Docker client that works with Unix sockets
            self.docker_unix_client = DockerUnixClient(socket_path='/var/run/docker.sock')
            
            # Test the connection
            try:
                ping_result = self.docker_unix_client.ping()
                if not ping_result:
                    self.logger.warning("Docker ping returned False, but continuing anyway")
            except Exception as ping_error:
                self.logger.warning("Docker ping failed, but will try to continue", error=str(ping_error))
            
            # Try to get version info to verify connection
            try:
                version_info = self.docker_unix_client.version()
                self.logger.info("Docker Unix client initialized successfully", version=version_info.get('Version'))
            except Exception as version_error:
                self.logger.error("Failed to get Docker version", error=str(version_error))
                raise RuntimeError(f"Failed to connect to Docker daemon: {str(version_error)}")
            
            # Set flag to indicate we're using the custom client
            self.docker_client = self.docker_unix_client
            self._docker_initialized = True
            self._using_custom_client = True
            
            self._ensure_executor_image()
            self.logger.info("Docker client initialized successfully with custom Unix socket client")
            
        except Exception as e:
            self.logger.error("Failed to initialize Docker client", error=str(e), exc_info=True)
            # Don't raise exception, allow fallback execution
            self.docker_client = None
            self._docker_initialized = False
            self._using_custom_client = False
    
    def _ensure_executor_image(self):
        """Ensure the PySpark executor Docker image is available."""
        if not self.docker_client:
            return
            
        try:
            if hasattr(self, '_using_custom_client') and self._using_custom_client:
                # Using custom Unix socket client
                self.docker_unix_client.inspect_image(settings.EXECUTION_IMAGE)
                self.logger.info("PySpark executor image found", image=settings.EXECUTION_IMAGE)
            else:
                # Using standard docker-py client
                self.docker_client.images.get(settings.EXECUTION_IMAGE)
                self.logger.info("PySpark executor image found", image=settings.EXECUTION_IMAGE)
        except Exception as e:
            self.logger.warning("PySpark executor image not found", image=settings.EXECUTION_IMAGE, error=str(e))
            # In production, this should be pre-built
            # For now, we'll log and continue
            self.logger.info("Will attempt to use image anyway - it may be pulled on first use")
    
    async def execute_code(self, code: str, question_id: str, mode: str, user_id: Optional[str] = None) -> ExecutionResult:
        """Execute PySpark code in isolated Docker container with dual execution modes."""
        job_id = str(uuid.uuid4())
        start_time = time.time()
        
        print(f"DEBUG ENTRY: execute_code called with mode={mode}, job_id={job_id}", flush=True)
        
        # Convert string mode to ExecutionMode enum
        execution_mode = ExecutionMode(mode)
        
        print(f"DEBUG ENTRY: Converted to execution_mode={execution_mode}", flush=True)
        
        self.logger.info("Starting code execution", 
                        job_id=job_id, 
                        mode=execution_mode.value, 
                        user_id=user_id,
                        question_id=question_id)
        
        # Initialize Docker client if not already done
        try:
            self._initialize_docker()
            self.logger.info("Docker initialization completed", 
                           has_docker_client=bool(self.docker_client),
                           using_custom_client=getattr(self, '_using_custom_client', False))
        except RuntimeError as e:
            self.logger.error("Docker initialization failed", error=str(e))
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.FAILED,
                mode=execution_mode,
                output=None,
                error_message=str(e),
                execution_time=time.time() - start_time,
                memory_usage=0.0,
                validation_result=None,
                completed_at=datetime.utcnow()
            )
        
        # If Docker is not available, use fallback execution
        if not self.docker_client:
            self.logger.warning("Docker not available, using fallback execution", job_id=job_id)
            return await self._execute_fallback(job_id, code, question_id, execution_mode, start_time)
        
        self.logger.info("Proceeding with Docker execution", job_id=job_id)
        
        # Check if we can allocate resources for this job
        if not await self.resource_pool.can_allocate_container():
            # Queue the job for later execution
            job_data = {
                'job_id': job_id,
                'code': code,
                'question_id': question_id,
                'mode': execution_mode.value,
                'user_id': user_id,
                'queued_at': datetime.utcnow().isoformat()
            }
            
            await JobQueue.enqueue_job(job_data)
            
            self.logger.info("Job queued due to resource constraints", job_id=job_id)
            
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.QUEUED,
                mode=execution_mode,
                output=None,
                execution_time=0.0,
                memory_usage=0.0,
                validation_result=None,
                queued_at=datetime.utcnow()
            )
        
        # Allocate container resources
        if not await self.resource_pool.allocate_container(job_id, user_id):
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.FAILED,
                mode=execution_mode,
                output=None,
                error_message="Failed to allocate container resources",
                execution_time=time.time() - start_time,
                memory_usage=0.0,
                validation_result=None,
                completed_at=datetime.utcnow()
            )
        
        # Initialize job tracking
        self.active_jobs[job_id] = {
            'status': ExecutionStatus.PENDING,
            'start_time': start_time,
            'container_id': None,
            'user_id': user_id,
            'mode': execution_mode
        }
        
        try:
            # Create execution result with initial status
            result = ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.RUNNING,
                mode=execution_mode,
                output=None,
                execution_time=0.0,
                memory_usage=0.0,
                validation_result=None
            )
            
            # Update job status
            self.active_jobs[job_id]['status'] = ExecutionStatus.RUNNING
            
            # HYBRID APPROACH: Use pool for TEST mode, on-demand for SUBMIT mode
            use_pool = (execution_mode == ExecutionMode.TEST and 
                       settings.CONTAINER_POOL_ENABLED)
            
            print(f"DEBUG EXEC: mode={execution_mode}, pool_enabled={settings.CONTAINER_POOL_ENABLED}, use_pool={use_pool}", flush=True)
            
            if use_pool:
                self.logger.info("Using container pool for test mode", job_id=job_id)
                print(f"DEBUG EXEC: Will use container pool for job {job_id}", flush=True)
            else:
                self.logger.info("Using on-demand container for submit mode", job_id=job_id)
                print(f"DEBUG EXEC: Will use on-demand container for job {job_id}", flush=True)
            
            # Execute code in container with mode-specific configuration
            container_result = await self._execute_in_container(
                job_id, code, question_id, execution_mode, use_pool=use_pool
            )
            
            # Update result with container execution data
            result.status = container_result['status']
            result.output = container_result.get('output')
            result.error_message = container_result.get('error_message')
            result.execution_time = time.time() - start_time
            result.memory_usage = container_result.get('memory_usage', 0.0)
            result.completed_at = datetime.utcnow()
            
            # Check for security violations
            if container_result.get('resource_stats'):
                await self.security_monitor.check_resource_violation(
                    job_id, user_id, container_result['resource_stats']
                )
            
            # Log timeout violations
            if result.status == ExecutionStatus.TIMEOUT:
                await self.security_monitor.log_violation(
                    SecurityViolationType.EXECUTION_TIMEOUT,
                    job_id, user_id,
                    {'execution_time': result.execution_time, 'timeout_limit': settings.CONTAINER_TIMEOUT}
                )
            
            # Perform validation if execution was successful
            if result.status == ExecutionStatus.COMPLETED and result.output:
                result.validation_result = await self._validate_output(result.output, question_id, execution_mode)
            
            # Handle mode-specific post-processing
            if execution_mode == ExecutionMode.SUBMIT and result.status == ExecutionStatus.COMPLETED:
                # For submit mode, trigger AI code review if validation passes
                if result.validation_result and result.validation_result.is_correct:
                    result.ai_review = await self._perform_ai_code_review(code, question_id, result)
                
                # Store solution permanently for submit mode
                await self._store_solution(job_id, user_id, question_id, code, result)
            
            # For test mode, results are temporary and not stored permanently
            if execution_mode == ExecutionMode.TEST:
                # Cache result temporarily for quick retrieval
                cache_key = f"test_result:{job_id}"
                await CacheManager.set_cache(cache_key, result.model_dump(), ttl=300)  # 5 minutes
            
            self.logger.info("Code execution completed", 
                           job_id=job_id, 
                           status=result.status,
                           mode=execution_mode.value,
                           execution_time=result.execution_time)
            
            return result
            
        except Exception as e:
            self.logger.error("Code execution failed", job_id=job_id, error=str(e))
            
            # Clean up on error
            if job_id in self.active_jobs:
                container_id = self.active_jobs[job_id].get('container_id')
                if container_id:
                    await self._cleanup_container(container_id)
            
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.FAILED,
                mode=execution_mode,
                output=None,
                error_message=f"Execution failed: {str(e)}",
                execution_time=time.time() - start_time,
                memory_usage=0.0,
                validation_result=None,
                completed_at=datetime.utcnow()
            )
        
        finally:
            # Clean up job tracking and deallocate resources
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            await self.resource_pool.deallocate_container(job_id)
    
    async def _execute_fallback(self, job_id: str, code: str, question_id: str, execution_mode: ExecutionMode, start_time: float) -> ExecutionResult:
        """Fallback execution method when Docker is not available."""
        self.logger.info("Using fallback execution (no Docker)", job_id=job_id)
        
        try:
            # Create a simple mock execution result for testing
            # In a real scenario, you might want to use a different execution method
            import json
            import tempfile
            import subprocess
            import sys
            
            # Create temporary file for code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                # Write a simple wrapper that captures output
                wrapper_code = f'''
import sys
import json
import traceback
from datetime import datetime
from io import StringIO

# Capture stdout
old_stdout = sys.stdout
sys.stdout = captured_output = StringIO()

try:
    # Create execution globals
    exec_globals = {{'__name__': '__main__'}}
    
    # User code (properly indented)
    exec("""{code}""", exec_globals)
    
    # Restore stdout and get captured output
    sys.stdout = old_stdout
    output_text = captured_output.getvalue()
    
    # Try to extract result variable
    result_data = exec_globals.get('result', None)
    
    # Convert result to serializable format if possible
    if result_data is not None:
        try:
            # Try to convert to list/dict format
            if hasattr(result_data, 'to_dict'):
                result_data = result_data.to_dict('records')
            elif hasattr(result_data, '__iter__') and not isinstance(result_data, (str, dict)):
                result_data = list(result_data)
        except:
            # If conversion fails, convert to string representation
            result_data = str(result_data)
    
    # Create result
    result = {{
        'stdout': output_text,
        'result': result_data,
        'status': 'success',
        'timestamp': datetime.utcnow().isoformat()
    }}
    
    print(json.dumps(result, default=str))
    
except Exception as e:
    sys.stdout = old_stdout
    error_result = {{
        'error': str(e),
        'error_type': type(e).__name__,
        'traceback': traceback.format_exc(),
        'status': 'error',
        'timestamp': datetime.utcnow().isoformat()
    }}
    print(json.dumps(error_result, default=str))
'''
                f.write(wrapper_code)
                temp_file = f.name
            
            # Execute with timeout
            try:
                result = subprocess.run(
                    [sys.executable, temp_file],
                    capture_output=True,
                    text=True,
                    timeout=30  # 30 second timeout for fallback
                )
                
                if result.returncode == 0:
                    try:
                        output_data = json.loads(result.stdout)
                        return ExecutionResult(
                            job_id=job_id,
                            status=ExecutionStatus.COMPLETED,
                            mode=execution_mode,
                            output=output_data,
                            execution_time=time.time() - start_time,
                            memory_usage=0.0,  # Can't measure in fallback mode
                            validation_result=None,
                            completed_at=datetime.utcnow()
                        )
                    except json.JSONDecodeError:
                        return ExecutionResult(
                            job_id=job_id,
                            status=ExecutionStatus.FAILED,
                            mode=execution_mode,
                            output=None,
                            error_message=f"Failed to parse execution output: {result.stdout}",
                            execution_time=time.time() - start_time,
                            memory_usage=0.0,
                            validation_result=None,
                            completed_at=datetime.utcnow()
                        )
                else:
                    return ExecutionResult(
                        job_id=job_id,
                        status=ExecutionStatus.FAILED,
                        mode=execution_mode,
                        output=None,
                        error_message=f"Execution failed: {result.stderr}",
                        execution_time=time.time() - start_time,
                        memory_usage=0.0,
                        validation_result=None,
                        completed_at=datetime.utcnow()
                    )
                    
            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    job_id=job_id,
                    status=ExecutionStatus.TIMEOUT,
                    mode=execution_mode,
                    output=None,
                    error_message="Execution timed out (fallback mode)",
                    execution_time=time.time() - start_time,
                    memory_usage=0.0,
                    validation_result=None,
                    completed_at=datetime.utcnow()
                )
            finally:
                # Clean up temp file
                try:
                    import os
                    os.unlink(temp_file)
                except:
                    pass
                    
        except Exception as e:
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus.FAILED,
                mode=execution_mode,
                output=None,
                error_message=f"Fallback execution failed: {str(e)}",
                execution_time=time.time() - start_time,
                memory_usage=0.0,
                validation_result=None,
                completed_at=datetime.utcnow()
            )

    async def _execute_in_container(self, job_id: str, code: str, question_id: str, execution_mode: ExecutionMode, use_pool: bool = False) -> Dict[str, Any]:
        """Execute code in a Docker container with security and resource controls."""
        container_id = None
        temp_dir = None
        pool_container_info = None
        
        try:
            self.logger.info("Fetching question for code execution", question_id=question_id, job_id=job_id)
            
            # Get question to inject input data
            from app.repositories.question_repository import QuestionRepository
            question_repo = QuestionRepository()
            question = await question_repo.get_question_by_id(question_id)
            
            if question:
                self.logger.info("Question fetched successfully", 
                               question_id=question_id, 
                               has_sample_input=bool(question.sample_input))
            else:
                self.logger.warning("Question not found", question_id=question_id)
            
            # Prepare code with input data injection
            prepared_code = await self._prepare_code_with_input(code, question)
            
            # Create temporary directory in shared volume for Docker-in-Docker
            # Use /tmp/execution which is mounted as a shared volume
            shared_exec_dir = "/tmp/execution"
            
            # Ensure the shared directory exists with proper permissions
            try:
                os.makedirs(shared_exec_dir, mode=0o777, exist_ok=True)
            except PermissionError:
                # If we can't create it, it might already exist - try to use it anyway
                pass
            
            # Create temp directory manually with world-writable permissions
            # This ensures sparkuser can write to it
            import random
            import string
            random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
            temp_dir = os.path.join(shared_exec_dir, f"exec_{job_id}_{random_suffix}")
            os.makedirs(temp_dir, mode=0o777, exist_ok=False)
            
            self.logger.info("Created temp directory", temp_dir=temp_dir, permissions=oct(os.stat(temp_dir).st_mode))
            
            # Use the default filenames that the wrapper expects
            code_file = os.path.join(temp_dir, "user_code.py")
            output_file = os.path.join(temp_dir, "output.json")
            
            # Write prepared code to file with UTF-8 encoding
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(prepared_code)
            
            # Make files readable/writable by all (needed for Docker-in-Docker)
            os.chmod(code_file, 0o666)
            
            self.logger.info("Created code file", code_file=code_file, permissions=oct(os.stat(code_file).st_mode))
            
            # HYBRID APPROACH: Try to use pool for TEST mode
            if use_pool:
                print(f"DEBUG POOL: Attempting to get container from pool for job {job_id}", flush=True)
                try:
                    from app.services.container_pool import get_container_pool
                    
                    print(f"DEBUG POOL: Getting pool instance...", flush=True)
                    pool = await get_container_pool()
                    print(f"DEBUG POOL: Pool instance obtained, getting container with timeout {settings.CONTAINER_POOL_GET_TIMEOUT}s", flush=True)
                    pool_container_info = await pool.get_container(timeout=settings.CONTAINER_POOL_GET_TIMEOUT)
                    
                    if pool_container_info:
                        print(f"DEBUG POOL: Got container {pool_container_info['container_id'][:12]} from pool!", flush=True)
                        self.logger.info("Using pooled container", 
                                       container_id=pool_container_info['container_id'][:12],
                                       job_id=job_id)
                        
                        # Execute in pooled container
                        return await self._execute_in_pooled_container(
                            job_id, pool_container_info, code_file, output_file, execution_mode
                        )
                    else:
                        print(f"DEBUG POOL: pool.get_container() returned None - pool exhausted", flush=True)
                        self.logger.warning("Pool exhausted, falling back to on-demand container", job_id=job_id)
                        
                except Exception as e:
                    print(f"DEBUG POOL: Exception getting container from pool: {e}", flush=True)
                    self.logger.error("Failed to use container pool, falling back to on-demand",
                                    error=str(e), job_id=job_id)
            
            # Fall through to on-demand container creation
            # Check if using custom client
            if hasattr(self, '_using_custom_client') and self._using_custom_client:
                # Use custom Docker Unix client
                return await self._execute_with_custom_client(
                    job_id, temp_dir, output_file, execution_mode
                )
            else:
                # Use standard docker-py client (original implementation)
                return await self._execute_with_standard_client(
                    job_id, temp_dir, output_file, execution_mode
                )
        
        finally:
            # Clean up temporary files
            if temp_dir and os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    async def _execute_with_custom_client(self, job_id: str, temp_dir: str, output_file: str, execution_mode: ExecutionMode) -> Dict[str, Any]:
        """Execute code using custom Docker Unix client."""
        container_id = None
        
        try:
            # Get resource limits
            resource_limits = self.resource_manager.get_resource_limits()
            
            # Extract the subdirectory name from temp_dir
            # temp_dir is like /tmp/execution/exec_XXX
            subdir = os.path.basename(temp_dir)
            
            # The volume is mounted at /var/lib/docker/volumes/data-engineering-service_execution_temp/_data on the host
            # We need to mount the subdirectory from the volume
            volume_path = f"/var/lib/docker/volumes/data-engineering-service_execution_temp/_data/{subdir}"
            
            self.logger.info("Preparing container", 
                           temp_dir=temp_dir,
                           subdir=subdir,
                           volume_path=volume_path,
                           job_id=job_id)
            
            # Build container configuration
            # Mount the temp directory from the volume to /execution
            container_config = {
                'Image': settings.EXECUTION_IMAGE,
                'Cmd': ['python3', '/usr/local/bin/execution_wrapper.py'],
                'WorkingDir': '/execution',
                'User': '0:0',  # Run as root to match backend container permissions
                'HostConfig': {
                    # Mount the subdirectory from the volume to /execution
                    'Binds': [f'{volume_path}:/execution:rw'],
                    'Memory': self._parse_memory_limit(resource_limits.get('mem_limit', '2g')),
                    'CpuQuota': resource_limits.get('cpu_quota', 100000),
                    'CpuPeriod': resource_limits.get('cpu_period', 100000),
                    'PidsLimit': resource_limits.get('pids_limit', 100),
                    'NetworkMode': 'none',
                    'AutoRemove': False
                }
            }
            
            self.logger.info("Creating container", 
                           volume_path=volume_path,
                           mount_point="/execution")
            
            # Create container
            create_response = self.docker_unix_client.create_container(container_config)
            container_id = create_response['Id']
            
            self.logger.info("Container created", container_id=container_id[:12])
            
            # Update job tracking
            self.active_jobs[job_id]['container_id'] = container_id
            
            # Start container
            self.docker_unix_client.start_container(container_id)
            self.logger.info("Container started", container_id=container_id[:12])
            
            # Wait for container with timeout
            try:
                wait_result = self.docker_unix_client.wait_container(
                    container_id,
                    timeout=settings.CONTAINER_TIMEOUT
                )
                exit_code = wait_result.get('StatusCode', 1)
                
                # Get logs
                logs_bytes = self.docker_unix_client.get_container_logs(container_id, stdout=True, stderr=True)
                logs = logs_bytes.decode('utf-8', errors='replace')
                
                self.logger.info("Container finished", container_id=container_id[:12], exit_code=exit_code)
                
                # Get resource stats
                try:
                    stats = self.docker_unix_client.get_container_stats(container_id, stream=False)
                    memory_usage_mb = stats.get('memory_stats', {}).get('usage', 0) / (1024 * 1024)
                except Exception as e:
                    self.logger.warning("Failed to get container stats", error=str(e))
                    memory_usage_mb = 0.0
                
                if exit_code == 0:
                    # Try to read output file
                    if os.path.exists(output_file):
                        with open(output_file, 'r', encoding='utf-8') as f:
                            output_data = json.load(f)
                        
                        return {
                            'status': ExecutionStatus.COMPLETED,
                            'output': output_data,
                            'memory_usage': memory_usage_mb,
                            'resource_stats': {'memory_usage_mb': memory_usage_mb},
                            'logs': logs
                        }
                    else:
                        return {
                            'status': ExecutionStatus.FAILED,
                            'error_message': f"No output produced. Logs: {logs}",
                            'memory_usage': memory_usage_mb,
                            'resource_stats': {'memory_usage_mb': memory_usage_mb}
                        }
                else:
                    # Check if output file exists even on error (execution wrapper writes errors to output.json)
                    if os.path.exists(output_file):
                        try:
                            with open(output_file, 'r', encoding='utf-8') as f:
                                output_data = json.load(f)
                            
                            # Extract the formatted error message from output
                            error_msg = output_data.get('error', 'Code execution failed')
                            
                            return {
                                'status': ExecutionStatus.FAILED,
                                'error_message': error_msg,
                                'memory_usage': memory_usage_mb,
                                'resource_stats': {'memory_usage_mb': memory_usage_mb},
                                'logs': logs
                            }
                        except Exception as e:
                            self.logger.warning("Failed to parse error output", error=str(e))
                            # Fall back to logs
                            return {
                                'status': ExecutionStatus.FAILED,
                                'error_message': f"Code execution failed with exit code {exit_code}. Logs: {logs}",
                                'memory_usage': memory_usage_mb,
                                'resource_stats': {'memory_usage_mb': memory_usage_mb}
                            }
                    else:
                        return {
                            'status': ExecutionStatus.FAILED,
                            'error_message': f"Code execution failed with exit code {exit_code}. Logs: {logs}",
                            'memory_usage': memory_usage_mb,
                            'resource_stats': {'memory_usage_mb': memory_usage_mb}
                        }
            
            except Exception as e:
                if "timeout" in str(e).lower():
                    return {
                        'status': ExecutionStatus.TIMEOUT,
                        'error_message': f"Execution timed out after {settings.CONTAINER_TIMEOUT} seconds",
                        'memory_usage': 0.0
                    }
                else:
                    return {
                        'status': ExecutionStatus.FAILED,
                        'error_message': f"Execution error: {str(e)}",
                        'memory_usage': 0.0
                    }
        
        finally:
            # Clean up container
            if container_id:
                try:
                    self.docker_unix_client.stop_container(container_id, timeout=5)
                except:
                    pass
                try:
                    self.docker_unix_client.remove_container(container_id, force=True)
                except:
                    pass
            
            # Remove from active containers
            if job_id in self.resource_manager.active_containers:
                del self.resource_manager.active_containers[job_id]
    
    async def _execute_in_pooled_container(self, job_id: str, pool_container_info: Dict[str, Any], 
                                          code_file: str, output_file: str, 
                                          execution_mode: ExecutionMode) -> Dict[str, Any]:
        """
        Execute code in a pooled container with Spark already initialized.
        Uses file-based communication to execute code in the same process where Spark is running.
        
        Args:
            job_id: Unique job identifier
            pool_container_info: Container info from pool
            code_file: Path to user code file
            output_file: Path to output file
            execution_mode: Execution mode (TEST/SUBMIT)
            
        Returns:
            Execution result dictionary
        """
        container_id = pool_container_info['container_id']
        
        try:
            self.logger.info("Executing in pooled container",
                           container_id=container_id[:12],
                           job_id=job_id,
                           executions=pool_container_info['executions'])
            
            # Copy code file to container's execution directory
            import shutil
            temp_dir = pool_container_info['temp_dir']
            pool_code_file = os.path.join(temp_dir, "user_code.py")
            pool_output_file = os.path.join(temp_dir, "output.json")
            trigger_file = os.path.join(temp_dir, "execute.trigger")
            
            # Clean up any previous output
            if os.path.exists(pool_output_file):
                os.remove(pool_output_file)
            
            # Copy the code file
            shutil.copy2(code_file, pool_code_file)
            os.chmod(pool_code_file, 0o666)
            
            # Create trigger file to signal execution
            with open(trigger_file, 'w') as f:
                f.write(str(time.time()))
            os.chmod(trigger_file, 0o666)
            
            # Start timing
            start_time = time.time()
            
            # Wait for output file to appear
            max_wait = settings.CONTAINER_TIMEOUT
            waited = 0
            poll_interval = 0.05  # Reduced from 0.1s to 50ms for faster response
            
            while waited < max_wait:
                # Check if output file exists
                if os.path.exists(pool_output_file):
                    break
                
                await asyncio.sleep(poll_interval)
                waited += poll_interval
            
            execution_time = time.time() - start_time
            
            # Read output
            if os.path.exists(pool_output_file):
                with open(pool_output_file, 'r', encoding='utf-8') as f:
                    output_data = json.load(f)
                
                if output_data.get('status') == 'success':
                    result = {
                        'status': ExecutionStatus.COMPLETED,
                        'output': output_data,
                        'memory_usage': output_data.get('memory_usage_mb', 0.0),
                        'resource_stats': {'memory_usage_mb': output_data.get('memory_usage_mb', 0.0)},
                        'execution_time': execution_time,
                        'used_pool': True
                    }
                else:
                    result = {
                        'status': ExecutionStatus.FAILED,
                        'error_message': output_data.get('error', 'Execution failed'),
                        'memory_usage': output_data.get('memory_usage_mb', 0.0),
                        'resource_stats': {'memory_usage_mb': output_data.get('memory_usage_mb', 0.0)},
                        'execution_time': execution_time,
                        'used_pool': True
                    }
                
                self.logger.info("Pooled container execution completed",
                               container_id=container_id[:12],
                               job_id=job_id,
                               status=result['status'],
                               execution_time=f"{execution_time:.2f}s")
                
                return result
                
            else:
                # Timeout
                return {
                    'status': ExecutionStatus.TIMEOUT,
                    'error_message': f"Execution timed out after {settings.CONTAINER_TIMEOUT} seconds",
                    'memory_usage': 0.0,
                    'execution_time': execution_time,
                    'used_pool': True
                }
                
        except Exception as e:
            execution_time = time.time() - start_time if 'start_time' in locals() else 0.0
            return {
                'status': ExecutionStatus.FAILED,
                'error_message': f"Execution error: {str(e)}",
                'memory_usage': 0.0,
                'execution_time': execution_time,
                'used_pool': True
            }
            
        finally:
            # Return container to pool
            try:
                from app.services.container_pool import get_container_pool
                pool = await get_container_pool()
                await pool.return_container(pool_container_info)
                self.logger.info("Container returned to pool", 
                               container_id=container_id[:12],
                               job_id=job_id)
            except Exception as e:
                self.logger.error("Failed to return container to pool",
                                container_id=container_id[:12],
                                error=str(e))
    
    def _parse_memory_limit(self, mem_limit_str: str) -> int:
        """Parse memory limit string (e.g., '2g', '512m') to bytes."""
        if isinstance(mem_limit_str, int):
            return mem_limit_str
        
        mem_limit_str = mem_limit_str.lower().strip()
        if mem_limit_str.endswith('g'):
            return int(float(mem_limit_str[:-1]) * 1024 * 1024 * 1024)
        elif mem_limit_str.endswith('m'):
            return int(float(mem_limit_str[:-1]) * 1024 * 1024)
        elif mem_limit_str.endswith('k'):
            return int(float(mem_limit_str[:-1]) * 1024)
        else:
            return int(mem_limit_str)
    
    async def _execute_with_standard_client(self, job_id: str, temp_dir: str, output_file: str, execution_mode: ExecutionMode) -> Dict[str, Any]:
        """Execute code using standard docker-py client (fallback)."""
        container = None
        
        try:
            # Get resource limits and security options
            resource_limits = self.resource_manager.get_resource_limits()
            security_options = self.resource_manager.get_security_options()
            
            # Create and start container with the PySpark executor image
            container = self.docker_client.containers.run(
                image=settings.EXECUTION_IMAGE,
                command=["python3", "/usr/local/bin/execution_wrapper.py"],
                volumes={temp_dir: {'bind': '/execution', 'mode': 'rw'}},
                working_dir='/execution',
                detach=True,
                remove=False,  # We'll remove manually after getting logs
                stdout=True,
                stderr=True,
                **resource_limits,
                **security_options
            )
            
            # Update job tracking with container ID
            self.active_jobs[job_id]['container_id'] = container.id
            self.resource_manager.active_containers[job_id] = container
            
            # Wait for container completion with timeout
            try:
                result = container.wait(timeout=settings.CONTAINER_TIMEOUT)
                exit_code = result['StatusCode']
                
                # Get container logs
                logs = container.logs(stdout=True, stderr=True).decode('utf-8')
                
                # Monitor final resource usage
                resource_stats = self.resource_manager.monitor_container_resources(container)
                
                # Update resource pool with final usage
                await self.resource_pool.update_container_usage(job_id, resource_stats)
                
                if exit_code == 0:
                    # Try to read output file with UTF-8 encoding
                    if os.path.exists(output_file):
                        with open(output_file, 'r', encoding='utf-8') as f:
                            output_data = json.load(f)
                        
                        return {
                            'status': ExecutionStatus.COMPLETED,
                            'output': output_data,
                            'memory_usage': resource_stats.get('memory_usage_mb', 0.0),
                            'resource_stats': resource_stats,
                            'logs': logs
                        }
                    else:
                        return {
                            'status': ExecutionStatus.FAILED,
                            'error_message': f"No output produced. Logs: {logs}",
                            'memory_usage': resource_stats.get('memory_usage_mb', 0.0),
                            'resource_stats': resource_stats
                        }
                else:
                    # Check if output file exists even on error (execution wrapper writes errors to output.json)
                    if os.path.exists(output_file):
                        try:
                            with open(output_file, 'r', encoding='utf-8') as f:
                                output_data = json.load(f)
                            
                            # Extract the formatted error message from output
                            error_msg = output_data.get('error', 'Code execution failed')
                            
                            return {
                                'status': ExecutionStatus.FAILED,
                                'error_message': error_msg,
                                'memory_usage': resource_stats.get('memory_usage_mb', 0.0),
                                'resource_stats': resource_stats,
                                'logs': logs
                            }
                        except Exception as e:
                            self.logger.warning("Failed to parse error output", error=str(e))
                            # Fall back to logs
                            return {
                                'status': ExecutionStatus.FAILED,
                                'error_message': f"Code execution failed with exit code {exit_code}. Logs: {logs}",
                                'memory_usage': resource_stats.get('memory_usage_mb', 0.0),
                                'resource_stats': resource_stats
                            }
                    else:
                        return {
                            'status': ExecutionStatus.FAILED,
                            'error_message': f"Code execution failed with exit code {exit_code}. Logs: {logs}",
                            'memory_usage': resource_stats.get('memory_usage_mb', 0.0),
                            'resource_stats': resource_stats
                        }
                    
            except Exception as e:
                # Handle timeout and other exceptions
                if "timeout" in str(e).lower():
                    return {
                        'status': ExecutionStatus.TIMEOUT,
                        'error_message': f"Execution timed out after {settings.CONTAINER_TIMEOUT} seconds",
                        'memory_usage': 0.0
                    }
                else:
                    return {
                        'status': ExecutionStatus.FAILED,
                        'error_message': f"Execution error: {str(e)}",
                        'memory_usage': 0.0
                    }
        
        finally:
            # Clean up container
            if container:
                await self._cleanup_container(container.id)
            
            # Remove from active containers
            if job_id in self.resource_manager.active_containers:
                del self.resource_manager.active_containers[job_id]
    
    def _create_execution_wrapper(self, code_file: str, output_file: str) -> str:
        """Create a wrapper script that executes user code safely and captures output."""
        # The new PySpark executor image has its own execution wrapper
        # We just need to ensure the user code is available at the expected location
        return f'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import json
import traceback
import signal
import os
from datetime import datetime

# Set UTF-8 encoding for all file operations
import locale
import codecs
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

def timeout_handler(signum, frame):
    raise TimeoutError("Code execution timed out")

def main():
    # Set up timeout handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm({settings.CONTAINER_TIMEOUT - 10})  # Give 10 seconds buffer
    
    try:
        # Redirect stdout to capture print statements
        from io import StringIO
        old_stdout = sys.stdout
        sys.stdout = captured_output = StringIO()
        
        # Execute user code with UTF-8 encoding
        with open('/execution/user_code.py', 'r', encoding='utf-8') as f:
            user_code = f.read()
        
        # Create a controlled execution environment
        exec_globals = {{
            '__name__': '__main__',
            '__builtins__': __builtins__,
            'print': print,
            # Add safe imports
            'pandas': __import__('pandas'),
            'numpy': __import__('numpy'),
        }}
        
        # Try to import pyspark safely
        try:
            import pyspark
            from pyspark.sql import SparkSession
            
            # Create Spark session with resource limits
            spark = SparkSession.builder \\
                .appName("UserCodeExecution") \\
                .config("spark.driver.memory", "1g") \\
                .config("spark.executor.memory", "1g") \\
                .config("spark.sql.adaptive.enabled", "true") \\
                .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \\
                .getOrCreate()
            
            exec_globals['spark'] = spark
            exec_globals['SparkSession'] = SparkSession
            
        except ImportError:
            # Fallback if PySpark is not available
            pass
        
        # Execute the user code
        exec(user_code, exec_globals)
        
        # Restore stdout and get captured output
        sys.stdout = old_stdout
        output_text = captured_output.getvalue()
        
        # Try to get the result variable if it exists
        result_data = exec_globals.get('result', None)
        
        # Convert PySpark DataFrame to serializable format
        if result_data is not None:
            try:
                # Check if it's a PySpark DataFrame
                if hasattr(result_data, 'toPandas'):
                    # Convert PySpark DataFrame to pandas, then to dict
                    pandas_df = result_data.toPandas()
                    result_data = pandas_df.to_dict('records')
                elif hasattr(result_data, 'to_dict'):
                    # Convert pandas DataFrame to dict
                    result_data = result_data.to_dict('records')
                elif hasattr(result_data, '__iter__') and not isinstance(result_data, (str, dict)):
                    # Convert other iterables to list
                    result_data = list(result_data)
            except Exception as e:
                # If conversion fails, store the error
                result_data = {
                    'conversion_error': f"Failed to convert result to serializable format: {str(e)}",
                    'result_type': str(type(result_data))
                }
        
        # Prepare output
        output = {{
            'stdout': output_text,
            'result': result_data,
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat()
        }}
        
        # Write output to file with UTF-8 encoding
        with open('/execution/output.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, default=str, indent=2, ensure_ascii=False)
        
        print("Execution completed successfully")
        
    except TimeoutError:
        output = {{
            'error': 'Code execution timed out',
            'status': 'timeout',
            'timestamp': datetime.utcnow().isoformat()
        }}
        with open('/execution/output.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        sys.exit(1)
        
    except Exception as e:
        # Capture any execution errors
        error_info = {{
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback.format_exc(),
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat()
        }}
        
        with open('/execution/output.json', 'w', encoding='utf-8') as f:
            json.dump(error_info, f, indent=2, ensure_ascii=False)
        
        print(f"Execution failed: {str(e)}")
        sys.exit(1)
    
    finally:
        # Clean up Spark session if it exists
        if 'spark' in locals():
            try:
                spark.stop()
            except:
                pass
        
        # Cancel the alarm
        signal.alarm(0)

if __name__ == "__main__":
    main()
'''
    
    async def _cleanup_container(self, container_id: str):
        """Clean up a Docker container safely."""
        try:
            container = self.docker_client.containers.get(container_id)
            
            # Stop the container if it's still running
            if container.status == 'running':
                container.stop(timeout=5)
            
            # Remove the container
            container.remove(force=True)
            
            self.logger.info("Container cleaned up", container_id=container_id)
            
        except docker.errors.NotFound:
            # Container already removed
            pass
        except Exception as e:
            self.logger.warning("Failed to cleanup container", 
                              container_id=container_id, 
                              error=str(e))
    
    async def _validate_output(self, output: Dict[str, Any], question_id: str, execution_mode: ExecutionMode) -> ValidationResult:
        """Validate execution output against expected results using comprehensive validation engine."""
        from app.services.validation_engine import get_validation_engine
        from app.repositories.question_repository import QuestionRepository
        
        # If execution failed, return error result
        if output.get('status') != 'success':
            return ValidationResult(
                is_correct=False,
                schema_match=False,
                row_count_match=False,
                data_match=False,
                similarity_score=0.0,
                error_details=[
                    ValidationError(
                        error_type="execution_error",
                        message=output.get('error', 'Unknown execution error'),
                        details=output
                    )
                ]
            )
        
        try:
            # Get the question to retrieve expected output
            question_repo = QuestionRepository()
            question = await question_repo.get_question_by_id(question_id)
            
            if not question:
                return ValidationResult(
                    is_correct=False,
                    schema_match=False,
                    row_count_match=False,
                    data_match=False,
                    similarity_score=0.0,
                    error_details=[
                        ValidationError(
                            error_type="question_not_found",
                            message=f"Question with ID {question_id} not found",
                            details={"question_id": question_id}
                        )
                    ]
                )
            
            # Use comprehensive validation engine
            validation_engine = get_validation_engine()
            
            # For test mode, use basic validation only
            if execution_mode == ExecutionMode.TEST:
                result = await validation_engine.validate_output(
                    actual_output=output,
                    expected_output=question.expected_output,
                    question=question
                )
            else:
                # For submit mode, use full validation with detailed error reporting
                result = await validation_engine.validate_output(
                    actual_output=output,
                    expected_output=question.expected_output,
                    question=question
                )
            
            return result
            
        except Exception as e:
            self.logger.error("Validation failed", error=str(e), question_id=question_id)
            return ValidationResult(
                is_correct=False,
                schema_match=False,
                row_count_match=False,
                data_match=False,
                similarity_score=0.0,
                error_details=[
                    ValidationError(
                        error_type="validation_error",
                        message=f"Validation error: {str(e)}",
                        details={"error": str(e)}
                    )
                ]
            )
        
    async def _prepare_code_with_input(self, user_code: str, question: Optional[Any]) -> str:
        """
        Prepare user code by injecting input data from the question.
        
        Args:
            user_code: The user's submitted code
            question: Question object with sample_input data
            
        Returns:
            Prepared code with input data injection
        """
        if not question or not question.sample_input:
            # No input data to inject, return code as-is
            self.logger.warning("No question or sample_input, returning code as-is")
            return user_code
        
        # Extract input data from question
        input_data = question.sample_input.get('data', [])
        
        if not input_data:
            self.logger.warning("No input data in sample_input, returning code as-is")
            return user_code
        
        self.logger.info("Injecting input data", row_count=len(input_data))
        
        # Create code to inject input DataFrame
        import json
        input_data_json = json.dumps(input_data, indent=2)
        
        injection_code = f"""
# Auto-injected input data from question
_input_data = {input_data_json}
input_df = spark.createDataFrame(_input_data)

"""
        
        # Inject the code at the beginning (after imports)
        # Find the last import statement
        lines = user_code.split('\n')
        inject_after_line = 0
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('import ') or stripped.startswith('from '):
                inject_after_line = i + 1
            elif stripped.startswith('#') or stripped == '':
                # Skip comments and empty lines after imports
                if inject_after_line > 0:
                    inject_after_line = i + 1
            elif stripped:
                # Found first non-import, non-comment line
                break
        
        # Insert the injection code
        lines.insert(inject_after_line, injection_code)
        
        prepared_code = '\n'.join(lines)
        self.logger.info("Code prepared with input injection", inject_after_line=inject_after_line)
        
        return prepared_code
    
    async def _perform_ai_code_review(self, code: str, question_id: str, execution_result: ExecutionResult) -> Optional[CodeReview]:
        """Perform AI-powered code review for submit mode using the comprehensive CodeReviewer service."""
        try:
            from app.services.code_reviewer import get_code_reviewer
            from app.repositories.question_repository import QuestionRepository
            
            # Get question details for context
            question_repo = QuestionRepository()
            question = await question_repo.get_by_id(question_id)
            
            if not question:
                self.logger.warning("Question not found for AI review", question_id=question_id)
                return None
            
            # Get code reviewer instance
            code_reviewer = get_code_reviewer()
            
            # Determine difficulty level from question
            difficulty_level = question.difficulty_level.value if hasattr(question.difficulty_level, 'value') else str(question.difficulty_level)
            topic_area = question.topic.value if hasattr(question.topic, 'value') else str(question.topic)
            
            # Perform comprehensive code review
            review_result = await code_reviewer.review_solution(
                user_id=execution_result.job_id,  # Use job_id as user identifier for this context
                code=code,
                question_title=question.title,
                question_description=question.description,
                execution_result=execution_result,
                question_difficulty=difficulty_level,
                question_topic=topic_area
            )
            
            self.logger.info("AI code review completed", question_id=question_id, overall_score=review_result.overall_score)
            return review_result
            
        except Exception as e:
            self.logger.error("AI code review failed", error=str(e), question_id=question_id)
            # Return a basic review structure on error
            return CodeReview(
                overall_score=0.0,
                correctness_feedback=f"Unable to generate review due to system error: {str(e)}",
                performance_feedback="Review unavailable due to system error",
                best_practices_feedback="Review unavailable due to system error",
                improvement_suggestions=["Please try submitting again later"],
                code_examples=[],
                alternative_approaches=[],
                strengths=[],
                areas_for_improvement=["System was unable to analyze the code"],
                analysis_time=0.0,
                model_used="error-fallback",
                reviewed_at=datetime.utcnow()
            )
    
    async def _store_solution(self, job_id: str, user_id: Optional[str], question_id: str, 
                            code: str, execution_result: ExecutionResult) -> None:
        """Store solution permanently for submit mode."""
        try:
            from app.repositories.solution_repository import SolutionRepository
            from app.models.user import Solution, SolutionStatus
            
            solution_repo = SolutionRepository()
            
            # Determine solution status based on execution result
            if execution_result.status == ExecutionStatus.COMPLETED:
                if execution_result.validation_result and execution_result.validation_result.is_correct:
                    status = SolutionStatus.REVIEWED if execution_result.ai_review else SolutionStatus.SUBMITTED
                else:
                    status = SolutionStatus.SUBMITTED
            else:
                status = SolutionStatus.DRAFT
            
            # Create solution object
            solution = Solution(
                id=job_id,
                user_id=user_id or "anonymous",
                question_id=question_id,
                code=code,
                status=status,
                execution_result=execution_result,
                ai_review=execution_result.ai_review,
                performance_metrics={
                    'execution_time': execution_result.execution_time,
                    'memory_usage': execution_result.memory_usage,
                    'similarity_score': execution_result.validation_result.similarity_score if execution_result.validation_result else 0.0
                },
                submitted_at=datetime.utcnow()
            )
            
            # Store solution
            await solution_repo.create(solution)
            
            # Update user progress if user_id is provided
            if user_id:
                await self._update_user_progress(user_id, question_id, execution_result)
            
            self.logger.info("Solution stored successfully", 
                           job_id=job_id, 
                           user_id=user_id, 
                           question_id=question_id,
                           status=status.value)
            
        except Exception as e:
            self.logger.error("Failed to store solution", 
                            job_id=job_id, 
                            error=str(e))
    
    async def _update_user_progress(self, user_id: str, question_id: str, execution_result: ExecutionResult) -> None:
        """Update user progress after successful submission."""
        try:
            from app.repositories.user_repository import UserRepository
            
            user_repo = UserRepository()
            user_progress = await user_repo.get_progress(user_id)
            
            if user_progress:
                # Update completion statistics
                if question_id not in user_progress.completed_questions:
                    if execution_result.validation_result and execution_result.validation_result.is_correct:
                        user_progress.completed_questions.append(question_id)
                        user_progress.total_questions_completed += 1
                
                # Update attempt statistics
                user_progress.total_questions_attempted += 1
                
                # Recalculate success rate
                if user_progress.total_questions_attempted > 0:
                    user_progress.success_rate = user_progress.total_questions_completed / user_progress.total_questions_attempted
                
                # Update last activity
                user_progress.last_activity = datetime.utcnow()
                
                # Save updated progress
                await user_repo.update_progress(user_progress)
                
                self.logger.info("User progress updated", 
                               user_id=user_id, 
                               completed=user_progress.total_questions_completed,
                               attempted=user_progress.total_questions_attempted)
            
        except Exception as e:
            self.logger.error("Failed to update user progress", 
                            user_id=user_id, 
                            error=str(e))
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of an execution job."""
        if job_id in self.active_jobs:
            job_info = self.active_jobs[job_id]
            
            # Calculate progress based on elapsed time
            elapsed_time = time.time() - job_info['start_time']
            estimated_total = settings.CONTAINER_TIMEOUT
            progress = min(elapsed_time / estimated_total, 0.95)  # Cap at 95% until completion
            
            return {
                'job_id': job_id,
                'status': job_info['status'],
                'progress': progress,
                'elapsed_time': elapsed_time,
                'estimated_completion': datetime.utcnow() + timedelta(seconds=max(0, estimated_total - elapsed_time))
            }
        
        return None
    
    async def list_active_jobs(self) -> List[Dict[str, Any]]:
        """List all currently active execution jobs."""
        return [
            {
                'job_id': job_id,
                'status': job_info['status'],
                'start_time': job_info['start_time'],
                'user_id': job_info.get('user_id'),
                'elapsed_time': time.time() - job_info['start_time']
            }
            for job_id, job_info in self.active_jobs.items()
        ]
    
    async def terminate_job(self, job_id: str) -> bool:
        """Terminate a running execution job."""
        if job_id not in self.active_jobs:
            return False
        
        job_info = self.active_jobs[job_id]
        container_id = job_info.get('container_id')
        
        if container_id:
            await self._cleanup_container(container_id)
        
        # Update job status
        self.active_jobs[job_id]['status'] = ExecutionStatus.FAILED
        
        self.logger.info("Job terminated", job_id=job_id)
        return True
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on the execution engine."""
        try:
            health_status = {
                "status": "healthy",
                "docker_available": False,
                "active_jobs": len(self.active_jobs),
                "resource_pool": await self.resource_pool.get_pool_status(),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Check Docker availability
            if self.docker_client:
                try:
                    if hasattr(self, '_using_custom_client') and self._using_custom_client:
                        # Using custom Unix socket client
                        if self.docker_unix_client.ping():
                            health_status["docker_available"] = True
                            version_info = self.docker_unix_client.version()
                            health_status["docker_info"] = {
                                "version": version_info.get("Version", "unknown"),
                                "api_version": version_info.get("ApiVersion", "unknown"),
                                "client_type": "custom_unix_socket"
                            }
                        else:
                            health_status["docker_error"] = "Docker ping failed"
                            health_status["status"] = "degraded"
                    else:
                        # Using standard docker-py client
                        self.docker_client.ping()
                        health_status["docker_available"] = True
                        health_status["docker_info"] = {
                            "version": self.docker_client.version().get("Version", "unknown"),
                            "api_version": self.docker_client.api.api_version,
                            "client_type": "docker_py"
                        }
                except Exception as e:
                    health_status["docker_error"] = str(e)
                    health_status["status"] = "degraded"
            else:
                health_status["status"] = "degraded"
                health_status["docker_error"] = "Docker client not initialized"
            
            # Check system resources
            system_resources = self.get_system_resources()
            health_status["system_resources"] = system_resources
            
            # Determine overall health
            if (system_resources.get("cpu_percent", 0) > 90 or 
                system_resources.get("memory_percent", 0) > 90):
                health_status["status"] = "degraded"
            
            return health_status
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get current system resource usage."""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'disk_percent': disk.percent,
                'active_containers': len(self.resource_manager.active_containers),
                'active_jobs': len(self.active_jobs),
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.warning("Failed to get system resources", error=str(e))
            return {
                'cpu_percent': 0.0,
                'memory_percent': 0.0,
                'disk_percent': 0.0,
                'active_containers': len(self.resource_manager.active_containers),
                'active_jobs': len(self.active_jobs),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def start_job_queue_processor(self) -> None:
        """Start the job queue processor."""
        if self.job_queue_processor_running:
            self.logger.info("Job queue processor already running")
            return
        
        self.job_queue_processor_running = True
        
        # Start the queue processor task
        asyncio.create_task(self._process_job_queue())
        
        self.logger.info("Job queue processor started")
    
    async def stop_job_queue_processor(self) -> None:
        """Stop the job queue processor."""
        self.job_queue_processor_running = False
        self.logger.info("Job queue processor stopped")
    
    async def _process_job_queue(self) -> None:
        """Process jobs from the queue."""
        while self.job_queue_processor_running:
            try:
                # Check if we can process more jobs
                if not await self.resource_pool.can_allocate_container():
                    await asyncio.sleep(5)  # Wait before checking again
                    continue
                
                # Get next job from queue
                job_data = await JobQueue.dequeue_job()
                
                if job_data:
                    # Process job asynchronously
                    asyncio.create_task(self._execute_queued_job(job_data))
                else:
                    await asyncio.sleep(1)  # No jobs available, wait briefly
                    
            except Exception as e:
                self.logger.error("Error in job queue processor", error=str(e))
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _execute_queued_job(self, job_data: Dict[str, Any]) -> None:
        """Execute a job from the queue."""
        try:
            result = await self.execute_code(
                code=job_data['code'],
                question_id=job_data['question_id'],
                mode=job_data['mode'],
                user_id=job_data.get('user_id')
            )
            
            # Cache the result for retrieval
            cache_key = f"queued_result:{job_data['job_id']}"
            await CacheManager.set_cache(cache_key, result.model_dump(), ttl=3600)  # 1 hour
            
            self.logger.info("Queued job completed", job_id=job_data['job_id'], status=result.status)
            
        except Exception as e:
            self.logger.error("Failed to execute queued job", 
                            job_id=job_data.get('job_id'), 
                            error=str(e))
    
    async def get_queue_status(self) -> Dict[str, Any]:
        """Get current job queue status."""
        try:
            queue_length = await JobQueue.get_queue_length()
            pool_status = await self.resource_pool.get_pool_status()
            
            return {
                'queue_length': queue_length,
                'processor_running': self.job_queue_processor_running,
                'active_jobs': len(self.active_jobs),
                'resource_pool': pool_status,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error("Failed to get queue status", error=str(e))
            return {
                'queue_length': 0,
                'processor_running': self.job_queue_processor_running,
                'active_jobs': len(self.active_jobs),
                'resource_pool': {},
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def get_security_violations(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent security violations."""
        return await self.security_monitor.get_recent_violations(hours)
    
    async def get_execution_metrics(self) -> Dict[str, Any]:
        """Get comprehensive execution metrics."""
        try:
            queue_status = await self.get_queue_status()
            system_resources = self.get_system_resources()
            recent_violations = await self.get_security_violations(1)  # Last hour
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'queue_status': queue_status,
                'system_resources': system_resources,
                'recent_violations': len(recent_violations),
                'violation_details': recent_violations[:5]  # Last 5 violations
            }
        except Exception as e:
            self.logger.error("Failed to get execution metrics", error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'queue_status': {},
                'system_resources': {},
                'recent_violations': 0,
                'violation_details': []
            }


# Global execution engine instance - initialized lazily
_execution_engine = None


def get_execution_engine() -> ExecutionEngine:
    """Get the global execution engine instance."""
    global _execution_engine
    if _execution_engine is None:
        _execution_engine = ExecutionEngine()
    return _execution_engine


class ExecutionEngineService:
    """Service wrapper for the execution engine."""
    
    def __init__(self):
        self.logger = logger.bind(service="execution_engine_service")
    
    @property
    def engine(self) -> ExecutionEngine:
        """Get the execution engine instance."""
        return get_execution_engine()
    
    async def execute_code(self, code: str, question_id: str, mode: str, user_id: Optional[str] = None) -> ExecutionResult:
        """Execute PySpark code in isolated Docker container."""
        return await self.engine.execute_code(code, question_id, mode, user_id)
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of an execution job."""
        return await self.engine.get_job_status(job_id)
    
    async def list_active_jobs(self) -> List[Dict[str, Any]]:
        """List all currently active execution jobs."""
        return await self.engine.list_active_jobs()
    
    async def terminate_job(self, job_id: str) -> bool:
        """Terminate a running execution job."""
        return await self.engine.terminate_job(job_id)
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get current system resource usage."""
        return self.engine.get_system_resources()
    
    async def start_queue_processor(self) -> None:
        """Start the job queue processor."""
        await self.engine.start_job_queue_processor()
    
    async def stop_queue_processor(self) -> None:
        """Stop the job queue processor."""
        await self.engine.stop_job_queue_processor()
    
    async def get_queue_status(self) -> Dict[str, Any]:
        """Get current job queue status."""
        return await self.engine.get_queue_status()
    
    async def get_security_violations(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent security violations."""
        return await self.engine.get_security_violations(hours)
    
    async def get_execution_metrics(self) -> Dict[str, Any]:
        """Get comprehensive execution metrics."""
        return await self.engine.get_execution_metrics()
    
    async def get_cached_result(self, job_id: str) -> Optional[ExecutionResult]:
        """Get a cached execution result."""
        cache_key = f"execution_result:{job_id}"
        cached_data = await CacheManager.get_cache(cache_key)
        
        if cached_data:
            return ExecutionResult(**cached_data)
        return None
    
    async def execute_code(
        self, 
        job_id: str, 
        code: str, 
        question_id: str, 
        mode: ExecutionMode, 
        user_id: str
    ) -> ExecutionResult:
        """Execute code with job ID tracking."""
        return await self.engine.execute_code(code, question_id, mode.value, user_id)
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running execution job."""
        return await self.engine.terminate_job(job_id)
    
    async def cleanup_job_resources(self, job_id: str) -> None:
        """Clean up resources for a completed job."""
        try:
            # Remove from active jobs
            if hasattr(self.engine, 'active_jobs') and job_id in self.engine.active_jobs:
                del self.engine.active_jobs[job_id]
            
            # Deallocate container resources
            await self.engine.resource_pool.deallocate_container(job_id)
            
            self.logger.debug("Job resources cleaned up", job_id=job_id)
            
        except Exception as e:
            self.logger.warning("Failed to cleanup job resources", error=str(e), job_id=job_id)
    
    async def get_execution_metrics(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get execution metrics, optionally filtered by user."""
        base_metrics = await self.engine.get_execution_metrics()
        
        if user_id:
            # Add user-specific metrics
            try:
                from app.core.redis_client import get_redis
                redis_client = await get_redis()
                
                # Get user's job history
                user_jobs_key = f"user_jobs:{user_id}"
                user_job_ids = await redis_client.lrange(user_jobs_key, 0, -1)
                
                user_metrics = {
                    "user_id": user_id,
                    "total_jobs": len(user_job_ids),
                    "recent_jobs": len(user_job_ids[:10]),  # Last 10 jobs
                }
                
                # Count jobs by status
                status_counts = {"completed": 0, "failed": 0, "cancelled": 0}
                for job_id in user_job_ids[:50]:  # Check last 50 jobs
                    job_key = f"execution_job:{job_id}"
                    job_data = await redis_client.hgetall(job_key)
                    if job_data:
                        status = job_data.get("status", "unknown")
                        if status in status_counts:
                            status_counts[status] += 1
                
                user_metrics["status_distribution"] = status_counts
                base_metrics["user_metrics"] = user_metrics
                
            except Exception as e:
                self.logger.warning("Failed to get user-specific metrics", error=str(e), user_id=user_id)
        
        return base_metrics