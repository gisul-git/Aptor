import os
import shutil
import re
import shlex
import subprocess
from dataclasses import dataclass
from typing import List


NSJAIL_CONFIG_PATH = os.getenv("NSJAIL_CONFIG_PATH", "/app/nsjail.cfg")
DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_CLI_BIN = os.getenv("AWS_CLI_BIN", "/usr/bin/aws")
TERRAFORM_BIN = os.getenv("TERRAFORM_BIN", "/usr/local/bin/terraform")
TERRAFORM_WORKDIR_BASE = os.getenv("TERRAFORM_WORKDIR_BASE", "/tmp/cloud_engine_tf")
MAX_COMMAND_LENGTH = int(os.getenv("MAX_COMMAND_LENGTH", "512"))
EXECUTION_TIMEOUT_SECONDS = int(os.getenv("EXECUTION_TIMEOUT_SECONDS", "20"))
FORCE_SUCCESS_RESPONSE = os.getenv("FORCE_SUCCESS_RESPONSE", "false").lower() == "true"
NSJAIL_LOGS_ONLY = os.getenv("NSJAIL_LOGS_ONLY", "false").lower() == "true"

_HOST_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}[a-zA-Z0-9]$")
_SESSION_RE = re.compile(r"[^a-zA-Z0-9_-]")
_TERRAFORM_ACTIONS = {"init", "plan", "apply", "destroy", "validate"}


class ExecutionValidationError(ValueError):
    pass


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    sandbox_logs: str
    command_stderr: str


def _validate_endpoint(endpoint: str) -> str:
    host = endpoint.strip()
    if not host:
        raise ExecutionValidationError("localstack_host is required")
    if "/" in host or ":" in host or host.startswith("http"):
        raise ExecutionValidationError("localstack_host must be a plain hostname (without scheme, path, or port)")
    if not _HOST_RE.fullmatch(host):
        raise ExecutionValidationError("localstack_host contains invalid characters")
    return host


def _parse_aws_tokens(command: str) -> List[str]:
    raw = command.strip()
    if not raw:
        raise ExecutionValidationError("command is required")
    if len(raw) > MAX_COMMAND_LENGTH:
        raise ExecutionValidationError(f"command exceeds max length ({MAX_COMMAND_LENGTH})")

    try:
        tokens = shlex.split(raw)
    except ValueError as exc:
        raise ExecutionValidationError(f"invalid command syntax: {exc}") from exc

    if not tokens:
        raise ExecutionValidationError("command is empty")

    # Accept both "aws s3 ls" and "s3 ls" input forms.
    if tokens[0].lower() == "aws":
        tokens = tokens[1:]

    if not tokens:
        raise ExecutionValidationError("AWS subcommand is missing")
    return tokens


def build_aws_command(command: str, endpoint: str) -> List[str]:
    host = _validate_endpoint(endpoint)
    tokens = _parse_aws_tokens(command)
    return [
        AWS_CLI_BIN,
        *tokens,
        f"--endpoint-url=http://{host}:4566",
    ]


def _normalize_session_id(session_id: str) -> str:
    trimmed = session_id.strip()
    if not trimmed:
        raise ExecutionValidationError("session_id is required")
    cleaned = _SESSION_RE.sub("-", trimmed)[:64].strip("-")
    if not cleaned:
        raise ExecutionValidationError("session_id contains no valid characters")
    return cleaned


def _prepare_terraform_workspace(session_id: str, terraform_code: str) -> str:
    if not terraform_code.strip():
        raise ExecutionValidationError("terraform_code is required for terraform mode")

    safe_session = _normalize_session_id(session_id)
    workspace_root = TERRAFORM_WORKDIR_BASE
    workspace_path = os.path.join(workspace_root, safe_session)
    os.makedirs(workspace_path, exist_ok=True)

    main_tf_path = os.path.join(workspace_path, "main.tf")
    with open(main_tf_path, "w", encoding="utf-8") as file:
        file.write(terraform_code)

    return workspace_path


def build_terraform_commands(workspace_path: str, action: str) -> List[List[str]]:
    normalized_action = action.strip().lower()
    if normalized_action not in _TERRAFORM_ACTIONS:
        raise ExecutionValidationError(f"Unsupported terraform_action: {action}")

    init_cmd = [TERRAFORM_BIN, f"-chdir={workspace_path}", "init", "-input=false", "-no-color"]
    if normalized_action == "init":
        return [init_cmd]

    action_cmd: List[str] = [TERRAFORM_BIN, f"-chdir={workspace_path}", normalized_action, "-no-color"]
    if normalized_action in {"plan", "apply", "destroy"}:
        action_cmd.append("-input=false")
    if normalized_action in {"apply", "destroy"}:
        action_cmd.append("-auto-approve")

    return [init_cmd, action_cmd]


def _split_stderr(stderr: str) -> tuple[str, str]:
    nsjail_lines: list[str] = []
    command_lines: list[str] = []
    for line in stderr.splitlines():
        if line.startswith(("[I][", "[W][", "[E][", "[F][")):
            nsjail_lines.append(line)
        else:
            command_lines.append(line)
    nsjail_log = "\n".join(nsjail_lines)
    command_log = "\n".join(command_lines)
    if nsjail_log:
        nsjail_log += "\n"
    if command_log:
        command_log += "\n"
    return nsjail_log, command_log


def execute_in_nsjail(command_argv: List[str]) -> ExecutionResult:
    nsjail_cmd = [
        "nsjail",
        "--config",
        NSJAIL_CONFIG_PATH,
        "--disable_clone_newnet",
        "--env",
        "AWS_ACCESS_KEY_ID=test",
        "--env",
        "AWS_SECRET_ACCESS_KEY=test",
        "--env",
        f"AWS_DEFAULT_REGION={DEFAULT_REGION}",
        "--",
        *command_argv,
    ]

    try:
        completed = subprocess.run(
            nsjail_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=EXECUTION_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(
            f"command timed out after {EXECUTION_TIMEOUT_SECONDS}s"
        ) from exc

    sandbox_logs, command_stderr = _split_stderr(completed.stderr or "")
    if NSJAIL_LOGS_ONLY:
        response_stderr = sandbox_logs
    else:
        response_stderr = f"{sandbox_logs}{command_stderr}"

    if FORCE_SUCCESS_RESPONSE:
        exit_code = 0
    else:
        exit_code = completed.returncode

    return ExecutionResult(
        stdout=completed.stdout or "",
        stderr=response_stderr,
        exit_code=exit_code,
        sandbox_logs=sandbox_logs,
        command_stderr=command_stderr,
    )


def execute_terraform_in_nsjail(session_id: str, terraform_code: str, action: str) -> ExecutionResult:
    workspace_path = _prepare_terraform_workspace(session_id, terraform_code)
    commands = build_terraform_commands(workspace_path, action)

    combined_stdout: list[str] = []
    combined_stderr: list[str] = []
    final_exit_code = 0

    try:
        for idx, command in enumerate(commands):
            result = execute_in_nsjail(command)
            if result.stdout:
                combined_stdout.append(result.stdout)
            if result.stderr:
                combined_stderr.append(result.stderr)

            final_exit_code = result.exit_code
            if result.exit_code != 0:
                break

            if len(commands) > 1 and idx == 0:
                combined_stdout.append("Terraform init completed.\n")

        return ExecutionResult(
            stdout="".join(combined_stdout),
            stderr="".join(combined_stderr),
            exit_code=final_exit_code,
            sandbox_logs="",
            command_stderr="",
        )
    finally:
        shutil.rmtree(workspace_path, ignore_errors=True)
