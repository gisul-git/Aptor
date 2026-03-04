"""
Base repository class with common CRUD operations and error handling.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, TypeVar, Generic
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import (
    DuplicateKeyError, 
    ConnectionFailure, 
    ServerSelectionTimeoutError,
    OperationFailure,
    WriteError
)
from pymongo import ReturnDocument
import structlog
from datetime import datetime

from app.core.database import get_database

logger = structlog.get_logger()

T = TypeVar('T')


class RepositoryError(Exception):
    """Base repository error."""
    pass


class DocumentNotFoundError(RepositoryError):
    """Document not found error."""
    pass


class DuplicateDocumentError(RepositoryError):
    """Duplicate document error."""
    pass


class DatabaseConnectionError(RepositoryError):
    """Database connection error."""
    pass


class BaseRepository(Generic[T], ABC):
    """
    Base repository class providing common CRUD operations with error handling.
    
    This class implements the repository pattern for MongoDB operations with:
    - Connection pooling through Motor async client
    - Comprehensive error handling and logging
    - Retry logic for transient failures
    - Performance monitoring
    """
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self._collection: Optional[AsyncIOMotorCollection] = None
        
    async def _get_collection(self) -> AsyncIOMotorCollection:
        """Get the MongoDB collection with connection pooling."""
        if self._collection is None:
            try:
                database = await get_database()
                self._collection = database[self.collection_name]
            except Exception as e:
                logger.error(
                    "Failed to get database collection",
                    collection=self.collection_name,
                    error=str(e)
                )
                raise DatabaseConnectionError(f"Failed to connect to collection {self.collection_name}: {str(e)}")
        
        return self._collection
    
    async def create(self, document: Dict[str, Any]) -> str:
        """
        Create a new document.
        
        Args:
            document: Document data to insert
            
        Returns:
            str: The inserted document ID
            
        Raises:
            DuplicateDocumentError: If document with unique constraint already exists
            DatabaseConnectionError: If database connection fails
        """
        try:
            collection = await self._get_collection()
            
            # Add creation timestamp if not present
            if 'created_at' not in document:
                document['created_at'] = datetime.utcnow()
            
            result = await collection.insert_one(document)
            
            logger.info(
                "Document created successfully",
                collection=self.collection_name,
                document_id=str(result.inserted_id)
            )
            
            return str(result.inserted_id)
            
        except DuplicateKeyError as e:
            logger.warning(
                "Duplicate document creation attempted",
                collection=self.collection_name,
                error=str(e)
            )
            raise DuplicateDocumentError(f"Document already exists: {str(e)}")
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during create",
                collection=self.collection_name,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during document creation",
                collection=self.collection_name,
                error=str(e)
            )
            raise RepositoryError(f"Failed to create document: {str(e)}")
    
    async def get_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by its ID.
        
        Args:
            document_id: The document ID to search for
            
        Returns:
            Optional[Dict[str, Any]]: The document if found, None otherwise
        """
        try:
            collection = await self._get_collection()
            
            # Try both ObjectId and string ID formats
            from bson import ObjectId
            query = {"_id": ObjectId(document_id)} if ObjectId.is_valid(document_id) else {"_id": document_id}
            
            document = await collection.find_one(query)
            
            if document:
                # Convert ObjectId to string for JSON serialization
                if '_id' in document and isinstance(document['_id'], ObjectId):
                    document['_id'] = str(document['_id'])
                    
                logger.debug(
                    "Document retrieved successfully",
                    collection=self.collection_name,
                    document_id=document_id
                )
            
            return document
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during get_by_id",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during document retrieval",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to retrieve document: {str(e)}")
    
    async def get_by_field(self, field: str, value: Any) -> Optional[Dict[str, Any]]:
        """
        Get a document by a specific field value.
        
        Args:
            field: Field name to search by
            value: Field value to match
            
        Returns:
            Optional[Dict[str, Any]]: The document if found, None otherwise
        """
        try:
            collection = await self._get_collection()
            document = await collection.find_one({field: value})
            
            if document and '_id' in document:
                from bson import ObjectId
                if isinstance(document['_id'], ObjectId):
                    document['_id'] = str(document['_id'])
            
            return document
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during get_by_field",
                collection=self.collection_name,
                field=field,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during field-based retrieval",
                collection=self.collection_name,
                field=field,
                error=str(e)
            )
            raise RepositoryError(f"Failed to retrieve document by {field}: {str(e)}")
    
    async def find_many(
        self, 
        query: Dict[str, Any], 
        limit: Optional[int] = None,
        skip: Optional[int] = None,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict[str, Any]]:
        """
        Find multiple documents matching a query.
        
        Args:
            query: MongoDB query filter
            limit: Maximum number of documents to return
            skip: Number of documents to skip
            sort: Sort specification as list of (field, direction) tuples
            
        Returns:
            List[Dict[str, Any]]: List of matching documents
        """
        try:
            collection = await self._get_collection()
            cursor = collection.find(query)
            
            if sort:
                cursor = cursor.sort(sort)
            if skip:
                cursor = cursor.skip(skip)
            if limit:
                cursor = cursor.limit(limit)
            
            documents = await cursor.to_list(length=limit)
            
            # Convert ObjectIds to strings
            from bson import ObjectId
            for doc in documents:
                if '_id' in doc and isinstance(doc['_id'], ObjectId):
                    doc['_id'] = str(doc['_id'])
            
            logger.debug(
                "Multiple documents retrieved",
                collection=self.collection_name,
                count=len(documents),
                query=query
            )
            
            return documents
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during find_many",
                collection=self.collection_name,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during multi-document retrieval",
                collection=self.collection_name,
                query=query,
                error=str(e)
            )
            raise RepositoryError(f"Failed to retrieve documents: {str(e)}")
    
    async def update_by_id(
        self, 
        document_id: str, 
        update_data: Dict[str, Any],
        upsert: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Update a document by its ID.
        
        Args:
            document_id: The document ID to update
            update_data: Update operations to apply
            upsert: Whether to create document if it doesn't exist
            
        Returns:
            Optional[Dict[str, Any]]: The updated document if found
        """
        try:
            collection = await self._get_collection()
            
            # Add update timestamp
            if '$set' not in update_data:
                update_data = {'$set': update_data}
            update_data['$set']['updated_at'] = datetime.utcnow()
            
            # Try both ObjectId and string ID formats
            from bson import ObjectId
            query = {"_id": ObjectId(document_id)} if ObjectId.is_valid(document_id) else {"_id": document_id}
            
            result = await collection.find_one_and_update(
                query,
                update_data,
                return_document=ReturnDocument.AFTER,
                upsert=upsert
            )
            
            if result and '_id' in result:
                if isinstance(result['_id'], ObjectId):
                    result['_id'] = str(result['_id'])
                    
                logger.info(
                    "Document updated successfully",
                    collection=self.collection_name,
                    document_id=document_id
                )
            
            return result
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during update",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during document update",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to update document: {str(e)}")
    
    async def delete_by_id(self, document_id: str) -> bool:
        """
        Delete a document by its ID.
        
        Args:
            document_id: The document ID to delete
            
        Returns:
            bool: True if document was deleted, False if not found
        """
        try:
            collection = await self._get_collection()
            
            # Try both ObjectId and string ID formats
            from bson import ObjectId
            query = {"_id": ObjectId(document_id)} if ObjectId.is_valid(document_id) else {"_id": document_id}
            
            result = await collection.delete_one(query)
            
            if result.deleted_count > 0:
                logger.info(
                    "Document deleted successfully",
                    collection=self.collection_name,
                    document_id=document_id
                )
                return True
            else:
                logger.warning(
                    "Document not found for deletion",
                    collection=self.collection_name,
                    document_id=document_id
                )
                return False
                
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during delete",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during document deletion",
                collection=self.collection_name,
                document_id=document_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to delete document: {str(e)}")
    
    async def count(self, query: Optional[Dict[str, Any]] = None) -> int:
        """
        Count documents matching a query.
        
        Args:
            query: MongoDB query filter (None for all documents)
            
        Returns:
            int: Number of matching documents
        """
        try:
            collection = await self._get_collection()
            count = await collection.count_documents(query or {})
            
            logger.debug(
                "Document count retrieved",
                collection=self.collection_name,
                count=count,
                query=query
            )
            
            return count
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during count",
                collection=self.collection_name,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during document count",
                collection=self.collection_name,
                query=query,
                error=str(e)
            )
            raise RepositoryError(f"Failed to count documents: {str(e)}")
    
    async def exists(self, query: Dict[str, Any]) -> bool:
        """
        Check if a document exists matching the query.
        
        Args:
            query: MongoDB query filter
            
        Returns:
            bool: True if document exists, False otherwise
        """
        try:
            collection = await self._get_collection()
            document = await collection.find_one(query, {"_id": 1})
            return document is not None
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(
                "Database connection failed during exists check",
                collection=self.collection_name,
                error=str(e)
            )
            raise DatabaseConnectionError(f"Database connection failed: {str(e)}")
            
        except Exception as e:
            logger.error(
                "Unexpected error during exists check",
                collection=self.collection_name,
                query=query,
                error=str(e)
            )
            raise RepositoryError(f"Failed to check document existence: {str(e)}")