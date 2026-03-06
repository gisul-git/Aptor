import logging
from typing import Dict, Any, List

import httpx

from ..config import SQL_ENGINE_URL, get_dsa_settings, DSASettings

logger = logging.getLogger("backend")


async def fetch_seeded_sql_schema() -> Dict[str, Any]:
    """
    Fetch seeded database schemas + sample data from the SQL Execution Engine.

    The SQL engine returns:
      {
        "schemas": { tableName: { "columns": { colName: colType } } },
        "sample_data": { tableName: [ { colName: value, ... }, ... ] }
      }

    This helper normalizes sample_data to the DSA question model format:
      Dict[str, List[List[Any]]]
    where each row is a list of values in the same order as schemas[table].columns keys.
    """
    # Always get fresh settings (not cached) to pick up .env changes
    settings = DSASettings()
    base_url = settings.sql_engine_url

    base = (base_url or "").rstrip("/")
    if not base:
        raise RuntimeError(
            "SQL_ENGINE_URL is not configured. Please set SQL_ENGINE_URL in your .env file. "
            "Example: SQL_ENGINE_URL=https://sql-engine.internal.delightfulpebble-b20f7903.centralindia.azurecontainerapps.io/api"
        )

    # Remove /api suffix if present (we'll add it back for the endpoint)
    if base.endswith('/api'):
        base = base[:-4]
    
    # Use POST /api/schema with empty body to get the default/preloaded database
    url = f"{base}/api/schema"
    logger.info(f"[SQL Seeded Dataset] Fetching default/preloaded database schema from {url}")

    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # POST with empty body to get default seed (preloaded database)
            resp = await client.post(url, json={})
    except httpx.ConnectError as e:
        logger.error(f"[SQL Seeded Dataset] Connection error: {e}")
        raise RuntimeError(
            f"Failed to connect to SQL execution engine at {url}. "
            f"Make sure the SQL execution engine is running on port 3000. Error: {str(e)}"
        )
    except httpx.TimeoutException as e:
        logger.error(f"[SQL Seeded Dataset] Timeout error: {e}")
        raise RuntimeError(
            f"Timeout while connecting to SQL execution engine at {url}. Error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"[SQL Seeded Dataset] Unexpected error: {e}", exc_info=True)
        raise RuntimeError(
            f"Unexpected error connecting to SQL execution engine at {url}. Error: {str(e)}"
        )

    if resp.status_code != 200:
        text = resp.text[:500] if resp.text else ""
        logger.error(f"[SQL Seeded Dataset] SQL engine returned {resp.status_code}: {text}")
        raise RuntimeError(
            f"SQL execution engine returned {resp.status_code}: {text}"
        )

    try:
        data = resp.json() or {}
    except Exception as e:
        logger.error(f"[SQL Seeded Dataset] Failed to parse JSON response: {e}")
        logger.error(f"[SQL Seeded Dataset] Response text: {resp.text[:500]}")
        raise RuntimeError(
            f"Failed to parse JSON response from SQL execution engine. Error: {str(e)}"
        )
    
    # SQL engine returns: { schema: [{ table: "...", columns: [...], data: [...] }] }
    # We need to convert to: { schemas: { tableName: { columns: {...} } }, sample_data: { tableName: [[...], [...]] } }
    
    schema_array = data.get("schema") or []
    
    if not schema_array:
        logger.warning("[SQL Seeded Dataset] No schema found in response. Response data: %s", str(data)[:200])
        # Return empty schemas, let the frontend handle it
        return {
            "schemas": {},
            "sample_data": {},
        }

    # Convert SQL engine format to DSA question format
    schemas: Dict[str, Dict[str, Dict[str, str]]] = {}
    normalized_sample: Dict[str, List[List[Any]]] = {}
    
    for table_info in schema_array:
        table_name = table_info.get("table")
        if not table_name:
            continue
        
        # Convert columns array to object format
        columns_dict: Dict[str, str] = {}
        columns_array = table_info.get("columns") or []
        for col in columns_array:
            col_name = col.get("name")
            col_type = col.get("type")
            if col_name and col_type:
                columns_dict[col_name] = col_type
        
        schemas[table_name] = {"columns": columns_dict}
        
        # Convert data array to list-of-lists format
        # SQL engine returns: [{ col1: val1, col2: val2 }, ...]
        # We need: [[val1, val2], [val3, val4], ...]
        column_names = list(columns_dict.keys())
        data_array = table_info.get("data") or []
        
        normalized_rows: List[List[Any]] = []
        for row in data_array:
            if isinstance(row, dict):
                # Extract values in column order
                normalized_rows.append([row.get(col) for col in column_names])
            elif isinstance(row, list):
                normalized_rows.append(row)
            else:
                normalized_rows.append([row])
        
        normalized_sample[table_name] = normalized_rows

    logger.info(f"[SQL Seeded Dataset] Converted {len(schemas)} table(s) from default/preloaded database")
    
    return {
        "schemas": schemas,
        "sample_data": normalized_sample,
    }


