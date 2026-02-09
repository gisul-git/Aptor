"""
Design Repository - Database operations for design service
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.design import (
    DesignQuestionModel,
    PenpotSessionModel,
    DesignSubmissionModel,
    DesignRole,
    DifficultyLevel,
    TaskType
)
from app.db.mongo import get_database
from bson import ObjectId

logger = logging.getLogger(__name__)


class DesignRepository:
    """Repository for design-related database operations"""
    
    def __init__(self):
        self.db: AsyncIOMotorDatabase = None
    
    async def initialize(self):
        """Initialize database connection"""
        self.db = get_database()
        if self.db is None:
            raise RuntimeError("Database not initialized")
    
    # Design Questions CRUD
    async def create_question(self, question: DesignQuestionModel) -> str:
        """Create a new design question"""
        try:
            question_dict = question.model_dump(exclude={"id"})
            result = await self.db.design_questions.insert_one(question_dict)
            logger.info(f"Created design question: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create question: {e}")
            raise
    
    async def get_question(self, question_id: str) -> Optional[DesignQuestionModel]:
        """Get design question by ID"""
        try:
            question_data = await self.db.design_questions.find_one(
                {"_id": ObjectId(question_id)}
            )
            if question_data:
                question_data["_id"] = str(question_data["_id"])
                return DesignQuestionModel(**question_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get question {question_id}: {e}")
            return None
    
    async def get_questions(
        self,
        role: Optional[DesignRole] = None,
        difficulty: Optional[DifficultyLevel] = None,
        task_type: Optional[TaskType] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[DesignQuestionModel]:
        """Get design questions with filters"""
        try:
            filter_dict = {}
            if role:
                filter_dict["role"] = role.value
            if difficulty:
                filter_dict["difficulty"] = difficulty.value
            if task_type:
                filter_dict["task_type"] = task_type.value
            
            cursor = self.db.design_questions.find(filter_dict).skip(skip).limit(limit)
            questions = []
            
            async for question_data in cursor:
                question_data["_id"] = str(question_data["_id"])
                questions.append(DesignQuestionModel(**question_data))
            
            return questions
        except Exception as e:
            logger.error(f"Failed to get questions: {e}")
            return []
    
    async def update_question(
        self,
        question_id: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """Update design question"""
        try:
            result = await self.db.design_questions.update_one(
                {"_id": ObjectId(question_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update question {question_id}: {e}")
            return False
    
    async def delete_question(self, question_id: str) -> bool:
        """Delete design question"""
        try:
            result = await self.db.design_questions.delete_one(
                {"_id": ObjectId(question_id)}
            )
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete question {question_id}: {e}")
            return False
    
    # Penpot Sessions CRUD
    async def create_session(self, session: PenpotSessionModel) -> str:
        """Create a new Penpot session"""
        try:
            session_dict = session.model_dump(exclude={"id"})
            result = await self.db.penpot_sessions.insert_one(session_dict)
            logger.info(f"Created Penpot session: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    async def get_session(self, session_id: str) -> Optional[PenpotSessionModel]:
        """Get Penpot session by ID"""
        try:
            session_data = await self.db.penpot_sessions.find_one(
                {"_id": ObjectId(session_id)}
            )
            if session_data:
                session_data["_id"] = str(session_data["_id"])
                return PenpotSessionModel(**session_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {e}")
            return None
    
    async def get_session_by_token(self, session_token: str) -> Optional[PenpotSessionModel]:
        """Get Penpot session by token"""
        try:
            session_data = await self.db.penpot_sessions.find_one(
                {"session_token": session_token}
            )
            if session_data:
                session_data["_id"] = str(session_data["_id"])
                return PenpotSessionModel(**session_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get session by token: {e}")
            return None
    
    async def get_user_sessions(
        self,
        user_id: str,
        active_only: bool = False
    ) -> List[PenpotSessionModel]:
        """Get user's Penpot sessions"""
        try:
            filter_dict = {"user_id": user_id}
            if active_only:
                filter_dict["ended_at"] = None
            
            cursor = self.db.penpot_sessions.find(filter_dict)
            sessions = []
            
            async for session_data in cursor:
                session_data["_id"] = str(session_data["_id"])
                sessions.append(PenpotSessionModel(**session_data))
            
            return sessions
        except Exception as e:
            logger.error(f"Failed to get user sessions: {e}")
            return []
    
    async def end_session(self, session_id: str) -> bool:
        """End Penpot session"""
        try:
            result = await self.db.penpot_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"ended_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to end session {session_id}: {e}")
            return False
    
    # Design Submissions CRUD
    async def create_submission(self, submission: DesignSubmissionModel) -> str:
        """Create a new design submission"""
        try:
            submission_dict = submission.model_dump(exclude={"id"})
            result = await self.db.design_submissions.insert_one(submission_dict)
            logger.info(f"Created design submission: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create submission: {e}")
            raise
    
    async def get_submission(self, submission_id: str) -> Optional[DesignSubmissionModel]:
        """Get design submission by ID"""
        try:
            submission_data = await self.db.design_submissions.find_one(
                {"_id": ObjectId(submission_id)}
            )
            if submission_data:
                submission_data["_id"] = str(submission_data["_id"])
                return DesignSubmissionModel(**submission_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get submission {submission_id}: {e}")
            return None
    
    async def get_user_submissions(
        self,
        user_id: str,
        question_id: Optional[str] = None
    ) -> List[DesignSubmissionModel]:
        """Get user's design submissions"""
        try:
            filter_dict = {"user_id": user_id}
            if question_id:
                filter_dict["question_id"] = question_id
            
            cursor = self.db.design_submissions.find(filter_dict)
            submissions = []
            
            async for submission_data in cursor:
                submission_data["_id"] = str(submission_data["_id"])
                submissions.append(DesignSubmissionModel(**submission_data))
            
            return submissions
        except Exception as e:
            logger.error(f"Failed to get user submissions: {e}")
            return []
    
    async def update_submission_scores(
        self,
        submission_id: str,
        rule_based_score: float,
        ai_based_score: float,
        final_score: float,
        feedback: Dict[str, Any]
    ) -> bool:
        """Update submission scores and feedback"""
        try:
            result = await self.db.design_submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {
                    "$set": {
                        "rule_based_score": rule_based_score,
                        "ai_based_score": ai_based_score,
                        "final_score": final_score,
                        "feedback": feedback
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to update submission scores: {e}")
            return False
    
    # Analytics and Statistics
    async def get_question_stats(self, question_id: str) -> Dict[str, Any]:
        """Get statistics for a question"""
        try:
            pipeline = [
                {"$match": {"question_id": question_id}},
                {
                    "$group": {
                        "_id": None,
                        "total_submissions": {"$sum": 1},
                        "avg_score": {"$avg": "$final_score"},
                        "max_score": {"$max": "$final_score"},
                        "min_score": {"$min": "$final_score"}
                    }
                }
            ]
            
            result = await self.db.design_submissions.aggregate(pipeline).to_list(1)
            if result:
                stats = result[0]
                stats.pop("_id", None)
                return stats
            
            return {
                "total_submissions": 0,
                "avg_score": 0,
                "max_score": 0,
                "min_score": 0
            }
        except Exception as e:
            logger.error(f"Failed to get question stats: {e}")
            return {}
    
    async def get_user_performance(self, user_id: str) -> Dict[str, Any]:
        """Get user performance statistics"""
        try:
            pipeline = [
                {"$match": {"user_id": user_id}},
                {
                    "$group": {
                        "_id": None,
                        "total_submissions": {"$sum": 1},
                        "avg_score": {"$avg": "$final_score"},
                        "best_score": {"$max": "$final_score"},
                        "recent_submissions": {
                            "$push": {
                                "question_id": "$question_id",
                                "score": "$final_score",
                                "submitted_at": "$submitted_at"
                            }
                        }
                    }
                }
            ]
            
            result = await self.db.design_submissions.aggregate(pipeline).to_list(1)
            if result:
                stats = result[0]
                stats.pop("_id", None)
                # Sort recent submissions by date
                stats["recent_submissions"] = sorted(
                    stats["recent_submissions"],
                    key=lambda x: x["submitted_at"],
                    reverse=True
                )[:10]  # Last 10 submissions
                return stats
            
            return {
                "total_submissions": 0,
                "avg_score": 0,
                "best_score": 0,
                "recent_submissions": []
            }
        except Exception as e:
            logger.error(f"Failed to get user performance: {e}")
            return {}


# Singleton instance
design_repository = DesignRepository()