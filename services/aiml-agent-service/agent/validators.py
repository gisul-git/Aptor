"""
Input validation utilities for AIML Agent Service.
"""

import re
import ast
import logging
from typing import Tuple, Optional
from agent.config import Config

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Raised when validation fails."""
    pass

def validate_session_id(session_id: str) -> bool:
    """
    Validate session_id format.
    
    Args:
        session_id: Session identifier to validate
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If validation fails
    """
    if not session_id:
        raise ValidationError("session_id cannot be empty")
    
    if len(session_id) > 100:
        raise ValidationError(f"session_id too long (max 100 chars, got {len(session_id)})")
    
    if not re.match(Config.SESSION_ID_PATTERN, session_id):
        raise ValidationError(f"session_id contains invalid characters: {session_id}")
    
    return True

def validate_run_id(run_id: str) -> bool:
    """
    Validate run_id format.
    
    Args:
        run_id: Run identifier to validate
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If validation fails
    """
    if not run_id:
        raise ValidationError("run_id cannot be empty")
    
    if len(run_id) > 200:
        raise ValidationError(f"run_id too long (max 200 chars, got {len(run_id)})")
    
    if not re.match(Config.RUN_ID_PATTERN, run_id):
        raise ValidationError(f"run_id contains invalid characters: {run_id}")
    
    return True

def validate_code(code: str) -> Tuple[bool, Optional[str]]:
    """
    Validate code size and basic syntax.
    
    Args:
        code: Python code to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not code:
        return True, None
    
    # Check size
    code_size = len(code.encode('utf-8'))
    if code_size > Config.MAX_CODE_SIZE:
        return False, f"Code too large: {code_size} bytes (max {Config.MAX_CODE_SIZE} bytes)"
    
    # Basic syntax check (optional, can be disabled for performance)
    try:
        ast.parse(code)
    except SyntaxError as e:
        # Allow syntax errors - they'll be caught during execution
        pass
    except Exception as e:
        logger.warning(f"Code validation warning: {e}")
    
    return True, None

import os

def validate_filename(filename: str) -> Tuple[bool, Optional[str]]:
    """
    Validate filename for security.
    
    Args:
        filename: Filename to validate
        
    Returns:
        Tuple of (is_valid, sanitized_filename)
    """
    if not filename:
        return False, None
    
    # Remove path components
    safe_filename = os.path.basename(filename)
    
    # Remove any remaining path traversal attempts
    safe_filename = safe_filename.replace('..', '').replace('/', '').replace('\\', '')
    
    # Check extension
    if Config.ALLOWED_FILE_EXTENSIONS:
        ext = os.path.splitext(safe_filename)[1].lower()
        if ext and ext not in Config.ALLOWED_FILE_EXTENSIONS:
            return False, None
    
    # Check length
    if len(safe_filename) > 255:
        return False, None
    
    return True, safe_filename

def validate_file_size(file_size: int) -> bool:
    """
    Validate file size.
    
    Args:
        file_size: File size in bytes
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If validation fails
    """
    if file_size > Config.MAX_FILE_SIZE:
        raise ValidationError(f"File too large: {file_size} bytes (max {Config.MAX_FILE_SIZE} bytes)")
    
    if file_size < 0:
        raise ValidationError("File size cannot be negative")
    
    return True

