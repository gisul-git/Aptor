"""MongoDB utilities."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId


def to_object_id(value: str | ObjectId | None) -> Optional[ObjectId]:
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(value)
    except Exception as exc:
        raise ValueError("Invalid ObjectId string") from exc


def _convert_object_ids(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_convert_object_ids(item) for item in value]
    if isinstance(value, dict):
        return {key: _convert_object_ids(val) for key, val in value.items()}
    return value


def convert_object_ids(value: Any) -> Any:
    """Public wrapper for _convert_object_ids to serialize ObjectIds and datetimes in nested structures."""
    return _convert_object_ids(value)


def serialize_document(document: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if document is None:
        return None
    doc = document.copy()
    _id = doc.pop("_id", None)
    if _id is not None:
        doc["id"] = str(_id)
    return _convert_object_ids(doc)


def serialize_documents(documents: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [serialize_document(doc) for doc in documents if doc is not None]

