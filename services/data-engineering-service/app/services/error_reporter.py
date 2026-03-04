"""
Detailed error reporting system for validation mismatches and debugging.
"""

import pandas as pd
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

from app.models.execution import ValidationError


class ErrorSeverity(str, Enum):
    """Severity levels for validation errors."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class DetailedError:
    """Enhanced error information with debugging context."""
    error_type: str
    severity: ErrorSeverity
    message: str
    description: str
    location: Optional[str] = None
    suggested_fix: Optional[str] = None
    code_example: Optional[str] = None
    sample_data: Optional[Dict[str, Any]] = None
    related_errors: Optional[List[str]] = None


class ErrorReporter:
    """Comprehensive error reporting system for validation mismatches."""
    
    def __init__(self):
        self.max_sample_rows = 5
        self.max_sample_columns = 10
    
    def create_detailed_error_report(self, 
                                   validation_errors: List[ValidationError],
                                   actual_df: Optional[pd.DataFrame] = None,
                                   expected_df: Optional[pd.DataFrame] = None) -> List[DetailedError]:
        """Create comprehensive error reports with debugging information."""
        detailed_errors = []
        
        for error in validation_errors:
            if error.error_type == "schema_mismatch":
                detailed_errors.extend(self._create_schema_error_reports(error, actual_df, expected_df))
            elif error.error_type == "row_count_mismatch":
                detailed_errors.append(self._create_row_count_error_report(error, actual_df, expected_df))
            elif error.error_type == "column_missing":
                detailed_errors.append(self._create_missing_column_error_report(error, actual_df, expected_df))
            elif error.error_type == "column_extra":
                detailed_errors.append(self._create_extra_column_error_report(error, actual_df, expected_df))
            elif error.error_type == "data_type_mismatch":
                detailed_errors.extend(self._create_type_mismatch_error_reports(error, actual_df, expected_df))
            elif error.error_type == "value_mismatch":
                detailed_errors.append(self._create_value_mismatch_error_report(error, actual_df, expected_df))
            elif error.error_type == "null_value_mismatch":
                detailed_errors.append(self._create_null_mismatch_error_report(error, actual_df, expected_df))
            else:
                detailed_errors.append(self._create_generic_error_report(error))
        
        return detailed_errors
    
    def _create_schema_error_reports(self, 
                                   error: ValidationError,
                                   actual_df: Optional[pd.DataFrame],
                                   expected_df: Optional[pd.DataFrame]) -> List[DetailedError]:
        """Create detailed reports for schema mismatches."""
        return [DetailedError(
            error_type="schema_mismatch",
            severity=ErrorSeverity.CRITICAL,
            message="DataFrame schema does not match expected structure",
            description="The output DataFrame has a different schema than expected.",
            suggested_fix="Check your DataFrame operations to ensure all required columns are present with correct data types"
        )]
    
    def _create_row_count_error_report(self, 
                                     error: ValidationError,
                                     actual_df: Optional[pd.DataFrame],
                                     expected_df: Optional[pd.DataFrame]) -> DetailedError:
        """Create detailed report for row count mismatches."""
        details = error.details
        expected_rows = details.get('expected_rows', 'unknown')
        actual_rows = details.get('actual_rows', 'unknown')
        difference = details.get('difference', 0)
        
        if difference > 0:
            description = f"Output contains {difference} more rows than expected."
            suggested_fix = "Check for duplicate rows, missing filters, or incorrect joins."
        else:
            description = f"Output contains {abs(difference)} fewer rows than expected."
            suggested_fix = "Check for overly restrictive filters, incorrect joins, or missing data."
        
        return DetailedError(
            error_type="row_count_mismatch",
            severity=ErrorSeverity.HIGH,
            message=f"Row count mismatch: expected {expected_rows}, got {actual_rows}",
            description=description,
            suggested_fix=suggested_fix
        )
    
    def _create_missing_column_error_report(self, 
                                          error: ValidationError,
                                          actual_df: Optional[pd.DataFrame],
                                          expected_df: Optional[pd.DataFrame]) -> DetailedError:
        """Create detailed report for missing columns."""
        details = error.details
        missing_columns = details.get('missing_columns', [])
        
        return DetailedError(
            error_type="column_missing",
            severity=ErrorSeverity.CRITICAL,
            message=f"Missing required columns: {', '.join(str(col) for col in missing_columns)}",
            description="Your output is missing one or more required columns.",
            suggested_fix=f"Add the missing columns to your output: {', '.join(str(col) for col in missing_columns)}"
        )
    
    def _create_extra_column_error_report(self, 
                                        error: ValidationError,
                                        actual_df: Optional[pd.DataFrame],
                                        expected_df: Optional[pd.DataFrame]) -> DetailedError:
        """Create detailed report for extra columns."""
        details = error.details
        extra_columns = details.get('extra_columns', [])
        
        return DetailedError(
            error_type="column_extra",
            severity=ErrorSeverity.MEDIUM,
            message=f"Unexpected columns in output: {', '.join(str(col) for col in extra_columns)}",
            description="Your output contains columns that are not expected.",
            suggested_fix=f"Remove the extra columns from your output: {', '.join(str(col) for col in extra_columns)}"
        )
    
    def _create_type_mismatch_error_reports(self, 
                                          error: ValidationError,
                                          actual_df: Optional[pd.DataFrame],
                                          expected_df: Optional[pd.DataFrame]) -> List[DetailedError]:
        """Create detailed reports for data type mismatches."""
        details = error.details
        type_mismatches = details.get('type_mismatches', {})
        errors = []
        
        for column, type_info in type_mismatches.items():
            expected_type = type_info['expected']
            actual_type = type_info['actual']
            
            errors.append(DetailedError(
                error_type="data_type_mismatch",
                severity=ErrorSeverity.HIGH,
                message=f"Data type mismatch in column '{column}': expected {expected_type}, got {actual_type}",
                description=f"Column '{column}' has the wrong data type.",
                suggested_fix=f"Convert column '{column}' to {expected_type} using cast() or astype()"
            ))
        
        return errors
    
    def _create_value_mismatch_error_report(self, 
                                          error: ValidationError,
                                          actual_df: Optional[pd.DataFrame],
                                          expected_df: Optional[pd.DataFrame]) -> DetailedError:
        """Create detailed report for value mismatches."""
        details = error.details
        column = details.get('column', 'unknown')
        mismatch_count = details.get('mismatch_count', 0)
        
        return DetailedError(
            error_type="value_mismatch",
            severity=ErrorSeverity.HIGH,
            message=f"Value mismatches in column '{column}': {mismatch_count} differences found",
            description=f"Column '{column}' contains incorrect values.",
            suggested_fix=f"Review your transformations for column '{column}'"
        )
    
    def _create_null_mismatch_error_report(self, 
                                         error: ValidationError,
                                         actual_df: Optional[pd.DataFrame],
                                         expected_df: Optional[pd.DataFrame]) -> DetailedError:
        """Create detailed report for null value mismatches."""
        details = error.details
        column = details.get('column', 'unknown')
        expected_null_count = details.get('expected_null_count', 0)
        actual_null_count = details.get('actual_null_count', 0)
        
        return DetailedError(
            error_type="null_value_mismatch",
            severity=ErrorSeverity.MEDIUM,
            message=f"Null value mismatch in column '{column}'",
            description="Your output has different null value counts than expected.",
            suggested_fix="Check your null value handling logic"
        )
    
    def _create_generic_error_report(self, error: ValidationError) -> DetailedError:
        """Create a generic error report for unhandled error types."""
        return DetailedError(
            error_type=error.error_type,
            severity=ErrorSeverity.MEDIUM,
            message=error.message,
            description="A validation error occurred.",
            suggested_fix="Check the error details and adjust your code accordingly."
        )
    
    def format_error_message(self, detailed_error: DetailedError) -> str:
        """Format a detailed error into a user-friendly message."""
        message_parts = [
            f"❌ {detailed_error.message}",
            f"📝 {detailed_error.description}"
        ]
        
        if detailed_error.suggested_fix:
            message_parts.append(f"💡 Suggested fix: {detailed_error.suggested_fix}")
        
        if detailed_error.code_example:
            message_parts.append(f"📋 Example:\n{detailed_error.code_example}")
        
        return "\n\n".join(message_parts)
    
    def format_error_summary(self, detailed_errors: List[DetailedError]) -> str:
        """Format multiple errors into a comprehensive summary."""
        if not detailed_errors:
            return "✅ No validation errors found."
        
        summary_parts = [f"Found {len(detailed_errors)} validation error(s):"]
        
        for i, error in enumerate(detailed_errors, 1):
            summary_parts.append(f"\n{i}. {self.format_error_message(error)}")
        
        return "\n".join(summary_parts)


# Global error reporter instance
_error_reporter = None

def get_error_reporter() -> ErrorReporter:
    """Get the global error reporter instance."""
    global _error_reporter
    if _error_reporter is None:
        _error_reporter = ErrorReporter()
    return _error_reporter