import subprocess

NSJAIL_CONTAINER = "nsjail-runtime"

def run_command(command: str) -> dict:
    completed = subprocess.run(
        ["docker", "exec", NSJAIL_CONTAINER, "sh", "-c", command],
        capture_output=True,
        text=True,
        timeout=5
    )

    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "exit_code": completed.returncode,
    }
