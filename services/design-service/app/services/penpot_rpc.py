"""
Complete Penpot RPC API Integration with Transit Format Support
Automated isolated workspace creation for each candidate
"""

import logging
import httpx
import asyncio
import uuid
from typing import Dict, Any, Optional
from app.core.config import settings
from app.models.design import PenpotSessionModel
from app.services.transit_helper import get_transit_helper

logger = logging.getLogger(__name__)


class PenpotRPCService:
    """Complete Penpot RPC API service with Transit format support"""
    
    def __init__(self):
        # Use backend URL for API calls (Docker internal network)
        self.api_base = settings.PENPOT_API_URL.rstrip('/')
        # Use public URL for workspace links (browser access)
        self.public_uri = settings.PENPOT_URL.rstrip('/')
        
        # Admin credentials for API access
        self.admin_email = settings.PENPOT_ADMIN_EMAIL
        self.admin_password = settings.PENPOT_ADMIN_PASSWORD
        
        # Transit helper for encoding/decoding
        self.transit = get_transit_helper()
        
        # Cache for auth session
        self._session_cookies = None
        
        logger.info(f"Penpot RPC Service initialized")
        logger.info(f"API Base: {self.api_base}")
        logger.info(f"Public URI: {self.public_uri}")
        logger.info(f"Transit support: {self.transit is not None}")
    
    async def authenticate(self) -> Dict[str, Any]:
        """
        Authenticate with Penpot using Transit format
        
        Returns:
            Session cookies for subsequent requests
        """
        
        if self._session_cookies:
            return self._session_cookies
        
        if not self.transit:
            raise Exception("Transit format support not available. Install transit-python.")
        
        logger.info("Authenticating with Penpot using Transit format")
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                login_url = f"{self.api_base}/api/rpc/command/login-with-password"
                
                # Encode login request using Transit
                request_body = self.transit.prepare_login_request(
                    self.admin_email,
                    self.admin_password
                )
                
                logger.info(f"Login URL: {login_url}")
                logger.debug(f"Request body: {request_body[:200]}")
                
                response = await client.post(
                    login_url,
                    content=request_body,
                    headers={"Content-Type": "application/transit+json"}
                )
                
                logger.info(f"Login response status: {response.status_code}")
                
                if response.status_code == 200:
                    # Decode Transit response
                    response_data = self.transit.decode_rpc_response(response.content)
                    logger.info(f"Login successful")
                    logger.debug(f"Response data type: {type(response_data)}")
                    
                    # Extract profile info
                    profile_id = self.transit.extract_id(response_data, "id")
                    team_id = self.transit.extract_id(response_data, "default-team-id")
                    
                    logger.info(f"Profile ID: {profile_id}")
                    logger.info(f"Team ID: {team_id}")
                    
                    # Store session cookies
                    self._session_cookies = dict(response.cookies)
                    logger.info(f"✅ Authenticated successfully, got {len(self._session_cookies)} cookies")
                    
                    return self._session_cookies
                else:
                    error_msg = response.text[:200]
                    logger.error(f"Login failed with status {response.status_code}: {error_msg}")
                    raise Exception(f"Login failed: {error_msg}")
                
        except Exception as e:
            logger.error(f"❌ Penpot authentication failed: {e}")
            raise
    
    
    async def create_candidate_workspace(
        self,
        user_id: str,
        assessment_id: str,
        question_id: str,
        question_title: str = "Design Challenge"
    ) -> PenpotSessionModel:
        """
        Create isolated workspace by creating a new file for each candidate
        
        Uses Transit format to communicate with Penpot's RPC API.
        Each candidate gets their own blank file for true isolation.
        """
        
        try:
            session_id = str(uuid.uuid4())
            
            # Template IDs
            template_team_id = "72b215ed-dedf-8032-8007-87e4c4104a6f"
            template_project_id = "72b215ed-dedf-8032-8007-87ee503f626c"
            
            logger.info(f"Creating isolated workspace for user {user_id}")
            
            if not self.transit:
                logger.error("Transit format not available")
                raise Exception("Transit format support required. Install transit-python.")
            
            # Authenticate first
            cookies = await self.authenticate()
            
            # Create a new blank file for this candidate
            new_file_id = await self._create_file_with_transit(
                template_project_id,
                f"{question_title}_{user_id[:8]}_{session_id[:8]}",
                cookies
            )
            
            if new_file_id:
                logger.info(f"✅ Created isolated file: {new_file_id}")
                workspace_url = f"{self.public_uri}/#/workspace?team-id={template_team_id}&project-id={template_project_id}&file-id={new_file_id}"
                
                session = PenpotSessionModel(
                    user_id=user_id,
                    assessment_id=assessment_id,
                    question_id=question_id,
                    workspace_url=workspace_url,
                    session_token=session_id,
                    file_id=new_file_id,
                    project_id=template_project_id
                )
                
                logger.info(f"✅ Isolated workspace created successfully!")
                logger.info(f"Workspace URL: {workspace_url}")
                return session
            else:
                raise Exception("Failed to create file")
            
        except Exception as e:
            logger.error(f"❌ Failed to create workspace: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def _create_file_with_transit(
        self,
        project_id: str,
        file_name: str,
        cookies: Dict[str, Any]
    ) -> Optional[str]:
        """
        Create a new file using Transit format
        
        Args:
            project_id: Penpot project ID
            file_name: Name for the new file
            cookies: Session cookies from authentication
            
        Returns:
            New file ID or None if failed
        """
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                create_url = f"{self.api_base}/api/rpc/command/create-file"
                
                # Encode request using Transit
                request_body = self.transit.prepare_create_file_request(
                    project_id,
                    file_name,
                    is_shared=False
                )
                
                logger.info(f"Creating file: {file_name}")
                logger.info(f"Create URL: {create_url}")
                logger.debug(f"Request body: {request_body[:200]}")
                
                response = await client.post(
                    create_url,
                    content=request_body,
                    headers={"Content-Type": "application/transit+json"},
                    cookies=cookies
                )
                
                logger.info(f"Create file response status: {response.status_code}")
                
                if response.status_code == 200:
                    # Decode Transit response
                    response_data = self.transit.decode_rpc_response(response.content)
                    logger.debug(f"Response data type: {type(response_data)}")
                    
                    # Extract file ID
                    file_id = self.transit.extract_id(response_data, "id")
                    
                    if file_id:
                        logger.info(f"✅ File created successfully: {file_id}")
                        return file_id
                    else:
                        logger.warning("Could not extract file ID from response")
                        logger.debug(f"Response data: {response_data}")
                        return None
                else:
                    error_msg = response.text[:500]
                    logger.error(f"Create file failed with status {response.status_code}")
                    logger.error(f"Response: {error_msg}")
                    return None
                    
        except Exception as e:
            logger.error(f"File creation error: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    
    async def get_file_data(self, file_id: str) -> Dict[str, Any]:
        """Get file data for evaluation"""
        try:
            cookies = await self.authenticate()
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                url = f"{self.api_base}/api/rpc/command/get-file"
                
                # Encode request using Transit
                request_body = self.transit.encode_rpc_request({"id": file_id})
                
                response = await client.post(
                    url,
                    content=request_body,
                    headers={"Content-Type": "application/transit+json"},
                    cookies=cookies
                )
                
                if response.status_code == 200:
                    return self.transit.decode_rpc_response(response.content)
                else:
                    logger.error(f"Get file failed: {response.status_code}")
                    return {}
                
        except Exception as e:
            logger.error(f"Failed to get file data: {e}")
            return {}
    
    async def delete_workspace(self, project_id: str, file_id: str):
        """Clean up workspace after assessment"""
        try:
            cookies = await self.authenticate()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Delete file
                if file_id:
                    file_url = f"{self.api_base}/api/rpc/command/delete-file"
                    request_body = self.transit.encode_rpc_request({"id": file_id})
                    
                    await client.post(
                        file_url,
                        content=request_body,
                        headers={"Content-Type": "application/transit+json"},
                        cookies=cookies
                    )
                    logger.info(f"Deleted file: {file_id}")
                    
        except Exception as e:
            logger.error(f"Failed to delete workspace: {e}")
    
    async def get_workspace_status(self, session_token: str) -> Dict[str, Any]:
        """Get workspace status"""
        return {
            "session_token": session_token,
            "status": "active",
            "message": "Workspace is active"
        }
    
    async def export_design_data(self, file_id: str) -> Dict[str, Any]:
        """
        Export complete design file data for evaluation
        
        Args:
            file_id: Penpot file ID
            
        Returns:
            Complete file data including pages, shapes, colors, etc.
        """
        try:
            from datetime import datetime
            logger.info(f"Exporting design data for file: {file_id}")
            
            # Get file data using Transit format
            file_data = await self.get_file_data(file_id)
            
            if not file_data:
                logger.warning(f"No data found for file: {file_id}")
                return {}
            
            logger.debug(f"File data keys: {list(file_data.keys()) if isinstance(file_data, dict) else 'not a dict'}")
            logger.debug(f"File data type: {type(file_data)}")
            
            # Extract relevant design metrics
            design_metrics = {
                "file_id": file_id,
                "exported_at": datetime.utcnow().isoformat(),
                "pages": [],
                "total_shapes": 0,
                "colors_used": [],
                "fonts_used": [],
                "components_used": []
            }
            
            # Parse pages and shapes - Penpot stores data in 'data' key
            data = file_data.get("data", {}) if isinstance(file_data, dict) else {}
            pages_by_id = data.get("pages-index", {}) if isinstance(data, dict) else {}
            
            logger.debug(f"Pages index keys: {list(pages_by_id.keys()) if isinstance(pages_by_id, dict) else 'not a dict'}")
            
            # Count pages
            design_metrics["page_count"] = len(pages_by_id) if isinstance(pages_by_id, dict) else 0
            
            # Count shapes across all pages
            total_shapes = 0
            for page_id, page_data in (pages_by_id.items() if isinstance(pages_by_id, dict) else []):
                if isinstance(page_data, dict):
                    objects = page_data.get("objects", {})
                    if isinstance(objects, dict):
                        # Each object in objects dict is a shape
                        total_shapes += len(objects)
                        logger.debug(f"Page {page_id}: {len(objects)} objects")
            
            design_metrics["total_shapes"] = total_shapes
            
            logger.info(f"✅ Exported design data: {design_metrics['total_shapes']} shapes, {design_metrics['page_count']} pages")
            
            return {
                "file_data": file_data,
                "metrics": design_metrics
            }
            
        except Exception as e:
            logger.error(f"Failed to export design data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {}


# Singleton instance
penpot_rpc_service = PenpotRPCService()
