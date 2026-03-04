"""
Comprehensive output validation engine for DataFrame comparison and analysis.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
import structlog
from dataclasses import dataclass
from enum import Enum

from app.models.execution import ValidationResult, ValidationError
from app.models.question import Question, TestCase

logger = structlog.get_logger()


class ValidationErrorType(str, Enum):
    """Types of validation errors."""
    SCHEMA_MISMATCH = "schema_mismatch"
    ROW_COUNT_MISMATCH = "row_count_mismatch"
    COLUMN_MISSING = "column_missing"
    COLUMN_EXTRA = "column_extra"
    DATA_TYPE_MISMATCH = "data_type_mismatch"
    VALUE_MISMATCH = "value_mismatch"
    NULL_VALUE_MISMATCH = "null_value_mismatch"
    DUPLICATE_ROWS = "duplicate_rows"
    ORDERING_MISMATCH = "ordering_mismatch"
    CONSTRAINT_VIOLATION = "constraint_violation"


@dataclass
class DataFrameComparison:
    """Result of DataFrame comparison."""
    is_identical: bool
    schema_match: bool
    row_count_match: bool
    data_match: bool
    similarity_score: float
    differences: List[Dict[str, Any]]
    sample_mismatches: List[Dict[str, Any]]


class ValidationEngine:
    """Comprehensive validation engine for DataFrame comparison and analysis."""
    
    def __init__(self):
        self.logger = logger.bind(component="validation_engine")
        self.max_sample_differences = 10  # Maximum number of sample differences to report
        self.similarity_threshold = 0.95  # Threshold for considering outputs similar
    
    async def validate_output(self, 
                            actual_output: Dict[str, Any], 
                            expected_output: Dict[str, Any],
                            question: Optional[Question] = None) -> ValidationResult:
        """
        Validate execution output against expected results with comprehensive analysis.
        
        Args:
            actual_output: The actual output from code execution
            expected_output: The expected output to compare against
            question: Optional question object for additional context
            
        Returns:
            ValidationResult with detailed comparison results
        """
        self.logger.info("Starting output validation")
        
        try:
            # Check if actual_output has a None result (common error case)
            if isinstance(actual_output, dict) and 'result' in actual_output and actual_output['result'] is None:
                return self._create_error_result(
                    "Code execution completed but no result was produced. Make sure your code sets the 'result' variable.",
                    ValidationErrorType.SCHEMA_MISMATCH
                )
            
            # Convert outputs to DataFrames for comparison
            actual_df = self._convert_to_dataframe(actual_output)
            expected_df = self._convert_to_dataframe(expected_output)
            
            if actual_df is None or expected_df is None:
                return self._create_error_result(
                    "Failed to convert output to DataFrame format",
                    ValidationErrorType.SCHEMA_MISMATCH
                )
            
            # Perform comprehensive comparison
            comparison = await self._compare_dataframes(actual_df, expected_df)
            
            # Create validation result
            result = ValidationResult(
                is_correct=comparison.is_identical,
                schema_match=comparison.schema_match,
                row_count_match=comparison.row_count_match,
                data_match=comparison.data_match,
                similarity_score=comparison.similarity_score,
                error_details=self._create_error_details(comparison),
                sample_differences=comparison.sample_mismatches
            )
            
            # Add schema-specific information
            if not comparison.schema_match:
                schema_info = self._analyze_schema_differences(actual_df, expected_df)
                result.missing_columns = schema_info['missing_columns']
                result.extra_columns = schema_info['extra_columns']
                result.type_mismatches = schema_info['type_mismatches']
            
            self.logger.info("Output validation completed", 
                           is_correct=result.is_correct,
                           similarity_score=result.similarity_score)
            
            return result
            
        except Exception as e:
            self.logger.error("Validation failed with exception", error=str(e))
            return self._create_error_result(
                f"Validation error: {str(e)}",
                ValidationErrorType.SCHEMA_MISMATCH
            )
    
    async def validate_test_cases(self, 
                                actual_output: Dict[str, Any],
                                test_cases: List[TestCase]) -> List[ValidationResult]:
        """
        Validate output against multiple test cases.
        
        Args:
            actual_output: The actual output from code execution
            test_cases: List of test cases to validate against
            
        Returns:
            List of ValidationResult objects, one for each test case
        """
        results = []
        
        for i, test_case in enumerate(test_cases):
            self.logger.info(f"Validating test case {i + 1}", description=test_case.description)
            
            result = await self.validate_output(
                actual_output, 
                test_case.expected_output
            )
            
            # Add test case context to error details
            for error in result.error_details:
                error.details['test_case_index'] = i
                error.details['test_case_description'] = test_case.description
            
            results.append(result)
        
        return results
    
    def _convert_to_dataframe(self, output: Dict[str, Any]) -> Optional[pd.DataFrame]:
        """
        Convert various output formats to pandas DataFrame.
        
        Args:
            output: Output data in various formats
            
        Returns:
            pandas DataFrame or None if conversion fails
        """
        try:
            # Debug logging
            self.logger.info("Converting output to DataFrame", 
                           output_keys=list(output.keys()) if isinstance(output, dict) else None,
                           output_type=type(output).__name__,
                           has_result_key='result' in output if isinstance(output, dict) else False,
                           result_type=type(output.get('result')).__name__ if isinstance(output, dict) and 'result' in output else None)
            
            # Handle different output formats
            if isinstance(output, dict):
                # Check if this is in execution wrapper format with 'result' key
                if 'result' in output:
                    result_data = output['result']
                    
                    # Handle None result
                    if result_data is None:
                        self.logger.warning("Result is None, cannot convert to DataFrame")
                        return None
                    
                    # Handle conversion errors from execution wrapper
                    if isinstance(result_data, dict) and 'conversion_error' in result_data:
                        self.logger.error("Execution wrapper conversion error", 
                                        error=result_data['conversion_error'],
                                        result_type=result_data.get('result_type'))
                        return None
                    
                    # Extract result from execution output
                    # Check if result is in the execution wrapper format
                    if isinstance(result_data, dict) and 'type' in result_data:
                        if result_data['type'] == 'dataframe' and 'data' in result_data:
                            # Execution wrapper DataFrame format
                            return pd.DataFrame(result_data['data'])
                        elif result_data['type'] == 'list' and 'data' in result_data:
                            # List format from execution wrapper
                            return pd.DataFrame(result_data['data'])
                        elif result_data['type'] == 'dict' and 'data' in result_data:
                            # Dict format from execution wrapper
                            return pd.DataFrame(result_data['data'])
                    
                    # Try standard conversions
                    if isinstance(result_data, list):
                        # List of records (most common format from PySpark conversion)
                        if len(result_data) > 0 and isinstance(result_data[0], dict):
                            return pd.DataFrame(result_data)
                        else:
                            # Simple list, convert to single column DataFrame
                            return pd.DataFrame({'value': result_data})
                    elif isinstance(result_data, dict):
                        # Check if it has a 'data' key (question format)
                        if 'data' in result_data and isinstance(result_data['data'], list):
                            return pd.DataFrame(result_data['data'])
                        # Convert dict to DataFrame (columns as keys)
                        return pd.DataFrame(result_data)
                    elif hasattr(result_data, 'toPandas'):
                        # PySpark DataFrame (shouldn't happen after wrapper conversion)
                        return result_data.toPandas()
                    else:
                        # Try to convert directly
                        return pd.DataFrame([result_data])
                
                # Check if this is already in execution wrapper format (no 'result' key)
                elif 'type' in output and 'data' in output:
                    if output['type'] == 'dataframe':
                        return pd.DataFrame(output['data'])
                    elif output['type'] == 'list':
                        return pd.DataFrame(output['data'])
                    elif output['type'] == 'dict':
                        return pd.DataFrame(output['data'])
                
                # Check if this is question format with just 'data' key
                elif 'data' in output and isinstance(output['data'], list):
                    return pd.DataFrame(output['data'])
                
                # Try to convert the dict directly
                else:
                    return pd.DataFrame(output)
            
            elif isinstance(output, list):
                # List of records
                return pd.DataFrame(output)
            
            elif hasattr(output, 'toPandas'):
                # PySpark DataFrame
                return output.toPandas()
            
            elif isinstance(output, pd.DataFrame):
                # Already a pandas DataFrame
                return output
            
            else:
                # Try to wrap in DataFrame
                return pd.DataFrame([output])
                
        except Exception as e:
            self.logger.warning("Failed to convert output to DataFrame", 
                              error=str(e), 
                              output_type=type(output).__name__,
                              output_sample=str(output)[:200] if output else None)
            return None
    
    async def _compare_dataframes(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> DataFrameComparison:
        """
        Perform comprehensive DataFrame comparison with accurate scoring.
        
        Args:
            actual_df: Actual DataFrame
            expected_df: Expected DataFrame
            
        Returns:
            DataFrameComparison object with detailed results
        """
        differences = []
        sample_mismatches = []
        
        # 1. Schema comparison
        schema_match = self._compare_schemas(actual_df, expected_df, differences)
        
        # 2. Row count comparison
        row_count_match = len(actual_df) == len(expected_df)
        if not row_count_match:
            differences.append({
                'type': ValidationErrorType.ROW_COUNT_MISMATCH,
                'expected_rows': len(expected_df),
                'actual_rows': len(actual_df),
                'difference': len(actual_df) - len(expected_df)
            })
        
        # 3. Data comparison and similarity calculation
        data_match = False
        similarity_score = 0.0
        
        # Calculate schema similarity score (0-40 points)
        schema_score = self._calculate_schema_similarity(actual_df, expected_df)
        
        # Calculate row count similarity score (0-10 points)
        if len(expected_df) > 0:
            row_count_score = max(0, 10 * (1 - abs(len(actual_df) - len(expected_df)) / len(expected_df)))
        else:
            row_count_score = 10 if len(actual_df) == 0 else 0
        
        # Calculate data similarity score (0-50 points)
        data_score = 0.0
        if schema_match and row_count_match:
            data_match, data_similarity, data_differences = self._compare_data_values(
                actual_df, expected_df
            )
            differences.extend(data_differences)
            data_score = data_similarity * 50
            
            # Get sample mismatches for debugging
            if not data_match:
                sample_mismatches = self._get_sample_mismatches(actual_df, expected_df)
        
        elif schema_match:
            # Partial data comparison even with different row counts
            partial_similarity = self._calculate_partial_similarity(actual_df, expected_df)
            data_score = partial_similarity * 50
            
        elif len(set(actual_df.columns) & set(expected_df.columns)) > 0:
            # Some columns match - compare data for matching columns only
            common_cols = list(set(actual_df.columns) & set(expected_df.columns))
            if common_cols:
                try:
                    actual_subset = actual_df[common_cols]
                    expected_subset = expected_df[common_cols]
                    partial_similarity = self._calculate_partial_similarity(actual_subset, expected_subset)
                    # Reduce score since schema doesn't fully match
                    data_score = partial_similarity * 50 * (len(common_cols) / len(expected_df.columns))
                except Exception:
                    data_score = 0.0
        
        # Combine scores (out of 100)
        similarity_score = (schema_score + row_count_score + data_score) / 100.0
        similarity_score = max(0.0, min(1.0, similarity_score))  # Clamp to [0, 1]
        
        # Overall assessment
        is_identical = schema_match and row_count_match and data_match
        
        return DataFrameComparison(
            is_identical=is_identical,
            schema_match=schema_match,
            row_count_match=row_count_match,
            data_match=data_match,
            similarity_score=similarity_score,
            differences=differences,
            sample_mismatches=sample_mismatches
        )
    
    def _compare_schemas(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame, 
                        differences: List[Dict[str, Any]]) -> bool:
        """Compare DataFrame schemas (columns and types)."""
        actual_columns = set(actual_df.columns)
        expected_columns = set(expected_df.columns)
        
        # Check for missing and extra columns
        missing_columns = expected_columns - actual_columns
        extra_columns = actual_columns - expected_columns
        
        if missing_columns:
            differences.append({
                'type': ValidationErrorType.COLUMN_MISSING,
                'missing_columns': list(missing_columns)
            })
        
        if extra_columns:
            differences.append({
                'type': ValidationErrorType.COLUMN_EXTRA,
                'extra_columns': list(extra_columns)
            })
        
        # Check data types for common columns
        common_columns = actual_columns & expected_columns
        type_mismatches = {}
        
        for col in common_columns:
            actual_type = str(actual_df[col].dtype)
            expected_type = str(expected_df[col].dtype)
            
            # Normalize type names for comparison
            if not self._types_compatible(actual_type, expected_type):
                type_mismatches[col] = {
                    'expected': expected_type,
                    'actual': actual_type
                }
        
        if type_mismatches:
            differences.append({
                'type': ValidationErrorType.DATA_TYPE_MISMATCH,
                'type_mismatches': type_mismatches
            })
        
        # Schema matches if no missing/extra columns and no type mismatches
        return len(missing_columns) == 0 and len(extra_columns) == 0 and len(type_mismatches) == 0
    
    def _calculate_schema_similarity(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> float:
        """
        Calculate schema similarity score (0-40 points).
        
        Breakdown:
        - Column names match: 20 points
        - Column types match: 20 points
        """
        if len(expected_df.columns) == 0:
            return 40.0 if len(actual_df.columns) == 0 else 0.0
        
        actual_columns = set(actual_df.columns)
        expected_columns = set(expected_df.columns)
        common_columns = actual_columns & expected_columns
        
        # Column name score (0-20 points)
        # Jaccard similarity: intersection / union
        union_columns = actual_columns | expected_columns
        column_name_score = (len(common_columns) / len(union_columns)) * 20 if union_columns else 0
        
        # Column type score (0-20 points)
        type_score = 0.0
        if common_columns:
            matching_types = 0
            for col in common_columns:
                actual_type = self._normalize_type(str(actual_df[col].dtype))
                expected_type = self._normalize_type(str(expected_df[col].dtype))
                if self._types_compatible(actual_type, expected_type):
                    matching_types += 1
            
            # Score based on matching types among common columns
            type_score = (matching_types / len(expected_columns)) * 20
        
        return column_name_score + type_score
    
    def _types_compatible(self, actual_type: str, expected_type: str) -> bool:
        """Check if two data types are compatible."""
        # Normalize type names
        actual_normalized = self._normalize_type(actual_type)
        expected_normalized = self._normalize_type(expected_type)
        
        # Direct match
        if actual_normalized == expected_normalized:
            return True
        
        # Compatible numeric types
        numeric_types = {'int', 'float', 'number'}
        if actual_normalized in numeric_types and expected_normalized in numeric_types:
            return True
        
        # Compatible string types
        string_types = {'object', 'string', 'str'}
        if actual_normalized in string_types and expected_normalized in string_types:
            return True
        
        return False
    
    def _normalize_type(self, dtype_str: str) -> str:
        """Normalize data type string for comparison."""
        dtype_lower = dtype_str.lower()
        
        if 'int' in dtype_lower:
            return 'int'
        elif 'float' in dtype_lower or 'double' in dtype_lower:
            return 'float'
        elif 'object' in dtype_lower or 'string' in dtype_lower:
            return 'string'
        elif 'bool' in dtype_lower:
            return 'bool'
        elif 'datetime' in dtype_lower or 'timestamp' in dtype_lower:
            return 'datetime'
        else:
            return dtype_lower
    
    def _compare_data_values(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> Tuple[bool, float, List[Dict[str, Any]]]:
        """Compare actual data values between DataFrames."""
        differences = []
        
        # Sort both DataFrames for consistent comparison
        try:
            # Try to sort by all columns
            actual_sorted = actual_df.sort_values(by=list(actual_df.columns)).reset_index(drop=True)
            expected_sorted = expected_df.sort_values(by=list(expected_df.columns)).reset_index(drop=True)
        except Exception:
            # If sorting fails, use original order
            actual_sorted = actual_df.reset_index(drop=True)
            expected_sorted = expected_df.reset_index(drop=True)
        
        # Compare values column by column
        total_cells = 0
        matching_cells = 0
        
        for col in actual_sorted.columns:
            if col in expected_sorted.columns:
                actual_values = actual_sorted[col]
                expected_values = expected_sorted[col]
                
                # Handle NaN values
                actual_nulls = actual_values.isna()
                expected_nulls = expected_values.isna()
                
                # Check null value consistency
                null_mismatch = not actual_nulls.equals(expected_nulls)
                if null_mismatch:
                    differences.append({
                        'type': ValidationErrorType.NULL_VALUE_MISMATCH,
                        'column': col,
                        'actual_null_count': actual_nulls.sum(),
                        'expected_null_count': expected_nulls.sum()
                    })
                    # Null mismatches should affect the similarity score
                    null_mismatch_count = abs(actual_nulls.sum() - expected_nulls.sum())
                    matching_cells += len(actual_values) - null_mismatch_count
                    total_cells += len(actual_values)
                else:
                    # Compare non-null values
                    non_null_mask = ~(actual_nulls | expected_nulls)
                    if non_null_mask.any():
                        actual_non_null = actual_values[non_null_mask]
                        expected_non_null = expected_values[non_null_mask]
                        
                        # For numeric columns, allow reasonable floating point differences
                        # Use relative tolerance of 0.01% (1e-4) and absolute tolerance of 0.01
                        # This handles floating-point arithmetic variations while catching real errors
                        if pd.api.types.is_numeric_dtype(actual_values):
                            matches = np.isclose(actual_non_null, expected_non_null, rtol=1e-4, atol=0.01)
                        else:
                            matches = actual_non_null.equals(expected_non_null)
                        
                        if isinstance(matches, bool):
                            cell_matches = len(actual_non_null) if matches else 0
                        else:
                            cell_matches = matches.sum()
                        
                        matching_cells += cell_matches + actual_nulls.sum()  # Null matches count as matches
                        total_cells += len(actual_values)
                        
                        if not (isinstance(matches, bool) and matches) and not (hasattr(matches, 'all') and matches.all()):
                            # Find specific mismatches
                            if hasattr(matches, '__len__') and len(matches) > 1:
                                mismatch_indices = np.where(~matches)[0]
                                sample_indices = mismatch_indices[:5]  # First 5 mismatches
                                
                                differences.append({
                                    'type': ValidationErrorType.VALUE_MISMATCH,
                                    'column': col,
                                    'mismatch_count': len(mismatch_indices),
                                    'sample_mismatches': [
                                        {
                                            'row': int(idx),
                                            'expected': expected_non_null.iloc[idx],
                                            'actual': actual_non_null.iloc[idx]
                                        }
                                        for idx in sample_indices
                                    ]
                                })
                    else:
                        # All values are null
                        matching_cells += len(actual_values)
                        total_cells += len(actual_values)
        
        # Calculate similarity score
        similarity_score = matching_cells / total_cells if total_cells > 0 else 1.0
        data_match = similarity_score >= self.similarity_threshold
        
        return data_match, similarity_score, differences
    
    def _calculate_partial_similarity(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> float:
        """Calculate similarity score for DataFrames with different row counts."""
        if len(actual_df) == 0 and len(expected_df) == 0:
            return 1.0
        
        if len(actual_df) == 0 or len(expected_df) == 0:
            return 0.0
        
        # Take the minimum number of rows for comparison
        min_rows = min(len(actual_df), len(expected_df))
        actual_sample = actual_df.head(min_rows)
        expected_sample = expected_df.head(min_rows)
        
        # Compare the sample
        _, similarity_score, _ = self._compare_data_values(actual_sample, expected_sample)
        
        # Adjust for row count difference
        row_count_penalty = abs(len(actual_df) - len(expected_df)) / max(len(actual_df), len(expected_df))
        adjusted_score = similarity_score * (1 - row_count_penalty * 0.5)
        
        return max(0.0, adjusted_score)
    
    def _get_sample_mismatches(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Get sample mismatches for debugging purposes."""
        sample_mismatches = []
        
        try:
            # Sort both DataFrames
            actual_sorted = actual_df.sort_values(by=list(actual_df.columns)).reset_index(drop=True)
            expected_sorted = expected_df.sort_values(by=list(expected_df.columns)).reset_index(drop=True)
            
            # Find rows that don't match
            min_rows = min(len(actual_sorted), len(expected_sorted))
            
            for i in range(min(min_rows, self.max_sample_differences)):
                actual_row = actual_sorted.iloc[i].to_dict()
                expected_row = expected_sorted.iloc[i].to_dict()
                
                # Check if rows are different
                row_differs = False
                for col in actual_row.keys():
                    if col in expected_row:
                        actual_val = actual_row[col]
                        expected_val = expected_row[col]
                        
                        # Handle NaN comparison
                        if pd.isna(actual_val) and pd.isna(expected_val):
                            continue
                        elif pd.isna(actual_val) or pd.isna(expected_val):
                            row_differs = True
                            break
                        elif actual_val != expected_val:
                            # For numeric values, check with tolerance
                            if isinstance(actual_val, (int, float)) and isinstance(expected_val, (int, float)):
                                if not np.isclose(actual_val, expected_val, rtol=1e-10, atol=1e-10):
                                    row_differs = True
                                    break
                            else:
                                row_differs = True
                                break
                
                if row_differs:
                    sample_mismatches.append({
                        'row_index': i,
                        'expected': expected_row,
                        'actual': actual_row
                    })
        
        except Exception as e:
            self.logger.warning("Failed to generate sample mismatches", error=str(e))
        
        return sample_mismatches
    
    def _analyze_schema_differences(self, actual_df: pd.DataFrame, expected_df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze schema differences between DataFrames."""
        actual_columns = set(actual_df.columns)
        expected_columns = set(expected_df.columns)
        
        # Convert column names to strings to ensure compatibility with Pydantic models
        missing_columns = [str(col) for col in (expected_columns - actual_columns)]
        extra_columns = [str(col) for col in (actual_columns - expected_columns)]
        
        # Analyze type mismatches
        common_columns = actual_columns & expected_columns
        type_mismatches = {}
        
        for col in common_columns:
            actual_type = str(actual_df[col].dtype)
            expected_type = str(expected_df[col].dtype)
            
            if not self._types_compatible(actual_type, expected_type):
                type_mismatches[str(col)] = {
                    'expected': expected_type,
                    'actual': actual_type
                }
        
        return {
            'missing_columns': missing_columns,
            'extra_columns': extra_columns,
            'type_mismatches': type_mismatches
        }
    
    def _create_error_details(self, comparison: DataFrameComparison) -> List[ValidationError]:
        """Create detailed error information from comparison results."""
        error_details = []
        
        for diff in comparison.differences:
            error_type = diff['type']
            
            if error_type == ValidationErrorType.ROW_COUNT_MISMATCH:
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Row count mismatch: expected {diff['expected_rows']}, got {diff['actual_rows']}",
                    details=diff
                ))
            
            elif error_type == ValidationErrorType.COLUMN_MISSING:
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Missing columns: {', '.join(str(col) for col in diff['missing_columns'])}",
                    details=diff
                ))
            
            elif error_type == ValidationErrorType.COLUMN_EXTRA:
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Extra columns: {', '.join(str(col) for col in diff['extra_columns'])}",
                    details=diff
                ))
            
            elif error_type == ValidationErrorType.DATA_TYPE_MISMATCH:
                type_errors = []
                for col, types in diff['type_mismatches'].items():
                    type_errors.append(f"{col}: expected {types['expected']}, got {types['actual']}")
                
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Data type mismatches: {'; '.join(type_errors)}",
                    details=diff
                ))
            
            elif error_type == ValidationErrorType.VALUE_MISMATCH:
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Value mismatches in column '{diff['column']}': {diff['mismatch_count']} differences found",
                    details=diff
                ))
            
            elif error_type == ValidationErrorType.NULL_VALUE_MISMATCH:
                error_details.append(ValidationError(
                    error_type=error_type,
                    message=f"Null value mismatch in column '{diff['column']}': expected {diff['expected_null_count']} nulls, got {diff['actual_null_count']}",
                    details=diff
                ))
        
        return error_details
    
    def get_debugging_info(self, 
                          actual_df: Optional[pd.DataFrame], 
                          expected_df: Optional[pd.DataFrame],
                          validation_result: ValidationResult) -> Dict[str, Any]:
        """
        Extract comprehensive debugging information for failed validations.
        
        Args:
            actual_df: Actual DataFrame output
            expected_df: Expected DataFrame output
            validation_result: Validation result with errors
            
        Returns:
            Dictionary with debugging information
        """
        debugging_info = {
            "validation_summary": {
                "is_correct": validation_result.is_correct,
                "similarity_score": validation_result.similarity_score,
                "schema_match": validation_result.schema_match,
                "row_count_match": validation_result.row_count_match,
                "data_match": validation_result.data_match
            }
        }
        
        # Add DataFrame information
        if actual_df is not None:
            debugging_info["actual_output"] = {
                "shape": actual_df.shape,
                "columns": list(actual_df.columns),
                "dtypes": {col: str(dtype) for col, dtype in actual_df.dtypes.items()},
                "sample_data": actual_df.head(5).to_dict('records') if not actual_df.empty else [],
                "null_counts": actual_df.isnull().sum().to_dict()
            }
        
        if expected_df is not None:
            debugging_info["expected_output"] = {
                "shape": expected_df.shape,
                "columns": list(expected_df.columns),
                "dtypes": {col: str(dtype) for col, dtype in expected_df.dtypes.items()},
                "sample_data": expected_df.head(5).to_dict('records') if not expected_df.empty else [],
                "null_counts": expected_df.isnull().sum().to_dict()
            }
        
        # Add error analysis
        if validation_result.error_details:
            debugging_info["error_analysis"] = {
                "error_count": len(validation_result.error_details),
                "error_types": [error.error_type for error in validation_result.error_details],
                "detailed_errors": [
                    {
                        "type": error.error_type,
                        "message": error.message,
                        "details": error.details
                    }
                    for error in validation_result.error_details
                ]
            }
        
        # Add schema comparison if available
        if actual_df is not None and expected_df is not None:
            debugging_info["schema_comparison"] = self._analyze_schema_differences(actual_df, expected_df)
        
        # Add sample differences for data mismatches
        if validation_result.sample_differences:
            debugging_info["sample_differences"] = validation_result.sample_differences[:10]  # Limit to 10 samples
        
        return debugging_info
    
    def extract_mismatch_samples(self, 
                               actual_df: pd.DataFrame, 
                               expected_df: pd.DataFrame,
                               max_samples: int = 5) -> List[Dict[str, Any]]:
        """
        Extract specific samples where actual and expected outputs differ.
        
        Args:
            actual_df: Actual DataFrame output
            expected_df: Expected DataFrame output
            max_samples: Maximum number of sample mismatches to return
            
        Returns:
            List of sample mismatches with context
        """
        if actual_df.empty or expected_df.empty:
            return []
        
        mismatches = []
        
        try:
            # Ensure both DataFrames have the same columns for comparison
            common_columns = list(set(actual_df.columns) & set(expected_df.columns))
            if not common_columns:
                return []
            
            # Sort both DataFrames for consistent comparison
            actual_sorted = actual_df[common_columns].sort_values(by=common_columns).reset_index(drop=True)
            expected_sorted = expected_df[common_columns].sort_values(by=common_columns).reset_index(drop=True)
            
            # Compare row by row
            min_rows = min(len(actual_sorted), len(expected_sorted))
            
            for i in range(min(min_rows, max_samples * 2)):  # Check more rows to find mismatches
                if len(mismatches) >= max_samples:
                    break
                
                actual_row = actual_sorted.iloc[i]
                expected_row = expected_sorted.iloc[i]
                
                # Check if rows differ
                row_differs = False
                differing_columns = []
                
                for col in common_columns:
                    actual_val = actual_row[col]
                    expected_val = expected_row[col]
                    
                    # Handle NaN comparison
                    if pd.isna(actual_val) and pd.isna(expected_val):
                        continue
                    elif pd.isna(actual_val) or pd.isna(expected_val):
                        row_differs = True
                        differing_columns.append({
                            "column": col,
                            "actual": actual_val,
                            "expected": expected_val,
                            "issue": "null_mismatch"
                        })
                    elif actual_val != expected_val:
                        # For numeric values, check with tolerance
                        if isinstance(actual_val, (int, float)) and isinstance(expected_val, (int, float)):
                            if not np.isclose(actual_val, expected_val, rtol=1e-10, atol=1e-10):
                                row_differs = True
                                differing_columns.append({
                                    "column": col,
                                    "actual": actual_val,
                                    "expected": expected_val,
                                    "issue": "value_mismatch",
                                    "difference": abs(actual_val - expected_val)
                                })
                        else:
                            row_differs = True
                            differing_columns.append({
                                "column": col,
                                "actual": actual_val,
                                "expected": expected_val,
                                "issue": "value_mismatch"
                            })
                
                if row_differs:
                    mismatches.append({
                        "row_index": i,
                        "differing_columns": differing_columns,
                        "actual_row": actual_row.to_dict(),
                        "expected_row": expected_row.to_dict()
                    })
            
            # If we have different row counts, add information about extra/missing rows
            if len(actual_df) != len(expected_df):
                if len(actual_df) > len(expected_df):
                    # Show sample of extra rows
                    extra_rows = actual_df.iloc[len(expected_df):len(expected_df) + 3]
                    mismatches.append({
                        "issue_type": "extra_rows",
                        "message": f"Output has {len(actual_df) - len(expected_df)} extra rows",
                        "sample_extra_rows": extra_rows.to_dict('records')
                    })
                else:
                    # Show sample of missing rows
                    missing_rows = expected_df.iloc[len(actual_df):len(actual_df) + 3]
                    mismatches.append({
                        "issue_type": "missing_rows",
                        "message": f"Output is missing {len(expected_df) - len(actual_df)} rows",
                        "sample_missing_rows": missing_rows.to_dict('records')
                    })
        
        except Exception as e:
            self.logger.warning("Failed to extract mismatch samples", error=str(e))
            return [{
                "error": "Failed to extract sample mismatches",
                "details": str(e)
            }]
        
        return mismatches
    
    def _create_error_result(self, message: str, error_type: ValidationErrorType) -> ValidationResult:
        """Create a ValidationResult for error cases."""
        return ValidationResult(
            is_correct=False,
            schema_match=False,
            row_count_match=False,
            data_match=False,
            similarity_score=0.0,
            error_details=[
                ValidationError(
                    error_type=error_type,
                    message=message,
                    details={}
                )
            ]
        )


# Global validation engine instance
_validation_engine = None

def get_validation_engine() -> ValidationEngine:
    """Get the global validation engine instance."""
    global _validation_engine
    if _validation_engine is None:
        _validation_engine = ValidationEngine()
    return _validation_engine