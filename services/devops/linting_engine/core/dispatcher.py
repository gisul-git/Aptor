from linting_engine.schemas.request import LintType
from linting_engine.linters.docker import lint_dockerfile
from linting_engine.linters.kubernetes import lint_kubernetes_yaml
from linting_engine.linters.github_actions import lint_github_actions


def dispatch_lint(lint_type: LintType, content: str) -> dict:
    if lint_type == LintType.docker:
        return lint_dockerfile(content)

    if lint_type == LintType.kubernetes:
        return lint_kubernetes_yaml(content)

    if lint_type == LintType.github_actions:
        return lint_github_actions(content)

    return {
        "status": "failed",
        "errors": ["Unsupported lint type"],
        "warnings": [],
        "score": 0,
    }
