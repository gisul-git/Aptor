from typing import Any
from fastapi.responses import JSONResponse

def success_response(message: str, data: Any = None, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "message": message, "data": data})

