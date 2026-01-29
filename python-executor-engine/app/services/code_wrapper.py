"""Dynamic code wrapper for user's Python function."""
import json
from typing import List, Any


class CodeWrapper:
    """Wraps user's Python function with I/O handling and execution code."""
    
    @staticmethod
    def wrap_code(
        user_code: str,
        function_name: str,
        param_names: List[str],
        test_input: dict
    ) -> str:
        """
        Generate complete Python code with wrapper.
        
        Args:
            user_code: User's Python function code
            function_name: Function name to call
            param_names: Parameter names (e.g., ['nums', 'target'])
            test_input: Test input dictionary
            
        Returns:
            Complete Python code with imports, user code, and execution code
        """
        if not param_names:
            raise ValueError("param_names cannot be empty")
        
        # Generate parameter extraction code
        param_extraction = CodeWrapper._generate_parameter_extraction(param_names, test_input)
        
        # Generate function call
        function_call = CodeWrapper._generate_function_call(function_name, param_names)
        
        # Build complete code
        wrapped_code = f"""import json
import sys
import traceback

# USER'S CODE (as-is)
{user_code}

# AUTO-GENERATED WRAPPER
if __name__ == "__main__":
    try:
        # Read JSON from stdin
        input_data = sys.stdin.read()
        if not input_data or not input_data.strip():
            print(json.dumps(None))
            sys.exit(0)
        
        # Parse input
        try:
            test_input = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(json.dumps({{
                "error": "JSONDecodeError",
                "message": f"Invalid JSON input: {{str(e)}}"
            }}), file=sys.stderr)
            sys.exit(1)
        
        # Extract parameters
{param_extraction}
        
        # Call user's function
{function_call}
        
        # Output as JSON (handle None, NaN, Infinity, sets, tuples)
        try:
            # Convert sets to lists, tuples to lists for JSON serialization
            def json_serialize(obj):
                if isinstance(obj, set):
                    return list(obj)
                elif isinstance(obj, tuple):
                    return list(obj)
                elif isinstance(obj, (int, float, str, bool, type(None))):
                    return obj
                elif isinstance(obj, dict):
                    return {{k: json_serialize(v) for k, v in obj.items()}}
                elif isinstance(obj, (list, tuple)):
                    return [json_serialize(item) for item in obj]
                else:
                    # Try to convert to string as fallback
                    return str(obj)
            
            serialized_result = json_serialize(result)
            output_json = json.dumps(serialized_result, allow_nan=False)
            print(output_json)
        except (ValueError, TypeError) as e:
            # Handle cases where result can't be serialized to JSON
            print(json.dumps({{
                "error": "SerializationError",
                "message": f"Cannot serialize result to JSON: {{str(e)}}",
                "result_type": str(type(result).__name__)
            }}), file=sys.stderr)
            sys.exit(1)
        
    except SyntaxError as e:
        print(json.dumps({{
            "error": "SyntaxError",
            "message": str(e),
            "lineno": getattr(e, 'lineno', None),
            "text": getattr(e, 'text', None)
        }}), file=sys.stderr)
        sys.exit(1)
    except NameError as e:
        print(json.dumps({{
            "error": "NameError",
            "message": str(e)
        }}), file=sys.stderr)
        sys.exit(1)
    except TypeError as e:
        print(json.dumps({{
            "error": "TypeError",
            "message": str(e)
        }}), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(json.dumps({{
            "error": "ValueError",
            "message": str(e)
        }}), file=sys.stderr)
        sys.exit(1)
    except RecursionError as e:
        print(json.dumps({{
            "error": "RecursionError",
            "message": str(e)
        }}), file=sys.stderr)
        sys.exit(1)
    except MemoryError as e:
        print(json.dumps({{
            "error": "MemoryError",
            "message": str(e)
        }}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        error_info = {{
            "error": type(e).__name__,
            "message": str(e),
            "traceback": traceback.format_exc()
        }}
        print(json.dumps(error_info), file=sys.stderr)
        sys.exit(1)
"""
        
        return wrapped_code
    
    @staticmethod
    def _generate_parameter_extraction(param_names: List[str], test_input: dict) -> str:
        """Generate parameter extraction code from test_input."""
        extractions = []
        for param_name in param_names:
            # Handle nested keys (e.g., "nums" from {"nums": [1,2,3]})
            extractions.append(f"        {param_name} = test_input.get('{param_name}')")
        
        return "\n".join(extractions)
    
    @staticmethod
    def _generate_function_call(function_name: str, param_names: List[str]) -> str:
        """Generate function call code."""
        params_str = ", ".join(param_names)
        return f"        result = {function_name}({params_str})"

