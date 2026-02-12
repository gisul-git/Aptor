from __future__ import annotations

import logging
import json
from typing import Any

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def success_response(message: str, data: Any = None, status_code: int = 200) -> JSONResponse:
    """Create a success response with JSON serialization validation."""
    try:
        logger.info(f"[RESPONSE] Creating success_response: message='{message}', status_code={status_code}, has_data={data is not None}")
        
        # DEBUG: Test if data is serializable
        if data is not None:
            logger.info(f"[RESPONSE] Data type: {type(data).__name__}")
            if isinstance(data, dict):
                logger.info(f"[RESPONSE] Data keys: {list(data.keys())}")
                if "submissions" in data:
                    logger.info(f"[RESPONSE] Submissions count: {len(data.get('submissions', []))}")
            
            try:
                json_str = json.dumps(data)
                logger.info(f"[RESPONSE] ✓ Data is JSON serializable (length: {len(json_str)} bytes)")
            except (TypeError, ValueError) as e:
                logger.error(f"[RESPONSE ERROR] Data is NOT JSON serializable: {str(e)}")
                logger.error(f"[RESPONSE ERROR] Data type: {type(data).__name__}")
                if isinstance(data, dict):
                    for key, value in data.items():
                        try:
                            json.dumps(value)
                            logger.debug(f"[RESPONSE]   Field '{key}': serializable")
                        except (TypeError, ValueError) as field_error:
                            logger.error(f"[RESPONSE ERROR]   Field '{key}' is NOT serializable: {str(field_error)}")
                            logger.error(f"[RESPONSE ERROR]   Field '{key}' type: {type(value).__name__}")
                            logger.error(f"[RESPONSE ERROR]   Field '{key}' value preview: {str(value)[:200]}")
                            if isinstance(value, list) and len(value) > 0:
                                logger.error(f"[RESPONSE ERROR]   Field '{key}' is a list with {len(value)} items")
                                for idx, item in enumerate(value[:3]):  # Check first 3 items
                                    try:
                                        json.dumps(item)
                                    except (TypeError, ValueError) as item_error:
                                        logger.error(f"[RESPONSE ERROR]     Item[{idx}] is NOT serializable: {str(item_error)}")
                                        if isinstance(item, dict):
                                            for item_key, item_value in item.items():
                                                try:
                                                    json.dumps(item_value)
                                                except (TypeError, ValueError) as item_field_error:
                                                    logger.error(f"[RESPONSE ERROR]       Item[{idx}].{item_key} is NOT serializable: {str(item_field_error)}")
                                                    logger.error(f"[RESPONSE ERROR]       Item[{idx}].{item_key} type: {type(item_value).__name__}")
                raise
        
        content = {"success": True, "message": message, "data": data}
        
        # DEBUG: Test if content is serializable
        try:
            json_str = json.dumps(content)
            logger.info(f"[RESPONSE] ✓ Content is JSON serializable (length: {len(json_str)} bytes)")
        except (TypeError, ValueError) as e:
            logger.error(f"[RESPONSE ERROR] Content is NOT JSON serializable: {str(e)}")
            raise
        
        logger.info(f"[RESPONSE] Creating JSONResponse with status_code={status_code}")
        try:
            response = JSONResponse(status_code=status_code, content=content)
            logger.info("[RESPONSE] ✓ JSONResponse created successfully")
            return response
        except Exception as json_error:
            logger.error(f"[RESPONSE ERROR] Error creating JSONResponse: {str(json_error)}")
            logger.error(f"[RESPONSE ERROR] JSONResponse error type: {type(json_error).__name__}")
            import traceback
            logger.error(f"[RESPONSE ERROR] JSONResponse traceback:\n{traceback.format_exc()}")
            raise
    except Exception as e:
        logger.exception(f"[RESPONSE ERROR] Error creating success_response: {e}")
        logger.error(f"[RESPONSE ERROR] Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"[RESPONSE ERROR] Full traceback:\n{traceback.format_exc()}")
        # Return a safe error response
        try:
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": f"Error creating response: {str(e)}", "data": None}
            )
        except Exception as final_error:
            logger.error(f"[RESPONSE ERROR] Even error response failed: {str(final_error)}")
            # Last resort - return minimal response
            from fastapi.responses import Response
            return Response(
                status_code=500,
                content='{"success": false, "message": "Internal server error"}',
                media_type="application/json"
            )


def error_response(message: str, status_code: int = 400, data: Any = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message, "data": data})

