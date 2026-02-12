"""MongoDB utilities."""
from datetime import datetime
from typing import Any, Dict, Optional
from bson import ObjectId

def to_object_id(value: str | ObjectId | None) -> Optional[ObjectId]:
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except:
        raise ValueError("Invalid ObjectId")

def _convert_object_ids(value: Any) -> Any:
    """Recursively convert ObjectIds and datetimes to strings in nested structures."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_convert_object_ids(item) for item in value]
    if isinstance(value, dict):
        return {key: _convert_object_ids(val) for key, val in value.items()}
    return value

def serialize_document(document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Serialize MongoDB document, converting _id to id and recursively handling ObjectIds and datetimes."""
    if document is None:
        return None
    doc = document.copy()
    _id = doc.pop("_id", None)
    if _id is not None:
        doc["id"] = str(_id)
    # Recursively convert ObjectIds and datetimes in nested structures
    return _convert_object_ids(doc)

