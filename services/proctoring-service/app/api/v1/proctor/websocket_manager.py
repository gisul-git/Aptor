"""
WebSocket Manager for Live Proctoring
Manages WebSocket connections for candidates and admins, routes signaling messages.
"""

from __future__ import annotations

import logging
import json
from typing import Dict, Set, Optional, Any
from collections import defaultdict
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections for Live Proctoring.
    
    - Candidate connections: One per session (sessionId -> WebSocket)
    - Admin connections: Multiple per assessment (assessmentId -> Set[WebSocket])
    """
    
    def __init__(self):
        # Candidate connections: sessionId -> WebSocket
        self.candidate_connections: Dict[str, WebSocket] = {}
        
        # Admin connections: assessmentId -> Set[WebSocket]
        self.admin_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        
        # Track which session belongs to which assessment
        self.session_to_assessment: Dict[str, str] = {}
    
    async def connect_candidate(self, session_id: str, assessment_id: str, websocket: WebSocket):
        """Connect a candidate's WebSocket for a session."""
        logger.info(f"[WebSocket] connect_candidate called: session_id={session_id}, assessment_id={assessment_id}")
        logger.info(f"[WebSocket] Current candidate_connections before: {list(self.candidate_connections.keys())}")
        
        await websocket.accept()
        self.candidate_connections[session_id] = websocket
        self.session_to_assessment[session_id] = assessment_id
        
        logger.info(f"[WebSocket] ✅ Candidate connected: session={session_id}, assessment={assessment_id}")
        logger.info(f"[WebSocket] Current candidate_connections after: {list(self.candidate_connections.keys())}")
        logger.info(f"[WebSocket] WebSocket state: client_state={websocket.client_state}, application_state={websocket.application_state}")
    
    async def disconnect_candidate(self, session_id: str):
        """Disconnect a candidate's WebSocket."""
        logger.info(f"[WebSocket] disconnect_candidate called: session_id={session_id}")
        logger.info(f"[WebSocket] Current candidate_connections before disconnect: {list(self.candidate_connections.keys())}")
        
        if session_id in self.candidate_connections:
            try:
                await self.candidate_connections[session_id].close()
            except Exception as e:
                logger.warning(f"[WebSocket] Error closing candidate connection: {e}")
            del self.candidate_connections[session_id]
            if session_id in self.session_to_assessment:
                del self.session_to_assessment[session_id]
            logger.info(f"[WebSocket] ✅ Candidate disconnected: session={session_id}")
        else:
            logger.warning(f"[WebSocket] ⚠️ Attempted to disconnect candidate {session_id} but not in connections")
        
        logger.info(f"[WebSocket] Current candidate_connections after disconnect: {list(self.candidate_connections.keys())}")
    
    async def connect_admin(self, assessment_id: str, websocket: WebSocket):
        """Connect an admin's WebSocket for an assessment."""
        await websocket.accept()
        self.admin_connections[assessment_id].add(websocket)
        logger.info(f"[WebSocket] Admin connected: assessment={assessment_id}, total={len(self.admin_connections[assessment_id])}")
    
    async def disconnect_admin(self, assessment_id: str, websocket: WebSocket):
        """Disconnect an admin's WebSocket."""
        if assessment_id in self.admin_connections:
            self.admin_connections[assessment_id].discard(websocket)
            # Try to close WebSocket, but ignore errors if already closed
            try:
                await websocket.close()
            except Exception as e:
                # WebSocket might already be closed by client, which is fine
                # This prevents "Unexpected ASGI message 'websocket.close'" errors
                logger.debug(f"[WebSocket] Admin connection already closed or error closing: {e}")
            logger.info(f"[WebSocket] Admin disconnected: assessment={assessment_id}, remaining={len(self.admin_connections[assessment_id])}")
    
    async def send_to_candidate(self, session_id: str, message: Dict[str, Any]):
        """Send a message to a candidate's WebSocket."""
        if session_id in self.candidate_connections:
            try:
                await self.candidate_connections[session_id].send_text(json.dumps(message))
                logger.debug(f"[WebSocket] Sent to candidate {session_id}: {message.get('type')}")
            except Exception as e:
                logger.error(f"[WebSocket] Error sending to candidate {session_id}: {e}")
                # Remove dead connection
                await self.disconnect_candidate(session_id)
        else:
            logger.warning(f"[WebSocket] Candidate {session_id} not connected")
    
    async def send_to_admins(self, assessment_id: str, message: Dict[str, Any]):
        """Send a message to all admin WebSockets for an assessment."""
        if assessment_id in self.admin_connections:
            disconnected = set()
            for websocket in self.admin_connections[assessment_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                    logger.debug(f"[WebSocket] Sent to admin: {message.get('type')}")
                except Exception as e:
                    logger.error(f"[WebSocket] Error sending to admin: {e}")
                    disconnected.add(websocket)
            
            # Clean up disconnected websockets
            for ws in disconnected:
                self.admin_connections[assessment_id].discard(ws)
                try:
                    await ws.close()
                except:
                    pass
    
    async def send_to_all_admins(self, message: Dict[str, Any]):
        """Send a message to all admin WebSockets across all assessments."""
        all_admins = set()
        for assessment_id in self.admin_connections:
            all_admins.update(self.admin_connections[assessment_id])
        
        disconnected = set()
        for websocket in all_admins:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"[WebSocket] Error sending to admin: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected:
            for assessment_id in self.admin_connections:
                self.admin_connections[assessment_id].discard(ws)
            try:
                await ws.close()
            except:
                pass
    
    def get_candidate_connection(self, session_id: str) -> Optional[WebSocket]:
        """Get a candidate's WebSocket connection."""
        return self.candidate_connections.get(session_id)
    
    def get_admin_connections(self, assessment_id: str) -> Set[WebSocket]:
        """Get all admin WebSocket connections for an assessment."""
        return self.admin_connections.get(assessment_id, set())
    
    def is_candidate_connected(self, session_id: str) -> bool:
        """Check if a candidate is connected."""
        is_connected = session_id in self.candidate_connections
        logger.info(f"[WebSocket] is_candidate_connected({session_id}) = {is_connected}")
        logger.info(f"[WebSocket] Current candidate_connections keys: {list(self.candidate_connections.keys())}")
        if is_connected:
            websocket = self.candidate_connections.get(session_id)
            if websocket:
                logger.info(f"[WebSocket] WebSocket state for {session_id}: client_state={websocket.client_state}, application_state={websocket.application_state}")
        return is_connected
    
    def get_assessment_id_for_session(self, session_id: str) -> Optional[str]:
        """Get the assessment ID for a session."""
        return self.session_to_assessment.get(session_id)


# Global WebSocket manager instance
connection_manager = WebSocketManager()

