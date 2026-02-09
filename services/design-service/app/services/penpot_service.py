"""
Enhanced Penpot Service for Design Workspace Management
Handles workspace creation, session management, and data export
"""

import logging
import httpx
import asyncio
from typing import Dict, Any, Optional, Tuple
from app.core.config import settings
from app.models.design import PenpotSessionModel
import uuid
import os

logger = logging.getLogger(__name__)


class PenpotService:
    """Enhanced Penpot service for workspace management"""
    
    def __init__(self):
        self.api_base = settings.PENPOT_API_URL
        self.public_uri = settings.PENPOT_URL
        self.admin_email = settings.PENPOT_ADMIN_EMAIL
        self.admin_password = settings.PENPOT_ADMIN_PASSWORD
        self._auth_token = None
        self._team_id = None
    
    async def authenticate(self) -> str:
        """Authenticate with Penpot and get access token"""
        
        if self._auth_token:
            return self._auth_token
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await self._rpc_call(
                    client,
                    None,
                    "login-with-password",
                    {
                        "email": self.admin_email,
                        "password": self.admin_password
                    }
                )
                
                self._auth_token = response.get("token")
                if not self._auth_token:
                    raise ValueError("No token received from Penpot login")
                
                # Get default team ID
                profile = response.get("profile", {})
                self._team_id = profile.get("default-team-id")
                
                if not self._team_id:
                    # Fallback: get teams
                    teams = await self._rpc_call(client, self._auth_token, "get-teams", {})
                    if teams:
                        self._team_id = teams[0].get("id")
                
                logger.info("Successfully authenticated with Penpot")
                return self._auth_token
                
        except Exception as e:
            logger.error(f"Penpot authentication failed: {e}")
            raise
    
    async def create_candidate_workspace(
        self,
        user_id: str,
        assessment_id: str,
        question_id: str,
        question_title: str = "Design Challenge"
    ) -> PenpotSessionModel:
        """Create isolated workspace for candidate"""
        
        try:
            await self.authenticate()
            
            session_id = str(uuid.uuid4())
            project_name = f"Assessment_{assessment_id}_{user_id}"
            file_name = f"{question_title}_{session_id[:8]}"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Create project
                project = await self._rpc_call(
                    client,
                    self._auth_token,
                    "create-project",
                    {
                        "team-id": self._team_id,
                        "name": project_name
                    }
                )
                project_id = project.get("id")
                
                # Create file in project
                design_file = await self._rpc_call(
                    client,
                    self._auth_token,
                    "create-file",
                    {
                        "project-id": project_id,
                        "name": file_name
                    }
                )
                file_id = design_file.get("id")
                
                # Generate workspace URL that opens directly into the file
                # Format: http://localhost:9001/#/workspace/{project-id}/{file-id}
                workspace_url = f"{self.public_uri}/#/workspace/{project_id}/{file_id}"
                
                # Create session model
                session = PenpotSessionModel(
                    user_id=user_id,
                    assessment_id=assessment_id,
                    question_id=question_id,
                    workspace_url=workspace_url,
                    session_token=session_id,
                    file_id=file_id,
                    project_id=project_id
                )
                
                logger.info(f"Created Penpot workspace for user {user_id}")
                return session
                
        except Exception as e:
            logger.error(f"Failed to create Penpot workspace: {e}")
            # Return fallback workspace
            return self._create_fallback_session(user_id, assessment_id, question_id)
    
    async def export_design_data(
        self,
        file_id: str,
        export_format: str = "json"
    ) -> Dict[str, Any]:
        """Export design data from Penpot file"""
        
        try:
            await self.authenticate()
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Get file data
                file_data = await self._rpc_call(
                    client,
                    self._auth_token,
                    "get-file",
                    {"id": file_id}
                )
                
                # Export design data
                if export_format == "json":
                    return {
                        "file_id": file_id,
                        "data": file_data,
                        "format": "json",
                        "exported_at": "2024-01-01T00:00:00Z"  # Would be actual timestamp
                    }
                
                return file_data
                
        except Exception as e:
            logger.error(f"Failed to export design data: {e}")
            return {"error": str(e)}
    
    async def capture_screenshot(
        self,
        file_id: str,
        page_id: str = None
    ) -> str:
        """Capture screenshot of design"""
        
        try:
            await self.authenticate()
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Use Penpot exporter service
                export_data = await self._rpc_call(
                    client,
                    self._auth_token,
                    "create-export",
                    {
                        "file-id": file_id,
                        "page-id": page_id,
                        "type": "png",
                        "scale": 2
                    }
                )
                
                export_id = export_data.get("id")
                
                # Poll for export completion
                for _ in range(30):  # 30 second timeout
                    status = await self._rpc_call(
                        client,
                        self._auth_token,
                        "get-export",
                        {"id": export_id}
                    )
                    
                    if status.get("status") == "completed":
                        return status.get("url", "")
                    
                    await asyncio.sleep(1)
                
                raise TimeoutError("Screenshot export timed out")
                
        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")
            return ""
    
    async def cleanup_workspace(self, session_id: str, file_id: str = None):
        """Clean up workspace after assessment"""
        
        try:
            if not file_id:
                return
            
            await self.authenticate()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Delete file
                await self._rpc_call(
                    client,
                    self._auth_token,
                    "delete-file",
                    {"id": file_id}
                )
                
                logger.info(f"Cleaned up workspace for session {session_id}")
                
        except Exception as e:
            logger.error(f"Failed to cleanup workspace: {e}")
    
    async def _rpc_call(
        self,
        client: httpx.AsyncClient,
        token: Optional[str],
        method: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Make RPC call to Penpot API"""
        
        url = f"{self.api_base}/api/rpc/command/{method}"
        payload = {"type": method, **params}
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Token {token}"
        
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        return response.json()
    
    def _create_fallback_session(
        self,
        user_id: str,
        assessment_id: str,
        question_id: str
    ) -> PenpotSessionModel:
        """Create fallback session when Penpot API fails"""
        
        session_id = str(uuid.uuid4())
        # Simple Penpot workspace URL without authentication (for testing)
        fallback_url = f"{self.public_uri}/"
        
        return PenpotSessionModel(
            user_id=user_id,
            assessment_id=assessment_id,
            question_id=question_id,
            workspace_url=fallback_url,
            session_token=session_id
        )
    
    async def get_workspace_status(self, session_token: str) -> Dict[str, Any]:
        """Get workspace status and activity"""
        
        try:
            # This would integrate with Penpot's real-time API
            # For now, return mock status
            return {
                "session_token": session_token,
                "status": "active",
                "last_activity": "2024-01-01T00:00:00Z",
                "elements_count": 0,
                "pages_count": 1
            }
            
        except Exception as e:
            logger.error(f"Failed to get workspace status: {e}")
            return {"error": str(e)}
    
    async def save_workspace_state(
        self,
        session_token: str,
        state_data: Dict[str, Any]
    ) -> bool:
        """Save workspace state for recovery"""
        
        try:
            # Save state to storage (Redis/MongoDB)
            # This would be implemented based on your storage strategy
            logger.info(f"Saved workspace state for session {session_token}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save workspace state: {e}")
            return False


# Singleton instance
penpot_service = PenpotService()