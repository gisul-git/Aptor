import subprocess
import tempfile
import os
from typing import Dict, List

KUBECONFORM_PATH = os.getenv("KUBECONFORM_PATH", "kubeconform")



def lint_kubernetes_yaml(content: str) -> Dict:
    fd, tmp_path = tempfile.mkstemp(suffix=".yaml", text=True)

    try:
        with os.fdopen(fd, "w") as tmp:
            tmp.write(content)

        errors: List[str] = []
        warnings: List[str] = []

        # ---------- yamllint (relaxed config) ----------
        yamllint_config = os.path.join(
            os.path.dirname(__file__),
            "yamllint.yaml",
        )

        yamllint_result = subprocess.run(
            ["yamllint", "-c", yamllint_config, tmp_path],
            capture_output=True,
            text=True,
        )

        if yamllint_result.returncode != 0:
            errors.extend(_lines(yamllint_result.stdout))

        # ---------- kubeconform (K8s schema validation) ----------
        kubeconform_result = subprocess.run(
            [
                KUBECONFORM_PATH,
                "-strict",
                "-ignore-missing-schemas",
                tmp_path,
            ],
            capture_output=True,
            text=True,
        )

        if kubeconform_result.returncode != 0:
            errors.extend(_lines(kubeconform_result.stdout))

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
