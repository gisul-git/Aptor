"""
File upload feature with security validation.
"""

import os
import base64
import asyncio
import logging
from pathlib import Path
from typing import Dict, Tuple
from agent.config import Config
from agent.validators import validate_session_id, validate_filename, validate_file_size, ValidationError

logger = logging.getLogger(__name__)

# Base upload directory
UPLOAD_BASE_DIR = Path(Config.UPLOAD_BASE_DIR)


def ensure_upload_dir(session_id: str) -> Path:
    """Ensure upload directory exists for session."""
    validate_session_id(session_id)  # Validate before using in path
    upload_dir = UPLOAD_BASE_DIR / session_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def handle_file_upload(session_id: str, filename: str, data_base64: str) -> Dict:
    """
    Handle file upload request with validation.
    
    Args:
        session_id: Session identifier (validated)
        filename: Original filename (will be sanitized)
        data_base64: Base64 encoded file data
        
    Returns:
        Dictionary with success status, path, and message
    """
    try:
        # Validate session_id
        validate_session_id(session_id)
        
        # Validate and sanitize filename
        is_valid, safe_filename = validate_filename(filename)
        if not is_valid or not safe_filename:
            return {
                'success': False,
                'path': '',
                'message': f'Invalid filename: {filename}'
            }
        
        # Validate file size (estimate from base64)
        # Base64 encoding increases size by ~33%
        estimated_size = len(data_base64) * 3 // 4
        try:
            validate_file_size(estimated_size)
        except ValidationError as e:
            return {
                'success': False,
                'path': '',
                'message': str(e)
            }
        
        # Run in thread to avoid blocking event loop
        result = await asyncio.to_thread(_save_file, session_id, safe_filename, data_base64)
        return result
    
    except ValidationError as e:
        logger.warning(f"Validation error in file upload: {e}")
        return {
            'success': False,
            'path': '',
            'message': f'Validation error: {str(e)}'
        }
    except Exception as e:
        logger.error(f"File upload error: {e}", exc_info=True)
        return {
            'success': False,
            'path': '',
            'message': f'Upload failed: {str(e)}'
        }


def _save_file(session_id: str, safe_filename: str, data_base64: str) -> Dict:
    """
    Save file to disk (runs in thread) with additional security checks.
    
    Args:
        session_id: Session identifier (already validated)
        safe_filename: Sanitized filename
        data_base64: Base64 encoded file data
        
    Returns:
        Dictionary with success status, path, and message
    """
    try:
        # Ensure upload directory exists
        upload_dir = ensure_upload_dir(session_id)
        
        # Additional security: ensure filename doesn't contain path separators
        safe_filename = os.path.basename(safe_filename)
        safe_filename = safe_filename.replace('..', '').replace('/', '').replace('\\', '')
        
        # Check extension again (defense in depth)
        ext = os.path.splitext(safe_filename)[1].lower()
        if Config.ALLOWED_FILE_EXTENSIONS and ext and ext not in Config.ALLOWED_FILE_EXTENSIONS:
            return {
                'success': False,
                'path': '',
                'message': f'File extension not allowed: {ext}'
            }
        
        # Full path
        file_path = upload_dir / safe_filename
        
        # Decode and validate actual size
        try:
            file_data = base64.b64decode(data_base64, validate=True)
        except Exception as e:
            return {
                'success': False,
                'path': '',
                'message': f'Invalid base64 data: {str(e)}'
            }
        
        # Validate actual file size
        try:
            validate_file_size(len(file_data))
        except ValidationError as e:
            return {
                'success': False,
                'path': '',
                'message': str(e)
            }
        
        # Write file
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # Return relative path (not absolute for security)
        relative_path = str(file_path.relative_to(Path.cwd()))
        
        logger.info(f"File uploaded: {safe_filename} ({len(file_data)} bytes) for session {session_id}")
        
        return {
            'success': True,
            'path': relative_path,
            'message': f'File uploaded successfully: {safe_filename}'
        }
    
    except Exception as e:
        logger.error(f"Failed to save file: {e}", exc_info=True)
        return {
            'success': False,
            'path': '',
            'message': f'Failed to save file: {str(e)}'
        }
