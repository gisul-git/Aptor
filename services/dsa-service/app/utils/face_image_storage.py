"""
Face Image Storage Utility

Provides functions for sanitizing, compressing, and storing face images in MongoDB.
Note: PIL/Pillow is optional. If not available, compression will be skipped.
"""

import base64
import re
from typing import Optional, Tuple

try:
    from io import BytesIO
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def sanitize_base64_image(base64_string: str) -> Optional[str]:
    """
    Sanitize base64 image string by removing data URI prefix and validating format.
    
    Args:
        base64_string: Base64 encoded image (with or without data URI prefix)
    
    Returns:
        Clean base64 string without prefix, or None if invalid
    """
    if not base64_string or not isinstance(base64_string, str):
        return None
    
    # Remove data URI prefix if present (data:image/jpeg;base64,)
    pattern = r'^data:image/[^;]+;base64,'
    cleaned = re.sub(pattern, '', base64_string)
    
    # Validate base64 format
    try:
        # Try to decode to ensure it's valid base64
        base64.b64decode(cleaned, validate=True)
        return cleaned
    except Exception:
        return None

def compress_image(base64_string: str, max_width: int = 640, max_height: int = 480, quality: int = 85) -> Optional[str]:
    """
    Compress and resize image to reduce storage size.
    
    Args:
        base64_string: Base64 encoded image
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels
        quality: JPEG quality (1-100)
    
    Returns:
        Compressed base64 string, or original if PIL not available
    """
    if not PIL_AVAILABLE:
        # If PIL not available, return sanitized version
        return sanitize_base64_image(base64_string)
    
    try:
        # Sanitize input
        cleaned = sanitize_base64_image(base64_string)
        if not cleaned:
            return None
        
        # Decode base64
        image_data = base64.b64decode(cleaned)
        image = Image.open(BytesIO(image_data))
        
        # Convert RGBA to RGB if necessary (for JPEG)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        
        # Resize if necessary (maintain aspect ratio)
        if image.width > max_width or image.height > max_height:
            image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Compress to JPEG
        output = BytesIO()
        image.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)
        
        # Encode back to base64
        compressed_base64 = base64.b64encode(output.getvalue()).decode('utf-8')
        return compressed_base64
    
    except Exception as e:
        print(f"[FaceImageStorage] Compression error: {e}")
        return None

def validate_face_image(base64_string: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that the image is suitable for face recognition.
    
    Args:
        base64_string: Base64 encoded image
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Sanitize
    cleaned = sanitize_base64_image(base64_string)
    if not cleaned:
        return False, "Invalid base64 format"
    
    # Check size (max 5MB when decoded)
    try:
        decoded_size = len(base64.b64decode(cleaned))
        if decoded_size > 5 * 1024 * 1024:  # 5MB
            return False, "Image too large (max 5MB)"
    except Exception:
        return False, "Failed to decode image"
    
    # Get dimensions (if PIL available)
    if PIL_AVAILABLE:
        try:
            image_data = base64.b64decode(cleaned)
            image = Image.open(BytesIO(image_data))
            width, height = image.size
            
            # Validate minimum size
            if width < 100 or height < 100:
                return False, "Image too small (minimum 100x100)"
            
            # Validate aspect ratio (reasonable for faces)
            aspect_ratio = width / height
            if aspect_ratio < 0.5 or aspect_ratio > 2.0:
                return False, "Invalid aspect ratio for face image"
        except Exception:
            return False, "Failed to read image dimensions"
    
    return True, None

def prepare_image_for_storage(base64_string: str) -> Optional[str]:
    """
    Prepare image for storage by sanitizing and compressing.
    
    Args:
        base64_string: Base64 encoded image
    
    Returns:
        Processed base64 string ready for storage, or None if processing fails
    """
    # Validate first
    is_valid, error = validate_face_image(base64_string)
    if not is_valid:
        print(f"[FaceImageStorage] Validation failed: {error}")
        return None
    
    # Compress
    compressed = compress_image(base64_string, max_width=640, max_height=480, quality=85)
    return compressed
