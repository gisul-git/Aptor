"""
SQL Engine Client
Handles all communication with the SQL Execution Engine API.

All endpoints use the SQL_ENGINE_URL from .env configuration.
No hardcoded URLs in this file.
"""
import logging
from typing import Dict, Any, List, Optional
import httpx

from ..config import get_dsa_settings

logger = logging.getLogger("backend")


class SQLEngineClient:
    """Client for SQL Execution Engine API"""
    
    def __init__(self):
        self.settings = get_dsa_settings()
        self.base_url = self.settings.sql_engine_url.rstrip('/')
        
        if not self.base_url:
            raise RuntimeError(
                "SQL_ENGINE_URL is not configured. Please set SQL_ENGINE_URL in your .env file. "
                "Example: SQL_ENGINE_URL=http://103.173.99.254:6060/api"
            )
        
        # Ensure base_url doesn't end with /api (we'll add it per endpoint)
        if self.base_url.endswith('/api'):
            self.base_url = self.base_url[:-4]
        
        self.timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    
    async def create_seed(self, seed_sql: str) -> str:
        """
        Create a new seeded dataset variant.
        
        Args:
            seed_sql: DDL and INSERT statements to initialize the database
            
        Returns:
            groupId: UUID returned from the engine
            
        Raises:
            RuntimeError: If seed creation fails
        """
        url = f"{self.base_url}/api/seed"
        logger.info(f"[SQL Engine] Creating seed at {url}")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json={"seedSql": seed_sql},
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                
                data = response.json()
                group_id = data.get("groupId")
                
                if not group_id:
                    raise RuntimeError("SQL engine did not return groupId in response")
                
                logger.info(f"[SQL Engine] Created seed with groupId: {group_id}")
                return group_id
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text[:500] if hasattr(e.response, 'text') else str(e.response.content)
            logger.error(f"[SQL Engine] HTTP error creating seed: {e.response.status_code} - {error_text}")
            raise RuntimeError(f"Failed to create seed: {error_text}")
        except httpx.RequestError as e:
            logger.error(f"[SQL Engine] Connection error: {e}")
            raise RuntimeError(f"Failed to connect to SQL engine at {url}: {str(e)}")
        except Exception as e:
            logger.error(f"[SQL Engine] Unexpected error creating seed: {e}", exc_info=True)
            raise RuntimeError(f"Unexpected error creating seed: {str(e)}")
    
    async def get_schema(
        self, 
        question_id: Optional[str] = None, 
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieve database schema (table structure with column types and all data).
        
        Args:
            question_id: Optional question ID to scope the schema
            group_id: Optional group ID for seeded variant
            
        Returns:
            Schema response with questionId, groupId, and schema array
            
        Raises:
            RuntimeError: If schema retrieval fails
        """
        url = f"{self.base_url}/api/schema"
        logger.info(f"[SQL Engine] Fetching schema from {url} (questionId={question_id}, groupId={group_id})")
        
        payload = {}
        if question_id:
            payload["questionId"] = question_id
        if group_id:
            payload["groupId"] = group_id
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"[SQL Engine] Retrieved schema with {len(data.get('schema', []))} tables")
                return data
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text[:500] if hasattr(e.response, 'text') else str(e.response.content)
            logger.error(f"[SQL Engine] HTTP error fetching schema: {e.response.status_code} - {error_text}")
            raise RuntimeError(f"Failed to fetch schema: {error_text}")
        except httpx.RequestError as e:
            logger.error(f"[SQL Engine] Connection error: {e}")
            raise RuntimeError(f"Failed to connect to SQL engine at {url}: {str(e)}")
        except Exception as e:
            logger.error(f"[SQL Engine] Unexpected error fetching schema: {e}", exc_info=True)
            raise RuntimeError(f"Unexpected error fetching schema: {str(e)}")
    
    async def execute_sql(
        self,
        question_id: str,
        code: str,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute SQL against a question-scoped database and return outputs.
        
        Args:
            question_id: Identifies the question (required)
            code: SQL code to execute (required)
            group_id: Optional group ID for seeded variant
            
        Returns:
            Response with success, output, outputs, or error
            
        Raises:
            RuntimeError: If execution fails
        """
        url = f"{self.base_url}/api/execute"
        logger.info(f"[SQL Engine] Executing SQL for question {question_id} at {url}")
        
        payload = {
            "questionId": question_id,
            "code": code
        }
        if group_id:
            payload["groupId"] = group_id
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                
                data = response.json()
                
                if data.get("success"):
                    logger.info(f"[SQL Engine] SQL executed successfully for question {question_id}")
                else:
                    error_msg = data.get("error", "Unknown error")
                    logger.warning(f"[SQL Engine] SQL execution returned error: {error_msg}")
                
                return data
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text[:500] if hasattr(e.response, 'text') else str(e.response.content)
            logger.error(f"[SQL Engine] HTTP error executing SQL: {e.response.status_code} - {error_text}")
            raise RuntimeError(f"Failed to execute SQL: {error_text}")
        except httpx.RequestError as e:
            logger.error(f"[SQL Engine] Connection error: {e}")
            raise RuntimeError(f"Failed to connect to SQL engine at {url}: {str(e)}")
        except Exception as e:
            logger.error(f"[SQL Engine] Unexpected error executing SQL: {e}", exc_info=True)
            raise RuntimeError(f"Unexpected error executing SQL: {str(e)}")
    
    async def submit_sql(
        self,
        question_id: str,
        code: str,
        expected_output: List[Dict[str, Any]],
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute SQL, compare result to expected output, and destroy the engine.
        
        Args:
            question_id: Identifies the question (required)
            code: SQL code to execute (required)
            expected_output: Expected normalized result as array of row objects (required)
            group_id: Optional group ID for seeded variant
            
        Returns:
            Response with passed, reason, actualOutput, actualOutputs, or error
            
        Raises:
            RuntimeError: If submission fails
        """
        url = f"{self.base_url}/api/submit"
        logger.info(f"[SQL Engine] Submitting SQL for question {question_id} at {url}")
        
        payload = {
            "questionId": question_id,
            "code": code,
            "expectedOutput": expected_output
        }
        if group_id:
            payload["groupId"] = group_id
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                
                data = response.json()
                
                passed = data.get("passed", False)
                logger.info(
                    f"[SQL Engine] SQL submission for question {question_id}: "
                    f"passed={passed}, reason={data.get('reason')}"
                )
                
                return data
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text[:500] if hasattr(e.response, 'text') else str(e.response.content)
            logger.error(f"[SQL Engine] HTTP error submitting SQL: {e.response.status_code} - {error_text}")
            raise RuntimeError(f"Failed to submit SQL: {error_text}")
        except httpx.RequestError as e:
            logger.error(f"[SQL Engine] Connection error: {e}")
            raise RuntimeError(f"Failed to connect to SQL engine at {url}: {str(e)}")
        except Exception as e:
            logger.error(f"[SQL Engine] Unexpected error submitting SQL: {e}", exc_info=True)
            raise RuntimeError(f"Unexpected error submitting SQL: {str(e)}")
    
    async def reset_engine(
        self,
        question_id: str,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reset (destroy) the engine for a given questionId and optional groupId.
        
        Args:
            question_id: Identifies the question (required)
            group_id: Optional group ID for seeded variant
            
        Returns:
            Response with success and message
            
        Raises:
            RuntimeError: If reset fails
        """
        url = f"{self.base_url}/api/reset"
        logger.info(f"[SQL Engine] Resetting engine for question {question_id} at {url}")
        
        payload = {"questionId": question_id}
        if group_id:
            payload["groupId"] = group_id
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"[SQL Engine] Engine reset successfully for question {question_id}")
                return data
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text[:500] if hasattr(e.response, 'text') else str(e.response.content)
            logger.error(f"[SQL Engine] HTTP error resetting engine: {e.response.status_code} - {error_text}")
            raise RuntimeError(f"Failed to reset engine: {error_text}")
        except httpx.RequestError as e:
            logger.error(f"[SQL Engine] Connection error: {e}")
            raise RuntimeError(f"Failed to connect to SQL engine at {url}: {str(e)}")
        except Exception as e:
            logger.error(f"[SQL Engine] Unexpected error resetting engine: {e}", exc_info=True)
            raise RuntimeError(f"Unexpected error resetting engine: {str(e)}")


# Singleton instance
_sql_engine_client: Optional[SQLEngineClient] = None


def get_sql_engine_client() -> SQLEngineClient:
    """Get singleton SQL engine client instance"""
    global _sql_engine_client
    if _sql_engine_client is None:
        _sql_engine_client = SQLEngineClient()
    return _sql_engine_client

