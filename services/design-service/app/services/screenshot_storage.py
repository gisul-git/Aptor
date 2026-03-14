"""
Screenshot Storage Service
Handles screenshot storage in MinIO/S3 instead of MongoDB
"""

import logging
import base64
import io
from typing import Optional
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error
from app.core.config import settings

logger = logging.getLogger(__name__)


class ScreenshotStorageService:
    """Service for storing screenshots in MinIO/S3"""
    
    def __init__(self):
        # MinIO configuration
        self.minio_endpoint = getattr(settings, 'MINIO_ENDPOINT', 'localhost:9000')
        self.minio_access_key = getattr(settings, 'MINIO_ACCESS_KEY', 'minioadmin')
        self.minio_secret_key = getattr(settings, 'MINIO_SECRET_KEY', 'minioadmin')
        self.minio_secure = getattr(settings, 'MINIO_SECURE', False)
        self.bucket_name = getattr(settings, 'MINIO_BUCKET', 'design-screenshots')
        
        self.client: Optional[Minio] = None
        self.enabled = False
        
        try:
            self._initialize_client()
        except Exception as e:
            logger.warning(f"MinIO not available, falling back to MongoDB storage: {e}")
    
    def _initialize_client(self):
        """Initialize MinIO client"""
        try:
            self.client = Minio(
                self.minio_endpoint,
                access_key=self.minio_access_key,
                secret_key=self.minio_secret_key,
                secure=self.minio_secure
            )
            
            # Create bucket if it doesn't exist
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"✅ Created MinIO bucket: {self.bucket_name}")
            
            self.enabled = True
            logger.info(f"✅ MinIO client initialized: {self.minio_endpoint}")
            
        except Exception as e:
            logger.error(f"Failed to initialize MinIO: {e}")
            self.enabled = False
            raise
    
    def store_screenshot(
        self,
        session_id: str,
        image_data: str,
        timestamp: str,
        event_type: str = "periodic"
    ) -> Optional[str]:
        """
        Store screenshot in MinIO/S3
        
        Args:
            session_id: Session identifier
            image_data: Base64 encoded image data
            timestamp: ISO timestamp
            event_type: Type of screenshot (periodic, major_change, submission)
            
        Returns:
            Screenshot URL or None if storage failed
        """
        
        if not self.enabled or not self.client:
            logger.warning("MinIO not enabled, cannot store screenshot")
            return None
        
        try:
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            image_stream = io.BytesIO(image_bytes)
            
            # Generate object name
            timestamp_str = timestamp.replace(':', '-').replace('.', '-')
            object_name = f"{session_id}/{event_type}_{timestamp_str}.png"
            
            # Upload to MinIO
            self.client.put_object(
                self.bucket_name,
                object_name,
                image_stream,
                length=len(image_bytes),
                content_type='image/png'
            )
            
            # Generate URL (valid for 7 days)
            screenshot_url = self.client.presigned_get_object(
                self.bucket_name,
                object_name,
                expires=timedelta(days=7)
            )
            
            logger.info(f"📸 Screenshot stored in MinIO: {object_name}")
            return screenshot_url
            
        except S3Error as e:
            logger.error(f"MinIO S3 error: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to store screenshot: {e}")
            return None
    
    def get_screenshot_url(
        self,
        session_id: str,
        object_name: str,
        expires_hours: int = 24
    ) -> Optional[str]:
        """
        Get presigned URL for screenshot
        
        Args:
            session_id: Session identifier
            object_name: Object name in bucket
            expires_hours: URL expiration in hours
            
        Returns:
            Presigned URL or None
        """
        
        if not self.enabled or not self.client:
            return None
        
        try:
            url = self.client.presigned_get_object(
                self.bucket_name,
                object_name,
                expires=timedelta(hours=expires_hours)
            )
            return url
        except Exception as e:
            logger.error(f"Failed to get screenshot URL: {e}")
            return None
    
    def list_session_screenshots(self, session_id: str) -> list:
        """
        List all screenshots for a session
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of screenshot object names
        """
        
        if not self.enabled or not self.client:
            return []
        
        try:
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=f"{session_id}/",
                recursive=True
            )
            
            screenshots = []
            for obj in objects:
                screenshots.append({
                    "object_name": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "url": self.get_screenshot_url(session_id, obj.object_name)
                })
            
            return screenshots
            
        except Exception as e:
            logger.error(f"Failed to list screenshots: {e}")
            return []
    
    def delete_session_screenshots(self, session_id: str) -> bool:
        """
        Delete all screenshots for a session
        
        Args:
            session_id: Session identifier
            
        Returns:
            True if successful
        """
        
        if not self.enabled or not self.client:
            return False
        
        try:
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=f"{session_id}/",
                recursive=True
            )
            
            for obj in objects:
                self.client.remove_object(self.bucket_name, obj.object_name)
            
            logger.info(f"🗑️ Deleted screenshots for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete screenshots: {e}")
            return False


# Singleton instance
screenshot_storage_service = ScreenshotStorageService()
