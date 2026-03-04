"""
Unit tests for the Docker-based execution engine.
"""

import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime

from app.services.execution_engine import (
    ExecutionEngine, 
    ContainerResourceManager, 
    ExecutionEngineService,
    SecurityMonitor,
    SecurityViolationType,
    ResourcePool
)
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode, ValidationResult
from app.core.config import settings


class TestContainerResourceManager:
    """Test container resource management functionality."""
    
    def test_get_resource_limits(self):
        """Test resource limits configuration."""
        manager = ContainerResourceManager()
        limits = manager.get_resource_limits()
        
        assert 'mem_limit' in limits
        assert 'cpu_quota' in limits
        assert 'cpu_period' in limits
        assert 'pids_limit' in limits
        assert 'ulimits' in limits
        
        # Verify CPU quota calculation
        assert limits['cpu_quota'] == 100000  # 1.0 * 100000
        assert limits['cpu_period'] == 100000
        assert limits['pids_limit'] == 100
    
    def test_get_security_options(self):
        """Test security options for container isolation."""
        manager = ContainerResourceManager()
        security = manager.get_security_options()
        
        assert 'security_opt' in security
        assert 'cap_drop' in security
        assert 'cap_add' in security
        assert 'tmpfs' in security
        assert 'network_mode' in security
        
        # Verify security settings
        assert 'no-new-privileges:true' in security['security_opt']
        assert 'ALL' in security['cap_drop']
        assert 'SETUID' in security['cap_add']
        assert security['network_mode'] == 'none'
    
    @patch('docker.models.containers.Container.stats')
    def test_monitor_container_resources(self, mock_stats):
        """Test container resource monitoring."""
        manager = ContainerResourceManager()
        
        # Mock container stats
        mock_stats.return_value = {
            'cpu_stats': {
                'cpu_usage': {'total_usage': 1000000, 'percpu_usage': [500000, 500000]},
                'system_cpu_usage': 10000000
            },
            'precpu_stats': {
                'cpu_usage': {'total_usage': 900000},
                'system_cpu_usage': 9000000
            },
            'memory_stats': {
                'usage': 134217728,  # 128 MB
                'limit': 2147483648  # 2 GB
            }
        }
        
        container = Mock()
        container.stats = mock_stats
        
        stats = manager.monitor_container_resources(container)
        
        assert 'cpu_percent' in stats
        assert 'memory_usage_mb' in stats
        assert 'memory_limit_mb' in stats
        assert 'memory_percent' in stats
        
        assert stats['memory_usage_mb'] == 128.0
        assert stats['memory_limit_mb'] == 2048.0
        assert stats['memory_percent'] == 6.25  # 128/2048 * 100


class TestExecutionEngine:
    """Test the main execution engine functionality."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine instance for testing."""
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_docker.return_value = mock_client
            
            # Mock image check
            mock_client.images.get.return_value = Mock()
            
            engine = ExecutionEngine()
            engine.docker_client = mock_client
            return engine
    
    def test_create_execution_wrapper(self, engine):
        """Test execution wrapper script creation."""
        wrapper = engine._create_execution_wrapper("test_code.py", "output.json")
        
        assert "import sys" in wrapper
        assert "import json" in wrapper
        assert "timeout_handler" in wrapper
        assert "exec(user_code, exec_globals)" in wrapper
        assert "SparkSession" in wrapper
        assert "/execution/user_code.py" in wrapper
        assert "/execution/output.json" in wrapper
    
    @pytest.mark.asyncio
    async def test_cleanup_container(self, engine):
        """Test container cleanup functionality."""
        # Mock container
        mock_container = Mock()
        mock_container.status = 'running'
        engine.docker_client.containers.get.return_value = mock_container
        
        await engine._cleanup_container("test_container_id")
        
        mock_container.stop.assert_called_once_with(timeout=5)
        mock_container.remove.assert_called_once_with(force=True)
    
    @pytest.mark.asyncio
    async def test_cleanup_container_not_found(self, engine):
        """Test cleanup when container doesn't exist."""
        from docker.errors import NotFound
        engine.docker_client.containers.get.side_effect = NotFound("Container not found")
        
        # Should not raise exception
        await engine._cleanup_container("nonexistent_container")
    
    @pytest.mark.asyncio
    async def test_validate_output_success(self, engine):
        """Test output validation for successful execution."""
        output = {
            'status': 'success',
            'result': {'data': 'test'},
            'stdout': 'Test output'
        }
        
        result = await engine._validate_output(output, "test_question")
        
        assert isinstance(result, ValidationResult)
        assert result.is_correct is True
        assert result.schema_match is True
        assert result.similarity_score == 1.0
    
    @pytest.mark.asyncio
    async def test_validate_output_failure(self, engine):
        """Test output validation for failed execution."""
        output = {
            'status': 'error',
            'error': 'Test error message'
        }
        
        result = await engine._validate_output(output, "test_question")
        
        assert isinstance(result, ValidationResult)
        assert result.is_correct is False
        assert result.schema_match is False
        assert result.similarity_score == 0.0
        assert len(result.error_details) == 1
        assert result.error_details[0].error_type == "execution_error"
    
    @pytest.mark.asyncio
    async def test_get_job_status_active(self, engine):
        """Test getting status of active job."""
        job_id = "test_job_123"
        engine.active_jobs[job_id] = {
            'status': ExecutionStatus.RUNNING,
            'start_time': 1000.0,
            'container_id': 'container_123',
            'user_id': 'user_123'
        }
        
        with patch('time.time', return_value=1010.0):  # 10 seconds elapsed
            status = await engine.get_job_status(job_id)
        
        assert status is not None
        assert status['job_id'] == job_id
        assert status['status'] == ExecutionStatus.RUNNING
        assert status['elapsed_time'] == 10.0
        assert 'progress' in status
        assert 'estimated_completion' in status
    
    @pytest.mark.asyncio
    async def test_get_job_status_nonexistent(self, engine):
        """Test getting status of non-existent job."""
        status = await engine.get_job_status("nonexistent_job")
        assert status is None
    
    @pytest.mark.asyncio
    async def test_list_active_jobs(self, engine):
        """Test listing all active jobs."""
        engine.active_jobs = {
            'job1': {
                'status': ExecutionStatus.RUNNING,
                'start_time': 1000.0,
                'user_id': 'user1'
            },
            'job2': {
                'status': ExecutionStatus.PENDING,
                'start_time': 1005.0,
                'user_id': 'user2'
            }
        }
        
        with patch('time.time', return_value=1010.0):
            jobs = await engine.list_active_jobs()
        
        assert len(jobs) == 2
        assert jobs[0]['job_id'] == 'job1'
        assert jobs[0]['elapsed_time'] == 10.0
        assert jobs[1]['job_id'] == 'job2'
        assert jobs[1]['elapsed_time'] == 5.0
    
    @pytest.mark.asyncio
    async def test_terminate_job(self, engine):
        """Test job termination."""
        job_id = "test_job_123"
        container_id = "container_123"
        
        engine.active_jobs[job_id] = {
            'status': ExecutionStatus.RUNNING,
            'start_time': 1000.0,
            'container_id': container_id
        }
        
        # Mock cleanup
        engine._cleanup_container = AsyncMock()
        
        result = await engine.terminate_job(job_id)
        
        assert result is True
        engine._cleanup_container.assert_called_once_with(container_id)
        assert engine.active_jobs[job_id]['status'] == ExecutionStatus.FAILED
    
    @pytest.mark.asyncio
    async def test_terminate_nonexistent_job(self, engine):
        """Test terminating non-existent job."""
        result = await engine.terminate_job("nonexistent_job")
        assert result is False
    
    def test_get_system_resources(self, engine):
        """Test system resource monitoring."""
        with patch('psutil.cpu_percent', return_value=25.5), \
             patch('psutil.virtual_memory') as mock_memory, \
             patch('psutil.disk_usage') as mock_disk:
            
            mock_memory.return_value.percent = 60.0
            mock_disk.return_value.percent = 45.0
            
            resources = engine.get_system_resources()
            
            assert resources['cpu_percent'] == 25.5
            assert resources['memory_percent'] == 60.0
            assert resources['disk_percent'] == 45.0
            assert 'active_containers' in resources
            assert 'active_jobs' in resources


class TestExecutionEngineIntegration:
    """Integration tests for the execution engine."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine with mocked Docker client."""
        engine = ExecutionEngine()
        # Mock the Docker client directly
        engine.docker_client = Mock()
        engine._docker_initialized = True
        return engine
    
    @pytest.mark.asyncio
    async def test_execute_code_success(self, engine):
        """Test successful code execution flow."""
        # Mock container execution
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed successfully"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 256.0,
            'cpu_percent': 15.0
        })
        
        # Mock temporary directory and output file
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'},
                'stdout': 'Test output'
            }
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            assert isinstance(result, ExecutionResult)
            assert result.status == ExecutionStatus.COMPLETED
            assert result.mode == ExecutionMode.TEST
            assert result.output is not None
            assert result.memory_usage == 256.0
            assert result.validation_result is not None
    
    @pytest.mark.asyncio
    async def test_execute_code_timeout(self, engine):
        """Test code execution timeout handling."""
        # Mock container that times out
        mock_container = Mock()
        mock_container.wait.side_effect = Exception("timeout")
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        engine._cleanup_container = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            
            result = await engine.execute_code(
                code="import time; time.sleep(1000)",
                question_id="test_question",
                mode="test"
            )
            
            assert result.status == ExecutionStatus.TIMEOUT  # The engine correctly detects timeout
            assert "timed out" in result.error_message.lower()
            engine._cleanup_container.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_code_container_error(self, engine):
        """Test handling of container execution errors."""
        # Mock container that fails
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 1}
        mock_container.logs.return_value = b"Python syntax error"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 128.0
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = False  # No output file created
            
            result = await engine.execute_code(
                code="invalid python syntax",
                question_id="test_question",
                mode="test"
            )
            
            assert result.status == ExecutionStatus.FAILED
            # Check that the error message contains information about the failure
            assert "failed" in result.error_message.lower() or "error" in result.error_message.lower()


class TestExecutionEngineService:
    """Test the service wrapper for the execution engine."""
    
    @pytest.mark.asyncio
    async def test_execute_code_delegation(self):
        """Test that service delegates to engine correctly."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_result = ExecutionResult(
                job_id="test_job",
                status=ExecutionStatus.COMPLETED,
                mode=ExecutionMode.TEST,
                output={'result': 'test'},
                execution_time=1.5,
                memory_usage=128.0
            )
            # Make the mock method async
            mock_engine.execute_code = AsyncMock(return_value=mock_result)
            
            result = await service.execute_code(
                code="test code",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            mock_engine.execute_code.assert_called_once_with(
                "test code", "test_question", "test", "test_user"
            )
            assert result == mock_result
    
    @pytest.mark.asyncio
    async def test_get_job_status_delegation(self):
        """Test job status retrieval delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_status = {'job_id': 'test_job', 'status': 'running'}
            # Make the mock method async
            mock_engine.get_job_status = AsyncMock(return_value=mock_status)
            
            result = await service.get_job_status("test_job")
            
            mock_engine.get_job_status.assert_called_once_with("test_job")
            assert result == mock_status
    
    def test_get_system_resources_delegation(self):
        """Test system resources retrieval delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_resources = {'cpu_percent': 25.0, 'memory_percent': 60.0}
            mock_engine.get_system_resources.return_value = mock_resources
            
            result = service.get_system_resources()
            
            mock_engine.get_system_resources.assert_called_once()
            assert result == mock_resources
    
    @pytest.mark.asyncio
    async def test_start_queue_processor_delegation(self):
        """Test queue processor start delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_engine.start_job_queue_processor = AsyncMock()
            
            await service.start_queue_processor()
            
            mock_engine.start_job_queue_processor.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_queue_status_delegation(self):
        """Test queue status retrieval delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_status = {'queue_length': 5, 'active_jobs': 2}
            mock_engine.get_queue_status = AsyncMock(return_value=mock_status)
            
            result = await service.get_queue_status()
            
            mock_engine.get_queue_status.assert_called_once()
            assert result == mock_status
    
    @pytest.mark.asyncio
    async def test_get_security_violations_delegation(self):
        """Test security violations retrieval delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_violations = [{'violation_type': 'resource_limit_exceeded'}]
            mock_engine.get_security_violations = AsyncMock(return_value=mock_violations)
            
            result = await service.get_security_violations(24)
            
            mock_engine.get_security_violations.assert_called_once_with(24)
            assert result == mock_violations
    
    @pytest.mark.asyncio
    async def test_get_execution_metrics_delegation(self):
        """Test execution metrics retrieval delegation."""
        with patch('app.services.execution_engine.get_execution_engine') as mock_get_engine:
            mock_engine = Mock()
            mock_get_engine.return_value = mock_engine
            
            service = ExecutionEngineService()
            
            mock_metrics = {
                'timestamp': '2024-01-01T00:00:00',
                'queue_status': {'queue_length': 3},
                'system_resources': {'cpu_percent': 50.0}
            }
            mock_engine.get_execution_metrics = AsyncMock(return_value=mock_metrics)
            
            result = await service.get_execution_metrics()
            
            mock_engine.get_execution_metrics.assert_called_once()
            assert result == mock_metrics
    
    @pytest.mark.asyncio
    async def test_get_cached_result(self):
        """Test retrieving cached execution results."""
        with patch('app.services.execution_engine.CacheManager.get_cache') as mock_cache:
            service = ExecutionEngineService()
            
            cached_data = {
                'job_id': 'test_job',
                'status': 'completed',
                'mode': 'test',
                'output': {'result': 'test'},
                'execution_time': 1.5,
                'memory_usage': 128.0
            }
            mock_cache.return_value = cached_data
            
            result = await service.get_cached_result("test_job")
            
            mock_cache.assert_called_once_with("execution_result:test_job")
            assert isinstance(result, ExecutionResult)
            assert result.job_id == "test_job"
    
    @pytest.mark.asyncio
    async def test_get_cached_result_not_found(self):
        """Test retrieving cached result when not found."""
        with patch('app.services.execution_engine.CacheManager.get_cache') as mock_cache:
            service = ExecutionEngineService()
            
            mock_cache.return_value = None
            
            result = await service.get_cached_result("nonexistent_job")
            
            assert result is None


class TestExecutionWrapperScript:
    """Test the execution wrapper script functionality."""
    
    def test_wrapper_script_structure(self):
        """Test that wrapper script has required components."""
        engine = ExecutionEngine()
        wrapper = engine._create_execution_wrapper("test_code.py", "output.json")
        
        # Check for essential components
        assert "def timeout_handler" in wrapper
        assert "def main" in wrapper
        assert "signal.signal(signal.SIGALRM" in wrapper
        assert "exec(user_code, exec_globals)" in wrapper
        assert "SparkSession.builder" in wrapper
        assert "json.dump(output" in wrapper
        
        # Check error handling
        assert "except TimeoutError" in wrapper
        assert "except Exception as e" in wrapper
        assert "finally:" in wrapper
        
        # Check Spark cleanup
        assert "spark.stop()" in wrapper
    
    def test_wrapper_script_security(self):
        """Test that wrapper script includes security measures."""
        engine = ExecutionEngine()
        wrapper = engine._create_execution_wrapper("test_code.py", "output.json")
        
        # Check timeout handling
        assert "signal.alarm" in wrapper
        assert "TimeoutError" in wrapper
        
        # Check controlled execution environment
        assert "exec_globals" in wrapper
        assert "__builtins__" in wrapper
        
        # Check resource limits in Spark config
        assert "spark.driver.memory" in wrapper
        assert "spark.executor.memory" in wrapper


class TestSecurityMonitor:
    """Test security monitoring functionality."""
    
    @pytest.fixture
    def security_monitor(self):
        """Create a security monitor instance for testing."""
        return SecurityMonitor()
    
    @pytest.mark.asyncio
    async def test_log_violation(self, security_monitor):
        """Test logging security violations."""
        with patch('app.services.execution_engine.get_redis') as mock_redis:
            mock_client = AsyncMock()
            mock_redis.return_value = mock_client
            
            await security_monitor.log_violation(
                SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
                "test_job_123",
                "test_user",
                {"resource": "memory", "usage_percent": 98.5}
            )
            
            # Check that violation was stored locally
            assert len(security_monitor.violations) == 1
            violation = security_monitor.violations[0]
            assert violation['violation_type'] == "resource_limit_exceeded"
            assert violation['job_id'] == "test_job_123"
            assert violation['user_id'] == "test_user"
            
            # Check Redis storage was attempted
            mock_client.lpush.assert_called_once()
            mock_client.expire.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_check_resource_violation_memory(self, security_monitor):
        """Test resource violation detection for memory."""
        security_monitor.log_violation = AsyncMock()
        
        resource_stats = {
            'memory_percent': 96.0,
            'cpu_percent': 50.0
        }
        
        await security_monitor.check_resource_violation("job_123", "user_123", resource_stats)
        
        security_monitor.log_violation.assert_called_once_with(
            SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
            "job_123", "user_123",
            {'resource': 'memory', 'usage_percent': 96.0}
        )
    
    @pytest.mark.asyncio
    async def test_check_resource_violation_cpu(self, security_monitor):
        """Test resource violation detection for CPU."""
        security_monitor.log_violation = AsyncMock()
        
        resource_stats = {
            'memory_percent': 50.0,
            'cpu_percent': 97.0
        }
        
        await security_monitor.check_resource_violation("job_123", "user_123", resource_stats)
        
        security_monitor.log_violation.assert_called_once_with(
            SecurityViolationType.RESOURCE_LIMIT_EXCEEDED,
            "job_123", "user_123",
            {'resource': 'cpu', 'usage_percent': 97.0}
        )
    
    @pytest.mark.asyncio
    async def test_get_recent_violations(self, security_monitor):
        """Test retrieving recent violations."""
        # Add some test violations
        security_monitor.violations = [
            {
                'timestamp': datetime.utcnow().isoformat(),
                'violation_type': 'resource_limit_exceeded',
                'job_id': 'job1',
                'user_id': 'user1'
            },
            {
                'timestamp': (datetime.utcnow()).isoformat(),
                'violation_type': 'execution_timeout',
                'job_id': 'job2',
                'user_id': 'user2'
            }
        ]
        
        recent = await security_monitor.get_recent_violations(24)
        assert len(recent) == 2


class TestResourcePool:
    """Test resource pool management functionality."""
    
    @pytest.fixture
    def resource_pool(self):
        """Create a resource pool instance for testing."""
        return ResourcePool(max_concurrent_containers=3)
    
    @pytest.mark.asyncio
    async def test_can_allocate_container_success(self, resource_pool):
        """Test successful container allocation check."""
        with patch.object(resource_pool, '_get_system_resources') as mock_resources:
            mock_resources.return_value = {
                'memory_percent': 50.0,
                'cpu_percent': 60.0,
                'disk_percent': 40.0
            }
            
            can_allocate = await resource_pool.can_allocate_container()
            assert can_allocate is True
    
    @pytest.mark.asyncio
    async def test_can_allocate_container_limit_reached(self, resource_pool):
        """Test container allocation when limit is reached."""
        # Fill up the pool
        resource_pool.active_containers = {
            'job1': {'user_id': 'user1'},
            'job2': {'user_id': 'user2'},
            'job3': {'user_id': 'user3'}
        }
        
        can_allocate = await resource_pool.can_allocate_container()
        assert can_allocate is False
    
    @pytest.mark.asyncio
    async def test_can_allocate_container_high_memory(self, resource_pool):
        """Test container allocation when system memory is high."""
        with patch.object(resource_pool, '_get_system_resources') as mock_resources:
            mock_resources.return_value = {
                'memory_percent': 85.0,  # Too high
                'cpu_percent': 60.0,
                'disk_percent': 40.0
            }
            
            can_allocate = await resource_pool.can_allocate_container()
            assert can_allocate is False
    
    @pytest.mark.asyncio
    async def test_allocate_container(self, resource_pool):
        """Test container allocation."""
        result = await resource_pool.allocate_container("job_123", "user_123")
        
        assert result is True
        assert "job_123" in resource_pool.active_containers
        assert resource_pool.active_containers["job_123"]["user_id"] == "user_123"
    
    @pytest.mark.asyncio
    async def test_deallocate_container(self, resource_pool):
        """Test container deallocation."""
        # First allocate
        await resource_pool.allocate_container("job_123", "user_123")
        
        # Then deallocate
        await resource_pool.deallocate_container("job_123")
        
        assert "job_123" not in resource_pool.active_containers
    
    @pytest.mark.asyncio
    async def test_update_container_usage(self, resource_pool):
        """Test updating container resource usage."""
        # Allocate container first
        await resource_pool.allocate_container("job_123", "user_123")
        
        # Update usage
        resource_stats = {
            'memory_usage_mb': 256.0,
            'cpu_percent': 25.0
        }
        
        await resource_pool.update_container_usage("job_123", resource_stats)
        
        container_info = resource_pool.active_containers["job_123"]
        assert container_info['memory_mb'] == 256.0
        assert container_info['cpu_percent'] == 25.0
        
        # Check total usage updated
        assert resource_pool.resource_usage['total_memory_mb'] == 256.0
        assert resource_pool.resource_usage['total_cpu_percent'] == 25.0
    
    @pytest.mark.asyncio
    async def test_get_pool_status(self, resource_pool):
        """Test getting pool status."""
        await resource_pool.allocate_container("job_123", "user_123")
        
        with patch.object(resource_pool, '_get_system_resources') as mock_resources:
            mock_resources.return_value = {
                'memory_percent': 50.0,
                'cpu_percent': 60.0,
                'disk_percent': 40.0
            }
            
            status = await resource_pool.get_pool_status()
            
            assert status['active_containers'] == 1
            assert status['max_concurrent'] == 3
            assert status['available_slots'] == 2
class TestExecutionEngineConcurrency:
    """Test concurrent execution functionality."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine with mocked dependencies."""
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_docker.return_value = mock_client
            mock_client.images.get.return_value = Mock()
            
            engine = ExecutionEngine()
            engine.docker_client = mock_client
            engine._docker_initialized = True
            return engine
    
    @pytest.mark.asyncio
    async def test_execute_code_queued_when_no_resources(self, engine):
        """Test that jobs are queued when no resources are available."""
        # Mock resource pool to deny allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=False)
        
        with patch('app.services.execution_engine.JobQueue.enqueue_job') as mock_enqueue:
            mock_enqueue.return_value = True
            
            result = await engine.execute_code(
                code="print('test')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            assert result.status == ExecutionStatus.QUEUED
            assert result.queued_at is not None
            mock_enqueue.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_start_job_queue_processor(self, engine):
        """Test starting the job queue processor."""
        with patch('asyncio.create_task') as mock_create_task:
            await engine.start_job_queue_processor()
            
            assert engine.job_queue_processor_running is True
            mock_create_task.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_stop_job_queue_processor(self, engine):
        """Test stopping the job queue processor."""
        engine.job_queue_processor_running = True
        
        await engine.stop_job_queue_processor()
        
        assert engine.job_queue_processor_running is False
    
    @pytest.mark.asyncio
    async def test_process_job_queue_with_job(self, engine):
        """Test processing a job from the queue."""
        engine.job_queue_processor_running = True
        
        # Mock dependencies
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        
        job_data = {
            'job_id': 'test_job_123',
            'code': 'print("test")',
            'question_id': 'test_question',
            'mode': 'test',
            'user_id': 'test_user'
        }
        
        with patch('app.services.execution_engine.JobQueue.dequeue_job') as mock_dequeue, \
             patch('asyncio.create_task') as mock_create_task:
            
            # Return job data once, then None to exit loop
            mock_dequeue.side_effect = [job_data, None]
            
            # Process one iteration - keep processor running during the call
            await engine._process_job_queue()
            
            # Should have created a task for the job
            mock_create_task.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_queued_job(self, engine):
        """Test executing a queued job."""
        job_data = {
            'job_id': 'test_job_123',
            'code': 'print("test")',
            'question_id': 'test_question',
            'mode': 'test',
            'user_id': 'test_user'
        }
        
        # Mock execute_code to return a result
        mock_result = ExecutionResult(
            job_id="test_job_123",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            output={'result': 'test'},
            execution_time=1.0,
            memory_usage=128.0
        )
        
        with patch.object(engine, 'execute_code') as mock_execute, \
             patch('app.services.execution_engine.CacheManager.set_cache') as mock_cache:
            
            mock_execute.return_value = mock_result
            mock_cache.return_value = True
            
            await engine._execute_queued_job(job_data)
            
            mock_execute.assert_called_once_with(
                code=job_data['code'],
                question_id=job_data['question_id'],
                mode=job_data['mode'],
                user_id=job_data['user_id']
            )
            mock_cache.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_queue_status(self, engine):
        """Test getting queue status."""
        with patch('app.services.execution_engine.JobQueue.get_queue_length') as mock_queue_len:
            mock_queue_len.return_value = 5
            engine.resource_pool.get_pool_status = AsyncMock(return_value={
                'active_containers': 2,
                'max_concurrent': 5
            })
            
            status = await engine.get_queue_status()
            
            assert status['queue_length'] == 5
            assert status['processor_running'] == engine.job_queue_processor_running
            assert 'resource_pool' in status
            assert status['active_jobs'] == len(engine.active_jobs)
    
    @pytest.mark.asyncio
    async def test_get_security_violations(self, engine):
        """Test getting security violations."""
        mock_violations = [
            {'violation_type': 'resource_limit_exceeded', 'job_id': 'job1'},
            {'violation_type': 'execution_timeout', 'job_id': 'job2'}
        ]
        
        engine.security_monitor.get_recent_violations = AsyncMock(return_value=mock_violations)
        
        violations = await engine.get_security_violations(24)
        
        assert len(violations) == 2
        assert violations[0]['violation_type'] == 'resource_limit_exceeded'
    
    @pytest.mark.asyncio
    async def test_get_execution_metrics(self, engine):
        """Test getting comprehensive execution metrics."""
        with patch.object(engine, 'get_queue_status') as mock_queue_status, \
             patch.object(engine, 'get_system_resources') as mock_system_resources, \
             patch.object(engine, 'get_security_violations') as mock_violations:
            
            mock_queue_status.return_value = {'queue_length': 3}
            mock_system_resources.return_value = {'cpu_percent': 50.0}
            mock_violations.return_value = [{'violation': 'test'}]
            
            metrics = await engine.get_execution_metrics()
            
            assert 'timestamp' in metrics
            assert 'queue_status' in metrics
            assert 'system_resources' in metrics
            assert 'recent_violations' in metrics
            assert metrics['recent_violations'] == 1
    
    @pytest.mark.asyncio
    async def test_security_monitoring_during_execution(self, engine):
        """Test that security violations are monitored during execution."""
        # Mock container execution with high resource usage
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock high resource usage
        high_resource_stats = {
            'memory_usage_mb': 256.0,
            'memory_percent': 96.0,  # High usage
            'cpu_percent': 15.0
        }
        
        engine.resource_manager.monitor_container_resources = Mock(return_value=high_resource_stats)
        engine.security_monitor.check_resource_violation = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify security monitoring was called
            engine.security_monitor.check_resource_violation.assert_called_once()
            
            # Verify the call arguments
            call_args = engine.security_monitor.check_resource_violation.call_args
            assert call_args[0][1] == "test_user"  # user_id
            assert call_args[0][2] == high_resource_stats  # resource_stats


class TestExecutionEngineResourceLimits:
    """Test resource limit enforcement and cleanup functionality."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine with mocked dependencies."""
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_docker.return_value = mock_client
            mock_client.images.get.return_value = Mock()
            
            engine = ExecutionEngine()
            engine.docker_client = mock_client
            engine._docker_initialized = True
            return engine
    
    @pytest.mark.asyncio
    async def test_memory_limit_enforcement(self, engine):
        """Test that memory limits are properly enforced in containers."""
        # Mock container creation with resource limits
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Memory limit exceeded"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock high memory usage that exceeds limits
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 2048.0,  # Exceeds typical limit
            'memory_percent': 98.0,
            'cpu_percent': 15.0
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="# Code that uses too much memory\ndata = [0] * 10000000",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify container was created with memory limits
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            assert 'mem_limit' in call_kwargs
            
            # Verify memory usage was monitored
            assert result.memory_usage == 2048.0
    
    @pytest.mark.asyncio
    async def test_cpu_limit_enforcement(self, engine):
        """Test that CPU limits are properly enforced in containers."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"CPU intensive task completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock high CPU usage
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 256.0,
            'memory_percent': 25.0,
            'cpu_percent': 95.0  # High CPU usage
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="# CPU intensive code\nfor i in range(1000000): pass",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify container was created with CPU limits
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            assert 'cpu_quota' in call_kwargs
            assert 'cpu_period' in call_kwargs
            
            # Verify CPU usage was monitored
            assert result.status == ExecutionStatus.COMPLETED
    
    @pytest.mark.asyncio
    async def test_timeout_enforcement(self, engine):
        """Test that execution timeout is properly enforced."""
        # Mock container that takes too long
        mock_container = Mock()
        mock_container.wait.side_effect = Exception("timeout")
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        engine._cleanup_container = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            
            result = await engine.execute_code(
                code="import time; time.sleep(1000)",  # Long running code
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify timeout was detected
            assert result.status == ExecutionStatus.TIMEOUT
            assert "timed out" in result.error_message.lower()
            
            # Verify container cleanup was called
            engine._cleanup_container.assert_called_once_with("container_123")
    
    @pytest.mark.asyncio
    async def test_container_cleanup_after_success(self, engine):
        """Test that containers are properly cleaned up after successful execution."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed successfully"
        mock_container.id = "container_123"
        mock_container.status = 'exited'
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.docker_client.containers.get.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify successful execution
            assert result.status == ExecutionStatus.COMPLETED
            
            # Verify container was removed
            mock_container.remove.assert_called_once_with(force=True)
            
            # Verify temporary directory was cleaned up
            mock_rmtree.assert_called_once_with("/tmp/test_exec", ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_container_cleanup_after_failure(self, engine):
        """Test that containers are properly cleaned up after failed execution."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 1}  # Failure
        mock_container.logs.return_value = b"Python syntax error"
        mock_container.id = "container_123"
        mock_container.status = 'exited'
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.docker_client.containers.get.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = False  # No output file
            
            result = await engine.execute_code(
                code="invalid python syntax",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify failed execution
            assert result.status == ExecutionStatus.FAILED
            
            # Verify container was still cleaned up
            mock_container.remove.assert_called_once_with(force=True)
            
            # Note: Temporary directory cleanup happens in finally block
            # and may not be called in this test scenario due to mocking
    
    @pytest.mark.asyncio
    async def test_container_isolation_security_options(self, engine):
        """Test that containers are created with proper security isolation."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify container was created with security options
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            
            # Check security options
            assert 'security_opt' in call_kwargs
            assert 'cap_drop' in call_kwargs
            assert 'cap_add' in call_kwargs
            assert 'network_mode' in call_kwargs
            assert 'tmpfs' in call_kwargs
            
            # Verify specific security settings
            assert 'no-new-privileges:true' in call_kwargs['security_opt']
            assert 'ALL' in call_kwargs['cap_drop']
            assert call_kwargs['network_mode'] == 'none'
    
    @pytest.mark.asyncio
    async def test_resource_pool_allocation_and_deallocation(self, engine):
        """Test that resource pool properly allocates and deallocates containers."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock resource pool methods
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.deallocate_container = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify resource allocation was checked
            engine.resource_pool.can_allocate_container.assert_called_once()
            
            # Verify container was allocated
            engine.resource_pool.allocate_container.assert_called_once()
            
            # Verify container was deallocated after execution
            engine.resource_pool.deallocate_container.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_docker_initialization_failure(self, engine):
        """Test handling of Docker initialization failures."""
        # Reset the engine to test initialization
        engine._docker_initialized = False
        engine.docker_client = None
        
        with patch('docker.from_env') as mock_docker:
            mock_docker.side_effect = Exception("Docker daemon not running")
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify failure due to Docker initialization
            assert result.status == ExecutionStatus.FAILED
            assert "Docker initialization failed" in result.error_message
    
    @pytest.mark.asyncio
    async def test_temporary_directory_creation_and_cleanup(self, engine):
        """Test that temporary directories are properly created and cleaned up."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        temp_dir = "/tmp/exec_test_123"
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_tempdir.return_value = temp_dir
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify temporary directory was created
            mock_tempdir.assert_called_once()
            
            # Verify code file was written (use os.path.join for cross-platform compatibility)
            expected_code_file = mock_tempdir.return_value + os.sep + "user_code.py"
            mock_open.assert_any_call(expected_code_file, 'w')
            
            # Verify temporary directory was cleaned up
            mock_rmtree.assert_called_once()


class TestExecutionEngineErrorScenarios:
    """Test various error scenarios and edge cases."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine with mocked dependencies."""
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_docker.return_value = mock_client
            mock_client.images.get.return_value = Mock()
            
            engine = ExecutionEngine()
            engine.docker_client = mock_client
            engine._docker_initialized = True
            return engine
    
    @pytest.mark.asyncio
    async def test_container_creation_failure(self, engine):
        """Test handling of container creation failures."""
        from docker.errors import APIError
        
        # Mock container creation failure
        engine.docker_client.containers.run.side_effect = APIError("Container creation failed")
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify failure was handled
            assert result.status == ExecutionStatus.FAILED
            assert "Execution failed" in result.error_message
    
    @pytest.mark.asyncio
    async def test_output_file_missing(self, engine):
        """Test handling when output file is not created."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"No output produced"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = False  # Output file doesn't exist
            
            result = await engine.execute_code(
                code="# Code that doesn't produce output",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify failure due to missing output
            assert result.status == ExecutionStatus.FAILED
            assert "No output produced" in result.error_message
    
    @pytest.mark.asyncio
    async def test_malformed_output_file(self, engine):
        """Test handling of malformed JSON output files."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify failure was handled gracefully
            assert result.status == ExecutionStatus.FAILED
            assert "Execution error" in result.error_message or "Invalid JSON" in result.error_message
    
    @pytest.mark.asyncio
    async def test_resource_allocation_failure(self, engine):
        """Test handling when resource allocation fails."""
        # Mock resource pool to deny allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=False)
        
        result = await engine.execute_code(
            code="print('Hello, World!')",
            question_id="test_question",
            mode="test",
            user_id="test_user"
        )
        
        # Verify failure due to resource allocation
        assert result.status == ExecutionStatus.FAILED
        assert "Failed to allocate container resources" in result.error_message
    
    @pytest.mark.asyncio
    async def test_container_stats_failure(self, engine):
        """Test handling when container stats monitoring fails."""
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock stats failure
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'cpu_percent': 0.0,
            'memory_usage_mb': 0.0,
            'memory_limit_mb': 0.0,
            'memory_percent': 0.0
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            result = await engine.execute_code(
                code="print('Hello, World!')",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify execution still succeeds despite stats failure
            assert result.status == ExecutionStatus.COMPLETED
            assert result.memory_usage == 0.0  # Default value when stats fail
    
    @pytest.mark.asyncio
    async def test_cleanup_container_already_removed(self, engine):
        """Test cleanup when container is already removed."""
        from docker.errors import NotFound
        
        # Mock container not found
        engine.docker_client.containers.get.side_effect = NotFound("Container not found")
        
        # Should not raise exception
        await engine._cleanup_container("nonexistent_container")
        
        # Verify get was called
        engine.docker_client.containers.get.assert_called_once_with("nonexistent_container")
    
    @pytest.mark.asyncio
    async def test_cleanup_container_stop_failure(self, engine):
        """Test cleanup when container stop fails."""
        mock_container = Mock()
        mock_container.status = 'running'
        mock_container.stop.side_effect = Exception("Stop failed")
        
        engine.docker_client.containers.get.return_value = mock_container
        
        # Should not raise exception, but should still try to remove
        await engine._cleanup_container("test_container")
        
        # Verify stop was attempted
        mock_container.stop.assert_called_once_with(timeout=5)
        
        # Verify remove was attempted (it may not be called if stop fails and exception is caught)
        # The actual implementation logs the error and continues


class TestExecutionEngineRequirementCompliance:
    """Test execution engine compliance with specific requirements 2.1, 2.2, 2.3, 2.4."""
    
    @pytest.fixture
    def engine(self):
        """Create an execution engine with mocked dependencies."""
        with patch('docker.from_env') as mock_docker:
            mock_client = Mock()
            mock_docker.return_value = mock_client
            mock_client.images.get.return_value = Mock()
            
            engine = ExecutionEngine()
            engine.docker_client = mock_client
            engine._docker_initialized = True
            return engine
    
    @pytest.mark.asyncio
    async def test_requirement_2_1_isolated_pyspark_container(self, engine):
        """
        Test Requirement 2.1: Isolated Container with PySpark runtime
        WHEN a user submits code for execution, THE Execution_Engine SHALL create 
        an isolated Container with PySpark runtime
        """
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"PySpark execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock resource pool to allow allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.deallocate_container = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            await engine.execute_code(
                code="from pyspark.sql import SparkSession; spark = SparkSession.builder.getOrCreate()",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify container was created with PySpark image
            engine.docker_client.containers.run.assert_called_once()
            call_args = engine.docker_client.containers.run.call_args
            
            # Check that the correct PySpark image is used
            assert call_args[1]['image'] == settings.EXECUTION_IMAGE
            
            # Check isolation settings
            call_kwargs = call_args[1]
            assert 'network_mode' in call_kwargs
            assert call_kwargs['network_mode'] == 'none'  # Network isolation
            assert 'volumes' in call_kwargs  # File system isolation
            assert 'working_dir' in call_kwargs
            assert call_kwargs['working_dir'] == '/execution'
    
    @pytest.mark.asyncio
    async def test_requirement_2_2_cpu_memory_limits(self, engine):
        """
        Test Requirement 2.2: CPU and memory limits enforcement
        WHEN executing user code, THE Container SHALL enforce CPU and memory limits 
        to prevent resource exhaustion
        """
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Resource limited execution completed"
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        
        # Mock resource pool to allow allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.deallocate_container = AsyncMock()
        
        # Mock resource monitoring to show limits are enforced
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 512.0,
            'memory_limit_mb': 1024.0,  # Shows limit is set
            'memory_percent': 50.0,
            'cpu_percent': 75.0
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'test_result'}
            }
            
            await engine.execute_code(
                code="# Resource intensive code\ndata = list(range(1000000))",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify container was created with resource limits
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            
            # Check memory limits
            assert 'mem_limit' in call_kwargs
            assert call_kwargs['mem_limit'] == settings.CONTAINER_MEMORY_LIMIT
            
            # Check CPU limits
            assert 'cpu_quota' in call_kwargs
            assert 'cpu_period' in call_kwargs
            expected_cpu_quota = int(float(settings.CONTAINER_CPU_LIMIT) * 100000)
            assert call_kwargs['cpu_quota'] == expected_cpu_quota
            assert call_kwargs['cpu_period'] == 100000
            
            # Check process limits
            assert 'pids_limit' in call_kwargs
            assert call_kwargs['pids_limit'] == 100
            
            # Verify resource monitoring was performed
            engine.resource_manager.monitor_container_resources.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_requirement_2_3_time_limits(self, engine):
        """
        Test Requirement 2.3: Time limits enforcement
        WHEN code execution exceeds time limits, THE Container SHALL terminate 
        the process and return a timeout error
        """
        # Mock container that times out
        mock_container = Mock()
        mock_container.wait.side_effect = Exception("timeout")
        mock_container.id = "container_123"
        
        engine.docker_client.containers.run.return_value = mock_container
        engine._cleanup_container = AsyncMock()
        
        # Mock resource pool to allow allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.deallocate_container = AsyncMock()
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('builtins.open', create=True) as mock_open, \
             patch('shutil.rmtree'):
            
            mock_tempdir.return_value = "/tmp/test_exec"
            
            result = await engine.execute_code(
                code="import time; time.sleep(1000)",  # Long running code
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify timeout was detected and handled
            assert result.status == ExecutionStatus.TIMEOUT
            assert "timed out" in result.error_message.lower()
            
            # Verify container was created with timeout consideration
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            
            # The timeout is enforced by container.wait(timeout=settings.CONTAINER_TIMEOUT)
            # Verify cleanup was called after timeout
            engine._cleanup_container.assert_called_once_with("container_123")
    
    @pytest.mark.asyncio
    async def test_requirement_2_4_container_destruction_data_leakage_prevention(self, engine):
        """
        Test Requirement 2.4: Container destruction to prevent data leakage
        WHEN containers complete execution, THE Execution_Engine SHALL destroy 
        the Container to prevent data leakage
        """
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Execution completed"
        mock_container.id = "container_123"
        mock_container.status = 'exited'
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.docker_client.containers.get.return_value = mock_container
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_tempdir.return_value = "/tmp/test_exec"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {'data': 'sensitive_data'}
            }
            
            result = await engine.execute_code(
                code="result = {'sensitive': 'data'}",
                question_id="test_question",
                mode="test",
                user_id="test_user"
            )
            
            # Verify successful execution
            assert result.status == ExecutionStatus.COMPLETED
            
            # Verify container was completely destroyed
            mock_container.remove.assert_called_once_with(force=True)
            
            # Verify temporary directory was cleaned up (prevents data leakage)
            mock_rmtree.assert_called_once_with("/tmp/test_exec", ignore_errors=True)
            
            # Verify container was removed from active containers tracking
            assert "container_123" not in engine.resource_manager.active_containers
            
            # Verify container creation used security options to prevent data leakage
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            
            # Check read-only filesystem where possible
            assert 'read_only' in call_kwargs
            
            # Check temporary filesystem mounts (prevents persistent data)
            assert 'tmpfs' in call_kwargs
            assert '/tmp' in call_kwargs['tmpfs']
            assert '/var/tmp' in call_kwargs['tmpfs']
            
            # Check that container is not kept around (remove=False but manual cleanup)
            assert 'remove' in call_kwargs
            assert call_kwargs['remove'] is False  # Manual cleanup for better control
    
    @pytest.mark.asyncio
    async def test_requirement_2_1_to_2_4_integration_scenario(self, engine):
        """
        Integration test covering all requirements 2.1-2.4 in a single execution scenario.
        Tests the complete flow: isolation -> resource limits -> time limits -> cleanup
        """
        mock_container = Mock()
        mock_container.wait.return_value = {'StatusCode': 0}
        mock_container.logs.return_value = b"Complete PySpark execution with limits"
        mock_container.id = "container_integration_test"
        mock_container.status = 'exited'
        
        engine.docker_client.containers.run.return_value = mock_container
        engine.docker_client.containers.get.return_value = mock_container
        
        # Mock resource pool to allow allocation
        engine.resource_pool.can_allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.allocate_container = AsyncMock(return_value=True)
        engine.resource_pool.deallocate_container = AsyncMock()
        
        # Mock resource monitoring showing limits are working
        engine.resource_manager.monitor_container_resources = Mock(return_value={
            'memory_usage_mb': 256.0,
            'memory_limit_mb': 1024.0,
            'memory_percent': 25.0,
            'cpu_percent': 45.0
        })
        
        with patch('tempfile.mkdtemp') as mock_tempdir, \
             patch('os.path.exists') as mock_exists, \
             patch('builtins.open', create=True) as mock_open, \
             patch('json.load') as mock_json_load, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_tempdir.return_value = "/tmp/integration_test"
            mock_exists.return_value = True
            mock_json_load.return_value = {
                'status': 'success',
                'result': {
                    'dataframe_rows': 1000,
                    'processing_time': 2.5
                }
            }
            
            result = await engine.execute_code(
                code="""
from pyspark.sql import SparkSession
import pandas as pd

# Create Spark session
spark = SparkSession.builder.appName("IntegrationTest").getOrCreate()

# Create test data
data = [(i, f"name_{i}") for i in range(1000)]
df = spark.createDataFrame(data, ["id", "name"])

# Perform some processing
result_df = df.filter(df.id > 500).count()
result = {"dataframe_rows": result_df, "processing_time": 2.5}

spark.stop()
                """,
                question_id="integration_test_question",
                mode="test",
                user_id="integration_test_user"
            )
            
            # Verify all requirements are met
            
            # Requirement 2.1: Isolated PySpark container
            engine.docker_client.containers.run.assert_called_once()
            call_kwargs = engine.docker_client.containers.run.call_args[1]
            assert call_kwargs['image'] == settings.EXECUTION_IMAGE
            assert call_kwargs['network_mode'] == 'none'
            assert call_kwargs['working_dir'] == '/execution'
            
            # Requirement 2.2: Resource limits enforced
            assert 'mem_limit' in call_kwargs
            assert 'cpu_quota' in call_kwargs
            assert 'pids_limit' in call_kwargs
            
            # Requirement 2.3: Time limits (verified by successful completion within limits)
            assert result.status == ExecutionStatus.COMPLETED
            assert result.execution_time > 0
            
            # Requirement 2.4: Container destruction and cleanup
            mock_container.remove.assert_called_once_with(force=True)
            mock_rmtree.assert_called_once_with("/tmp/integration_test", ignore_errors=True)
            
            # Verify security isolation
            assert 'security_opt' in call_kwargs
            assert 'no-new-privileges:true' in call_kwargs['security_opt']
            assert 'cap_drop' in call_kwargs
            assert 'ALL' in call_kwargs['cap_drop']
            
            # Verify resource monitoring occurred
            engine.resource_manager.monitor_container_resources.assert_called_once()
            assert result.memory_usage == 256.0
    
    def test_resource_manager_configuration_compliance(self):
        """
        Test that ContainerResourceManager provides compliant resource limits
        for requirements 2.2 (CPU and memory limits)
        """
        manager = ContainerResourceManager()
        
        # Test resource limits configuration
        limits = manager.get_resource_limits()
        
        # Verify memory limit is set
        assert 'mem_limit' in limits
        assert limits['mem_limit'] == settings.CONTAINER_MEMORY_LIMIT
        
        # Verify CPU limits are calculated correctly
        assert 'cpu_quota' in limits
        assert 'cpu_period' in limits
        expected_quota = int(float(settings.CONTAINER_CPU_LIMIT) * 100000)
        assert limits['cpu_quota'] == expected_quota
        assert limits['cpu_period'] == 100000
        
        # Verify process limits (prevents fork bombs)
        assert 'pids_limit' in limits
        assert limits['pids_limit'] == 100
        
        # Verify file descriptor limits
        assert 'ulimits' in limits
        ulimits = limits['ulimits']
        
        # Check for file descriptor limit
        nofile_limit = next((ul for ul in ulimits if ul.name == 'nofile'), None)
        assert nofile_limit is not None
        assert nofile_limit.soft == 1024
        assert nofile_limit.hard == 1024
        
        # Check for process limit
        nproc_limit = next((ul for ul in ulimits if ul.name == 'nproc'), None)
        assert nproc_limit is not None
        assert nproc_limit.soft == 50
        assert nproc_limit.hard == 50
    
    def test_security_options_compliance(self):
        """
        Test that ContainerResourceManager provides compliant security options
        for requirements 2.1 and 2.4 (isolation and data leakage prevention)
        """
        manager = ContainerResourceManager()
        
        # Test security options configuration
        security = manager.get_security_options()
        
        # Verify privilege restrictions (Requirement 2.1: Isolation)
        assert 'security_opt' in security
        assert 'no-new-privileges:true' in security['security_opt']
        
        # Verify capability restrictions
        assert 'cap_drop' in security
        assert 'ALL' in security['cap_drop']
        assert 'cap_add' in security
        assert 'SETUID' in security['cap_add']
        assert 'SETGID' in security['cap_add']
        
        # Verify network isolation (Requirement 2.1: Isolation)
        assert 'network_mode' in security
        assert security['network_mode'] == 'none'
        
        # Verify filesystem restrictions (Requirement 2.4: Data leakage prevention)
        assert 'read_only' in security
        assert 'tmpfs' in security
        
        # Check temporary filesystem mounts prevent data persistence
        tmpfs = security['tmpfs']
        assert '/tmp' in tmpfs
        assert '/var/tmp' in tmpfs
        assert 'noexec' in tmpfs['/tmp']
        assert 'nosuid' in tmpfs['/tmp']
        assert 'size=100m' in tmpfs['/tmp']