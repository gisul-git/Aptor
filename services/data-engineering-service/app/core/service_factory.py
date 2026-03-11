"""
Service factory for creating and wiring all application services.
This module handles dependency injection and service initialization.
"""

import structlog
from typing import Optional

from app.services.integration_service import IntegrationService, set_integration_service
from app.services.question_generator import QuestionGeneratorService
from app.services.validation_engine import ValidationEngine
from app.services.code_reviewer import CodeReviewer
from app.services.progress_analytics import ProgressAnalyticsService
from app.services.recommendation_engine import RecommendationEngine
from app.services.cache_manager import IntelligentCacheManager
from app.services.auto_scaler import AutoScaler
from app.services.cost_optimizer import CostOptimizationService
from app.services.ai_service import AIService
from app.repositories.question_repository import QuestionRepository
from app.repositories.solution_repository import SolutionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.execution_repository import ExecutionRepository
from app.core.database import get_database
from app.core.redis_client import get_redis
from app.core.config import settings
from app.core.monitoring import get_monitoring_system
from app.core.error_handler import get_error_handler

logger = structlog.get_logger()


class ServiceFactory:
    """Factory for creating and managing application services."""
    
    def __init__(self):
        self._services = {}
        self._repositories = {}
        self._initialized = False
    
    async def initialize(self):
        """Initialize all services and their dependencies."""
        if self._initialized:
            return
        
        logger.info("Initializing service factory")
        
        try:
            # Initialize monitoring and error handling first (optional)
            try:
                await self._initialize_monitoring()
            except Exception as e:
                logger.warning("Monitoring initialization failed, continuing", error=str(e))
            
            # Initialize repositories first
            await self._initialize_repositories()
            
            # Initialize core services
            await self._initialize_core_services()
            
            # Initialize AI services
            await self._initialize_ai_services()
            
            # Initialize execution services
            await self._initialize_execution_services()
            
            # Initialize analytics services
            await self._initialize_analytics_services()
            
            # Initialize infrastructure services
            await self._initialize_infrastructure_services()
            
            # Initialize integration service (wires everything together)
            await self._initialize_integration_service()
            
            self._initialized = True
            logger.info("Service factory initialization completed")
            
        except Exception as e:
            logger.error("Service factory initialization failed", error=str(e), exc_info=True)
            # Don't re-raise the exception, try to continue with partial initialization
            self._initialized = True  # Mark as initialized to prevent retry loops
            logger.warning("Continuing with partial service initialization")
    
    async def _initialize_monitoring(self):
        """Initialize monitoring and error handling systems."""
        try:
            # Initialize monitoring system
            monitoring_system = get_monitoring_system()
            await monitoring_system.start()
            self._services['monitoring'] = monitoring_system
            
            # Register health checks
            monitoring_system.register_health_check("database", self._check_database_health)
            monitoring_system.register_health_check("redis", self._check_redis_health)
            
            logger.info("Monitoring system initialized")
        except Exception as e:
            logger.warning("Failed to initialize monitoring system, continuing without it", error=str(e))
            # Create a dummy monitoring system
            self._services['monitoring'] = None
        
        try:
            # Initialize error handler
            error_handler = get_error_handler()
            self._services['error_handler'] = error_handler
            logger.info("Error handler initialized")
        except Exception as e:
            logger.warning("Failed to initialize error handler, continuing without it", error=str(e))
            self._services['error_handler'] = None
    
    async def _check_database_health(self) -> bool:
        """Health check for database connectivity."""
        try:
            db = await get_database()
            await db.command("ping")
            return True
        except Exception:
            return False
    
    async def _check_redis_health(self) -> bool:
        """Health check for Redis connectivity."""
        try:
            redis_client = await get_redis()
            await redis_client.ping()
            return True
        except Exception:
            return False
    
    async def _initialize_repositories(self):
        """Initialize data repositories."""
        try:
            # Repositories handle their own database connections
            self._repositories['question'] = QuestionRepository()
            self._repositories['solution'] = SolutionRepository()
            self._repositories['user'] = UserRepository()
            self._repositories['execution'] = ExecutionRepository()
            
            logger.info("Repositories initialized")
        except Exception as e:
            logger.error("Failed to initialize repositories", error=str(e))
            # Create empty repositories dict to prevent errors
            self._repositories = {
                'question': None,
                'solution': None,
                'user': None,
                'execution': None
            }
            raise  # This is critical, so re-raise
    
    async def _initialize_core_services(self):
        """Initialize core application services."""
        try:
            # Cache manager - handles its own Redis connection
            self._services['cache_manager'] = IntelligentCacheManager()
            
            # Validation engine
            self._services['validation_engine'] = ValidationEngine()
            
            logger.info("Core services initialized")
        except Exception as e:
            logger.error("Failed to initialize core services", error=str(e))
            # Create dummy services to prevent errors
            self._services['cache_manager'] = None
            self._services['validation_engine'] = None
            raise
    
    async def _initialize_ai_services(self):
        """Initialize AI-powered services."""
        # AI service - handles its own configuration
        ai_service = AIService()
        self._services['ai_service'] = ai_service
        
        # Question generator - handles its own dependencies
        self._services['question_generator'] = QuestionGeneratorService()
        
        # Code reviewer - handles its own dependencies
        self._services['code_reviewer'] = CodeReviewer()
        
        logger.info("AI services initialized")
    
    async def _initialize_execution_services(self):
        """Initialize code execution services."""
        # Note: Execution engine removed - will be rebuilt
        
        logger.info("Execution services initialized")
    
    async def _initialize_analytics_services(self):
        """Initialize analytics and recommendation services."""
        # Progress analytics - handles its own dependencies
        self._services['progress_analytics'] = ProgressAnalyticsService()
        
        # Recommendation engine - handles its own dependencies
        self._services['recommendation_engine'] = RecommendationEngine()
        
        logger.info("Analytics services initialized")
    
    async def _initialize_infrastructure_services(self):
        """Initialize infrastructure and optimization services."""
        # Auto scaler - handles its own dependencies
        self._services['auto_scaler'] = AutoScaler()
        
        # Cost optimizer - handles its own dependencies
        self._services['cost_optimizer'] = CostOptimizationService()
        
        logger.info("Infrastructure services initialized")
    
    async def _initialize_integration_service(self):
        """Initialize the main integration service that wires everything together."""
        try:
            integration_service = IntegrationService(
                question_generator=self._services.get('question_generator'),
                execution_engine=None,  # Will be rebuilt
                validation_engine=self._services.get('validation_engine'),
                code_reviewer=self._services.get('code_reviewer'),
                progress_analytics=self._services.get('progress_analytics'),
                recommendation_engine=self._services.get('recommendation_engine'),
                cache_manager=self._services.get('cache_manager'),
                auto_scaler=self._services.get('auto_scaler'),
                cost_optimizer=self._services.get('cost_optimizer'),
                question_repo=self._repositories.get('question'),
                solution_repo=self._repositories.get('solution'),
                user_repo=self._repositories.get('user'),
                execution_repo=self._repositories.get('execution')
            )
            
            self._services['integration'] = integration_service
            set_integration_service(integration_service)
            
            logger.info("Integration service initialized")
        except Exception as e:
            logger.error("Failed to initialize integration service", error=str(e))
            # Create a minimal integration service or None
            self._services['integration'] = None
            raise
    
    def get_service(self, service_name: str):
        """Get a service by name."""
        if not self._initialized:
            raise RuntimeError("Service factory not initialized")
        
        service = self._services.get(service_name)
        if not service:
            raise ValueError(f"Service '{service_name}' not found")
        
        return service
    
    def get_repository(self, repo_name: str):
        """Get a repository by name."""
        if not self._initialized:
            raise RuntimeError("Service factory not initialized")
        
        repo = self._repositories.get(repo_name)
        if not repo:
            raise ValueError(f"Repository '{repo_name}' not found")
        
        return repo
    
    async def cleanup(self):
        """Cleanup all services and resources."""
        logger.info("Cleaning up service factory")
        
        try:
            # Cleanup integration service
            if 'integration' in self._services:
                await self._services['integration'].cleanup_resources()
            
            # Cleanup execution engine - removed
            
            # Cleanup auto scaler - removed
            if 'auto_scaler' in self._services:
                await self._services['auto_scaler'].cleanup()
            
            # Cleanup cost optimizer
            if 'cost_optimizer' in self._services:
                await self._services['cost_optimizer'].cleanup()
            
            logger.info("Service factory cleanup completed")
            
        except Exception as e:
            logger.error("Service factory cleanup failed", error=str(e), exc_info=True)


# Global service factory instance
_service_factory: Optional[ServiceFactory] = None


async def get_service_factory() -> ServiceFactory:
    """Get the global service factory instance."""
    global _service_factory
    if not _service_factory:
        _service_factory = ServiceFactory()
        await _service_factory.initialize()
    return _service_factory


async def initialize_services():
    """Initialize all application services."""
    factory = await get_service_factory()
    return factory


async def cleanup_services():
    """Cleanup all application services."""
    global _service_factory
    if _service_factory:
        await _service_factory.cleanup()
        _service_factory = None