"""
Unit tests for the ValidationEngine and ErrorReporter classes.
"""

import pytest
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from unittest.mock import Mock, patch

from app.services.validation_engine import ValidationEngine, ValidationErrorType, get_validation_engine
from app.models.execution import ValidationResult, ValidationError
from app.models.question import Question, TestCase, DifficultyLevel, QuestionTopic


class TestValidationEngine:
    """Test the ValidationEngine class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.engine = ValidationEngine()
    
    @pytest.mark.asyncio
    async def test_identical_dataframes_validation_success(self):
        """Test validation of identical DataFrames returns success."""
        # Create identical DataFrames
        data = {"name": ["Alice", "Bob"], "age": [25, 30], "salary": [50000.0, 60000.0]}
        actual_output = {"result": data}
        expected_output = {"result": data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is True
        assert result.schema_match is True
        assert result.row_count_match is True
        assert result.data_match is True
        assert result.similarity_score == 1.0
        assert len(result.error_details) == 0
    
    @pytest.mark.asyncio
    async def test_schema_mismatch_missing_columns(self):
        """Test validation with missing columns."""
        actual_data = {"name": ["Alice", "Bob"]}  # Missing age column
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert result.schema_match is False
        assert "age" in result.missing_columns
        assert any(error.error_type == ValidationErrorType.COLUMN_MISSING for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_schema_mismatch_extra_columns(self):
        """Test validation with extra columns."""
        actual_data = {"name": ["Alice", "Bob"], "age": [25, 30], "extra_col": ["x", "y"]}
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert result.schema_match is False
        assert "extra_col" in result.extra_columns
        assert any(error.error_type == ValidationErrorType.COLUMN_EXTRA for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_data_type_mismatch(self):
        """Test validation with data type mismatches."""
        actual_data = {"name": ["Alice", "Bob"], "age": ["25", "30"]}  # String instead of int
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert result.schema_match is False
        assert "age" in result.type_mismatches
        assert any(error.error_type == ValidationErrorType.DATA_TYPE_MISMATCH for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_row_count_mismatch(self):
        """Test validation with different row counts."""
        actual_data = {"name": ["Alice"], "age": [25]}  # 1 row
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}  # 2 rows
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert result.row_count_match is False
        assert any(error.error_type == ValidationErrorType.ROW_COUNT_MISMATCH for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_value_mismatch(self):
        """Test validation with value mismatches."""
        actual_data = {"name": ["Alice", "Bob"], "age": [25, 35]}  # Different age for Bob
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert result.schema_match is True
        assert result.row_count_match is True
        assert result.data_match is False
        assert result.similarity_score < 1.0
        assert any(error.error_type == ValidationErrorType.VALUE_MISMATCH for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_null_value_handling(self):
        """Test validation with null values."""
        actual_data = {"name": ["Alice", None], "age": [25, 30]}
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        # Should fail due to null value mismatch and value mismatch
        assert result.is_correct is False
        assert result.data_match is False
        # Should detect null value mismatch
        assert any(error.error_type == ValidationErrorType.NULL_VALUE_MISMATCH for error in result.error_details)
    
    @pytest.mark.asyncio
    async def test_numeric_tolerance(self):
        """Test validation with small numeric differences within tolerance."""
        actual_data = {"value": [1.0000000001, 2.0000000001]}  # Very small differences
        expected_data = {"value": [1.0, 2.0]}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        # Should pass due to numeric tolerance
        assert result.is_correct is True
        assert result.data_match is True
    
    @pytest.mark.asyncio
    async def test_empty_dataframes(self):
        """Test validation with empty DataFrames."""
        actual_data = {"name": [], "age": []}
        expected_data = {"name": [], "age": []}
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is True
        assert result.similarity_score == 1.0
    
    @pytest.mark.asyncio
    async def test_invalid_output_format(self):
        """Test validation with invalid output format."""
        actual_output = {"invalid": "format"}
        expected_output = {"result": {"name": ["Alice"], "age": [25]}}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is False
        assert len(result.error_details) > 0
    
    @pytest.mark.asyncio
    async def test_multiple_test_cases_validation(self):
        """Test validation against multiple test cases."""
        actual_output = {"result": {"name": ["Alice"], "age": [25]}}
        
        test_cases = [
            TestCase(
                input_data={"name": ["Alice", "Bob"], "age": [25, 30]},
                expected_output={"name": ["Alice"], "age": [25]},
                description="Filter age < 30"
            ),
            TestCase(
                input_data={"name": ["Charlie", "David"], "age": [20, 35]},
                expected_output={"name": ["Charlie"], "age": [20]},
                description="Another filter test"
            )
        ]
        
        results = await self.engine.validate_test_cases(actual_output, test_cases)
        
        assert len(results) == 2
        assert results[0].is_correct is True  # Matches first test case
        assert results[1].is_correct is False  # Doesn't match second test case
    
    def test_dataframe_conversion_dict(self):
        """Test DataFrame conversion from dictionary."""
        output = {"result": {"name": ["Alice", "Bob"], "age": [25, 30]}}
        df = self.engine._convert_to_dataframe(output)
        
        assert df is not None
        assert list(df.columns) == ["name", "age"]
        assert len(df) == 2
    
    def test_dataframe_conversion_list(self):
        """Test DataFrame conversion from list of records."""
        output = {"result": [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 30}]}
        df = self.engine._convert_to_dataframe(output)
        
        assert df is not None
        assert list(df.columns) == ["name", "age"]
        assert len(df) == 2
    
    def test_dataframe_conversion_pandas(self):
        """Test DataFrame conversion from pandas DataFrame."""
        pandas_df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})
        output = pandas_df  # Direct DataFrame, not wrapped in result
        df = self.engine._convert_to_dataframe(output)
        
        assert df is not None
        assert df.equals(pandas_df)
    
    def test_types_compatible(self):
        """Test data type compatibility checking."""
        # Compatible types
        assert self.engine._types_compatible("int64", "int32") is True
        assert self.engine._types_compatible("float64", "float32") is True
        assert self.engine._types_compatible("object", "string") is True
        assert self.engine._types_compatible("int64", "float64") is True
        
        # Incompatible types
        assert self.engine._types_compatible("int64", "object") is False
        assert self.engine._types_compatible("bool", "int64") is False
    
    def test_debugging_info_extraction(self):
        """Test extraction of debugging information."""
        actual_df = pd.DataFrame({"name": ["Alice"], "age": [25]})
        expected_df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})
        
        validation_result = ValidationResult(
            is_correct=False,
            schema_match=True,
            row_count_match=False,
            data_match=False,
            similarity_score=0.5,
            error_details=[
                ValidationError(
                    error_type=ValidationErrorType.ROW_COUNT_MISMATCH,
                    message="Row count mismatch",
                    details={"expected_rows": 2, "actual_rows": 1}
                )
            ]
        )
        
        debug_info = self.engine.get_debugging_info(actual_df, expected_df, validation_result)
        
        assert "validation_summary" in debug_info
        assert "actual_output" in debug_info
        assert "expected_output" in debug_info
        assert "error_analysis" in debug_info
        assert debug_info["actual_output"]["shape"] == (1, 2)
        assert debug_info["expected_output"]["shape"] == (2, 2)
    
    def test_mismatch_samples_extraction(self):
        """Test extraction of sample mismatches."""
        actual_df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 35]})
        expected_df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})
        
        mismatches = self.engine.extract_mismatch_samples(actual_df, expected_df, max_samples=5)
        
        assert len(mismatches) > 0
        # Should find mismatch in Bob's age
        assert any(
            mismatch.get("row_index") == 1 and 
            any(col["column"] == "age" for col in mismatch.get("differing_columns", []))
            for mismatch in mismatches
        )
    
    def test_global_validation_engine_instance(self):
        """Test global validation engine instance."""
        engine1 = get_validation_engine()
        engine2 = get_validation_engine()
        
        assert engine1 is engine2  # Should be the same instance


class TestValidationEngineIntegration:
    """Integration tests for ValidationEngine."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.engine = ValidationEngine()
    
    @pytest.mark.asyncio
    async def test_comprehensive_validation_workflow(self):
        """Test complete validation workflow with multiple error types."""
        # Create DataFrames with multiple types of errors
        actual_data = {"name": ["Alice"], "extra_col": ["x"]}  # Missing age, extra column
        expected_data = {"name": ["Alice", "Bob"], "age": [25, 30]}  # Different structure
        
        actual_output = {"result": actual_data}
        expected_output = {"result": expected_data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        # Should detect multiple errors
        assert result.is_correct is False
        assert result.schema_match is False
        assert len(result.error_details) > 0
        assert "age" in result.missing_columns
        assert "extra_col" in result.extra_columns
    
    @pytest.mark.asyncio
    async def test_successful_validation_workflow(self):
        """Test successful validation workflow."""
        data = {"name": ["Alice", "Bob"], "age": [25, 30]}
        actual_output = {"result": data}
        expected_output = {"result": data}
        
        result = await self.engine.validate_output(actual_output, expected_output)
        
        assert result.is_correct is True
        assert len(result.error_details) == 0


if __name__ == "__main__":
    pytest.main([__file__])