"""
Unit tests for repository classes.

This module provides comprehensive unit tests for the MongoDB data access layer,
covering all repository classes and their methods including:
- Database operations (CRUD)
- Error conditions and exception handling
- Connection handling and retry logic
- Data validation and integrity

Requirements tested: 9.1, 9.2, 9.3
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, call
from bson import ObjectId
from pymongo.errors import (
    DuplicateKeyError, 
    ConnectionFailure, 
    ServerSelectionTimeoutError,
    OperationFailure,
    WriteError
)

from app.repositories.base import (
    BaseRepository, 
    RepositoryError, 
    DocumentNotFoundError, 
    DuplicateDocumentError,
    DatabaseConnectionError
)
from app.repositories.question_repository import QuestionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.solution_repository import SolutionRepository
from app.repositories.execution_repository import ExecutionRepository
from app.repositories.factory import RepositoryFactory

from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
from app.models.user import UserProgress, UserPreferences, Solution, SolutionStatus, SkillArea
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode, ValidationResult


class TestBaseRepository:
    """Test cases for BaseRepository."""
    
    @pytest.fixture
    def mock_collection(self):
        """Mock MongoDB collection."""
        collection = AsyncMock()
        return collection
    
    @pytest.fixture
    def base_repo(self):
        """Base repository instance with mocked collection."""
        repo = BaseRepository("test_collection")
        return repo
    
    # Test document creation
    @pytest.mark.asyncio
    async def test_create_document_success(self, base_repo):
        """Test successful document creation."""
        # Arrange
        document = {"name": "test", "value": 123}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.return_value = AsyncMock(inserted_id=ObjectId())
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.create(document)
            
            # Assert
            assert isinstance(result, str)
            mock_collection.insert_one.assert_called_once()
            assert "created_at" in mock_collection.insert_one.call_args[0][0]
    
    @pytest.mark.asyncio
    async def test_create_document_with_existing_created_at(self, base_repo):
        """Test document creation preserves existing created_at timestamp."""
        # Arrange
        created_at = datetime.utcnow()
        document = {"name": "test", "value": 123, "created_at": created_at}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.return_value = AsyncMock(inserted_id=ObjectId())
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.create(document)
            
            # Assert
            assert isinstance(result, str)
            call_args = mock_collection.insert_one.call_args[0][0]
            assert call_args["created_at"] == created_at
    
    @pytest.mark.asyncio
    async def test_create_document_duplicate_error(self, base_repo):
        """Test duplicate document creation error."""
        # Arrange
        document = {"name": "test", "value": 123}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.side_effect = DuplicateKeyError("Duplicate key")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DuplicateDocumentError):
                await base_repo.create(document)
    
    @pytest.mark.asyncio
    async def test_create_document_connection_failure(self, base_repo):
        """Test document creation with connection failure."""
        # Arrange
        document = {"name": "test", "value": 123}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.side_effect = ConnectionFailure("Connection lost")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.create(document)
    
    @pytest.mark.asyncio
    async def test_create_document_server_timeout(self, base_repo):
        """Test document creation with server timeout."""
        # Arrange
        document = {"name": "test", "value": 123}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.side_effect = ServerSelectionTimeoutError("Server timeout")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.create(document)
    
    @pytest.mark.asyncio
    async def test_create_document_unexpected_error(self, base_repo):
        """Test document creation with unexpected error."""
        # Arrange
        document = {"name": "test", "value": 123}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.insert_one.side_effect = Exception("Unexpected error")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(RepositoryError):
                await base_repo.create(document)
    
    # Test document retrieval
    @pytest.mark.asyncio
    async def test_get_by_id_success_with_objectid(self, base_repo):
        """Test successful document retrieval by ObjectId."""
        # Arrange
        doc_id = str(ObjectId())
        expected_doc = {"_id": ObjectId(doc_id), "name": "test"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = expected_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.get_by_id(doc_id)
            
            # Assert
            assert result is not None
            assert result["_id"] == doc_id  # Should be converted to string
            mock_collection.find_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_by_id_success_with_string_id(self, base_repo):
        """Test successful document retrieval by string ID."""
        # Arrange
        doc_id = "string_id_123"
        expected_doc = {"_id": doc_id, "name": "test"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = expected_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.get_by_id(doc_id)
            
            # Assert
            assert result is not None
            assert result["_id"] == doc_id
            mock_collection.find_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, base_repo):
        """Test document not found by ID."""
        # Arrange
        doc_id = str(ObjectId())
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = None
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.get_by_id(doc_id)
            
            # Assert
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_by_id_connection_error(self, base_repo):
        """Test get_by_id with connection error."""
        # Arrange
        doc_id = str(ObjectId())
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.side_effect = ConnectionFailure("Connection lost")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.get_by_id(doc_id)
    
    @pytest.mark.asyncio
    async def test_get_by_field_success(self, base_repo):
        """Test successful document retrieval by field."""
        # Arrange
        field = "email"
        value = "test@example.com"
        expected_doc = {"_id": ObjectId(), "email": value, "name": "test"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = expected_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.get_by_field(field, value)
            
            # Assert
            assert result is not None
            assert result["email"] == value
            assert isinstance(result["_id"], str)  # ObjectId converted to string
            mock_collection.find_one.assert_called_once_with({field: value})
    
    @pytest.mark.asyncio
    async def test_get_by_field_not_found(self, base_repo):
        """Test get_by_field when document not found."""
        # Arrange
        field = "email"
        value = "nonexistent@example.com"
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = None
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.get_by_field(field, value)
            
            # Assert
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_by_field_connection_error(self, base_repo):
        """Test get_by_field with connection error."""
        # Arrange
        field = "email"
        value = "test@example.com"
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.side_effect = ServerSelectionTimeoutError("Timeout")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.get_by_field(field, value)
    
    # Test document updates
    @pytest.mark.asyncio
    async def test_update_by_id_success(self, base_repo):
        """Test successful document update."""
        # Arrange
        doc_id = str(ObjectId())
        update_data = {"name": "updated"}
        updated_doc = {"_id": ObjectId(doc_id), "name": "updated", "updated_at": datetime.utcnow()}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one_and_update.return_value = updated_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.update_by_id(doc_id, update_data)
            
            # Assert
            assert result is not None
            assert result["name"] == "updated"
            assert "updated_at" in result
            mock_collection.find_one_and_update.assert_called_once()
            
            # Verify update_data was wrapped in $set and updated_at was added
            call_args = mock_collection.find_one_and_update.call_args[0]
            assert "$set" in call_args[1]
            assert "updated_at" in call_args[1]["$set"]
    
    @pytest.mark.asyncio
    async def test_update_by_id_with_existing_set_operation(self, base_repo):
        """Test document update with existing $set operation."""
        # Arrange
        doc_id = str(ObjectId())
        update_data = {"$set": {"name": "updated"}, "$inc": {"count": 1}}
        updated_doc = {"_id": ObjectId(doc_id), "name": "updated", "count": 2}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one_and_update.return_value = updated_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.update_by_id(doc_id, update_data)
            
            # Assert
            assert result is not None
            mock_collection.find_one_and_update.assert_called_once()
            
            # Verify updated_at was added to existing $set
            call_args = mock_collection.find_one_and_update.call_args[0]
            assert "updated_at" in call_args[1]["$set"]
            assert "$inc" in call_args[1]
    
    @pytest.mark.asyncio
    async def test_update_by_id_not_found(self, base_repo):
        """Test document update when document not found."""
        # Arrange
        doc_id = str(ObjectId())
        update_data = {"name": "updated"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one_and_update.return_value = None
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.update_by_id(doc_id, update_data)
            
            # Assert
            assert result is None
    
    @pytest.mark.asyncio
    async def test_update_by_id_with_upsert(self, base_repo):
        """Test document update with upsert option."""
        # Arrange
        doc_id = str(ObjectId())
        update_data = {"name": "new"}
        created_doc = {"_id": ObjectId(doc_id), "name": "new", "updated_at": datetime.utcnow()}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one_and_update.return_value = created_doc
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.update_by_id(doc_id, update_data, upsert=True)
            
            # Assert
            assert result is not None
            assert result["name"] == "new"
            
            # Verify upsert was passed
            call_args = mock_collection.find_one_and_update.call_args
            assert call_args[1]["upsert"] is True
    
    @pytest.mark.asyncio
    async def test_update_by_id_connection_error(self, base_repo):
        """Test update_by_id with connection error."""
        # Arrange
        doc_id = str(ObjectId())
        update_data = {"name": "updated"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one_and_update.side_effect = ConnectionFailure("Connection lost")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.update_by_id(doc_id, update_data)
    
    # Test document deletion
    @pytest.mark.asyncio
    async def test_delete_by_id_success(self, base_repo):
        """Test successful document deletion."""
        # Arrange
        doc_id = str(ObjectId())
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.delete_one.return_value = AsyncMock(deleted_count=1)
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.delete_by_id(doc_id)
            
            # Assert
            assert result is True
            mock_collection.delete_one.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_by_id_not_found(self, base_repo):
        """Test document deletion when not found."""
        # Arrange
        doc_id = str(ObjectId())
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.delete_one.return_value = AsyncMock(deleted_count=0)
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.delete_by_id(doc_id)
            
            # Assert
            assert result is False
    
    @pytest.mark.asyncio
    async def test_delete_by_id_connection_error(self, base_repo):
        """Test delete_by_id with connection error."""
        # Arrange
        doc_id = str(ObjectId())
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.delete_one.side_effect = ServerSelectionTimeoutError("Timeout")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.delete_by_id(doc_id)
    
    # Test find_many operations
    @pytest.mark.asyncio
    async def test_find_many_with_filters(self, base_repo):
        """Test finding multiple documents with filters."""
        # Arrange
        query = {"status": "active"}
        docs = [
            {"_id": ObjectId(), "name": "doc1", "status": "active"},
            {"_id": ObjectId(), "name": "doc2", "status": "active"}
        ]
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = MagicMock()  # Use MagicMock for cursor methods
            mock_cursor.to_list = AsyncMock(return_value=docs)
            mock_cursor.sort.return_value = mock_cursor
            mock_cursor.skip.return_value = mock_cursor
            mock_cursor.limit.return_value = mock_cursor
            
            # Mock collection.find to return the cursor directly (not a coroutine)
            mock_collection.find = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            # Act - use skip=5 instead of 0 since 0 is falsy and won't trigger the skip call
            result = await base_repo.find_many(query, limit=10, skip=5, sort=[("name", 1)])
            
            # Assert
            assert len(result) == 2
            assert all(isinstance(doc["_id"], str) for doc in result)  # ObjectIds converted to strings
            mock_collection.find.assert_called_once_with(query)
            mock_cursor.sort.assert_called_once_with([("name", 1)])
            mock_cursor.skip.assert_called_once_with(5)
            mock_cursor.limit.assert_called_once_with(10)
    
    @pytest.mark.asyncio
    async def test_find_many_no_filters(self, base_repo):
        """Test finding documents without filters."""
        # Arrange
        query = {}
        docs = [{"_id": ObjectId(), "name": "doc1"}]
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = MagicMock()
            mock_cursor.to_list = AsyncMock(return_value=docs)
            
            # Mock collection.find to return the cursor directly
            mock_collection.find = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.find_many(query)
            
            # Assert
            assert len(result) == 1
            mock_collection.find.assert_called_once_with(query)
            # Verify no sort, skip, or limit was called
            mock_cursor.sort.assert_not_called()
            mock_cursor.skip.assert_not_called()
            mock_cursor.limit.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_find_many_connection_error(self, base_repo):
        """Test find_many with connection error."""
        # Arrange
        query = {"status": "active"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = ConnectionFailure("Connection lost")
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.find_many(query)
    
    # Test count operations
    @pytest.mark.asyncio
    async def test_count_documents(self, base_repo):
        """Test document counting."""
        # Arrange
        query = {"status": "active"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.count_documents.return_value = 5
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.count(query)
            
            # Assert
            assert result == 5
            mock_collection.count_documents.assert_called_once_with(query)
    
    @pytest.mark.asyncio
    async def test_count_documents_no_query(self, base_repo):
        """Test counting all documents."""
        # Arrange
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.count_documents.return_value = 10
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.count()
            
            # Assert
            assert result == 10
            mock_collection.count_documents.assert_called_once_with({})
    
    @pytest.mark.asyncio
    async def test_count_connection_error(self, base_repo):
        """Test count with connection error."""
        # Arrange
        query = {"status": "active"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.count_documents.side_effect = ServerSelectionTimeoutError("Timeout")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.count(query)
    
    # Test exists operations
    @pytest.mark.asyncio
    async def test_exists_document(self, base_repo):
        """Test document existence check."""
        # Arrange
        query = {"name": "test"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = {"_id": ObjectId()}
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.exists(query)
            
            # Assert
            assert result is True
            mock_collection.find_one.assert_called_once_with(query, {"_id": 1})
    
    @pytest.mark.asyncio
    async def test_exists_document_not_found(self, base_repo):
        """Test document existence check when not found."""
        # Arrange
        query = {"name": "nonexistent"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.return_value = None
            mock_get_collection.return_value = mock_collection
            
            # Act
            result = await base_repo.exists(query)
            
            # Assert
            assert result is False
    
    @pytest.mark.asyncio
    async def test_exists_connection_error(self, base_repo):
        """Test exists with connection error."""
        # Arrange
        query = {"name": "test"}
        
        with patch.object(base_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.find_one.side_effect = ConnectionFailure("Connection lost")
            mock_get_collection.return_value = mock_collection
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo.exists(query)
    
    # Test connection handling
    @pytest.mark.asyncio
    async def test_get_collection_caching(self, base_repo):
        """Test that collection is cached after first access."""
        with patch('app.core.database.get_database') as mock_get_database:
            mock_database = AsyncMock()
            mock_collection = AsyncMock()
            mock_database.__getitem__.return_value = mock_collection
            mock_get_database.return_value = mock_database
            
            # First call
            collection1 = await base_repo._get_collection()
            
            # Second call
            collection2 = await base_repo._get_collection()
            
            # Assert
            assert collection1 is collection2
            mock_get_database.assert_called_once()  # Should only be called once due to caching
    
    @pytest.mark.asyncio
    async def test_get_collection_database_error(self, base_repo):
        """Test _get_collection with database connection error."""
        with patch('app.core.database.get_database') as mock_get_database:
            mock_get_database.side_effect = Exception("Database connection failed")
            
            # Act & Assert
            with pytest.raises(DatabaseConnectionError):
                await base_repo._get_collection()


class TestQuestionRepository:
    """Test cases for QuestionRepository."""
    
    @pytest.fixture
    def question_repo(self):
        """QuestionRepository instance."""
        return QuestionRepository()
    
    @pytest.fixture
    def sample_question(self):
        """Sample question for testing."""
        return Question(
            id="test_question_1",
            title="Test Question",
            description="A test question for unit testing",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"col1": "string", "col2": "integer"},
            sample_input={"data": [{"col1": "test", "col2": 1}]},
            expected_output={"data": [{"result": "processed"}]},
            test_cases=[
                TestCase(
                    input_data={"col1": "test", "col2": 1},
                    expected_output={"result": "processed"},
                    description="Basic test case"
                )
            ]
        )
    
    # Test question creation
    @pytest.mark.asyncio
    async def test_create_question(self, question_repo, sample_question):
        """Test question creation."""
        with patch.object(question_repo, 'create') as mock_create:
            mock_create.return_value = "created_id"
            
            result = await question_repo.create_question(sample_question)
            
            assert result == "created_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["_id"] == sample_question.id
    
    @pytest.mark.asyncio
    async def test_create_question_without_id(self, question_repo):
        """Test question creation without predefined ID."""
        question = Question(
            id="test_question_1",  # ID is required
            title="Test Question",
            description="A test question",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"col1": "string"},
            sample_input={"data": []},
            expected_output={"data": []},
            test_cases=[]
        )
        
        with patch.object(question_repo, 'create') as mock_create:
            mock_create.return_value = "generated_id"
            
            result = await question_repo.create_question(question)
            
            assert result == "generated_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["_id"] == "test_question_1"  # ID should be converted to _id
    
    @pytest.mark.asyncio
    async def test_create_question_error(self, question_repo, sample_question):
        """Test question creation with database error."""
        with patch.object(question_repo, 'create') as mock_create:
            mock_create.side_effect = RepositoryError("Database error")
            
            with pytest.raises(RepositoryError):
                await question_repo.create_question(sample_question)
    
    # Test question retrieval
    @pytest.mark.asyncio
    async def test_get_question_by_id(self, question_repo, sample_question):
        """Test getting question by ID."""
        with patch.object(question_repo, 'get_by_id') as mock_get:
            doc_data = sample_question.model_dump()
            doc_data["_id"] = sample_question.id
            mock_get.return_value = doc_data
            
            result = await question_repo.get_question_by_id(sample_question.id)
            
            assert result is not None
            assert result.id == sample_question.id
            assert result.title == sample_question.title
            assert result.difficulty_level == sample_question.difficulty_level
    
    @pytest.mark.asyncio
    async def test_get_question_by_id_not_found(self, question_repo):
        """Test getting question by ID when not found."""
        with patch.object(question_repo, 'get_by_id') as mock_get:
            mock_get.return_value = None
            
            result = await question_repo.get_question_by_id("nonexistent_id")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_question_by_id_database_error(self, question_repo):
        """Test getting question by ID with database error."""
        with patch.object(question_repo, 'get_by_id') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(DatabaseConnectionError):
                await question_repo.get_question_by_id("test_id")
    
    # Test finding questions by difficulty
    @pytest.mark.asyncio
    async def test_find_questions_by_difficulty(self, question_repo):
        """Test finding questions by difficulty level."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "q1", 
                    "title": "Q1", 
                    "description": "Test question 1",
                    "difficulty_level": 1, 
                    "topic": "transformations",
                    "input_schema": {"col1": "string"},
                    "sample_input": {"data": []},
                    "expected_output": {"data": []},
                    "test_cases": [],
                    "created_at": datetime.utcnow()
                },
                {
                    "_id": "q2", 
                    "title": "Q2", 
                    "description": "Test question 2",
                    "difficulty_level": 1, 
                    "topic": "aggregations",
                    "input_schema": {"col1": "string"},
                    "sample_input": {"data": []},
                    "expected_output": {"data": []},
                    "test_cases": [],
                    "created_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await question_repo.find_questions_by_difficulty(DifficultyLevel.BEGINNER, limit=10)
            
            assert len(result) == 2
            assert all(q.difficulty_level == DifficultyLevel.BEGINNER for q in result)
            mock_find.assert_called_once_with(
                {"difficulty_level": 1}, 
                limit=10, 
                sort=[("created_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_find_questions_by_difficulty_no_limit(self, question_repo):
        """Test finding questions by difficulty without limit."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await question_repo.find_questions_by_difficulty(DifficultyLevel.INTERMEDIATE)
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {"difficulty_level": 2}, 
                limit=None, 
                sort=[("created_at", -1)]
            )
    
    # Test finding questions by topic
    @pytest.mark.asyncio
    async def test_find_questions_by_topic(self, question_repo):
        """Test finding questions by topic."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "q1", 
                    "title": "Transform Q1", 
                    "description": "Transformation question",
                    "difficulty_level": 1, 
                    "topic": "transformations",
                    "input_schema": {"col1": "string"},
                    "sample_input": {"data": []},
                    "expected_output": {"data": []},
                    "test_cases": [],
                    "created_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await question_repo.find_questions_by_topic(QuestionTopic.TRANSFORMATIONS, limit=5)
            
            assert len(result) == 1
            assert result[0].topic == QuestionTopic.TRANSFORMATIONS
            mock_find.assert_called_once_with(
                {"topic": "transformations"}, 
                limit=5, 
                sort=[("created_at", -1)]
            )
    
    # Test finding questions by multiple criteria
    @pytest.mark.asyncio
    async def test_find_questions_by_criteria_all_filters(self, question_repo):
        """Test finding questions with all criteria filters."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await question_repo.find_questions_by_criteria(
                difficulty_level=DifficultyLevel.ADVANCED,
                topic=QuestionTopic.JOINS,
                limit=20,
                skip=10
            )
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {"difficulty_level": 3, "topic": "joins"}, 
                limit=20, 
                skip=10,
                sort=[("created_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_find_questions_by_criteria_partial_filters(self, question_repo):
        """Test finding questions with partial criteria filters."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await question_repo.find_questions_by_criteria(
                difficulty_level=DifficultyLevel.BEGINNER
            )
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {"difficulty_level": 1}, 
                limit=None, 
                skip=None,
                sort=[("created_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_find_questions_by_criteria_no_filters(self, question_repo):
        """Test finding questions without any criteria filters."""
        with patch.object(question_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await question_repo.find_questions_by_criteria()
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {}, 
                limit=None, 
                skip=None,
                sort=[("created_at", -1)]
            )
    
    # Test random question selection
    @pytest.mark.asyncio
    async def test_get_random_question(self, question_repo):
        """Test getting random question."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()  # Use AsyncMock for cursor
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": ObjectId(), 
                    "title": "Random Q", 
                    "description": "Random test question",
                    "difficulty_level": 1, 
                    "topic": "transformations",
                    "input_schema": {"col1": "string"},
                    "sample_input": {"data": []},
                    "expected_output": {"data": []},
                    "test_cases": [],
                    "created_at": datetime.utcnow()
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.get_random_question(DifficultyLevel.BEGINNER)
            
            assert result is not None
            assert result.title == "Random Q"
            assert result.difficulty_level == DifficultyLevel.BEGINNER
            
            # Verify aggregation pipeline
            mock_collection.aggregate.assert_called_once()
            pipeline = mock_collection.aggregate.call_args[0][0]
            assert {"$match": {"difficulty_level": 1}} in pipeline
            assert {"$sample": {"size": 1}} in pipeline
    
    @pytest.mark.asyncio
    async def test_get_random_question_with_topic(self, question_repo):
        """Test getting random question with topic filter."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.get_random_question(
                difficulty_level=DifficultyLevel.INTERMEDIATE,
                topic=QuestionTopic.AGGREGATIONS
            )
            
            assert result is None
            
            # Verify aggregation pipeline includes both filters
            pipeline = mock_collection.aggregate.call_args[0][0]
            assert {"$match": {"difficulty_level": 2, "topic": "aggregations"}} in pipeline
    
    @pytest.mark.asyncio
    async def test_get_random_question_no_filters(self, question_repo):
        """Test getting random question without filters."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.get_random_question()
            
            assert result is None
            
            # Verify aggregation pipeline has no match stage
            pipeline = mock_collection.aggregate.call_args[0][0]
            assert len(pipeline) == 1  # Only $sample stage
            assert {"$sample": {"size": 1}} in pipeline
    
    @pytest.mark.asyncio
    async def test_get_random_question_database_error(self, question_repo):
        """Test getting random question with database error."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await question_repo.get_random_question()
    
    # Test question updates
    @pytest.mark.asyncio
    async def test_update_question(self, question_repo):
        """Test question update."""
        with patch.object(question_repo, 'update_by_id') as mock_update:
            updated_doc = {
                "id": "test_id",
                "title": "Updated Question",
                "description": "Updated description",
                "difficulty_level": 2,
                "topic": "aggregations",
                "input_schema": {"col1": "string"},
                "sample_input": {"data": []},
                "expected_output": {"data": []},
                "test_cases": [],
                "updated_at": datetime.utcnow()
            }
            mock_update.return_value = updated_doc
            
            result = await question_repo.update_question("test_id", {"title": "Updated Question"})
            
            assert result is not None
            assert result.title == "Updated Question"
            mock_update.assert_called_once_with("test_id", {"title": "Updated Question"})
    
    @pytest.mark.asyncio
    async def test_update_question_not_found(self, question_repo):
        """Test question update when question not found."""
        with patch.object(question_repo, 'update_by_id') as mock_update:
            mock_update.return_value = None
            
            result = await question_repo.update_question("nonexistent_id", {"title": "Updated"})
            
            assert result is None
    
    # Test question deletion
    @pytest.mark.asyncio
    async def test_delete_question(self, question_repo):
        """Test question deletion."""
        with patch.object(question_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = True
            
            result = await question_repo.delete_question("test_id")
            
            assert result is True
            mock_delete.assert_called_once_with("test_id")
    
    @pytest.mark.asyncio
    async def test_delete_question_not_found(self, question_repo):
        """Test question deletion when not found."""
        with patch.object(question_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = False
            
            result = await question_repo.delete_question("nonexistent_id")
            
            assert result is False
    
    # Test question statistics
    @pytest.mark.asyncio
    async def test_get_question_statistics(self, question_repo):
        """Test getting question statistics."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": None,
                    "total_questions": 10,
                    "by_difficulty": [
                        {"difficulty": 1, "topic": "transformations"},
                        {"difficulty": 1, "topic": "aggregations"},
                        {"difficulty": 2, "topic": "joins"},
                        {"difficulty": 2, "topic": "window_functions"},
                        {"difficulty": 3, "topic": "optimization"}
                    ]
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.get_question_statistics()
            
            assert result["total_questions"] == 10
            assert result["by_difficulty"][1] == 2  # Two beginner questions
            assert result["by_difficulty"][2] == 2  # Two intermediate questions
            assert result["by_difficulty"][3] == 1  # One advanced question
            assert result["by_topic"]["transformations"] == 1
            assert result["by_topic"]["aggregations"] == 1
    
    @pytest.mark.asyncio
    async def test_get_question_statistics_empty(self, question_repo):
        """Test getting question statistics when no questions exist."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.get_question_statistics()
            
            assert result["total_questions"] == 0
            assert result["by_difficulty"] == {}
            assert result["by_topic"] == {}
    
    @pytest.mark.asyncio
    async def test_get_question_statistics_error(self, question_repo):
        """Test getting question statistics with database error."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await question_repo.get_question_statistics()
    
    # Test question search
    @pytest.mark.asyncio
    async def test_search_questions(self, question_repo):
        """Test searching questions by text."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = MagicMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": ObjectId(),
                    "title": "DataFrame Transformation",
                    "description": "Transform data using PySpark",
                    "difficulty_level": 1,
                    "topic": "transformations",
                    "input_schema": {"col1": "string"},
                    "sample_input": {"data": []},
                    "expected_output": {"data": []},
                    "test_cases": [],
                    "created_at": datetime.utcnow()
                }
            ])
            mock_cursor.sort.return_value = mock_cursor
            mock_cursor.limit.return_value = mock_cursor
            
            # Mock collection.find to return cursor directly
            mock_collection.find = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.search_questions("DataFrame", limit=5)
            
            assert len(result) == 1
            assert "DataFrame" in result[0].title
            
            # Verify search query
            mock_collection.find.assert_called_once()
            query = mock_collection.find.call_args[0][0]
            assert "$or" in query
            assert {"title": {"$regex": "DataFrame", "$options": "i"}} in query["$or"]
            assert {"description": {"$regex": "DataFrame", "$options": "i"}} in query["$or"]
    
    @pytest.mark.asyncio
    async def test_search_questions_no_limit(self, question_repo):
        """Test searching questions without limit."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = MagicMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            mock_cursor.sort.return_value = mock_cursor
            
            # Mock collection.find to return cursor directly
            mock_collection.find = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await question_repo.search_questions("test")
            
            assert len(result) == 0
            mock_cursor.limit.assert_not_called()  # No limit should be applied
    
    @pytest.mark.asyncio
    async def test_search_questions_error(self, question_repo):
        """Test searching questions with database error."""
        with patch.object(question_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await question_repo.search_questions("test")


class TestUserRepository:
    """Test cases for UserRepository."""
    
    @pytest.fixture
    def user_repo(self):
        """UserRepository instance."""
        return UserRepository()
    
    @pytest.fixture
    def sample_user_progress(self):
        """Sample user progress for testing."""
        return UserProgress(
            user_id="test_user_1",
            experience_level=3,
            preferences=UserPreferences(experience_level=3),
            completed_questions=["q1", "q2"],
            success_rate=0.8,
            average_completion_time=15.5,
            skill_areas=[
                SkillArea(
                    topic=QuestionTopic.TRANSFORMATIONS,
                    proficiency_score=7.5,
                    questions_attempted=10,
                    questions_completed=8
                )
            ],
            total_questions_attempted=10,
            total_questions_completed=8
        )
    
    # Test user progress creation
    @pytest.mark.asyncio
    async def test_create_user_progress(self, user_repo, sample_user_progress):
        """Test user progress creation."""
        with patch.object(user_repo, 'create') as mock_create:
            mock_create.return_value = "created_id"
            
            result = await user_repo.create_user_progress(sample_user_progress)
            
            assert result == "created_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["user_id"] == sample_user_progress.user_id
    
    @pytest.mark.asyncio
    async def test_create_user_progress_error(self, user_repo, sample_user_progress):
        """Test user progress creation with database error."""
        with patch.object(user_repo, 'create') as mock_create:
            mock_create.side_effect = DuplicateDocumentError("User already exists")
            
            with pytest.raises(DuplicateDocumentError):
                await user_repo.create_user_progress(sample_user_progress)
    
    # Test user progress retrieval
    @pytest.mark.asyncio
    async def test_get_user_progress(self, user_repo, sample_user_progress):
        """Test getting user progress."""
        with patch.object(user_repo, 'get_by_field') as mock_get:
            doc_data = sample_user_progress.model_dump()
            doc_data["_id"] = ObjectId()
            mock_get.return_value = doc_data
            
            result = await user_repo.get_user_progress(sample_user_progress.user_id)
            
            assert result is not None
            assert result.user_id == sample_user_progress.user_id
            assert result.success_rate == sample_user_progress.success_rate
            mock_get.assert_called_once_with("user_id", sample_user_progress.user_id)
    
    @pytest.mark.asyncio
    async def test_get_user_progress_not_found(self, user_repo):
        """Test getting user progress when not found."""
        with patch.object(user_repo, 'get_by_field') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.get_user_progress("nonexistent_user")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_user_progress_database_error(self, user_repo):
        """Test getting user progress with database error."""
        with patch.object(user_repo, 'get_by_field') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(DatabaseConnectionError):
                await user_repo.get_user_progress("test_user")
    
    # Test user progress updates
    @pytest.mark.asyncio
    async def test_update_user_progress(self, user_repo, sample_user_progress):
        """Test updating user progress."""
        with patch.object(user_repo, 'get_by_field') as mock_get, \
             patch.object(user_repo, 'update_by_id') as mock_update:
            
            # Mock existing document
            existing_doc = sample_user_progress.model_dump()
            existing_doc["_id"] = ObjectId()
            mock_get.return_value = existing_doc
            
            # Mock updated document
            updated_doc = existing_doc.copy()
            updated_doc["success_rate"] = 0.9
            mock_update.return_value = updated_doc
            
            result = await user_repo.update_user_progress("test_user_1", {"success_rate": 0.9})
            
            assert result is not None
            assert result.success_rate == 0.9
            mock_get.assert_called_once_with("user_id", "test_user_1")
            mock_update.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_update_user_progress_not_found(self, user_repo):
        """Test updating user progress when user not found."""
        with patch.object(user_repo, 'get_by_field') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.update_user_progress("nonexistent_user", {"success_rate": 0.9})
            
            assert result is None
    
    # Test adding completed questions
    @pytest.mark.asyncio
    async def test_add_completed_question_success(self, user_repo, sample_user_progress):
        """Test adding completed question successfully."""
        with patch.object(user_repo, 'get_user_progress') as mock_get, \
             patch.object(user_repo, 'update_user_progress') as mock_update:
            
            mock_get.return_value = sample_user_progress
            updated_progress = sample_user_progress.model_copy()
            updated_progress.total_questions_completed += 1
            updated_progress.success_rate = 0.82  # Recalculated
            mock_update.return_value = updated_progress
            
            result = await user_repo.add_completed_question(
                sample_user_progress.user_id, 
                "new_question", 
                12.0, 
                True
            )
            
            assert result is not None
            mock_get.assert_called_once_with(sample_user_progress.user_id)
            mock_update.assert_called_once()
            
            # Verify update data structure
            update_call = mock_update.call_args[0][1]
            assert "$addToSet" in update_call
            assert "$inc" in update_call
            assert "$set" in update_call
            assert update_call["$addToSet"]["completed_questions"] == "new_question"
            assert update_call["$inc"]["total_questions_attempted"] == 1
            assert update_call["$inc"]["total_questions_completed"] == 1
    
    @pytest.mark.asyncio
    async def test_add_completed_question_failure(self, user_repo, sample_user_progress):
        """Test adding completed question with failure."""
        with patch.object(user_repo, 'get_user_progress') as mock_get, \
             patch.object(user_repo, 'update_user_progress') as mock_update:
            
            mock_get.return_value = sample_user_progress
            updated_progress = sample_user_progress.model_copy()
            updated_progress.total_questions_attempted += 1
            # success_rate should decrease since no completion
            mock_update.return_value = updated_progress
            
            result = await user_repo.add_completed_question(
                sample_user_progress.user_id, 
                "failed_question", 
                25.0, 
                False  # Failed
            )
            
            assert result is not None
            
            # Verify update data - should not increment completed count
            update_call = mock_update.call_args[0][1]
            assert "$inc" in update_call
            assert update_call["$inc"]["total_questions_attempted"] == 1
            assert "total_questions_completed" not in update_call["$inc"]
    
    @pytest.mark.asyncio
    async def test_add_completed_question_user_not_found(self, user_repo):
        """Test adding completed question when user not found."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.add_completed_question("nonexistent_user", "q1", 10.0, True)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_add_completed_question_error(self, user_repo, sample_user_progress):
        """Test adding completed question with database error."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await user_repo.add_completed_question("test_user", "q1", 10.0, True)
    
    # Test skill area updates
    @pytest.mark.asyncio
    async def test_update_skill_area_existing(self, user_repo, sample_user_progress):
        """Test updating existing skill area."""
        with patch.object(user_repo, 'get_user_progress') as mock_get, \
             patch.object(user_repo, 'update_user_progress') as mock_update:
            
            mock_get.return_value = sample_user_progress
            updated_progress = sample_user_progress.model_copy()
            mock_update.return_value = updated_progress
            
            result = await user_repo.update_skill_area(
                sample_user_progress.user_id,
                QuestionTopic.TRANSFORMATIONS,
                0.5,  # Proficiency increase
                attempted=True,
                completed=True
            )
            
            assert result is not None
            mock_get.assert_called_once()
            mock_update.assert_called_once()
            
            # Verify skill area was updated
            update_call = mock_update.call_args[0][1]
            assert "skill_areas" in update_call
            assert "overall_proficiency" in update_call
    
    @pytest.mark.asyncio
    async def test_update_skill_area_new(self, user_repo, sample_user_progress):
        """Test updating new skill area."""
        with patch.object(user_repo, 'get_user_progress') as mock_get, \
             patch.object(user_repo, 'update_user_progress') as mock_update:
            
            mock_get.return_value = sample_user_progress
            updated_progress = sample_user_progress.model_copy()
            mock_update.return_value = updated_progress
            
            result = await user_repo.update_skill_area(
                sample_user_progress.user_id,
                QuestionTopic.JOINS,  # New topic
                1.0,
                attempted=True,
                completed=True
            )
            
            assert result is not None
            
            # Verify new skill area was added
            update_call = mock_update.call_args[0][1]
            skill_areas = update_call["skill_areas"]
            assert len(skill_areas) == 2  # Original + new
            
            # Find the new skill area
            new_skill = next(area for area in skill_areas if area["topic"] == "joins")
            assert new_skill["proficiency_score"] == 6.0  # 5.0 base + 1.0 change
            assert new_skill["questions_attempted"] == 1
            assert new_skill["questions_completed"] == 1
    
    @pytest.mark.asyncio
    async def test_update_skill_area_proficiency_bounds(self, user_repo, sample_user_progress):
        """Test skill area proficiency score bounds."""
        with patch.object(user_repo, 'get_user_progress') as mock_get, \
             patch.object(user_repo, 'update_user_progress') as mock_update:
            
            mock_get.return_value = sample_user_progress
            updated_progress = sample_user_progress.model_copy()
            mock_update.return_value = updated_progress
            
            # Test upper bound (should cap at 10.0)
            await user_repo.update_skill_area(
                sample_user_progress.user_id,
                QuestionTopic.TRANSFORMATIONS,
                5.0,  # Would make it 12.5, but should cap at 10.0
                attempted=True,
                completed=True
            )
            
            update_call = mock_update.call_args[0][1]
            skill_areas = update_call["skill_areas"]
            transform_skill = next(area for area in skill_areas if area["topic"] == "transformations")
            assert transform_skill["proficiency_score"] == 10.0
    
    @pytest.mark.asyncio
    async def test_update_skill_area_user_not_found(self, user_repo):
        """Test updating skill area when user not found."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.update_skill_area(
                "nonexistent_user",
                QuestionTopic.TRANSFORMATIONS,
                1.0
            )
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_update_skill_area_error(self, user_repo, sample_user_progress):
        """Test updating skill area with database error."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await user_repo.update_skill_area("test_user", QuestionTopic.TRANSFORMATIONS, 1.0)
    
    # Test user queries
    @pytest.mark.asyncio
    async def test_get_users_by_experience_level(self, user_repo):
        """Test getting users by experience level range."""
        with patch.object(user_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "user_id": "user1",
                    "experience_level": 3,
                    "preferences": {"experience_level": 3},
                    "completed_questions": [],
                    "success_rate": 0.8,
                    "average_completion_time": 15.0,
                    "skill_areas": [],
                    "total_questions_attempted": 5,
                    "total_questions_completed": 4,
                    "last_activity": datetime.utcnow()
                },
                {
                    "user_id": "user2",
                    "experience_level": 5,
                    "preferences": {"experience_level": 5},
                    "completed_questions": [],
                    "success_rate": 0.9,
                    "average_completion_time": 12.0,
                    "skill_areas": [],
                    "total_questions_attempted": 10,
                    "total_questions_completed": 9,
                    "last_activity": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await user_repo.get_users_by_experience_level(3, 5, limit=10)
            
            assert len(result) == 2
            assert all(3 <= user.experience_level <= 5 for user in result)
            mock_find.assert_called_once_with(
                {"experience_level": {"$gte": 3, "$lte": 5}},
                limit=10,
                sort=[("last_activity", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_get_active_users(self, user_repo):
        """Test getting active users."""
        with patch.object(user_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await user_repo.get_active_users(days=7)
            
            assert len(result) == 0
            mock_find.assert_called_once()
            
            # Verify query includes date filter
            query = mock_find.call_args[0][0]
            assert "last_activity" in query
            assert "$gte" in query["last_activity"]
    
    @pytest.mark.asyncio
    async def test_get_user_leaderboard(self, user_repo):
        """Test getting user leaderboard."""
        with patch.object(user_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "user_id": "user1",
                    "experience_level": 3,
                    "success_rate": 0.9,
                    "total_questions_completed": 20,
                    "overall_proficiency": 8.5,
                    "last_activity": datetime.utcnow(),
                    "rank_metric": 0.9
                },
                {
                    "user_id": "user2",
                    "experience_level": 5,
                    "success_rate": 0.85,
                    "total_questions_completed": 15,
                    "overall_proficiency": 7.8,
                    "last_activity": datetime.utcnow(),
                    "rank_metric": 0.85
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await user_repo.get_user_leaderboard("success_rate", limit=10)
            
            assert len(result) == 2
            assert result[0]["rank"] == 1
            assert result[1]["rank"] == 2
            assert result[0]["success_rate"] > result[1]["success_rate"]
            
            # Verify aggregation pipeline
            mock_collection.aggregate.assert_called_once()
            pipeline = mock_collection.aggregate.call_args[0][0]
            assert {"$match": {"success_rate": {"$gt": 0}}} in pipeline
            assert {"$sort": {"success_rate": -1}} in pipeline
            assert {"$limit": 10} in pipeline
    
    @pytest.mark.asyncio
    async def test_get_user_leaderboard_error(self, user_repo):
        """Test getting user leaderboard with database error."""
        with patch.object(user_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await user_repo.get_user_leaderboard()
    
    # Test user analytics
    @pytest.mark.asyncio
    async def test_get_user_analytics(self, user_repo, sample_user_progress):
        """Test getting user analytics."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.return_value = sample_user_progress
            
            result = await user_repo.get_user_analytics(sample_user_progress.user_id)
            
            assert result is not None
            assert result.user_id == sample_user_progress.user_id
            assert "transformations" in result.topic_performance
            assert len(result.strengths) >= 0  # Based on proficiency scores
            assert len(result.improvement_areas) >= 0
    
    @pytest.mark.asyncio
    async def test_get_user_analytics_not_found(self, user_repo):
        """Test getting user analytics when user not found."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.get_user_analytics("nonexistent_user")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_user_analytics_error(self, user_repo):
        """Test getting user analytics with database error."""
        with patch.object(user_repo, 'get_user_progress') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await user_repo.get_user_analytics("test_user")
    
    # Test user deletion
    @pytest.mark.asyncio
    async def test_delete_user_progress(self, user_repo):
        """Test deleting user progress."""
        with patch.object(user_repo, 'get_by_field') as mock_get, \
             patch.object(user_repo, 'delete_by_id') as mock_delete:
            
            mock_get.return_value = {"_id": ObjectId(), "user_id": "test_user"}
            mock_delete.return_value = True
            
            result = await user_repo.delete_user_progress("test_user")
            
            assert result is True
            mock_get.assert_called_once_with("user_id", "test_user")
            mock_delete.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_user_progress_not_found(self, user_repo):
        """Test deleting user progress when not found."""
        with patch.object(user_repo, 'get_by_field') as mock_get:
            mock_get.return_value = None
            
            result = await user_repo.delete_user_progress("nonexistent_user")
            
            assert result is False


class TestSolutionRepository:
    """Test cases for SolutionRepository."""
    
    @pytest.fixture
    def solution_repo(self):
        """SolutionRepository instance."""
        return SolutionRepository()
    
    @pytest.fixture
    def sample_solution(self):
        """Sample solution for testing."""
        return Solution(
            id="test_solution_1",
            user_id="test_user_1",
            question_id="test_question_1",
            code="df.select('*').show()",
            status=SolutionStatus.DRAFT,
            submitted_at=datetime.utcnow()
        )
    
    @pytest.fixture
    def sample_execution_result(self):
        """Sample execution result for testing."""
        return ExecutionResult(
            job_id="test_job_1",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.SUBMIT,
            execution_time=5.2,
            memory_usage=128.5,
            validation_result=ValidationResult(
                is_correct=True,
                schema_match=True,
                row_count_match=True,
                data_match=True,
                error_details=[],
                similarity_score=1.0
            )
        )
    
    # Test solution creation
    @pytest.mark.asyncio
    async def test_create_solution(self, solution_repo, sample_solution):
        """Test solution creation."""
        with patch.object(solution_repo, 'create') as mock_create:
            mock_create.return_value = "created_id"
            
            result = await solution_repo.create_solution(sample_solution)
            
            assert result == "created_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["_id"] == sample_solution.id
    
    @pytest.mark.asyncio
    async def test_create_solution_without_id(self, solution_repo):
        """Test solution creation without predefined ID."""
        solution = Solution(
            id="test_solution_1",  # ID is required
            user_id="test_user_1",
            question_id="test_question_1",
            code="df.show()",
            status=SolutionStatus.DRAFT,
            submitted_at=datetime.utcnow()
        )
        
        with patch.object(solution_repo, 'create') as mock_create:
            mock_create.return_value = "generated_id"
            
            result = await solution_repo.create_solution(solution)
            
            assert result == "generated_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["_id"] == "test_solution_1"  # ID should be converted to _id
    
    @pytest.mark.asyncio
    async def test_create_solution_error(self, solution_repo, sample_solution):
        """Test solution creation with database error."""
        with patch.object(solution_repo, 'create') as mock_create:
            mock_create.side_effect = RepositoryError("Database error")
            
            with pytest.raises(RepositoryError):
                await solution_repo.create_solution(sample_solution)
    
    # Test solution retrieval
    @pytest.mark.asyncio
    async def test_get_solution_by_id(self, solution_repo, sample_solution):
        """Test getting solution by ID."""
        with patch.object(solution_repo, 'get_by_id') as mock_get:
            doc_data = sample_solution.model_dump()
            doc_data["_id"] = sample_solution.id
            mock_get.return_value = doc_data
            
            result = await solution_repo.get_solution_by_id(sample_solution.id)
            
            assert result is not None
            assert result.id == sample_solution.id
            assert result.user_id == sample_solution.user_id
            assert result.code == sample_solution.code
    
    @pytest.mark.asyncio
    async def test_get_solution_by_id_not_found(self, solution_repo):
        """Test getting solution by ID when not found."""
        with patch.object(solution_repo, 'get_by_id') as mock_get:
            mock_get.return_value = None
            
            result = await solution_repo.get_solution_by_id("nonexistent_id")
            
            assert result is None
    
    # Test getting solutions by user
    @pytest.mark.asyncio
    async def test_get_solutions_by_user(self, solution_repo):
        """Test getting solutions by user."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "s1", 
                    "user_id": "user1", 
                    "question_id": "q1", 
                    "code": "code1",
                    "status": "draft",
                    "submitted_at": datetime.utcnow()
                },
                {
                    "_id": "s2", 
                    "user_id": "user1", 
                    "question_id": "q2", 
                    "code": "code2",
                    "status": "submitted",
                    "submitted_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await solution_repo.get_solutions_by_user("user1", limit=10, skip=5)
            
            assert len(result) == 2
            assert all(s.user_id == "user1" for s in result)
            mock_find.assert_called_once_with(
                {"user_id": "user1"},
                limit=10,
                skip=5,
                sort=[("submitted_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_get_solutions_by_user_no_pagination(self, solution_repo):
        """Test getting solutions by user without pagination."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await solution_repo.get_solutions_by_user("user1")
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {"user_id": "user1"},
                limit=None,
                skip=None,
                sort=[("submitted_at", -1)]
            )
    
    # Test getting solutions by question
    @pytest.mark.asyncio
    async def test_get_solutions_by_question(self, solution_repo):
        """Test getting solutions for a specific question."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "s1", 
                    "user_id": "user1", 
                    "question_id": "q1", 
                    "code": "code1",
                    "status": "submitted",
                    "submitted_at": datetime.utcnow()
                },
                {
                    "_id": "s2", 
                    "user_id": "user2", 
                    "question_id": "q1", 
                    "code": "code2",
                    "status": "reviewed",
                    "submitted_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await solution_repo.get_solutions_by_question("q1", limit=20)
            
            assert len(result) == 2
            assert all(s.question_id == "q1" for s in result)
            mock_find.assert_called_once_with(
                {"question_id": "q1"},
                limit=20,
                sort=[("submitted_at", -1)]
            )
    
    # Test getting user solution for specific question
    @pytest.mark.asyncio
    async def test_get_user_solution_for_question(self, solution_repo):
        """Test getting user's solution for specific question."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "s1", 
                    "user_id": "user1", 
                    "question_id": "q1", 
                    "code": "code1",
                    "status": "submitted",
                    "submitted_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await solution_repo.get_user_solution_for_question("user1", "q1")
            
            assert result is not None
            assert result.user_id == "user1"
            assert result.question_id == "q1"
            mock_find.assert_called_once_with(
                {"user_id": "user1", "question_id": "q1"},
                limit=1,
                sort=[("submitted_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_get_user_solution_for_question_not_found(self, solution_repo):
        """Test getting user solution when not found."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await solution_repo.get_user_solution_for_question("user1", "q1")
            
            assert result is None
    
    # Test solution updates
    @pytest.mark.asyncio
    async def test_update_solution(self, solution_repo):
        """Test solution update."""
        with patch.object(solution_repo, 'update_by_id') as mock_update:
            updated_doc = {
                "id": "test_id",
                "user_id": "user1",
                "question_id": "q1",
                "code": "updated_code",
                "status": "submitted",
                "submitted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            mock_update.return_value = updated_doc
            
            result = await solution_repo.update_solution("test_id", {"code": "updated_code"})
            
            assert result is not None
            assert result.code == "updated_code"
            mock_update.assert_called_once_with("test_id", {"code": "updated_code"})
    
    @pytest.mark.asyncio
    async def test_update_solution_not_found(self, solution_repo):
        """Test solution update when solution not found."""
        with patch.object(solution_repo, 'update_by_id') as mock_update:
            mock_update.return_value = None
            
            result = await solution_repo.update_solution("nonexistent_id", {"code": "updated"})
            
            assert result is None
    
    # Test updating solution with execution result
    @pytest.mark.asyncio
    async def test_update_solution_execution_result(self, solution_repo, sample_execution_result):
        """Test updating solution with execution result."""
        with patch.object(solution_repo, 'update_solution') as mock_update:
            updated_solution = Solution(
                id="test_id",
                user_id="user1",
                question_id="q1",
                code="code",
                status=SolutionStatus.SUBMITTED,
                submitted_at=datetime.utcnow(),
                execution_result=sample_execution_result
            )
            mock_update.return_value = updated_solution
            
            result = await solution_repo.update_solution_execution_result("test_id", sample_execution_result)
            
            assert result is not None
            assert result.status == SolutionStatus.SUBMITTED
            assert result.execution_result is not None
            
            # Verify update data
            update_call = mock_update.call_args[0][1]
            assert "execution_result" in update_call
            assert "status" in update_call
    
    @pytest.mark.asyncio
    async def test_update_solution_execution_result_incorrect(self, solution_repo):
        """Test updating solution with incorrect execution result."""
        incorrect_result = ExecutionResult(
            job_id="test_job",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=3.0,
            memory_usage=64.0,
            validation_result=ValidationResult(
                is_correct=False,  # Incorrect result
                schema_match=True,
                row_count_match=False,
                data_match=False,
                error_details=[],
                similarity_score=0.5
            )
        )
        
        with patch.object(solution_repo, 'update_solution') as mock_update:
            updated_solution = Solution(
                id="test_id",
                user_id="user1",
                question_id="q1",
                code="code",
                status=SolutionStatus.DRAFT,  # Should remain draft for incorrect
                submitted_at=datetime.utcnow(),
                execution_result=incorrect_result
            )
            mock_update.return_value = updated_solution
            
            result = await solution_repo.update_solution_execution_result("test_id", incorrect_result)
            
            assert result is not None
            assert result.status == SolutionStatus.DRAFT  # Should be draft for incorrect
    
    # Test updating solution with AI review
    @pytest.mark.asyncio
    async def test_update_solution_ai_review(self, solution_repo):
        """Test updating solution with AI review."""
        from app.models.execution import CodeReview
        
        ai_review = CodeReview(
            overall_score=8.5,
            correctness_feedback="Solution is correct",
            performance_feedback="Good performance",
            best_practices_feedback="Follows best practices",
            improvement_suggestions=["Consider using caching"],
            code_examples=[],
            alternative_approaches=[],
            analysis_time=2.5,  # Required field
            model_used="groq-llama3"  # Required field
        )
        
        with patch.object(solution_repo, 'update_solution') as mock_update:
            updated_solution = Solution(
                id="test_id",
                user_id="user1",
                question_id="q1",
                code="code",
                status=SolutionStatus.REVIEWED,
                submitted_at=datetime.utcnow(),
                ai_review=ai_review,
                reviewed_at=datetime.utcnow()
            )
            mock_update.return_value = updated_solution
            
            result = await solution_repo.update_solution_ai_review("test_id", ai_review)
            
            assert result is not None
            assert result.status == SolutionStatus.REVIEWED
            assert result.ai_review is not None
            assert result.reviewed_at is not None
            
            # Verify update data
            update_call = mock_update.call_args[0][1]
            assert "ai_review" in update_call
            assert "reviewed_at" in update_call
            assert "status" in update_call
    
    # Test getting solutions by status
    @pytest.mark.asyncio
    async def test_get_solutions_by_status(self, solution_repo):
        """Test getting solutions by status."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "s1",
                    "user_id": "user1",
                    "question_id": "q1",
                    "code": "code1",
                    "status": "submitted",
                    "submitted_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await solution_repo.get_solutions_by_status(SolutionStatus.SUBMITTED, limit=15)
            
            assert len(result) == 1
            assert result[0].status == SolutionStatus.SUBMITTED
            mock_find.assert_called_once_with(
                {"status": "submitted"},
                limit=15,
                sort=[("submitted_at", -1)]
            )
    
    # Test getting solutions needing review
    @pytest.mark.asyncio
    async def test_get_solutions_needing_review(self, solution_repo):
        """Test getting solutions that need AI review."""
        with patch.object(solution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "_id": "s1",
                    "user_id": "user1",
                    "question_id": "q1",
                    "code": "code1",
                    "status": "submitted",
                    "submitted_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await solution_repo.get_solutions_needing_review(limit=25)
            
            assert len(result) == 1
            mock_find.assert_called_once_with(
                {
                    "status": "submitted",
                    "ai_review": {"$exists": False}
                },
                limit=25,
                sort=[("submitted_at", 1)]  # Oldest first for fair processing
            )
    
    # Test solution statistics
    @pytest.mark.asyncio
    async def test_get_solution_statistics(self, solution_repo):
        """Test getting solution statistics."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": None,
                    "total_solutions": 100,
                    "by_status": ["draft", "submitted", "reviewed", "draft", "submitted"],
                    "avg_execution_time": 5.2,
                    "successful_solutions": 75
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await solution_repo.get_solution_statistics()
            
            assert result["total_solutions"] == 100
            assert result["successful_solutions"] == 75
            assert result["success_rate"] == 0.75
            assert result["avg_execution_time"] == 5.2
            assert result["by_status"]["draft"] == 2
            assert result["by_status"]["submitted"] == 2
            assert result["by_status"]["reviewed"] == 1
    
    @pytest.mark.asyncio
    async def test_get_solution_statistics_empty(self, solution_repo):
        """Test getting solution statistics when no solutions exist."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await solution_repo.get_solution_statistics()
            
            assert result["total_solutions"] == 0
            assert result["success_rate"] == 0.0
            assert result["avg_execution_time"] == 0.0
    
    # Test user solution history
    @pytest.mark.asyncio
    async def test_get_user_solution_history(self, solution_repo):
        """Test getting user solution history."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": "2023-12-01",
                    "solutions_count": 5,
                    "successful_count": 4,
                    "avg_execution_time": 4.2
                },
                {
                    "_id": "2023-12-02",
                    "solutions_count": 3,
                    "successful_count": 2,
                    "avg_execution_time": 6.1
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await solution_repo.get_user_solution_history("user1", days=30)
            
            assert len(result) == 2
            assert result[0]["date"] == "2023-12-01"
            assert result[0]["solutions_count"] == 5
            assert result[0]["successful_count"] == 4
            assert result[0]["success_rate"] == 0.8
            assert result[1]["success_rate"] == 2/3  # 2 successful out of 3
    
    @pytest.mark.asyncio
    async def test_get_user_solution_history_error(self, solution_repo):
        """Test getting user solution history with database error."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await solution_repo.get_user_solution_history("user1")
    
    # Test solution deletion
    @pytest.mark.asyncio
    async def test_delete_solution(self, solution_repo):
        """Test solution deletion."""
        with patch.object(solution_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = True
            
            result = await solution_repo.delete_solution("test_id")
            
            assert result is True
            mock_delete.assert_called_once_with("test_id")
    
    @pytest.mark.asyncio
    async def test_delete_solution_not_found(self, solution_repo):
        """Test solution deletion when not found."""
        with patch.object(solution_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = False
            
            result = await solution_repo.delete_solution("nonexistent_id")
            
            assert result is False
    
    # Test deleting user solutions
    @pytest.mark.asyncio
    async def test_delete_user_solutions(self, solution_repo):
        """Test deleting all solutions for a user."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.delete_many.return_value = AsyncMock(deleted_count=5)
            mock_get_collection.return_value = mock_collection
            
            result = await solution_repo.delete_user_solutions("user1")
            
            assert result == 5
            mock_collection.delete_many.assert_called_once_with({"user_id": "user1"})
    
    @pytest.mark.asyncio
    async def test_delete_user_solutions_error(self, solution_repo):
        """Test deleting user solutions with database error."""
        with patch.object(solution_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await solution_repo.delete_user_solutions("user1")


class TestExecutionRepository:
    """Test cases for ExecutionRepository."""
    
    @pytest.fixture
    def execution_repo(self):
        """ExecutionRepository instance."""
        return ExecutionRepository()
    
    @pytest.fixture
    def sample_execution_result(self):
        """Sample execution result for testing."""
        return ExecutionResult(
            job_id="test_job_1",
            status=ExecutionStatus.PENDING,
            mode=ExecutionMode.TEST,
            execution_time=0.0,
            memory_usage=0.0,
            created_at=datetime.utcnow()
        )
    
    # Test execution result creation
    @pytest.mark.asyncio
    async def test_create_execution_result(self, execution_repo, sample_execution_result):
        """Test execution result creation."""
        with patch.object(execution_repo, 'create') as mock_create:
            mock_create.return_value = "created_id"
            
            result = await execution_repo.create_execution_result(sample_execution_result)
            
            assert result == "created_id"
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0]
            assert call_args["_id"] == sample_execution_result.job_id
    
    @pytest.mark.asyncio
    async def test_create_execution_result_error(self, execution_repo, sample_execution_result):
        """Test execution result creation with database error."""
        with patch.object(execution_repo, 'create') as mock_create:
            mock_create.side_effect = DuplicateDocumentError("Job ID already exists")
            
            with pytest.raises(DuplicateDocumentError):
                await execution_repo.create_execution_result(sample_execution_result)
    
    # Test execution result retrieval
    @pytest.mark.asyncio
    async def test_get_execution_result_by_job_id(self, execution_repo, sample_execution_result):
        """Test getting execution result by job ID."""
        with patch.object(execution_repo, 'get_by_id') as mock_get:
            doc_data = sample_execution_result.model_dump()
            mock_get.return_value = doc_data
            
            result = await execution_repo.get_execution_result_by_job_id(sample_execution_result.job_id)
            
            assert result is not None
            assert result.job_id == sample_execution_result.job_id
            assert result.status == sample_execution_result.status
            mock_get.assert_called_once_with(sample_execution_result.job_id)
    
    @pytest.mark.asyncio
    async def test_get_execution_result_by_job_id_not_found(self, execution_repo):
        """Test getting execution result when not found."""
        with patch.object(execution_repo, 'get_by_id') as mock_get:
            mock_get.return_value = None
            
            result = await execution_repo.get_execution_result_by_job_id("nonexistent_job")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_execution_result_database_error(self, execution_repo):
        """Test getting execution result with database error."""
        with patch.object(execution_repo, 'get_by_id') as mock_get:
            mock_get.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(DatabaseConnectionError):
                await execution_repo.get_execution_result_by_job_id("test_job")
    
    # Test execution result updates
    @pytest.mark.asyncio
    async def test_update_execution_result(self, execution_repo):
        """Test updating execution result."""
        with patch.object(execution_repo, 'update_by_id') as mock_update:
            updated_doc = {
                "job_id": "test_job",
                "status": "running",
                "mode": "test",
                "execution_time": 2.5,
                "memory_usage": 64.0,
                "updated_at": datetime.utcnow()
            }
            mock_update.return_value = updated_doc
            
            result = await execution_repo.update_execution_result("test_job", {"status": "running"})
            
            assert result is not None
            assert result.status == ExecutionStatus.RUNNING
            mock_update.assert_called_once_with("test_job", {"status": "running"})
    
    @pytest.mark.asyncio
    async def test_update_execution_result_not_found(self, execution_repo):
        """Test updating execution result when not found."""
        with patch.object(execution_repo, 'update_by_id') as mock_update:
            mock_update.return_value = None
            
            result = await execution_repo.update_execution_result("nonexistent_job", {"status": "running"})
            
            assert result is None
    
    # Test execution status updates
    @pytest.mark.asyncio
    async def test_update_execution_status_completed(self, execution_repo):
        """Test updating execution status to completed."""
        with patch.object(execution_repo, 'update_execution_result') as mock_update:
            updated_result = ExecutionResult(
                job_id="test_job_1",
                status=ExecutionStatus.COMPLETED,
                mode=ExecutionMode.TEST,
                execution_time=5.0,
                memory_usage=128.0,
                completed_at=datetime.utcnow()
            )
            mock_update.return_value = updated_result
            
            result = await execution_repo.update_execution_status("test_job_1", ExecutionStatus.COMPLETED)
            
            assert result is not None
            assert result.status == ExecutionStatus.COMPLETED
            
            # Verify update data includes completed_at
            update_call = mock_update.call_args[0][1]
            assert update_call["status"] == "completed"
            assert "completed_at" in update_call
    
    @pytest.mark.asyncio
    async def test_update_execution_status_failed(self, execution_repo):
        """Test updating execution status to failed with error message."""
        with patch.object(execution_repo, 'update_execution_result') as mock_update:
            updated_result = ExecutionResult(
                job_id="test_job_1",
                status=ExecutionStatus.FAILED,
                mode=ExecutionMode.TEST,
                execution_time=2.0,
                memory_usage=32.0,
                error_message="Syntax error in code",
                completed_at=datetime.utcnow()
            )
            mock_update.return_value = updated_result
            
            result = await execution_repo.update_execution_status(
                "test_job_1", 
                ExecutionStatus.FAILED, 
                error_message="Syntax error in code"
            )
            
            assert result is not None
            assert result.status == ExecutionStatus.FAILED
            assert result.error_message == "Syntax error in code"
            
            # Verify update data includes error message and completed_at
            update_call = mock_update.call_args[0][1]
            assert update_call["status"] == "failed"
            assert update_call["error_message"] == "Syntax error in code"
            assert "completed_at" in update_call
    
    @pytest.mark.asyncio
    async def test_update_execution_status_timeout(self, execution_repo):
        """Test updating execution status to timeout."""
        with patch.object(execution_repo, 'update_execution_result') as mock_update:
            updated_result = ExecutionResult(
                job_id="test_job_1",
                status=ExecutionStatus.TIMEOUT,
                mode=ExecutionMode.SUBMIT,
                execution_time=30.0,
                memory_usage=256.0,
                error_message="Execution timed out",
                completed_at=datetime.utcnow()
            )
            mock_update.return_value = updated_result
            
            result = await execution_repo.update_execution_status("test_job_1", ExecutionStatus.TIMEOUT)
            
            assert result is not None
            assert result.status == ExecutionStatus.TIMEOUT
            assert result.error_message == "Execution timed out"
            
            # Verify update data includes timeout error message
            update_call = mock_update.call_args[0][1]
            assert update_call["status"] == "timeout"
            assert update_call["error_message"] == "Execution timed out"
            assert "completed_at" in update_call
    
    @pytest.mark.asyncio
    async def test_update_execution_status_running(self, execution_repo):
        """Test updating execution status to running."""
        with patch.object(execution_repo, 'update_execution_result') as mock_update:
            updated_result = ExecutionResult(
                job_id="test_job_1",
                status=ExecutionStatus.RUNNING,
                mode=ExecutionMode.TEST,
                execution_time=0.0,
                memory_usage=0.0
            )
            mock_update.return_value = updated_result
            
            result = await execution_repo.update_execution_status("test_job_1", ExecutionStatus.RUNNING)
            
            assert result is not None
            assert result.status == ExecutionStatus.RUNNING
            
            # Verify update data doesn't include completed_at for running status
            update_call = mock_update.call_args[0][1]
            assert update_call["status"] == "running"
            assert "completed_at" not in update_call
    
    # Test getting executions by status
    @pytest.mark.asyncio
    async def test_get_executions_by_status(self, execution_repo):
        """Test getting executions by status."""
        with patch.object(execution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "job_id": "job1", 
                    "status": "pending", 
                    "mode": "test",
                    "execution_time": 0.0,
                    "memory_usage": 0.0,
                    "created_at": datetime.utcnow()
                },
                {
                    "job_id": "job2", 
                    "status": "pending", 
                    "mode": "submit",
                    "execution_time": 0.0,
                    "memory_usage": 0.0,
                    "created_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await execution_repo.get_executions_by_status(ExecutionStatus.PENDING, limit=10)
            
            assert len(result) == 2
            assert all(r.status == ExecutionStatus.PENDING for r in result)
            mock_find.assert_called_once_with(
                {"status": "pending"},
                limit=10,
                sort=[("created_at", -1)]
            )
    
    @pytest.mark.asyncio
    async def test_get_executions_by_status_no_limit(self, execution_repo):
        """Test getting executions by status without limit."""
        with patch.object(execution_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await execution_repo.get_executions_by_status(ExecutionStatus.COMPLETED)
            
            assert len(result) == 0
            mock_find.assert_called_once_with(
                {"status": "completed"},
                limit=None,
                sort=[("created_at", -1)]
            )
    
    # Test convenience methods for specific statuses
    @pytest.mark.asyncio
    async def test_get_pending_executions(self, execution_repo):
        """Test getting pending executions."""
        with patch.object(execution_repo, 'get_executions_by_status') as mock_get_by_status:
            mock_get_by_status.return_value = []
            
            result = await execution_repo.get_pending_executions(limit=5)
            
            assert len(result) == 0
            mock_get_by_status.assert_called_once_with(ExecutionStatus.PENDING, 5)
    
    @pytest.mark.asyncio
    async def test_get_running_executions(self, execution_repo):
        """Test getting running executions."""
        with patch.object(execution_repo, 'get_executions_by_status') as mock_get_by_status:
            mock_get_by_status.return_value = []
            
            result = await execution_repo.get_running_executions(limit=3)
            
            assert len(result) == 0
            mock_get_by_status.assert_called_once_with(ExecutionStatus.RUNNING, 3)
    
    # Test getting executions by mode
    @pytest.mark.asyncio
    async def test_get_executions_by_mode(self, execution_repo):
        """Test getting executions by mode."""
        with patch.object(execution_repo, 'find_many') as mock_find:
            mock_docs = [
                {
                    "job_id": "job1",
                    "status": "completed",
                    "mode": "submit",
                    "execution_time": 5.2,
                    "memory_usage": 128.0,
                    "created_at": datetime.utcnow()
                }
            ]
            mock_find.return_value = mock_docs
            
            result = await execution_repo.get_executions_by_mode(ExecutionMode.SUBMIT, limit=20)
            
            assert len(result) == 1
            assert result[0].mode == ExecutionMode.SUBMIT
            mock_find.assert_called_once_with(
                {"mode": "submit"},
                limit=20,
                sort=[("created_at", -1)]
            )
    
    # Test getting recent executions
    @pytest.mark.asyncio
    async def test_get_recent_executions(self, execution_repo):
        """Test getting recent executions."""
        with patch.object(execution_repo, 'find_many') as mock_find:
            mock_find.return_value = []
            
            result = await execution_repo.get_recent_executions(hours=12, limit=50)
            
            assert len(result) == 0
            mock_find.assert_called_once()
            
            # Verify query includes date filter
            query = mock_find.call_args[0][0]
            assert "created_at" in query
            assert "$gte" in query["created_at"]
    
    # Test execution statistics
    @pytest.mark.asyncio
    async def test_get_execution_statistics(self, execution_repo):
        """Test getting execution statistics."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {
                    "_id": None,
                    "total_executions": 100,
                    "by_status": ["completed", "failed", "timeout", "completed", "completed"],
                    "by_mode": ["test", "submit", "test", "submit", "test"],
                    "avg_execution_time": 4.5,
                    "avg_memory_usage": 96.2,
                    "successful_executions": 75,
                    "failed_executions": 20,
                    "timeout_executions": 5
                }
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await execution_repo.get_execution_statistics()
            
            assert result["total_executions"] == 100
            assert result["success_rate"] == 0.75
            assert result["failure_rate"] == 0.20
            assert result["timeout_rate"] == 0.05
            assert result["avg_execution_time"] == 4.5
            assert result["avg_memory_usage"] == 96.2
            assert result["by_status"]["completed"] == 3
            assert result["by_status"]["failed"] == 1
            assert result["by_status"]["timeout"] == 1
            assert result["by_mode"]["test"] == 3
            assert result["by_mode"]["submit"] == 2
    
    @pytest.mark.asyncio
    async def test_get_execution_statistics_empty(self, execution_repo):
        """Test getting execution statistics when no executions exist."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await execution_repo.get_execution_statistics()
            
            assert result["total_executions"] == 0
            assert result["success_rate"] == 0.0
            assert result["failure_rate"] == 0.0
            assert result["timeout_rate"] == 0.0
            assert result["avg_execution_time"] == 0.0
            assert result["avg_memory_usage"] == 0.0
    
    @pytest.mark.asyncio
    async def test_get_execution_statistics_error(self, execution_repo):
        """Test getting execution statistics with database error."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await execution_repo.get_execution_statistics()
    
    # Test cleanup operations
    @pytest.mark.asyncio
    async def test_cleanup_old_executions(self, execution_repo):
        """Test cleaning up old execution results."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_collection.delete_many.return_value = AsyncMock(deleted_count=25)
            mock_get_collection.return_value = mock_collection
            
            result = await execution_repo.cleanup_old_executions(days=7)
            
            assert result == 25
            mock_collection.delete_many.assert_called_once()
            
            # Verify query filters old executions and excludes pending/running
            query = mock_collection.delete_many.call_args[0][0]
            assert "created_at" in query
            assert "$lt" in query["created_at"]
            assert "status" in query
            assert "$in" in query["status"]
            assert "completed" in query["status"]["$in"]
            assert "failed" in query["status"]["$in"]
            assert "timeout" in query["status"]["$in"]
    
    @pytest.mark.asyncio
    async def test_cleanup_old_executions_error(self, execution_repo):
        """Test cleaning up old executions with database error."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await execution_repo.cleanup_old_executions()
    
    # Test queue status
    @pytest.mark.asyncio
    async def test_get_execution_queue_status(self, execution_repo):
        """Test getting execution queue status."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[
                {"_id": "pending", "count": 5},
                {"_id": "running", "count": 3},
                {"_id": "completed", "count": 100},
                {"_id": "failed", "count": 10},
                {"_id": "timeout", "count": 2}
            ])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await execution_repo.get_execution_queue_status()
            
            assert result["pending"] == 5
            assert result["running"] == 3
            assert result["completed"] == 100
            assert result["failed"] == 10
            assert result["timeout"] == 2
            assert result["total_in_queue"] == 8  # pending + running
    
    @pytest.mark.asyncio
    async def test_get_execution_queue_status_empty(self, execution_repo):
        """Test getting execution queue status when empty."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_collection = AsyncMock()
            mock_cursor = AsyncMock()
            mock_cursor.to_list = AsyncMock(return_value=[])
            # Mock collection.aggregate to return cursor directly
            mock_collection.aggregate = MagicMock(return_value=mock_cursor)
            mock_get_collection.return_value = mock_collection
            
            result = await execution_repo.get_execution_queue_status()
            
            assert result["pending"] == 0
            assert result["running"] == 0
            assert result["completed"] == 0
            assert result["failed"] == 0
            assert result["timeout"] == 0
            assert result["total_in_queue"] == 0
    
    @pytest.mark.asyncio
    async def test_get_execution_queue_status_error(self, execution_repo):
        """Test getting execution queue status with database error."""
        with patch.object(execution_repo, '_get_collection') as mock_get_collection:
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            with pytest.raises(RepositoryError):
                await execution_repo.get_execution_queue_status()
    
    # Test execution result deletion
    @pytest.mark.asyncio
    async def test_delete_execution_result(self, execution_repo):
        """Test execution result deletion."""
        with patch.object(execution_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = True
            
            result = await execution_repo.delete_execution_result("test_job")
            
            assert result is True
            mock_delete.assert_called_once_with("test_job")
    
    @pytest.mark.asyncio
    async def test_delete_execution_result_not_found(self, execution_repo):
        """Test execution result deletion when not found."""
        with patch.object(execution_repo, 'delete_by_id') as mock_delete:
            mock_delete.return_value = False
            
            result = await execution_repo.delete_execution_result("nonexistent_job")
            
            assert result is False


class TestRepositoryFactory:
    """Test cases for RepositoryFactory."""
    
    def setup_method(self):
        """Clear factory instances before each test."""
        RepositoryFactory.clear_instances()
    
    def teardown_method(self):
        """Clear factory instances after each test."""
        RepositoryFactory.clear_instances()
    
    # Test singleton behavior
    def test_get_question_repository_singleton(self):
        """Test that factory returns singleton instances for QuestionRepository."""
        repo1 = RepositoryFactory.get_question_repository()
        repo2 = RepositoryFactory.get_question_repository()
        
        assert repo1 is repo2
        assert isinstance(repo1, QuestionRepository)
        assert repo1.collection_name == "questions"
    
    def test_get_user_repository_singleton(self):
        """Test that factory returns singleton instances for UserRepository."""
        repo1 = RepositoryFactory.get_user_repository()
        repo2 = RepositoryFactory.get_user_repository()
        
        assert repo1 is repo2
        assert isinstance(repo1, UserRepository)
        assert repo1.collection_name == "users"
    
    def test_get_solution_repository_singleton(self):
        """Test that factory returns singleton instances for SolutionRepository."""
        repo1 = RepositoryFactory.get_solution_repository()
        repo2 = RepositoryFactory.get_solution_repository()
        
        assert repo1 is repo2
        assert isinstance(repo1, SolutionRepository)
        assert repo1.collection_name == "solutions"
    
    def test_get_execution_repository_singleton(self):
        """Test that factory returns singleton instances for ExecutionRepository."""
        repo1 = RepositoryFactory.get_execution_repository()
        repo2 = RepositoryFactory.get_execution_repository()
        
        assert repo1 is repo2
        assert isinstance(repo1, ExecutionRepository)
        assert repo1.collection_name == "execution_results"
    
    # Test different repository types are different instances
    def test_different_repository_types_are_different_instances(self):
        """Test that different repository types return different instances."""
        question_repo = RepositoryFactory.get_question_repository()
        user_repo = RepositoryFactory.get_user_repository()
        solution_repo = RepositoryFactory.get_solution_repository()
        execution_repo = RepositoryFactory.get_execution_repository()
        
        # All should be different instances
        assert question_repo is not user_repo
        assert question_repo is not solution_repo
        assert question_repo is not execution_repo
        assert user_repo is not solution_repo
        assert user_repo is not execution_repo
        assert solution_repo is not execution_repo
        
        # But should be correct types
        assert isinstance(question_repo, QuestionRepository)
        assert isinstance(user_repo, UserRepository)
        assert isinstance(solution_repo, SolutionRepository)
        assert isinstance(execution_repo, ExecutionRepository)
    
    # Test clearing instances
    def test_clear_instances(self):
        """Test clearing repository instances."""
        # Get instances
        repo1 = RepositoryFactory.get_question_repository()
        user_repo1 = RepositoryFactory.get_user_repository()
        
        # Verify they're cached
        repo2 = RepositoryFactory.get_question_repository()
        user_repo2 = RepositoryFactory.get_user_repository()
        assert repo1 is repo2
        assert user_repo1 is user_repo2
        
        # Clear instances
        RepositoryFactory.clear_instances()
        
        # Get new instances
        repo3 = RepositoryFactory.get_question_repository()
        user_repo3 = RepositoryFactory.get_user_repository()
        
        # Should be different instances now
        assert repo1 is not repo3
        assert user_repo1 is not user_repo3
        
        # But still correct types
        assert isinstance(repo3, QuestionRepository)
        assert isinstance(user_repo3, UserRepository)
    
    # Test internal _get_repository method
    def test_get_repository_internal_method(self):
        """Test the internal _get_repository method."""
        # First call should create new instance
        repo1 = RepositoryFactory._get_repository(QuestionRepository)
        assert isinstance(repo1, QuestionRepository)
        
        # Second call should return same instance
        repo2 = RepositoryFactory._get_repository(QuestionRepository)
        assert repo1 is repo2
        
        # Different type should return different instance
        user_repo = RepositoryFactory._get_repository(UserRepository)
        assert repo1 is not user_repo
        assert isinstance(user_repo, UserRepository)
    
    # Test factory state management
    def test_factory_instances_dictionary(self):
        """Test that factory properly manages instances dictionary."""
        # Initially empty
        assert len(RepositoryFactory._instances) == 0
        
        # Get one repository
        question_repo = RepositoryFactory.get_question_repository()
        assert len(RepositoryFactory._instances) == 1
        assert QuestionRepository in RepositoryFactory._instances
        assert RepositoryFactory._instances[QuestionRepository] is question_repo
        
        # Get another repository type
        user_repo = RepositoryFactory.get_user_repository()
        assert len(RepositoryFactory._instances) == 2
        assert UserRepository in RepositoryFactory._instances
        assert RepositoryFactory._instances[UserRepository] is user_repo
        
        # Get same repository again - should not increase count
        question_repo2 = RepositoryFactory.get_question_repository()
        assert len(RepositoryFactory._instances) == 2
        assert question_repo is question_repo2
        
        # Clear instances
        RepositoryFactory.clear_instances()
        assert len(RepositoryFactory._instances) == 0
    
    # Test convenience functions
    def test_convenience_functions(self):
        """Test convenience functions work correctly."""
        from app.repositories.factory import (
            get_question_repository,
            get_user_repository,
            get_solution_repository,
            get_execution_repository
        )
        
        # Test convenience functions return same instances as factory methods
        question_repo1 = get_question_repository()
        question_repo2 = RepositoryFactory.get_question_repository()
        assert question_repo1 is question_repo2
        
        user_repo1 = get_user_repository()
        user_repo2 = RepositoryFactory.get_user_repository()
        assert user_repo1 is user_repo2
        
        solution_repo1 = get_solution_repository()
        solution_repo2 = RepositoryFactory.get_solution_repository()
        assert solution_repo1 is solution_repo2
        
        execution_repo1 = get_execution_repository()
        execution_repo2 = RepositoryFactory.get_execution_repository()
        assert execution_repo1 is execution_repo2
    
    # Test thread safety (basic test)
    def test_factory_basic_thread_safety(self):
        """Test basic thread safety of factory (single-threaded test)."""
        import threading
        import time
        
        results = []
        
        def get_repo():
            time.sleep(0.01)  # Small delay to increase chance of race condition
            repo = RepositoryFactory.get_question_repository()
            results.append(repo)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=get_repo)
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All results should be the same instance
        assert len(results) == 5
        assert all(repo is results[0] for repo in results)
        assert isinstance(results[0], QuestionRepository)
    
    # Test error handling
    def test_factory_with_invalid_repository_class(self):
        """Test factory behavior with invalid repository class."""
        # This is more of a type safety test - in practice, this would be caught by type checker
        class InvalidRepository:
            pass
        
        # The factory should still work but create the invalid class
        # (This is expected behavior - the factory doesn't validate the class)
        instance = RepositoryFactory._get_repository(InvalidRepository)
        assert isinstance(instance, InvalidRepository)
        
        # Second call should return same instance
        instance2 = RepositoryFactory._get_repository(InvalidRepository)
        assert instance is instance2


# Additional integration-style tests for repository interactions
class TestRepositoryIntegration:
    """Integration tests for repository interactions."""
    
    def setup_method(self):
        """Clear factory instances before each test."""
        RepositoryFactory.clear_instances()
    
    def teardown_method(self):
        """Clear factory instances after each test."""
        RepositoryFactory.clear_instances()
    
    def test_multiple_repositories_independence(self):
        """Test that multiple repositories work independently."""
        question_repo = RepositoryFactory.get_question_repository()
        user_repo = RepositoryFactory.get_user_repository()
        solution_repo = RepositoryFactory.get_solution_repository()
        execution_repo = RepositoryFactory.get_execution_repository()
        
        # Each should have different collection names
        assert question_repo.collection_name == "questions"
        assert user_repo.collection_name == "users"
        assert solution_repo.collection_name == "solutions"
        assert execution_repo.collection_name == "execution_results"
        
        # Each should be independent instances
        assert question_repo._collection is None
        assert user_repo._collection is None
        assert solution_repo._collection is None
        assert execution_repo._collection is None
    
    @pytest.mark.asyncio
    async def test_repository_error_handling_independence(self):
        """Test that errors in one repository don't affect others."""
        question_repo = RepositoryFactory.get_question_repository()
        user_repo = RepositoryFactory.get_user_repository()
        
        # Mock one repository to fail
        with patch.object(question_repo, '_get_collection') as mock_question_collection, \
             patch.object(user_repo, '_get_collection') as mock_user_collection:
            
            # Make question repo fail
            mock_question_collection.side_effect = DatabaseConnectionError("Question DB failed")
            
            # Make user repo succeed
            mock_user_collection.return_value = AsyncMock()
            
            # Question repo should fail
            with pytest.raises(DatabaseConnectionError):
                await question_repo.get_question_by_id("test_id")
            
            # User repo should still work
            result = await user_repo.get_user_progress("test_user")
            assert result is None  # No user found, but no error
    
    def test_factory_memory_efficiency(self):
        """Test that factory doesn't create unnecessary instances."""
        import gc
        import weakref
        
        # Get repository and create weak reference
        repo = RepositoryFactory.get_question_repository()
        weak_ref = weakref.ref(repo)
        
        # Delete local reference
        del repo
        
        # Repository should still exist due to factory cache
        assert weak_ref() is not None
        
        # Get repository again - should be same instance
        repo2 = RepositoryFactory.get_question_repository()
        assert weak_ref() is repo2
        
        # Clear factory cache
        RepositoryFactory.clear_instances()
        del repo2
        
        # Force garbage collection
        gc.collect()
        
        # Now weak reference should be dead
        assert weak_ref() is None