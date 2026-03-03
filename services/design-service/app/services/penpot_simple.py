"""
Simplified Penpot Service - Direct Workspace Access
Creates isolated workspaces by generating unique file URLs
"""

import logging
import uuid
from typing import Dict, Any
from app.core.config import settings
from app.models.design import PenpotSessionModel

logger = logging.getLogger(__name__)


class SimplePenpotService:
    """Simplified Penpot service for direct workspace access"""
    
    def __init__(self):
        self.public_uri = settings.PENPOT_URL
    
    async def create_candidate_workspace(
        self,
        user_id: str,
        assessment_id: str,
        question_id: str,
        question_title: str = "Design Challenge"
    ) -> PenpotSessionModel:
        """
        Create isolated workspace for candidate
        
        Opens Penpot's dashboard where candidates can create a new file.
        Each candidate's session is tracked via session_token.
        
        Note: For true isolation, you need to:
        1. Set up Penpot admin account
        2. Use Penpot RPC API to create projects/files programmatically
        3. Generate share links or embed tokens
        
        Current implementation: Opens Penpot dashboard for manual file creation
        """
        
        try:
            session_id = str(uuid.uuid4())
            file_id = str(uuid.uuid4())
            
            # Open Penpot dashboard - candidates will create their own file
            # This is the simplest approach that works without API authentication
            workspace_url = f"{self.public_uri}/#/dashboard/projects"
            
            # Create session model
            session = PenpotSessionModel(
                user_id=user_id,
                assessment_id=assessment_id,
                question_id=question_id,
                workspace_url=workspace_url,
                session_token=session_id,
                file_id=file_id,
                project_id="",
                team_id=""
            )
            
            logger.info(f"Created Penpot workspace session for user {user_id}")
            logger.info(f"Session ID: {session_id}")
            logger.info(f"Workspace URL: {workspace_url}")
            logger.info(f"Candidate will create new file for: {question_title}")
            
            return session
            
        except Exception as e:
            logger.error(f"Failed to create Penpot workspace: {e}")
            raise
    
    async def get_workspace_status(self, session_token: str) -> Dict[str, Any]:
        """Get workspace status"""
        return {
            "session_token": session_token,
            "status": "active",
            "message": "Workspace is active"
        }


# Singleton instance
simple_penpot_service = SimplePenpotService()
