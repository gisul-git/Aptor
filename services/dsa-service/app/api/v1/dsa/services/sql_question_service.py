"""
SQL Question Service
Service layer for SQL question operations including:
- Creating seeds from schemas/sample_data
- Fetching schemas from engine
- Managing groupId for questions
"""
import logging
from typing import Dict, Any, Optional, List
from bson import ObjectId

from .sql_engine_client import get_sql_engine_client
from .sql_seed_converter import convert_to_seed_sql, validate_seed_sql

logger = logging.getLogger("backend")


class SQLQuestionService:
    """Service for SQL question operations"""
    
    def __init__(self):
        self.engine_client = get_sql_engine_client()
    
    async def create_seed_for_question(
        self,
        schemas: Dict[str, Any],
        sample_data: Dict[str, List[list]]
    ) -> str:
        """
        Create a seeded dataset for a SQL question.
        
        Args:
            schemas: Table schemas
            sample_data: Sample data rows
            
        Returns:
            groupId from the SQL engine
            
        Raises:
            ValueError: If schemas/sample_data are invalid
            RuntimeError: If seed creation fails
        """
        logger.info("[SQL Question Service] Creating seed for question")
        
        # Convert to seedSql
        try:
            seed_sql = convert_to_seed_sql(schemas, sample_data)
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to convert to seedSql: {e}")
            raise ValueError(f"Failed to convert schemas/sample_data to seedSql: {str(e)}")
        
        # Validate seedSql
        if not validate_seed_sql(seed_sql):
            raise ValueError("Generated seedSql is invalid")
        
        # Create seed via engine
        try:
            group_id = await self.engine_client.create_seed(seed_sql)
            logger.info(f"[SQL Question Service] Created seed with groupId: {group_id}")
            return group_id
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to create seed: {e}")
            raise RuntimeError(f"Failed to create seed in SQL engine: {str(e)}")
    
    async def get_schema_for_question(
        self,
        question_id: str,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get database schema for a question.
        
        Args:
            question_id: Question ID
            group_id: Optional group ID (if None, uses default seed)
            
        Returns:
            Schema response with tables, columns, and data
        """
        logger.info(f"[SQL Question Service] Fetching schema for question {question_id}")
        
        try:
            schema_data = await self.engine_client.get_schema(
                question_id=question_id,
                group_id=group_id
            )
            return schema_data
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to fetch schema: {e}")
            raise RuntimeError(f"Failed to fetch schema from SQL engine: {str(e)}")
    
    async def execute_query(
        self,
        question_id: str,
        sql_code: str,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a SQL query for testing.
        
        Args:
            question_id: Question ID
            sql_code: SQL code to execute
            group_id: Optional group ID
            
        Returns:
            Execution result with output or error
        """
        logger.info(f"[SQL Question Service] Executing query for question {question_id}")
        
        try:
            result = await self.engine_client.execute_sql(
                question_id=question_id,
                code=sql_code,
                group_id=group_id
            )
            return result
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to execute query: {e}")
            raise RuntimeError(f"Failed to execute SQL query: {str(e)}")
    
    async def submit_query(
        self,
        question_id: str,
        sql_code: str,
        expected_output: list,
        group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a SQL query for evaluation.
        
        Args:
            question_id: Question ID
            sql_code: SQL code to execute
            expected_output: Expected result as array of row objects
            group_id: Optional group ID
            
        Returns:
            Submission result with passed status
        """
        logger.info(f"[SQL Question Service] Submitting query for question {question_id}")
        
        try:
            result = await self.engine_client.submit_sql(
                question_id=question_id,
                code=sql_code,
                expected_output=expected_output,
                group_id=group_id
            )
            return result
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to submit query: {e}")
            raise RuntimeError(f"Failed to submit SQL query: {str(e)}")
    
    async def generate_expected_output(
        self,
        question_id: str,
        reference_query: str,
        group_id: Optional[str] = None
    ) -> list:
        """
        Generate expected output by executing reference query.
        
        Args:
            question_id: Question ID
            reference_query: Reference SQL query
            group_id: Optional group ID
            
        Returns:
            Expected output as array of row objects
        """
        logger.info(f"[SQL Question Service] Generating expected output for question {question_id}")
        
        try:
            result = await self.engine_client.execute_sql(
                question_id=question_id,
                code=reference_query,
                group_id=group_id
            )
            
            if not result.get("success"):
                error = result.get("error", "Unknown error")
                raise RuntimeError(f"Reference query execution failed: {error}")
            
            # Convert output to expected format
            output = result.get("output", [])
            
            # Ensure it's a list of dicts
            if isinstance(output, list):
                # Check if it's already in the right format
                if output and isinstance(output[0], dict):
                    return output
                # Otherwise, convert from list of lists/values
                # This shouldn't happen with the engine, but handle it
                return output
            
            return []
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to generate expected output: {e}")
            raise RuntimeError(f"Failed to generate expected output: {str(e)}")
    
    async def ensure_question_has_seed(
        self,
        question: Dict[str, Any],
        db
    ) -> Optional[str]:
        """
        Ensure a question has a groupId. If not, create one from schemas/sample_data.
        
        Args:
            question: Question document from database
            db: Database instance
            
        Returns:
            groupId (existing or newly created)
        """
        question_id = str(question.get("_id"))
        
        # Check if question already has groupId
        existing_group_id = question.get("groupId")
        if existing_group_id:
            logger.info(f"[SQL Question Service] Question {question_id} already has groupId: {existing_group_id}")
            return existing_group_id
        
        # Check if question has schemas and sample_data
        schemas = question.get("schemas", {})
        sample_data = question.get("sample_data", {})
        
        if not schemas:
            logger.warning(f"[SQL Question Service] Question {question_id} has no schemas, cannot create seed")
            return None
        
        # Create seed
        try:
            group_id = await self.create_seed_for_question(schemas, sample_data)
            
            # Update question with groupId and seedSql
            seed_sql = convert_to_seed_sql(schemas, sample_data)
            
            await db.questions.update_one(
                {"_id": ObjectId(question_id)},
                {
                    "$set": {
                        "groupId": group_id,
                        "seedSql": seed_sql
                    }
                }
            )
            
            logger.info(f"[SQL Question Service] Created and stored groupId {group_id} for question {question_id}")
            return group_id
            
        except Exception as e:
            logger.error(f"[SQL Question Service] Failed to ensure seed for question {question_id}: {e}")
            return None


# Singleton instance
_sql_question_service: Optional[SQLQuestionService] = None


def get_sql_question_service() -> SQLQuestionService:
    """Get singleton SQL question service instance"""
    global _sql_question_service
    if _sql_question_service is None:
        _sql_question_service = SQLQuestionService()
    return _sql_question_service

