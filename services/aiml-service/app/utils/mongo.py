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

def serialize_document(document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if document is None:
        return None
    doc = document.copy()
    _id = doc.pop("_id", None)
    if _id is not None:
        doc["id"] = str(_id)
    for key, val in doc.items():
        if isinstance(val, ObjectId):
            doc[key] = str(val)
        elif isinstance(val, datetime):
            doc[key] = val.isoformat()
    return doc

