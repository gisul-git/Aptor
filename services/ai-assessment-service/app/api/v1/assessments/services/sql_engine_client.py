"""
SQL Execution Engine Client
Handles all interactions with the external SQL Execution Engine API.
"""
import logging
from typing import Any, Dict, Optional
import httpx

from ..config import get_assessment_config

logger = logging.getLogger(__name__)


class SQLEngineClient:
    """Client for interacting with SQL Execution Engine API"""
    
    def __init__(self):
        self.settings = get_assessment_config()
        self.base_url = self.settings.sql_engine_url.rstrip('/')
        if not self.base_url:
            raise ValueError("SQL_ENGINE_URL is not configured in .env")
        if self.base_url.endswith('/api'):
            self.base_url = self.base_url[:-4]  # Remove /api if present, will add back for specific endpoints
        self.timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    
    async def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make POST request to SQL engine API"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"SQL engine API error ({endpoint}): {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"SQL engine request error ({endpoint}): {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling SQL engine ({endpoint}): {e}")
            raise
    
    async def create_seed(self, seed_sql: str) -> Dict[str, Any]:
        """
        Create a new seeded dataset variant.
        
        Args:
            seed_sql: DDL and INSERT statements to initialize the database
            
        Returns:
            Response with groupId
        """
        return await self._post("seed", {"seedSql": seed_sql})
    
    async def execute_sql(
        self,
        question_id: str,
        code: str,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute SQL query (for testing).
        
        Args:
            question_id: Question ID
            code: SQL code to execute
            group_id: Optional group ID
            
        Returns:
            Execution result with output or error
        """
        payload: Dict[str, Any] = {
            "questionId": question_id,
            "code": code
        }
        if group_id:
            payload["groupId"] = group_id
        
        return await self._post("execute", payload)


_sql_engine_client: Optional[SQLEngineClient] = None


def get_sql_engine_client() -> SQLEngineClient:
    """Get or create SQL engine client instance (singleton)"""
    global _sql_engine_client
    if _sql_engine_client is None:
        _sql_engine_client = SQLEngineClient()
    return _sql_engine_client

