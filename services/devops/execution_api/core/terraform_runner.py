import tempfile
import subprocess
import os
import shutil

ALLOWED_ACTIONS = {"init", "plan", "apply", "destroy"}
TERRAFORM_TIMEOUT_SECONDS = int(os.getenv("TERRAFORM_TIMEOUT_SECONDS", "120"))

def run_terraform(payload):
    if payload.action not in ALLOWED_ACTIONS:
        raise ValueError("Invalid terraform action")

    workdir = tempfile.mkdtemp(prefix="tf_")

    try:
        # Write terraform files
        for filename, content in payload.terraform_files.items():
            with open(os.path.join(workdir, filename), "w") as f:
                f.write(content)

        commands = [["terraform", "init", "-no-color"]]

        if payload.action == "plan":
            commands.append(["terraform", "plan", "-no-color"])
        elif payload.action == "apply":
            cmd = ["terraform", "apply", "-no-color"]
            if payload.auto_approve:
                cmd.append("-auto-approve")
            commands.append(cmd)
        elif payload.action == "destroy":
            cmd = ["terraform", "destroy", "-no-color"]
            if payload.auto_approve:
                cmd.append("-auto-approve")
            commands.append(cmd)

        stdout, stderr = "", ""
        exit_code = 0

        for cmd in commands:
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=workdir,
                    capture_output=True,
                    text=True,
                    timeout=TERRAFORM_TIMEOUT_SECONDS,
                )
                stdout += proc.stdout
                stderr += proc.stderr
                exit_code = proc.returncode
                if exit_code != 0:
                    break
            except subprocess.TimeoutExpired:
                exit_code = 124
                stderr += (
                    f"Command '{' '.join(cmd)}' timed out after "
                    f"{TERRAFORM_TIMEOUT_SECONDS} seconds"
                )
                break

        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
        }

    finally:
        shutil.rmtree(workdir, ignore_errors=True)
