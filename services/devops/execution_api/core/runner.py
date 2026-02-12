import subprocess
import time

NSJAIL_CONTAINER = "nsjail-runtime"
RESTARTING_ERROR_FRAGMENT = "is restarting, wait until the container is running"
MAX_RETRIES = 6
RETRY_DELAY_SECONDS = 0.5

def run_command(command: str) -> dict:
    completed = None

    for attempt in range(MAX_RETRIES):
        completed = subprocess.run(
            ["docker", "exec", NSJAIL_CONTAINER, "sh", "-c", command],
            capture_output=True,
            text=True,
            timeout=5
        )

        # Transient daemon error while the runtime container is still booting.
        if completed.returncode == 0 or RESTARTING_ERROR_FRAGMENT not in (completed.stderr or ""):
            break

        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY_SECONDS)

    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "exit_code": completed.returncode,
    }
