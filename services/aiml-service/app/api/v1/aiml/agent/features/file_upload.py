"""
File upload feature for agent.
Handles file uploads and stores them in session-specific directories.
"""

import os
import base64
import asyncio
from pathlib import Path
from typing import Dict


# Base upload directory
UPLOAD_BASE_DIR = Path('uploads')


def ensure_upload_dir(session_id: str) -> Path:
    """Ensure upload directory exists for session."""
    upload_dir = UPLOAD_BASE_DIR / session_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def handle_file_upload(session_id: str, filename: str, data_base64: str) -> Dict:
    """
    Handle file upload request.
    
    Args:
        session_id: Session identifier
        filename: Original filename
        data_base64: Base64 encoded file data
        
    Returns:
        Dictionary with success status, path, and message
    """
    try:
        # Run in thread to avoid blocking event loop
        result = await asyncio.to_thread(_save_file, session_id, filename, data_base64)
        return result
    except Exception as e:
        return {
            'success': False,
            'path': '',
            'message': f'Upload failed: {str(e)}'
        }


def _save_file(session_id: str, filename: str, data_base64: str) -> Dict:
    """
    Save file to disk (runs in thread).
    
    Args:
        session_id: Session identifier
        filename: Original filename
        data_base64: Base64 encoded file data
        
    Returns:
        Dictionary with success status, path, and message
    """
    try:
        # Ensure upload directory exists
        upload_dir = ensure_upload_dir(session_id)
        
        # Sanitize filename
        safe_filename = os.path.basename(filename)  # Remove path components
        safe_filename = safe_filename.replace('..', '')  # Remove parent directory references
        
        # Full path
        file_path = upload_dir / safe_filename
        
        # Decode and write file
        file_data = base64.b64decode(data_base64)
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # Return relative path
        relative_path = str(file_path)
        
        return {
            'success': True,
            'path': relative_path,
            'message': f'File uploaded successfully: {safe_filename}'
        }
    except Exception as e:
        return {
            'success': False,
            'path': '',
            'message': f'Failed to save file: {str(e)}'
        }


