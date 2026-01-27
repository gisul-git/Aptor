"""NoSQL injection protection utilities."""
from __future__ import annotations

from typing import Any, Dict, List, Union
from fastapi import HTTPException, status


# Dangerous MongoDB operators that should be blocked
DANGEROUS_OPERATORS = {
    "$where",
    "$expr",
    "$function",
    "$accumulator",
    "$code",
    "$eval",
    "$regex",  # Can be dangerous if user-controlled
    "$text",  # Can be dangerous if user-controlled
    "$ne",  # Not equal - can be used for injection
    "$nin",  # Not in - can be used for injection
    "$not",  # Logical not - can be used for injection
    "$type",  # Can leak information
    "$jsonSchema",  # Can be used for injection
}

# Allowed operators (safe to use)
ALLOWED_OPERATORS = {
    "$eq",  # Equal
    "$gt",  # Greater than
    "$gte",  # Greater than or equal
    "$lt",  # Less than
    "$lte",  # Less than or equal
    "$in",  # In array
    "$exists",  # Field exists
    "$and",  # Logical AND
    "$or",  # Logical OR
    "$nor",  # Logical NOR
    "$all",  # All elements match
    "$elemMatch",  # Element matches
    "$size",  # Array size
    "$mod",  # Modulo (with caution)
    "$regex",  # Regex (only if explicitly allowed)
}

# Operators that require explicit allowlist
CONDITIONAL_OPERATORS = {
    "$regex": False,  # Must be explicitly allowed
    "$text": False,  # Must be explicitly allowed
}


def sanitize_query(query: Union[Dict[str, Any], Any], allow_regex: bool = False, allow_text: bool = False) -> Dict[str, Any]:
    """
    Sanitize MongoDB query to prevent NoSQL injection.
    
    Args:
        query: MongoDB query dictionary
        allow_regex: Allow $regex operator (default: False)
        allow_text: Allow $text operator (default: False)
    
    Returns:
        Sanitized query dictionary
    
    Raises:
        HTTPException: If dangerous operators are detected
    """
    if not isinstance(query, dict):
        # If not a dict, return as-is (will be handled by MongoDB type checking)
        return query
    
    sanitized = {}
    
    for key, value in query.items():
        # Check if key is a MongoDB operator
        if key.startswith("$"):
            # Check if operator is dangerous
            if key in DANGEROUS_OPERATORS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dangerous MongoDB operator '{key}' is not allowed for security reasons"
                )
            
            # Check conditional operators
            if key == "$regex" and not allow_regex:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Regex operator is not allowed. Use text search instead."
                )
            
            if key == "$text" and not allow_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Text search operator is not allowed."
                )
            
            # Recursively sanitize operator value
            if isinstance(value, dict):
                sanitized[key] = sanitize_query(value, allow_regex=allow_regex, allow_text=allow_text)
            elif isinstance(value, list):
                sanitized[key] = [
                    sanitize_query(item, allow_regex=allow_regex, allow_text=allow_text) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        else:
            # Regular field - recursively sanitize if value is a dict
            if isinstance(value, dict):
                sanitized[key] = sanitize_query(value, allow_regex=allow_regex, allow_text=allow_text)
            elif isinstance(value, list):
                sanitized[key] = [
                    sanitize_query(item, allow_regex=allow_regex, allow_text=allow_text) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
    
    return sanitized


def sanitize_filter_dict(filter_dict: Dict[str, Any], allow_regex: bool = False, allow_text: bool = False) -> Dict[str, Any]:
    """
    Sanitize MongoDB filter dictionary (alias for sanitize_query for clarity).
    
    Args:
        filter_dict: MongoDB filter dictionary
        allow_regex: Allow $regex operator (default: False)
        allow_text: Allow $text operator (default: False)
    
    Returns:
        Sanitized filter dictionary
    """
    return sanitize_query(filter_dict, allow_regex=allow_regex, allow_text=allow_text)


def sanitize_update_dict(update_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize MongoDB update dictionary.
    
    Args:
        update_dict: MongoDB update dictionary
    
    Returns:
        Sanitized update dictionary
    
    Raises:
        HTTPException: If dangerous operators are detected
    """
    if not isinstance(update_dict, dict):
        return update_dict
    
    sanitized = {}
    
    for key, value in update_dict.items():
        # Check for dangerous update operators
        if key.startswith("$"):
            # Block dangerous update operators
            dangerous_update_ops = {
                "$where",
                "$expr",
                "$function",
                "$eval",
                "$code",
            }
            
            if key in dangerous_update_ops:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dangerous MongoDB update operator '{key}' is not allowed for security reasons"
                )
            
            # Recursively sanitize operator value
            if isinstance(value, dict):
                sanitized[key] = sanitize_update_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    sanitize_update_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        else:
            # Regular field update
            if isinstance(value, dict):
                sanitized[key] = sanitize_update_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    sanitize_update_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
    
    return sanitized


