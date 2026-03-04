"""
Simple tests for PySpark execution environment without Docker Python library.

These tests verify the execution environment by running Docker commands directly.
"""

import pytest
import subprocess
import json
import os
import tempfile
import time
from pathlib import Path


class TestPySparkExecutorSimple:
    """Simple test suite for PySpark executor environment."""
    
    def test_executor_image_exists(self):
        """Test that the executor image is built and available."""
        result = subprocess.run(
            ["docker", "images", "data-engineer-platform/pyspark-executor:latest", "--format", "{{.Repository}}"],
            capture_output=True,
            text=True
        )
        
        assert result.returncode == 0, "Docker command failed"
        assert "data-engineer-platform/pyspark-executor" in result.stdout, "Executor image not found"
    
    def test_pyspark_import(self):
        """Test that PySpark can be imported in the executor."""
        result = subprocess.run([
            "docker", "run", "--rm",
            "data-engineer-platform/pyspark-executor:latest",
            "python3", "-c", "import pyspark; print(pyspark.__version__)"
        ], capture_output=True, text=True)
        
        assert result.returncode == 0, f"PySpark import failed: {result.stderr}"
        assert result.stdout.strip().startswith("3.5"), f"Expected PySpark 3.5.x, got: {result.stdout.strip()}"
    
    def test_successful_execution_with_output_file(self):
        """Test successful code execution with output file verification."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create user code
            user_code = """
import pandas as pd
from pyspark.sql import functions as F

# Create a simple DataFrame
data = [(1, "Alice"), (2, "Bob"), (3, "Charlie")]
df = spark.createDataFrame(data, ["id", "name"])

# Transform and convert to Pandas
result = df.select(F.col("id"), F.upper(F.col("name")).alias("upper_name")).toPandas()
"""
            
            code_file = os.path.join(temp_dir, "user_code.py")
            with open(code_file, 'w') as f:
                f.write(user_code)
            
            # Run container
            result = subprocess.run([
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/execution",
                "data-engineer-platform/pyspark-executor:latest"
            ], capture_output=True, text=True, timeout=120)
            
            assert result.returncode == 0, f"Container execution failed: {result.stderr}"
            
            # Read output
            output_file = os.path.join(temp_dir, "output.json")
            assert os.path.exists(output_file), "Output file not created"
            
            with open(output_file, 'r') as f:
                output = json.load(f)
            
            # Verify output structure
            assert output['status'] == 'success'
            assert 'result' in output
            assert output['result']['type'] == 'dataframe'
            assert len(output['result']['data']) == 3
            assert 'execution_time' in output
            assert 'memory_usage_mb' in output
    
    def test_error_handling_with_output_file(self):
        """Test error handling for code with runtime errors."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create code with error
            user_code = """
# This will cause a NameError
result = undefined_variable + 5
"""
            
            code_file = os.path.join(temp_dir, "user_code.py")
            with open(code_file, 'w') as f:
                f.write(user_code)
            
            # Run container
            result = subprocess.run([
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/execution",
                "data-engineer-platform/pyspark-executor:latest"
            ], capture_output=True, text=True, timeout=60)
            
            assert result.returncode == 1, "Container should exit with error status"
            
            # Read output
            output_file = os.path.join(temp_dir, "output.json")
            assert os.path.exists(output_file), "Output file not created"
            
            with open(output_file, 'r') as f:
                output = json.load(f)
            
            # Verify error output
            assert output['status'] == 'error'
            assert 'error' in output
            assert 'NameError' in output['error_type']
            assert 'traceback' in output
            assert 'undefined_variable' in output['error']
    
    def test_common_libraries_available(self):
        """Test that common data science libraries are available."""
        result = subprocess.run([
            "docker", "run", "--rm",
            "data-engineer-platform/pyspark-executor:latest",
            "python3", "-c", 
            "import pandas as pd; import numpy as np; import pyspark; print('All libraries imported successfully')"
        ], capture_output=True, text=True)
        
        assert result.returncode == 0, f"Library import failed: {result.stderr}"
        assert "All libraries imported successfully" in result.stdout
    
    def test_resource_limits_applied(self):
        """Test that resource limits can be applied to the container."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create code that uses some resources
            user_code = """
import pandas as pd
import numpy as np

# Create a small DataFrame
data = np.random.rand(1000, 5)
df = pd.DataFrame(data)

result = df.describe()
"""
            
            code_file = os.path.join(temp_dir, "user_code.py")
            with open(code_file, 'w') as f:
                f.write(user_code)
            
            # Run container with resource limits
            result = subprocess.run([
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/execution",
                "--memory=1g",
                "--cpus=0.5",
                "data-engineer-platform/pyspark-executor:latest"
            ], capture_output=True, text=True, timeout=60)
            
            assert result.returncode == 0, f"Container execution with limits failed: {result.stderr}"
            
            # Read output
            output_file = os.path.join(temp_dir, "output.json")
            assert os.path.exists(output_file), "Output file not created"
            
            with open(output_file, 'r') as f:
                output = json.load(f)
            
            # Verify execution completed within resource limits
            assert output['status'] == 'success'
            assert output['memory_usage_mb'] < 1024  # Should be under 1GB
    
    def test_security_no_network_access(self):
        """Test that the container has no network access when configured."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create code that tries to access network (should fail)
            user_code = """
import socket

try:
    # Try to resolve a hostname (should fail with no network)
    socket.gethostbyname('google.com')
    result = "Network access available"
except Exception as e:
    result = f"Network access blocked: {type(e).__name__}"
"""
            
            code_file = os.path.join(temp_dir, "user_code.py")
            with open(code_file, 'w') as f:
                f.write(user_code)
            
            # Run container with no network access
            result = subprocess.run([
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/execution",
                "--network=none",
                "data-engineer-platform/pyspark-executor:latest"
            ], capture_output=True, text=True, timeout=60)
            
            assert result.returncode == 0, f"Container execution failed: {result.stderr}"
            
            # Read output
            output_file = os.path.join(temp_dir, "output.json")
            assert os.path.exists(output_file), "Output file not created"
            
            with open(output_file, 'r') as f:
                output = json.load(f)
            
            # Verify network access was blocked
            assert output['status'] == 'success'
            assert "Network access blocked" in str(output['result']['data'])
    
    def test_execution_wrapper_functionality(self):
        """Test that the execution wrapper handles various scenarios correctly."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create comprehensive test code
            user_code = """
import pandas as pd
import numpy as np
from pyspark.sql import functions as F
import sys

# Test print statements
print("Starting execution")
print("This goes to stderr", file=sys.stderr)

# Test DataFrame creation and transformation
data = [(1, "test", 100.5), (2, "data", 200.7)]
df = spark.createDataFrame(data, ["id", "name", "value"])

# Apply transformations
result_df = df.select(
    F.col("id"),
    F.upper(F.col("name")).alias("upper_name"),
    F.round(F.col("value"), 1).alias("rounded_value")
)

# Convert to Pandas for output
result = result_df.toPandas()

print("Execution completed successfully")
"""
            
            code_file = os.path.join(temp_dir, "user_code.py")
            with open(code_file, 'w') as f:
                f.write(user_code)
            
            # Run container
            result = subprocess.run([
                "docker", "run", "--rm",
                "-v", f"{temp_dir}:/execution",
                "data-engineer-platform/pyspark-executor:latest"
            ], capture_output=True, text=True, timeout=120)
            
            assert result.returncode == 0, f"Container execution failed: {result.stderr}"
            
            # Read output
            output_file = os.path.join(temp_dir, "output.json")
            assert os.path.exists(output_file), "Output file not created"
            
            with open(output_file, 'r') as f:
                output = json.load(f)
            
            # Verify comprehensive output
            assert output['status'] == 'success'
            assert 'Starting execution' in output['stdout']
            assert 'Execution completed successfully' in output['stdout']
            assert 'This goes to stderr' in output['stderr']
            
            # Verify DataFrame result
            assert output['result']['type'] == 'dataframe'
            assert output['result']['shape'] == [2, 3]
            assert set(output['result']['columns']) == {'id', 'upper_name', 'rounded_value'}
            
            # Verify data content
            data = output['result']['data']
            assert len(data) == 2
            assert data[0]['upper_name'] == 'TEST'
            assert data[1]['upper_name'] == 'DATA'
            assert data[0]['rounded_value'] == 100.5
            assert data[1]['rounded_value'] == 200.7
            
            # Verify metadata
            assert 'execution_time' in output
            assert 'memory_usage_mb' in output
            assert 'timestamp' in output
            assert output['execution_time'] > 0
            assert output['memory_usage_mb'] > 0