"""
SQL Seed Converter
Converts schemas and sample_data to seedSql format for SQL Execution Engine.

The seedSql format is:
- CREATE TABLE statements from schemas
- INSERT INTO statements from sample_data
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


def convert_to_seed_sql(schemas: Dict[str, Any], sample_data: Dict[str, List[List[Any]]]) -> str:
    """
    Convert schemas and sample_data to seedSql format.
    
    Args:
        schemas: Dict mapping table names to column definitions
                 Format: {table_name: {columns: {col_name: col_type}}}
        sample_data: Dict mapping table names to rows
                     Format: {table_name: [[val1, val2, ...], ...]}
    
    Returns:
        seedSql string with CREATE TABLE and INSERT statements
        
    Example:
        schemas = {
            "employees": {
                "columns": {
                    "id": "INTEGER",
                    "name": "TEXT"
                }
            }
        }
        sample_data = {
            "employees": [[1, "Alice"], [2, "Bob"]]
        }
        
        Returns:
        CREATE TABLE employees(id INTEGER, name TEXT);
        INSERT INTO employees VALUES (1, 'Alice');
        INSERT INTO employees VALUES (2, 'Bob');
    """
    if not schemas:
        raise ValueError("schemas cannot be empty")
    
    sql_statements = []
    
    # Generate CREATE TABLE statements
    for table_name, table_def in schemas.items():
        columns = table_def.get("columns", {})
        
        if not columns:
            logger.warning(f"[SQL Seed Converter] Table {table_name} has no columns, skipping")
            continue
        
        # Build column definitions
        column_defs = []
        for col_name, col_type in columns.items():
            # Handle different column type formats
            col_type_str = str(col_type).upper()
            
            # Map common type variations
            if "PRIMARY KEY" in col_type_str or "AUTOINCREMENT" in col_type_str:
                # Keep as-is if it includes constraints
                column_defs.append(f"{col_name} {col_type}")
            else:
                # Simple type mapping
                column_defs.append(f"{col_name} {col_type_str}")
        
        create_stmt = f"CREATE TABLE {table_name}({', '.join(column_defs)});"
        sql_statements.append(create_stmt)
        logger.debug(f"[SQL Seed Converter] Generated CREATE TABLE for {table_name}")
    
    # Generate INSERT statements
    for table_name, rows in sample_data.items():
        if not rows:
            logger.debug(f"[SQL Seed Converter] Table {table_name} has no sample data, skipping INSERT")
            continue
        
        # Get column names from schema
        table_def = schemas.get(table_name, {})
        columns = table_def.get("columns", {})
        column_names = list(columns.keys())
        
        if not column_names:
            logger.warning(f"[SQL Seed Converter] Table {table_name} has no columns in schema, skipping INSERT")
            continue
        
        # Generate INSERT statements
        for row in rows:
            # Format values for SQL
            formatted_values = []
            for val in row:
                if val is None:
                    formatted_values.append("NULL")
                elif isinstance(val, str):
                    # Escape single quotes
                    escaped_val = val.replace("'", "''")
                    formatted_values.append(f"'{escaped_val}'")
                elif isinstance(val, (int, float)):
                    formatted_values.append(str(val))
                elif isinstance(val, bool):
                    formatted_values.append("1" if val else "0")
                else:
                    # Convert to string and escape
                    escaped_val = str(val).replace("'", "''")
                    formatted_values.append(f"'{escaped_val}'")
            
            # Use column names if row length matches, otherwise use VALUES only
            if len(row) == len(column_names):
                insert_stmt = f"INSERT INTO {table_name}({', '.join(column_names)}) VALUES ({', '.join(formatted_values)});"
            else:
                # Fallback: just use VALUES (assumes correct order)
                logger.warning(
                    f"[SQL Seed Converter] Row length ({len(row)}) doesn't match column count ({len(column_names)}) "
                    f"for table {table_name}, using VALUES only"
                )
                insert_stmt = f"INSERT INTO {table_name} VALUES ({', '.join(formatted_values)});"
            
            sql_statements.append(insert_stmt)
        
        logger.debug(f"[SQL Seed Converter] Generated {len(rows)} INSERT statements for {table_name}")
    
    seed_sql = "\n".join(sql_statements)
    logger.info(f"[SQL Seed Converter] Generated seedSql with {len(sql_statements)} statements")
    
    return seed_sql

