import subprocess
import tempfile
from typing import Dict, List
import os
HADOLINT_PATH = os.getenv("HADOLINT_PATH", "hadolint")



def lint_dockerfile(content: str) -> Dict:
    fd, tmp_path = tempfile.mkstemp(text=True)

    try:
        with os.fdopen(fd, "w") as tmp:
            tmp.write(content)

        result = subprocess.run(
            [HADOLINT_PATH, tmp_path],
            capture_output=True,
            text=True,
        )

        errors, warnings = _parse_hadolint_output(
            result.stdout + result.stderr
        )

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


def _parse_hadolint_output(output: str) -> (List[str], List[str]):
    errors = []
    warnings = []

    for line in output.splitlines():
        if "DL" in line:
            errors.append(line.strip())
        elif "SC" in line:
            warnings.append(line.strip())

    return errors, warnings
