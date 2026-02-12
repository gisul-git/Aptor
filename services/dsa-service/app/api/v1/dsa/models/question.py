from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing import List, Dict, Optional, Any
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return ObjectId(v)
            raise ValueError("Invalid ObjectId")
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string"}

class TestCase(BaseModel):
    """
    Single testcase for a DSA coding question.

    For the new JSON-based execution model:
    - input: typically a JSON object/dict (e.g., {"nums": [1,2,3], "target": 5})
    - expected_output: any JSON value (int, list, bool, object, etc.)

    For legacy questions:
    - input: raw stdin string
    - expected_output: string
    """
    input: Any
    # Optional because AI-generated questions intentionally omit expected_output.
    # Manual questions must provide expected_output; this is validated in routers/questions.py.
    expected_output: Optional[Any] = None
    is_hidden: bool = False

class StarterCode(BaseModel):
    language: str
    code: str

class FunctionParameter(BaseModel):
    """Defines a function parameter"""
    name: str           # e.g., "nums", "target"
    type: str           # e.g., "int[]", "int", "string"

class FunctionSignature(BaseModel):
    """Defines the expected function signature for code wrapping"""
    name: str                           # e.g., "twoSum", "isPrime"
    parameters: List[FunctionParameter] # Function parameters
    return_type: str                    # e.g., "int[]", "boolean", "string"

class Example(BaseModel):
    """A single example with input, output, and optional explanation"""
    input: str              # e.g., "nums = [2,7,11,15], target = 9"
    output: str             # e.g., "[0,1]"
    explanation: Optional[str] = None  # e.g., "Because nums[0] + nums[1] == 9"

# SQL-specific models
class TableSchema(BaseModel):
    """Schema definition for a SQL table"""
    columns: Dict[str, str]  # column_name: data_type (e.g., {"id": "INT PRIMARY KEY"})

class SQLEvaluation(BaseModel):
    """Evaluation configuration for SQL questions"""
    engine: str = "postgres"  # Database engine
    comparison: str = "result_set"  # Comparison method
    order_sensitive: bool = False  # Whether row order matters

class Question(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    title: str
    
    # LeetCode-style 3-part description
    description: str                    # Problem statement (Markdown)
    examples: List[Example] = []        # Input/Output examples
    constraints: List[str] = []         # e.g., ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"]
    
    difficulty: str  # easy, medium, hard
    languages: List[str]  # Any language Judge0 supports
    public_testcases: List[TestCase]
    hidden_testcases: List[TestCase]
    starter_code: Dict[str, str]  # {language: code}
    # Function signature for code wrapping (optional)
    function_signature: Optional[FunctionSignature] = None
    # If True, user code will be validated and wrapped
    secure_mode: bool = False
    # Admin-defined wrapper template for code execution
    wrapper_template: Optional[str] = None
    is_published: bool = False  # Whether question is visible to users
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

class QuestionCreate(BaseModel):
    title: str
    # LeetCode-style 3-part description
    description: str                    # Problem statement
    examples: List[Example] = []        # Input/Output examples  
    constraints: List[str] = []         # Constraints like "1 <= n <= 10^5"
    
    difficulty: str
    languages: List[str] = []  # Any language Judge0 supports (optional for SQL)
    public_testcases: List[TestCase] = []  # Optional for SQL questions
    hidden_testcases: List[TestCase] = []  # Optional for SQL questions
    starter_code: Dict[str, str] = {}  # Optional for SQL questions
    function_signature: Optional[FunctionSignature] = None
    secure_mode: bool = False
    wrapper_template: Optional[str] = None
    is_published: bool = False
    
    # SQL-specific fields (optional - only used for question_type="SQL")
    question_type: Optional[str] = None  # "coding" or "SQL"
    sql_category: Optional[str] = None  # select, join, aggregation, subquery, window
    schemas: Optional[Dict[str, Any]] = None  # Table schemas {table_name: {columns: {...}}}
    sample_data: Optional[Dict[str, List[List[Any]]]] = None  # Sample data per table
    starter_query: Optional[str] = None  # SQL starter template
    reference_query: Optional[str] = None  # Correct SQL query for evaluation
    # Optional manual expected result preview for SQL questions (e.g., result-set snapshot)
    sql_expected_output: Optional[str] = None
    hints: Optional[List[str]] = None  # Optional hints for SQL questions
    evaluation: Optional[Dict[str, Any]] = None  # SQL evaluation config

class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    # LeetCode-style 3-part description
    description: Optional[str] = None
    examples: Optional[List[Example]] = None
    constraints: Optional[List[str]] = None
    
    difficulty: Optional[str] = None
    languages: Optional[List[str]] = None
    public_testcases: Optional[List[TestCase]] = None
    hidden_testcases: Optional[List[TestCase]] = None
    starter_code: Optional[Dict[str, str]] = None
    function_signature: Optional[FunctionSignature] = None
    secure_mode: Optional[bool] = None
    wrapper_template: Optional[str] = None
    is_published: Optional[bool] = None
    
    # SQL-specific fields
    question_type: Optional[str] = None
    sql_category: Optional[str] = None
    schemas: Optional[Dict[str, Any]] = None
    sample_data: Optional[Dict[str, List[List[Any]]]] = None
    starter_query: Optional[str] = None
    reference_query: Optional[str] = None  # Correct SQL query for evaluation
    # Optional manual expected result preview for SQL questions
    sql_expected_output: Optional[str] = None
    hints: Optional[List[str]] = None
    evaluation: Optional[Dict[str, Any]] = None


