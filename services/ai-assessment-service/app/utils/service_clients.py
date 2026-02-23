"""
HTTP clients for inter-service communication.
These replace direct imports between services.
"""
import logging
from typing import Any, Dict, Optional
import httpx
from ..config.settings import get_settings

logger = logging.getLogger(__name__)


class AIMLServiceClient:
    """Client for communicating with AIML Service."""
    
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.aiml_service_url
        self.timeout = 30.0
    
    async def generate_question(
        self,
        title: str,
        skill: str,
        topic: Optional[str] = None,
        difficulty: str = "medium",
        dataset_format: str = "csv",
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generate an AIML question via HTTP call.
        
        Args:
            title: Question title
            skill: Skill/library name
            topic: Optional topic
            difficulty: easy, medium, or hard
            dataset_format: Dataset format (csv, json, etc.)
            headers: Optional headers (for auth, user context, etc.)
        
        Returns:
            Generated question data
        """
        url = f"{self.base_url}/api/v1/aiml/questions/generate-ai"
        payload = {
            "title": title,
            "skill": skill,
            "topic": topic,
            "difficulty": difficulty,
            "dataset_format": dataset_format
        }
        
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=request_headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"AIML service call failed: {e}")
            raise Exception(f"Failed to generate AIML question: {e}")
    
    async def evaluate_submission(
        self,
        source_code: str,
        outputs: list,
        question_title: str,
        question_description: str,
        tasks: list,
        constraints: list,
        difficulty: str = "medium",
        skill: Optional[str] = None,
        dataset_info: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate an AIML submission via HTTP call.
        
        Args:
            source_code: The Python code submitted by the candidate
            outputs: List of outputs from code execution
            question_title: Title of the question
            question_description: Description of the problem
            tasks: List of tasks to complete
            constraints: List of constraints
            difficulty: Question difficulty (easy, medium, hard)
            skill: The skill being assessed (numpy, pandas, etc.)
            dataset_info: Information about the dataset used
            headers: Optional headers (for auth, user context, etc.)
        
        Returns:
            Evaluation result dictionary with score, feedback, and detailed analysis
        """
        url = f"{self.base_url}/api/v1/aiml/evaluate"
        payload = {
            "source_code": source_code,
            "outputs": outputs,
            "question_title": question_title,
            "question_description": question_description,
            "tasks": tasks,
            "constraints": constraints,
            "difficulty": difficulty,
            "skill": skill,
            "dataset_info": dataset_info,
        }
        
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=request_headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"AIML evaluation service call failed: {e}")
            raise Exception(f"Failed to evaluate AIML submission: {e}")


class DSAServiceClient:
    """Client for communicating with DSA Service."""
    
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.dsa_service_url
        self.timeout = 30.0
    
    async def generate_question(
        self,
        difficulty: str,
        topic: Optional[str] = None,
        concepts: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generate a DSA question via HTTP call.
        
        Args:
            difficulty: easy, medium, or hard
            topic: Optional topic
            concepts: Optional concepts string
            headers: Optional headers (for auth, user context, etc.)
        
        Returns:
            Generated question data
        """
        url = f"{self.base_url}/api/v1/dsa/admin/generate-question"
        payload = {
            "difficulty": difficulty,
            "topic": topic,
            "concepts": concepts
        }
        
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=request_headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"DSA service call failed: {e}")
            raise Exception(f"Failed to generate DSA question: {e}")
    
    def generate_boilerplate(
        self,
        language: str,
        function_signature: Dict[str, Any],
        question_description: str
    ) -> str:
        """
        Generate boilerplate code.
        
        Note: This is a utility function that doesn't require HTTP.
        For now, we'll keep it as a local utility or create an endpoint.
        """
        # TODO: Either create an endpoint or keep as local utility
        # For now, this will need to be implemented locally
        raise NotImplementedError(
            "Boilerplate generation should be implemented locally or "
            "create an endpoint in DSA service."
        )
    
    async def generate_sql_question(
        self,
        difficulty: str,
        topic: Optional[str] = None,
        concepts: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generate a SQL question via HTTP call.
        
        Args:
            difficulty: easy, medium, or hard
            topic: Optional topic (e.g., "Joins", "Aggregation")
            concepts: Optional concepts string (e.g., "LEFT JOIN, GROUP BY")
            headers: Optional headers (for auth, user context, etc.)
        
        Returns:
            Generated SQL question data
        """
        url = f"{self.base_url}/api/v1/dsa/admin/generate-sql-question"
        payload = {
            "difficulty": difficulty,
            "topic": topic,
            "concepts": concepts
        }
        
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=request_headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"DSA SQL service call failed: {e}")
            raise Exception(f"Failed to generate SQL question: {e}")


# Global client instances
_aiml_client: Optional[AIMLServiceClient] = None
_dsa_client: Optional[DSAServiceClient] = None


def get_aiml_client() -> AIMLServiceClient:
    """Get or create AIML service client."""
    global _aiml_client
    if _aiml_client is None:
        _aiml_client = AIMLServiceClient()
    return _aiml_client


def get_dsa_client() -> DSAServiceClient:
    """Get or create DSA service client."""
    global _dsa_client
    if _dsa_client is None:
        _dsa_client = DSAServiceClient()
    return _dsa_client

