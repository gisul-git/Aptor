import subprocess
import tempfile
import os
from typing import Dict, List

ACTIONLINT_PATH = os.getenv("ACTIONLINT_PATH", "actionlint")


def lint_github_actions(content: str) -> Dict:
    fd, tmp_path = tempfile.mkstemp(suffix=".yml", text=True)

    try:
        with os.fdopen(fd, "w") as tmp:
            tmp.write(content)

        try:
            result = subprocess.run(
                [ACTIONLINT_PATH, tmp_path],
                capture_output=True,
                text=True,
                timeout=30,
            )
        except FileNotFoundError:
            return {
                "status": "failed",
                "errors": [f"actionlint binary not found at '{ACTIONLINT_PATH}'"],
                "warnings": [],
                "score": 0,
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "failed",
                "errors": ["actionlint timed out after 30 seconds"],
                "warnings": [],
                "score": 0,
            }
        except OSError as exc:
            return {
                "status": "failed",
                "errors": [f"actionlint failed to execute: {exc}"],
                "warnings": [],
                "score": 0,
            }

        errors: List[str] = []
        warnings: List[str] = []

        if result.returncode != 0:
            errors.extend(_lines(result.stdout + result.stderr))

        status = "passed" if not errors else "failed"
        score = max(0, 100 - len(errors) * 20)

        return {
            "status": status,
            "errors": errors,
            "warnings": warnings,
            "score": score,
        }

    finally:
        os.remove(tmp_path)


def _lines(output: str) -> List[str]:
    return [line.strip() for line in output.splitlines() if line.strip()]

