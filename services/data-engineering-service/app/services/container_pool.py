"""
Warm Container Pool for fast PySpark execution.

Maintains a pool of pre-warmed containers with Spark already initialized
to dramatically reduce execution time for test mode.
"""

import asyncio
import docker
import json
import os
import time
from datetime import datetime
from typing import Optional, Dict, Any, List
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class WarmContainerPool:
    """
    Manages a pool of warm containers with Spark pre-initialized.
    
    Features:
    - Pre-warmed containers with Spark ready
    - Automatic state reset between executions
    - Container recycling to prevent memory leaks
    - Health monitoring and auto-replacement
    - Graceful degradation when pool exhausted
    """
    
    def __init__(self, pool_size: int = 2):
        """
        Initialize the container pool.
        
        Args:
            pool_size: Number of containers to keep warm (default: 2)
        """
        self.pool_size = pool_size
        self.available = asyncio.Queue(maxsize=pool_size)
        self.in_use: Dict[str, Dict[str, Any]] = {}
        self.execution_tracking: Dict[str, Dict[str, Any]] = {}  # Track active executions
        self.lock = asyncio.Lock()
        self.docker_client = None
        self.docker_unix_client = None
        self._initialized = False
        self._health_check_task = None
        self.logger = logger.bind(component="container_pool")
        
    async def initialize(self):
        """Initialize the pool with warm containers."""
        if self._initialized:
            self.logger.warning("Pool already initialized")
            return
        
        self.logger.info("Initializing container pool", pool_size=self.pool_size)
        
        try:
            # Initialize Docker client
            await self._initialize_docker()
            
            # Pre-warm containers with retry logic
            successful_containers = 0
            max_retries = 3
            
            for i in range(self.pool_size):
                container_created = False
                
                for retry in range(max_retries):
                    try:
                        container_info = await self._create_warm_container()
                        await self.available.put(container_info)
                        successful_containers += 1
                        container_created = True
                        
                        self.logger.info("Warm container created", 
                                       container_id=container_info['container_id'][:12],
                                       index=i+1,
                                       total=self.pool_size,
                                       retry=retry)
                        break
                        
                    except Exception as e:
                        self.logger.error("Failed to create warm container", 
                                        error=str(e), 
                                        index=i+1,
                                        retry=retry+1,
                                        max_retries=max_retries)
                        
                        if retry < max_retries - 1:
                            # Wait before retry
                            await asyncio.sleep(2 ** retry)  # Exponential backoff
                
                if not container_created:
                    self.logger.warning("Failed to create container after all retries",
                                      index=i+1)
            
            # Check if we have minimum viable pool
            min_pool_size = 1
            if successful_containers < min_pool_size:
                raise RuntimeError(
                    f"Failed to create minimum pool size. "
                    f"Created {successful_containers}/{self.pool_size}, "
                    f"minimum required: {min_pool_size}"
                )
            
            if successful_containers < self.pool_size:
                self.logger.warning("Pool initialized with reduced size",
                                  created=successful_containers,
                                  target=self.pool_size)
            
            self._initialized = True
            
            # Start health check background task
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            
            self.logger.info("Container pool initialized successfully",
                           available=self.available.qsize(),
                           target_size=self.pool_size,
                           actual_size=successful_containers)
            
        except Exception as e:
            self.logger.error("Failed to initialize container pool", error=str(e))
            # Clean up any partially created containers
            while not self.available.empty():
                try:
                    container_info = self.available.get_nowait()
                    await self._destroy_container(container_info['container_id'])
                except:
                    pass
            raise
    
    async def _initialize_docker(self):
        """Initialize Docker client."""
        try:
            from app.services.docker_unix_client import DockerUnixClient
            
            self.docker_unix_client = DockerUnixClient(socket_path='/var/run/docker.sock')
            
            # Test connection
            version_info = self.docker_unix_client.version()
            self.logger.info("Docker client initialized", version=version_info.get('Version'))
            
        except Exception as e:
            self.logger.error("Failed to initialize Docker client", error=str(e))
            raise
    
    async def _create_warm_container(self) -> Dict[str, Any]:
        """
        Create a container with Spark pre-initialized and an execution server.
        
        Returns:
            Container info dictionary
        """
        start_time = time.time()
        
        # Create temp directory for this container
        import random
        import string
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        temp_dir = os.path.join("/tmp/execution", f"pool_{random_suffix}")
        os.makedirs(temp_dir, mode=0o777, exist_ok=True)
        
        # Create execution server script that keeps Spark alive and executes code on demand
        server_script = """
import socket
import os
import time
import signal
import sys
import json
import traceback
from io import StringIO
from datetime import datetime

# Fix hostname resolution issue
hostname = socket.gethostname()
with open('/etc/hosts', 'a') as f:
    f.write(f'127.0.0.1 {hostname}\\n')

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql import types as T
import pandas as pd
import numpy as np

print("Initializing Spark session...", flush=True)

# Initialize Spark session ONCE with optimized settings for speed
spark = SparkSession.builder \\
    .appName("PooledSpark") \\
    .master("local[1]") \\
    .config("spark.driver.memory", "512m") \\
    .config("spark.executor.memory", "512m") \\
    .config("spark.driver.maxResultSize", "128m") \\
    .config("spark.sql.warehouse.dir", "/tmp/sw") \\
    .config("spark.local.dir", "/tmp/sl") \\
    .config("spark.ui.enabled", "false") \\
    .config("spark.sql.adaptive.enabled", "false") \\
    .config("spark.sql.adaptive.coalescePartitions.enabled", "false") \\
    .config("spark.sql.shuffle.partitions", "2") \\
    .config("spark.default.parallelism", "1") \\
    .config("spark.rdd.compress", "false") \\
    .config("spark.shuffle.compress", "false") \\
    .config("spark.shuffle.spill.compress", "false") \\
    .config("spark.ui.showConsoleProgress", "false") \\
    .config("spark.driver.bindAddress", "127.0.0.1") \\
    .config("spark.driver.host", "localhost") \\
    .config("spark.sql.shuffle.partitions", "1") \\
    .config("spark.default.parallelism", "1") \\
    .config("spark.rdd.compress", "false") \\
    .config("spark.shuffle.compress", "false") \\
    .config("spark.eventLog.enabled", "false") \\
    .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \\
    .config("spark.python.worker.reuse", "true") \\
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")

print("SPARK_READY", flush=True)

# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    print("Received signal, shutting down gracefully", flush=True)
    spark.stop()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Execution loop - watch for code files and execute them
print("Execution server ready, watching for code files...", flush=True)

while True:
    try:
        # Check for code file
        code_file = '/execution/user_code.py'
        output_file = '/execution/output.json'
        trigger_file = '/execution/execute.trigger'
        
        # Wait for trigger file
        if os.path.exists(trigger_file):
            print(f"Trigger detected, executing code...", flush=True)
            
            try:
                # Read user code
                with open(code_file, 'r', encoding='utf-8') as f:
                    user_code = f.read()
                
                # Capture stdout
                old_stdout = sys.stdout
                sys.stdout = captured_output = StringIO()
                
                # Execute code in current namespace (with spark already available)
                exec_globals = globals().copy()
                exec(user_code, exec_globals)
                
                # Restore stdout
                sys.stdout = old_stdout
                output_text = captured_output.getvalue()
                
                # Get result if it exists
                result_data = exec_globals.get('result', None)
                
                # Properly serialize DataFrame results
                if result_data is not None:
                    # Check if it's a PySpark DataFrame
                    if hasattr(result_data, 'toPandas'):
                        pdf = result_data.toPandas()
                        result_output = {
                            'type': 'dataframe',
                            'data': pdf.to_dict(orient='records'),
                            'columns': list(pdf.columns),
                            'dtypes': {col: str(dtype) for col, dtype in pdf.dtypes.items()},
                            'shape': pdf.shape
                        }
                    # Check if it's a Pandas DataFrame
                    elif hasattr(result_data, 'to_dict') and hasattr(result_data, 'columns'):
                        result_output = {
                            'type': 'dataframe',
                            'data': result_data.to_dict(orient='records'),
                            'columns': list(result_data.columns),
                            'dtypes': {col: str(dtype) for col, dtype in result_data.dtypes.items()},
                            'shape': result_data.shape
                        }
                    else:
                        result_output = str(result_data)
                else:
                    result_output = None
                
                # Write success result
                result = {
                    'status': 'success',
                    'stdout': output_text,
                    'result': result_output,
                    'timestamp': datetime.utcnow().isoformat()
                }
                
                # Write immediately and flush to disk
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, default=str, indent=2)
                    f.flush()
                    os.fsync(f.fileno())  # Force write to disk
                
                print(f"Execution completed successfully", flush=True)
                
            except Exception as e:
                sys.stdout = old_stdout
                error_result = {
                    'status': 'error',
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'traceback': traceback.format_exc(),
                    'timestamp': datetime.utcnow().isoformat()
                }
                
                # Write immediately and flush to disk
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(error_result, f, default=str, indent=2)
                    f.flush()
                    os.fsync(f.fileno())  # Force write to disk
                
                print(f"Execution failed: {e}", flush=True)
            
            finally:
                # Remove trigger file
                try:
                    os.remove(trigger_file)
                except:
                    pass
        
        # Sleep briefly before checking again - reduced for faster response
        time.sleep(0.05)  # Reduced from 0.1s to 50ms
        
    except Exception as e:
        print(f"Server error: {e}", flush=True)
        time.sleep(1)
"""
        
        server_file = os.path.join(temp_dir, "execution_server.py")
        with open(server_file, 'w', encoding='utf-8') as f:
            f.write(server_script)
        os.chmod(server_file, 0o666)
        
        # Get volume path
        subdir = os.path.basename(temp_dir)
        volume_path = f"/var/lib/docker/volumes/data-engineering-service_execution_temp/_data/{subdir}"
        
        # Create container
        container_config = {
            'Image': settings.EXECUTION_IMAGE,
            'Cmd': ['python3', '/execution/execution_server.py'],
            'WorkingDir': '/execution',
            'User': '0:0',
            'Tty': True,  # Keep container running
            'OpenStdin': True,
            'HostConfig': {
                'Binds': [f'{volume_path}:/execution:rw'],
                'Memory': self._parse_memory_limit("1g"),  # Increased from 768m to meet Spark minimum requirements
                'CpuQuota': 100000,
                'CpuPeriod': 100000,
                'NetworkMode': 'none',
                'AutoRemove': False
            }
        }
        
        create_response = self.docker_unix_client.create_container(container_config)
        container_id = create_response['Id']
        
        # Start container
        self.docker_unix_client.start_container(container_id)
        
        # Wait for Spark initialization
        await asyncio.sleep(2)  # Give it time to start
        
        max_wait = 30
        waited = 0
        spark_ready = False
        
        while waited < max_wait:
            try:
                logs = self.docker_unix_client.get_container_logs(container_id, stdout=True, stderr=True)
                logs_str = logs.decode('utf-8', errors='replace')
                
                if "SPARK_READY" in logs_str:
                    spark_ready = True
                    break
                    
                if "Error" in logs_str or "Exception" in logs_str:
                    self.logger.error("Spark initialization failed", logs=logs_str)
                    break
                    
            except Exception as e:
                self.logger.warning("Failed to check logs", error=str(e))
            
            await asyncio.sleep(1)
            waited += 1
        
        if not spark_ready:
            # Clean up failed container
            try:
                self.docker_unix_client.stop_container(container_id, timeout=5)
                self.docker_unix_client.remove_container(container_id, force=True)
            except:
                pass
            raise RuntimeError("Failed to initialize Spark in container")
        
        initialization_time = time.time() - start_time
        
        container_info = {
            'container_id': container_id,
            'temp_dir': temp_dir,
            'volume_path': volume_path,
            'created_at': datetime.utcnow(),
            'executions': 0,
            'spark_ready': True,
            'initialization_time': initialization_time
        }
        
        self.logger.info("Warm container created successfully",
                        container_id=container_id[:12],
                        initialization_time=f"{initialization_time:.2f}s")
        
        return container_info
    
    def _parse_memory_limit(self, mem_limit_str: str) -> int:
        """Parse memory limit string to bytes."""
        if isinstance(mem_limit_str, int):
            return mem_limit_str
        
        mem_limit_str = mem_limit_str.lower().strip()
        if mem_limit_str.endswith('g'):
            return int(float(mem_limit_str[:-1]) * 1024 * 1024 * 1024)
        elif mem_limit_str.endswith('m'):
            return int(float(mem_limit_str[:-1]) * 1024 * 1024)
        else:
            return int(mem_limit_str)
    
    async def get_container(self, timeout: int = 30) -> Optional[Dict[str, Any]]:
        """
        Get a warm container from the pool.
        
        Args:
            timeout: Maximum time to wait for available container
            
        Returns:
            Container info dictionary or None if unavailable
        """
        if not self._initialized:
            self.logger.warning("Pool not initialized, cannot get container")
            return None
        
        try:
            # Try to get container from pool
            container_info = await asyncio.wait_for(
                self.available.get(),
                timeout=timeout
            )
            
            # Mark as in use and track execution start
            async with self.lock:
                self.in_use[container_info['container_id']] = container_info
                self.execution_tracking[container_info['container_id']] = {
                    'start_time': time.time(),
                    'container_info': container_info
                }
            
            self.logger.info("Container acquired from pool",
                           container_id=container_info['container_id'][:12],
                           executions=container_info['executions'],
                           available=self.available.qsize())
            
            return container_info
            
        except asyncio.TimeoutError:
            self.logger.warning("Pool exhausted, no containers available",
                              in_use=len(self.in_use),
                              available=self.available.qsize())
            return None
        except Exception as e:
            self.logger.error("Failed to get container from pool", error=str(e))
            return None
    
    async def return_container(self, container_info: Dict[str, Any]):
        """
        Return a container to the pool after execution.
        
        Args:
            container_info: Container info dictionary
        """
        container_id = container_info['container_id']
        
        # Idempotency check: prevent double-return
        async with self.lock:
            if container_id not in self.in_use:
                self.logger.warning("Container not in use, ignoring return",
                                  container_id=container_id[:12])
                return
            
            # Remove from in-use and execution tracking
            del self.in_use[container_id]
            if container_id in self.execution_tracking:
                del self.execution_tracking[container_id]
        
        try:
            # Reset container state
            await self._reset_container(container_info)
            
            # Increment execution counter
            container_info['executions'] += 1
            
            # Check if container should be recycled
            if container_info['executions'] >= 50:
                self.logger.info("Recycling container after 50 executions",
                               container_id=container_id[:12])
                await self._destroy_container(container_id)
                
                # Create replacement
                try:
                    new_container = await self._create_warm_container()
                    await self.available.put(new_container)
                except Exception as e:
                    self.logger.error("Failed to create replacement container", error=str(e))
            else:
                # Return to pool
                await self.available.put(container_info)
                
                self.logger.info("Container returned to pool",
                               container_id=container_id[:12],
                               executions=container_info['executions'],
                               available=self.available.qsize())
                
        except Exception as e:
            self.logger.error("Failed to return container to pool",
                            container_id=container_id[:12],
                            error=str(e))
            # Try to destroy the problematic container
            try:
                await self._destroy_container(container_id)
            except:
                pass
    
    async def _reset_container(self, container_info: Dict[str, Any]):
        """
        Reset container state between executions with comprehensive cleanup.
        
        Args:
            container_info: Container info dictionary
        """
        temp_dir = container_info['temp_dir']
        
        try:
            # 1. Clean up execution files (keep init script)
            for item in os.listdir(temp_dir):
                if item != "init_spark.py":
                    path = os.path.join(temp_dir, item)
                    try:
                        if os.path.isfile(path):
                            os.unlink(path)
                        elif os.path.isdir(path):
                            import shutil
                            shutil.rmtree(path)
                    except Exception as e:
                        self.logger.warning("Failed to clean file", path=path, error=str(e))
            
            # 2. Execute comprehensive reset in container
            reset_script = """
import gc
import sys

try:
    # Clear Spark catalog cache
    spark.catalog.clearCache()
    
    # Drop all temporary views
    for table in spark.catalog.listTables():
        try:
            if table.isTemporary:
                spark.catalog.dropTempView(table.name)
        except:
            pass
    
    # Unpersist all cached DataFrames
    try:
        spark.catalog.clearCache()
    except:
        pass
    
    # Clear Python namespace (except essential imports)
    essential_vars = {'spark', 'pd', 'pandas', 'np', 'numpy', 'F', 'functions', 
                     'T', 'types', 'Window', '__builtins__', '__name__', 
                     '__doc__', '__package__', 'gc', 'sys'}
    
    # Get all user-defined variables
    user_vars = [var for var in dir() if not var.startswith('_') and var not in essential_vars]
    
    # Delete user variables
    for var in user_vars:
        try:
            del globals()[var]
        except:
            pass
    
    # Force garbage collection
    gc.collect()
    
    # Clear any lingering references
    import sys
    if hasattr(sys, 'last_value'):
        sys.last_value = None
    if hasattr(sys, 'last_type'):
        sys.last_type = None
    if hasattr(sys, 'last_traceback'):
        sys.last_traceback = None
    
    print("RESET_COMPLETE")
    
except Exception as e:
    print(f"RESET_ERROR: {str(e)}")
"""
            
            reset_file = os.path.join(temp_dir, "reset.py")
            with open(reset_file, 'w', encoding='utf-8') as f:
                f.write(reset_script)
            os.chmod(reset_file, 0o666)
            
            # Execute reset in container
            exec_config = {
                'AttachStdout': True,
                'AttachStderr': True,
                'Cmd': ['python3', '/execution/reset.py']
            }
            
            exec_id = self.docker_unix_client.create_exec(container_info['container_id'], exec_config)
            self.docker_unix_client.start_exec(exec_id)
            
            # Wait a moment for reset to complete
            await asyncio.sleep(0.5)
            
            # Clean up reset script
            try:
                os.unlink(reset_file)
            except:
                pass
            
            self.logger.debug("Container reset complete", 
                            container_id=container_info['container_id'][:12])
            
        except Exception as e:
            self.logger.warning("Failed to reset container", 
                              container_id=container_info['container_id'][:12],
                              error=str(e))
            # If reset fails, mark container for recycling
            container_info['executions'] = 999  # Force recycling
    
    async def _destroy_container(self, container_id: str):
        """Destroy a container and clean up resources."""
        try:
            self.docker_unix_client.stop_container(container_id, timeout=5)
            self.docker_unix_client.remove_container(container_id, force=True)
            self.logger.info("Container destroyed", container_id=container_id[:12])
        except Exception as e:
            self.logger.warning("Failed to destroy container", 
                              container_id=container_id[:12],
                              error=str(e))
    
    async def _health_check_loop(self):
        """Background task for health monitoring and hung container detection."""
        self.logger.info("Health check loop started")
        
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                current_time = time.time()
                max_execution_time = settings.CONTAINER_TIMEOUT + 30  # Grace period
                
                # Check for hung containers (executing too long)
                async with self.lock:
                    for container_id, tracking_info in list(self.execution_tracking.items()):
                        execution_duration = current_time - tracking_info['start_time']
                        
                        if execution_duration > max_execution_time:
                            self.logger.warning("Hung container detected",
                                              container_id=container_id[:12],
                                              duration=f"{execution_duration:.1f}s")
                            
                            # Remove from tracking and in-use
                            del self.execution_tracking[container_id]
                            if container_id in self.in_use:
                                del self.in_use[container_id]
                            
                            # Destroy hung container
                            await self._destroy_container(container_id)
                            
                            # Create replacement
                            try:
                                new_container = await self._create_warm_container()
                                await self.available.put(new_container)
                                self.logger.info("Replaced hung container",
                                               old_id=container_id[:12],
                                               new_id=new_container['container_id'][:12])
                            except Exception as e:
                                self.logger.error("Failed to replace hung container",
                                                error=str(e))
                
                # Check in-use containers for health
                async with self.lock:
                    for container_id in list(self.in_use.keys()):
                        if not await self._is_container_healthy(container_id):
                            self.logger.warning("Unhealthy container detected",
                                              container_id=container_id[:12])
                            # Remove from in-use and tracking
                            del self.in_use[container_id]
                            if container_id in self.execution_tracking:
                                del self.execution_tracking[container_id]
                            # Destroy it
                            await self._destroy_container(container_id)
                
                # Ensure pool is full
                current_size = self.available.qsize() + len(self.in_use)
                if current_size < self.pool_size:
                    shortage = self.pool_size - current_size
                    self.logger.info("Replenishing pool", shortage=shortage)
                    
                    for _ in range(shortage):
                        try:
                            new_container = await self._create_warm_container()
                            await self.available.put(new_container)
                        except Exception as e:
                            self.logger.error("Failed to create replacement container",
                                            error=str(e))
                
            except Exception as e:
                self.logger.error("Health check loop error", error=str(e))
    
    async def _is_container_healthy(self, container_id: str) -> bool:
        """Check if a container is healthy."""
        try:
            inspect = self.docker_unix_client.inspect_container(container_id)
            state = inspect.get('State', {})
            return state.get('Running', False) and not state.get('Dead', False)
        except Exception:
            return False
    
    async def shutdown(self):
        """Shutdown the pool and clean up all containers."""
        self.logger.info("Shutting down container pool")
        
        # Cancel health check task
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        # Destroy all containers
        async with self.lock:
            # Destroy in-use containers
            for container_id in list(self.in_use.keys()):
                await self._destroy_container(container_id)
            
            # Destroy available containers
            while not self.available.empty():
                try:
                    container_info = self.available.get_nowait()
                    await self._destroy_container(container_info['container_id'])
                except:
                    break
        
        self._initialized = False
        self.logger.info("Container pool shutdown complete")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics."""
        return {
            'pool_size': self.pool_size,
            'available': self.available.qsize(),
            'in_use': len(self.in_use),
            'initialized': self._initialized,
            'total_capacity': self.pool_size,
            'utilization': len(self.in_use) / self.pool_size if self.pool_size > 0 else 0
        }


# Global pool instance
_container_pool: Optional[WarmContainerPool] = None


async def get_container_pool() -> WarmContainerPool:
    """Get the global container pool instance."""
    global _container_pool
    
    if _container_pool is None:
        pool_size = getattr(settings, 'CONTAINER_POOL_SIZE', 2)
        _container_pool = WarmContainerPool(pool_size=pool_size)
        await _container_pool.initialize()
    
    return _container_pool


async def shutdown_container_pool():
    """Shutdown the global container pool."""
    global _container_pool
    
    if _container_pool is not None:
        await _container_pool.shutdown()
        _container_pool = None
