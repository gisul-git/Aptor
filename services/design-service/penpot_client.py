"""
Penpot API client for design service.
Creates projects and files via Penpot RPC API.
"""
import os
from typing import Optional
import httpx


# API base URL - use penpot-backend when in Docker, localhost when running locally
PENPOT_API_BASE = os.getenv("PENPOT_API_URL", "http://penpot-backend:6060")
PENPOT_PUBLIC_URI = os.getenv("PENPOT_PUBLIC_URI", "http://localhost:9001")
PENPOT_EMAIL = os.getenv("PENPOT_ADMIN_EMAIL", "admin@penpot.local")
PENPOT_PASSWORD = os.getenv("PENPOT_ADMIN_PASSWORD", "admin123")


def _rpc(client: httpx.Client, token: Optional[str], method: str, params: dict) -> dict:
    """Call Penpot RPC API."""
    url = f"{PENPOT_API_BASE}/api/rpc/command/{method}"
    payload = {"type": method, **params}
    headers = {}
    if token:
        headers["Authorization"] = f"Token {token}"
    resp = client.post(url, json=payload, headers=headers, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def create_penpot_workspace(
    candidate_id: str, test_id: str, session_id: str
) -> tuple[str, str, str, str]:
    """
    Login to Penpot, create a project and file for the candidate session.
    Returns (iframe_url, team_id, project_id, file_id).
    Raises on failure.
    """
    with httpx.Client() as client:
        # 1. Login
        login_resp = _rpc(
            client,
            None,
            "login-with-password",
            {"email": PENPOT_EMAIL, "password": PENPOT_PASSWORD},
        )
        token = login_resp.get("token")
        if not token:
            raise RuntimeError("Penpot login failed: no token returned")

        profile = login_resp.get("profile", {})
        profile_id = profile.get("id")
        default_team_id = profile.get("default-team-id")

        if not default_team_id:
            # Fallback: get teams
            teams = _rpc(client, token, "get-teams", {})
            if not teams:
                raise RuntimeError("Penpot: no teams found for user")
            default_team_id = teams[0].get("id")

        # 2. Create project
        project_name = f"Assessment {candidate_id} - {test_id}"
        project = _rpc(
            client,
            token,
            "create-project",
            {"team-id": default_team_id, "name": project_name},
        )
        project_id = project.get("id")

        # 3. Create file in project
        file_name = f"Design Task - {session_id}"
        try:
            design_file = _rpc(
                client,
                token,
                "create-file",
                {"project-id": project_id, "name": file_name},
            )
        except httpx.HTTPStatusError as e:
            # create-file may return 404 on some Penpot versions - use Drafts + first file
            if e.response.status_code in (404, 400):
                projects = _rpc(client, token, "get-projects", {"team-id": default_team_id})
                drafts = next(
                    (p for p in projects if p.get("is-default") or "Draft" in (p.get("name") or "")),
                    projects[0] if projects else None,
                )
                if not drafts:
                    raise RuntimeError("Penpot: no projects found") from e
                project_id = drafts["id"]
                files = _rpc(client, token, "get-project-files", {"project-id": project_id})
                if not files:
                    raise RuntimeError("Penpot: no files in project, create-file not available") from e
                design_file = files[0]
            else:
                raise

        file_id = design_file.get("id")

        # 4. Build workspace URL
        iframe_url = f"{PENPOT_PUBLIC_URI}/#/workspace/{default_team_id}/{project_id}/{file_id}"

        return iframe_url, str(default_team_id), str(project_id), str(file_id)
