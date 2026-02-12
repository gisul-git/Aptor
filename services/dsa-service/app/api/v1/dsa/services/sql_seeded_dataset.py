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

    url = f"{base}/schema"
    logger.info(f"[SQL Seeded Dataset] Fetching seeded schema from {url}")

    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
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
    
    schemas = data.get("schemas") or {}
    raw_sample = data.get("sample_data") or {}

    if not schemas:
        logger.warning("[SQL Seeded Dataset] No schemas found in response. Response data: %s", str(data)[:200])
        # Don't raise an error - return empty schemas, let the frontend handle it
        # This allows the UI to show a message that no tables were found

    # Normalize sample data to list-of-lists per table, ordered by schema columns
    normalized_sample: Dict[str, List[List[Any]]] = {}
    for table_name, rows in raw_sample.items():
        table_def = schemas.get(table_name) or {}
        columns_dict = table_def.get("columns") or {}
        column_names = list(columns_dict.keys())

        normalized_rows: List[List[Any]] = []
        for row in rows or []:
            # Engine returns dicts; keep list rows as-is just in case
            if isinstance(row, dict):
                normalized_rows.append(
                    [row.get(col) for col in column_names]
                )
            elif isinstance(row, list):
                normalized_rows.append(row)
            else:
                # Fallback: wrap scalar into single-column row
                normalized_rows.append([row])

        normalized_sample[table_name] = normalized_rows

    return {
        "schemas": schemas,
        "sample_data": normalized_sample,
    }


