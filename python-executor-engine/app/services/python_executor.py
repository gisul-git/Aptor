"""Python code execution using Docker containers."""
import os
import json
import tempfile
import time
import docker
from typing import Tuple, Optional
from datetime import datetime

from app.models.response import Verdict


class PythonExecutor:
    """Executes Python code in isolated Docker containers."""

    def __init__(self):
        """Initialize Docker client (works on both Windows and Linux)."""
        self.docker_client = None
        self.image_name = "code-exec-python:3.11"
        self._docker_available = False
        
        # Try to initialize Docker client, but don't fail if Docker is not available
        # docker.from_env() automatically detects the correct connection method:
        # - Windows: Uses npipe:////./pipe/docker_engine
        # - Linux: Uses unix://var/run/docker.sock
        # - Inside container: Uses the mounted socket at /var/run/docker.sock
        try:
            self.docker_client = docker.from_env()
            # Test the connection by checking if we can ping the Docker daemon
            self.docker_client.ping()
            self._docker_available = True
        except Exception:
            # Docker is not available - this is OK, we'll handle it in execute()
            self._docker_available = False
            self.docker_client = None

    def execute(
        self,
        code: str,
        test_input: dict,
        time_limit_ms: int = 3000,
        memory_limit_mb: int = 256
    ) -> Tuple[Verdict, Optional[str], Optional[str], Optional[int], Optional[int], Optional[int]]:
        """
        Execute Python code in Docker container.

        Args:
            code: Complete Python code (with if __name__ == '__main__')
            test_input: Test input as dictionary
            time_limit_ms: Time limit in milliseconds
            memory_limit_mb: Memory limit in megabytes

        Returns:
            Tuple of (verdict, output, error, runtime_ms, memory_kb, exit_code)
        """
        # Check if Docker is available
        if not self._docker_available or self.docker_client is None:
            # Try to initialize Docker client if not already done
            try:
                self.docker_client = docker.from_env()
                self.docker_client.ping()
                self._docker_available = True
            except Exception:
                return (
                    Verdict.RUNTIME_ERROR,
                    None,
                    "Docker is not available. Please ensure Docker is running.",
                    None,
                    None,
                    None
                )
        
        temp_dir = None
        container = None

        try:
            # Create temporary directory for code
            temp_dir = tempfile.mkdtemp()
            code_file = os.path.join(temp_dir, "solution.py")

            # Write code to file
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(code)

            # Prepare JSON input - write to file for safer handling
            json_input = json.dumps(test_input)
            json_file = os.path.join(temp_dir, "input.json")
            with open(json_file, 'w', encoding='utf-8') as f:
                f.write(json_input)

            # Create Docker container
            # Python doesn't need compilation, just execution
            timeout_seconds = max(1, (time_limit_ms / 1000.0) + 1)
            container = self.docker_client.containers.create(
                image=self.image_name,
                command=["sh", "-c", "mkdir -p /tmp/workdir && cp /code/*.py /tmp/workdir/ && cp /code/*.json /tmp/workdir/ && cd /tmp/workdir && timeout " + str(timeout_seconds) + " python3 solution.py < input.json"],
                volumes={temp_dir: {"bind": "/code", "mode": "ro"}},
                mem_limit=f"{memory_limit_mb}m",
                memswap_limit=f"{memory_limit_mb}m",
                cpu_quota=100000,
                pids_limit=50,
                network_disabled=True,
                read_only=True,
                user="coderunner",
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                tmpfs={"/tmp": "size=100M"},
                detach=True
            )

            # Start container and measure time
            start_time = time.time()
            container.start()

            # Wait for container with timeout
            total_timeout = (time_limit_ms / 1000.0) + 10  # Add 10s buffer
            try:
                exit_code = container.wait(timeout=total_timeout)
                runtime_ms = int((time.time() - start_time) * 1000)
            except Exception as wait_error:
                # Timeout or other error
                runtime_ms = int((time.time() - start_time) * 1000)
                container.reload()
                if container.status == 'running':
                    # Still running - kill it
                    container.kill()
                    container.wait()
                    if runtime_ms >= time_limit_ms:
                        return (Verdict.TIME_LIMIT_EXCEEDED, None, "Time limit exceeded", runtime_ms, None, None)
                exit_code = container.attrs.get("State", {}).get("ExitCode", 1)

            # Get container logs
            logs = container.logs(stdout=True, stderr=True).decode('utf-8', errors='ignore')

            # Get memory stats
            stats = container.stats(stream=False)
            memory_kb = None
            if stats:
                memory_usage = stats.get('memory_stats', {}).get('usage', 0)
                if memory_usage:
                    memory_kb = memory_usage // 1024

            # Parse output and error
            output_lines = []
            error_lines = []

            # Split logs into stdout and stderr
            # Docker logs combines both, so we need to detect
            for line in logs.split('\n'):
                line = line.strip()
                if not line:
                    continue

                # Check for syntax errors
                if any(keyword in line.lower() for keyword in [
                    "syntaxerror", "syntax error", "invalid syntax",
                    "indentationerror", "indentation error",
                    "taberror", "tab error"
                ]):
                    error_lines.append(line)
                    continue

                # Check for runtime errors (Exception, Error in output)
                if any(keyword in line for keyword in [
                    "Traceback", "Exception", "Error", "File \"", "line ",
                    "TypeError", "ValueError", "AttributeError", "KeyError",
                    "IndexError", "NameError", "ZeroDivisionError", "RecursionError"
                ]):
                    error_lines.append(line)
                    continue

                # Check for memory errors
                if "MemoryError" in line or "out of memory" in line.lower():
                    error_lines.append(line)
                    continue

                # Check for timeout
                if "timeout" in line.lower() or "killed" in line.lower():
                    error_lines.append(line)
                    continue

                # Try to detect if it's JSON output (starts with [ or { or is a primitive)
                if (line.startswith('[') or line.startswith('{') or
                    line in ['null', 'None', 'true', 'false', 'True', 'False'] or
                    (line.replace('-', '').replace('.', '').replace('e', '').replace('E', '').replace('+', '').isdigit())):
                    output_lines.append(line)
                else:
                    # If it looks like an error message, add to errors
                    if line.startswith("Error:") or "error" in line.lower():
                        error_lines.append(line)
                    else:
                        # Ambiguous - try to parse as JSON, if fails, treat as error
                        try:
                            json.loads(line)
                            output_lines.append(line)
                        except:
                            # Check if it's a valid Python literal
                            try:
                                import ast
                                ast.literal_eval(line)  # Safe - only evaluates literals
                                output_lines.append(line)
                            except:
                                error_lines.append(line)

            output = '\n'.join(output_lines) if output_lines else None
            error = '\n'.join(error_lines) if error_lines else None

            # Check if syntax error
            syntax_keywords = [
                "syntaxerror", "syntax error", "invalid syntax",
                "indentationerror", "indentation error",
                "taberror", "tab error", "unexpected eof"
            ]
            if error and any(keyword in error.lower() for keyword in syntax_keywords):
                return (Verdict.SYNTAX_ERROR, output, error, runtime_ms, memory_kb, exit_code)

            # Check for MemoryError
            if error and ("MemoryError" in error or "out of memory" in error.lower()):
                return (Verdict.MEMORY_LIMIT_EXCEEDED, output, error, runtime_ms, memory_kb, exit_code)

            # Check for RecursionError (could be memory or just recursion limit)
            if error and "RecursionError" in error:
                # Treat as runtime error, but could also be memory
                if memory_kb and memory_kb > memory_limit_mb * 1024:
                    return (Verdict.MEMORY_LIMIT_EXCEEDED, output, error, runtime_ms, memory_kb, exit_code)

            # Determine verdict
            if exit_code != 0:
                if runtime_ms >= time_limit_ms:
                    verdict = Verdict.TIME_LIMIT_EXCEEDED
                elif memory_kb and memory_kb > memory_limit_mb * 1024:
                    verdict = Verdict.MEMORY_LIMIT_EXCEEDED
                else:
                    verdict = Verdict.RUNTIME_ERROR
            elif runtime_ms >= time_limit_ms:
                verdict = Verdict.TIME_LIMIT_EXCEEDED
            elif memory_kb and memory_kb > memory_limit_mb * 1024:
                verdict = Verdict.MEMORY_LIMIT_EXCEEDED
            else:
                # Success - output will be compared in main.py
                verdict = Verdict.ACCEPTED

            return (verdict, output, error, runtime_ms, memory_kb, exit_code)

        except Exception as e:
            return (Verdict.RUNTIME_ERROR, None, str(e), None, None, None)

        finally:
            # Cleanup
            if container:
                try:
                    container.remove(force=True)
                except:
                    pass

            if temp_dir and os.path.exists(temp_dir):
                try:
                    import shutil
                    shutil.rmtree(temp_dir)
                except:
                    pass