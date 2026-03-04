"""
Question repository for managing question data operations.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import structlog

from app.repositories.base import BaseRepository, RepositoryError
from app.models.question import Question, DifficultyLevel, QuestionTopic

logger = structlog.get_logger()


class QuestionRepository(BaseRepository[Question]):
    """Repository for question data operations."""
    
    def __init__(self):
        super().__init__("questions")
    
    async def create_question(self, question: Question) -> str:
        """
        Create a new question.
        
        Args:
            question: Question model to create
            
        Returns:
            str: The created question ID
        """
        question_data = question.model_dump()
        # Use the question's ID if provided, otherwise let MongoDB generate one
        if question.id:
            question_data["_id"] = question.id
        
        return await self.create(question_data)
    
    async def get_question_by_id(self, question_id: str) -> Optional[Question]:
        """
        Get a question by its ID.
        
        Args:
            question_id: Question ID to retrieve
            
        Returns:
            Optional[Question]: Question if found, None otherwise
        """
        document = await self.get_by_id(question_id)
        if document:
            # Map _id to id for the model
            if '_id' in document:
                document['id'] = document.pop('_id')
            return Question(**document)
        return None
    
    async def find_questions_by_difficulty(
        self, 
        difficulty_level: DifficultyLevel,
        limit: Optional[int] = None
    ) -> List[Question]:
        """
        Find questions by difficulty level.
        
        Args:
            difficulty_level: Difficulty level to filter by
            limit: Maximum number of questions to return
            
        Returns:
            List[Question]: List of matching questions
        """
        query = {"difficulty_level": difficulty_level.value}
        documents = await self.find_many(
            query, 
            limit=limit,
            sort=[("created_at", -1)]  # Most recent first
        )
        
        questions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            questions.append(Question(**doc))
        
        return questions
    
    async def find_questions_by_topic(
        self, 
        topic: QuestionTopic,
        limit: Optional[int] = None
    ) -> List[Question]:
        """
        Find questions by topic.
        
        Args:
            topic: Topic to filter by
            limit: Maximum number of questions to return
            
        Returns:
            List[Question]: List of matching questions
        """
        query = {"topic": topic.value}
        documents = await self.find_many(
            query, 
            limit=limit,
            sort=[("created_at", -1)]
        )
        
        questions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            questions.append(Question(**doc))
        
        return questions
    
    async def find_questions_by_criteria(
        self,
        difficulty_level: Optional[DifficultyLevel] = None,
        topic: Optional[QuestionTopic] = None,
        limit: Optional[int] = None,
        skip: Optional[int] = None
    ) -> List[Question]:
        """
        Find questions by multiple criteria.
        
        Args:
            difficulty_level: Optional difficulty level filter
            topic: Optional topic filter
            limit: Maximum number of questions to return
            skip: Number of questions to skip
            
        Returns:
            List[Question]: List of matching questions
        """
        query = {}
        
        if difficulty_level:
            query["difficulty_level"] = difficulty_level.value
        if topic:
            query["topic"] = topic.value
        
        documents = await self.find_many(
            query,
            limit=limit,
            skip=skip,
            sort=[("created_at", -1)]
        )
        
        questions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            questions.append(Question(**doc))
        
        return questions
    
    async def get_random_question(
        self,
        difficulty_level: Optional[DifficultyLevel] = None,
        topic: Optional[QuestionTopic] = None
    ) -> Optional[Question]:
        """
        Get a random question matching the criteria.
        
        Args:
            difficulty_level: Optional difficulty level filter
            topic: Optional topic filter
            
        Returns:
            Optional[Question]: Random question if found, None otherwise
        """
        try:
            collection = await self._get_collection()
            
            # Build match stage for aggregation
            match_stage = {}
            if difficulty_level:
                match_stage["difficulty_level"] = difficulty_level.value
            if topic:
                match_stage["topic"] = topic.value
            
            # Use aggregation pipeline with $sample for random selection
            pipeline = []
            if match_stage:
                pipeline.append({"$match": match_stage})
            pipeline.append({"$sample": {"size": 1}})
            
            cursor = collection.aggregate(pipeline)
            documents = await cursor.to_list(length=1)
            
            if documents:
                doc = documents[0]
                if '_id' in doc:
                    doc['id'] = str(doc.pop('_id'))
                return Question(**doc)
            
            return None
            
        except Exception as e:
            logger.error(
                "Error getting random question",
                difficulty_level=difficulty_level,
                topic=topic,
                error=str(e)
            )
            raise RepositoryError(f"Failed to get random question: {str(e)}")
    
    async def update_question(self, question_id: str, update_data: Dict[str, Any]) -> Optional[Question]:
        """
        Update a question.
        
        Args:
            question_id: Question ID to update
            update_data: Data to update
            
        Returns:
            Optional[Question]: Updated question if found, None otherwise
        """
        document = await self.update_by_id(question_id, update_data)
        if document:
            if '_id' in document:
                document['id'] = document.pop('_id')
            return Question(**document)
        return None
    
    async def delete_question(self, question_id: str) -> bool:
        """
        Delete a question.
        
        Args:
            question_id: Question ID to delete
            
        Returns:
            bool: True if deleted, False if not found
        """
        return await self.delete_by_id(question_id)
    
    async def get_question_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about questions in the database.
        
        Returns:
            Dict[str, Any]: Statistics including counts by difficulty and topic
        """
        try:
            collection = await self._get_collection()
            
            # Aggregation pipeline for statistics
            pipeline = [
                {
                    "$group": {
                        "_id": None,
                        "total_questions": {"$sum": 1},
                        "by_difficulty": {
                            "$push": {
                                "difficulty": "$difficulty_level",
                                "topic": "$topic"
                            }
                        }
                    }
                }
            ]
            
            cursor = collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            
            if not results:
                return {
                    "total_questions": 0,
                    "by_difficulty": {},
                    "by_topic": {}
                }
            
            result = results[0]
            
            # Count by difficulty and topic
            difficulty_counts = {}
            topic_counts = {}
            
            for item in result.get("by_difficulty", []):
                diff = item.get("difficulty")
                topic = item.get("topic")
                
                if diff:
                    difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1
                if topic:
                    topic_counts[topic] = topic_counts.get(topic, 0) + 1
            
            return {
                "total_questions": result.get("total_questions", 0),
                "by_difficulty": difficulty_counts,
                "by_topic": topic_counts
            }
            
        except Exception as e:
            logger.error("Error getting question statistics", error=str(e))
            raise RepositoryError(f"Failed to get question statistics: {str(e)}")
    
    async def search_questions(
        self, 
        search_text: str, 
        limit: Optional[int] = None
    ) -> List[Question]:
        """
        Search questions by text in title and description.
        
        Args:
            search_text: Text to search for
            limit: Maximum number of questions to return
            
        Returns:
            List[Question]: List of matching questions
        """
        try:
            collection = await self._get_collection()
            
            # Create text search query
            query = {
                "$or": [
                    {"title": {"$regex": search_text, "$options": "i"}},
                    {"description": {"$regex": search_text, "$options": "i"}}
                ]
            }
            
            cursor = collection.find(query).sort([("created_at", -1)])
            if limit:
                cursor = cursor.limit(limit)
            
            documents = await cursor.to_list(length=limit)
            
            questions = []
            for doc in documents:
                if '_id' in doc:
                    doc['id'] = str(doc.pop('_id'))
                questions.append(Question(**doc))
            
            return questions
            
        except Exception as e:
            logger.error(
                "Error searching questions",
                search_text=search_text,
                error=str(e)
            )
            raise RepositoryError(f"Failed to search questions: {str(e)}")