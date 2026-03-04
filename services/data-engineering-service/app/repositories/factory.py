"""
Repository factory for managing repository instances.
"""

from typing import Dict, Type, TypeVar
import structlog

from app.repositories.base import BaseRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.solution_repository import SolutionRepository
from app.repositories.execution_repository import ExecutionRepository

logger = structlog.get_logger()

T = TypeVar('T', bound=BaseRepository)


class RepositoryFactory:
    """
    Factory class for managing repository instances.
    
    Provides singleton access to repository instances to ensure
    efficient connection pooling and resource management.
    """
    
    _instances: Dict[Type[BaseRepository], BaseRepository] = {}
    
    @classmethod
    def get_question_repository(cls) -> QuestionRepository:
        """Get QuestionRepository instance."""
        return cls._get_repository(QuestionRepository)
    
    @classmethod
    def get_user_repository(cls) -> UserRepository:
        """Get UserRepository instance."""
        return cls._get_repository(UserRepository)
    
    @classmethod
    def get_solution_repository(cls) -> SolutionRepository:
        """Get SolutionRepository instance."""
        return cls._get_repository(SolutionRepository)
    
    @classmethod
    def get_execution_repository(cls) -> ExecutionRepository:
        """Get ExecutionRepository instance."""
        return cls._get_repository(ExecutionRepository)
    
    @classmethod
    def _get_repository(cls, repository_class: Type[T]) -> T:
        """
        Get or create repository instance.
        
        Args:
            repository_class: Repository class to instantiate
            
        Returns:
            Repository instance
        """
        if repository_class not in cls._instances:
            logger.debug(
                "Creating new repository instance",
                repository_class=repository_class.__name__
            )
            cls._instances[repository_class] = repository_class()
        
        return cls._instances[repository_class]
    
    @classmethod
    def clear_instances(cls) -> None:
        """Clear all repository instances (useful for testing)."""
        logger.debug("Clearing all repository instances")
        cls._instances.clear()


# Convenience functions for easy access
def get_question_repository() -> QuestionRepository:
    """Get QuestionRepository instance."""
    return RepositoryFactory.get_question_repository()


def get_user_repository() -> UserRepository:
    """Get UserRepository instance."""
    return RepositoryFactory.get_user_repository()


def get_solution_repository() -> SolutionRepository:
    """Get SolutionRepository instance."""
    return RepositoryFactory.get_solution_repository()


def get_execution_repository() -> ExecutionRepository:
    """Get ExecutionRepository instance."""
    return RepositoryFactory.get_execution_repository()