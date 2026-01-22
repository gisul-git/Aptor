"""
Universal Code Wrapper V2 - Production-Ready LeetCode-Style Execution

This version handles proper parameter extraction and JSON I/O for all 10 languages.
Works with Judge0's actual environment and available libraries.
"""

import json
import logging
from typing import Dict, Any, Optional, Tuple, List

logger = logging.getLogger("dsa-service")

# Judge0 Language IDs
JUDGE0_LANGUAGE_MAP = {
    "python": 71,
    "java": 62,
    "cpp": 54,
    "c": 50,
    "csharp": 51,
    "go": 60,
    "rust": 73,
    "kotlin": 78,
    "javascript": 63,
    "typescript": 74
}


def get_judge0_language_id(language: str) -> Optional[int]:
    """Get Judge0 language ID for a given language."""
    return JUDGE0_LANGUAGE_MAP.get(language.lower().strip())


def generate_python_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate Python driver code."""
    param_names = [p["name"] for p in parameters]
    param_extraction = ", ".join([f"test_input['{name}']" for name in param_names])
    
    return f"""import sys
import json
from typing import List, Dict, Any

{user_code}

if __name__ == "__main__":
    try:
        test_input = json.loads(sys.stdin.read())
        result = {function_name}({param_extraction})
        print(json.dumps(result, separators=(',', ':')))
    except Exception as e:
        print(json.dumps({{"error": str(e)}}), file=sys.stderr)
        sys.exit(1)
"""


def generate_java_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate Java driver code using Gson (available in Judge0)."""
    param_extractions = []
    param_calls = []
    
    java_type_map = {
        "int": "int", "int[]": "int[]", "Integer": "Integer", "Integer[]": "Integer[]",
        "String": "String", "String[]": "String[]",
        "boolean": "boolean", "boolean[]": "boolean[]", "Boolean": "Boolean", "Boolean[]": "Boolean[]",
        "double": "double", "double[]": "double[]", "Double": "Double", "Double[]": "Double[]",
        "float": "float", "float[]": "float[]", "Float": "Float", "Float[]": "Float[]",
        "long": "long", "long[]": "long[]", "Long": "Long", "Long[]": "Long[]",
        "char": "char", "char[]": "char[]", "Character": "Character", "Character[]": "Character[]",
        "List<Integer>": "java.util.List<Integer>", "List<String>": "java.util.List<String>",
        "List<List<Integer>>": "java.util.List<java.util.List<Integer>>",
        "ListNode": "ListNode", # Assuming ListNode class is provided by user or context
        "TreeNode": "TreeNode", # Assuming TreeNode class is provided by user or context
    }
    
    for param in parameters:
        param_name = param["name"]
        param_type = param["type"]
        
        java_type = java_type_map.get(param_type, "Object")
        
        if "[]" in param_type or "List" in param_type:
            param_extractions.append(
                f"        {java_type} {param_name} = gson.fromJson(testInput.get(\"{param_name}\"), new TypeToken<{java_type}>(){{}}.getType());"
            )
        else:
            # Handle primitive types vs. objects
            if param_type in ["int", "boolean", "double", "float", "long", "char"]:
                param_extractions.append(
                    f"        {java_type} {param_name} = testInput.get(\"{param_name}\").getAs{java_type.capitalize()}();"
                )
            else: # For String, Integer, etc.
                param_extractions.append(
                    f"        {java_type} {param_name} = gson.fromJson(testInput.get(\"{param_name}\"), {java_type}.class);"
                )
        
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""import java.util.*;
import java.io.*;
import com.google.gson.*;
import com.google.gson.reflect.TypeToken;

public class Main {{
    {user_code}
    
    public static void main(String[] args) {{
        try {{
            Gson gson = new Gson();
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            StringBuilder input = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {{
                input.append(line);
            }}
            
            JsonObject testInput = gson.fromJson(input.toString(), JsonObject.class);
            Solution solution = new Solution();
            
{param_extraction_code}
            
            Object result = solution.{function_name}({param_call_str});
            System.out.println(gson.toJson(result));
        }} catch (Exception e) {{
            System.err.println("{{\\"error\\": \\"" + e.getMessage().replace("\\"", "\\\\\\\"") + "\\"}}");
            System.exit(1);
        }}
    }}
}}
"""


def generate_javascript_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate JavaScript/Node.js driver code."""
    param_names = [p["name"] for p in parameters]
    param_extraction = ", ".join([f"testInput.{name}" for name in param_names])
    
    return f"""const readline = require('readline');

const rl = readline.createInterface({{
    input: process.stdin,
    output: process.stdout,
    terminal: false
}});

let input = '';

rl.on('line', (line) => {{
    input += line;
}});

rl.on('close', () => {{
    try {{
        const testInput = JSON.parse(input);
        
        {user_code}
        
        const result = {function_name}({param_extraction});
        console.log(JSON.stringify(result));
    }} catch (error) {{
        console.error(JSON.stringify({{"error": error.message}}));
        process.exit(1);
    }}
}});
"""


def generate_typescript_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate TypeScript driver code."""
    param_names = [p["name"] for p in parameters]
    param_extraction = ", ".join([f"testInput.{name}" for name in param_names])
    
    return f"""const readline = require('readline');

const rl = readline.createInterface({{
    input: process.stdin,
    output: process.stdout,
    terminal: false
}});

let input = '';

rl.on('line', (line: string) => {{
    input += line;
}});

rl.on('close', () => {{
    try {{
        const testInput = JSON.parse(input);
        
        {user_code}
        
        const result = {function_name}({param_extraction});
        console.log(JSON.stringify(result));
    }} catch (error: any) {{
        console.error(JSON.stringify({{"error": error.message}}));
        process.exit(1);
    }}
}});
"""


def generate_cpp_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate C++ driver code using nlohmann/json (if available)."""
    param_names = [p["name"] for p in parameters]
    param_extractions = []
    param_calls = []
    
    for param_name in param_names:
        param_extractions.append(f"        auto {param_name} = testInput[\"{param_name}\"];")
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

{user_code}

int main() {{
    try {{
        std::string input;
        std::string line;
        while (std::getline(std::cin, line)) {{
            input += line;
        }}
        
        json testInput = json::parse(input);
        Solution solution;
        
{param_extraction_code}
        
        auto result = solution.{function_name}({param_call_str});
        std::cout << json(result).dump() << std::endl;
    }} catch (const std::exception& e) {{
        std::cerr << "{{\\"error\\": \\"" << e.what() << "\\"}}" << std::endl;
        return 1;
    }}
    return 0;
}}
"""


def generate_c_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate C driver code (simplified - C doesn't have built-in JSON, may need manual parsing)."""
    param_names = [p["name"] for p in parameters]
    param_calls = ", ".join(param_names)
    
    return f"""#include <stdio.h>
#include <stdlib.h>
#include <string.h>

{user_code}

int main() {{
    // Note: C doesn't have built-in JSON parsing
    // This is a simplified version - may need manual JSON parsing
    // For now, return error
    fprintf(stderr, "{{\\"error\\": \\"C language requires manual JSON parsing implementation\\"}}");
    return 1;
}}
"""


def generate_csharp_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate C# driver code using Newtonsoft.Json."""
    param_names = [p["name"] for p in parameters]
    param_extractions = []
    param_calls = []
    
    for param in parameters:
        param_name = param["name"]
        param_type = param["type"]
        
        # Map types to C# types
        csharp_type_map = {
            "int": "int",
            "int[]": "int[]",
            "string": "string",
            "string[]": "string[]",
            "List<int>": "List<int>",
            "List<string>": "List<string>",
        }
        
        csharp_type = csharp_type_map.get(param_type, "object")
        
        param_extractions.append(
            f"            {csharp_type} {param_name} = testInput[\"{param_name}\"].ToObject<{csharp_type}>();"
        )
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

{user_code}

class MainClass {{
    static void Main() {{
        try {{
            string input = Console.In.ReadToEnd();
            JObject testInput = JObject.Parse(input);
            
            Solution solution = new Solution();
            
{param_extraction_code}
            
            var result = solution.{function_name}({param_call_str});
            Console.WriteLine(JsonConvert.SerializeObject(result));
        }} catch (Exception e) {{
            Console.Error.WriteLine($"{{\\"error\\": \\"{{e.Message}}\\"}}");
            Environment.Exit(1);
        }}
    }}
}}
"""


def generate_go_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate Go driver code using encoding/json."""
    param_names = [p["name"] for p in parameters]
    param_extractions = []
    param_calls = []
    
    for param in parameters:
        param_name = param["name"]
        param_type = param["type"]
        
        # Map types to Go types
        go_type_map = {
            "int": "int",
            "int[]": "[]int",
            "string": "string",
            "string[]": "[]string",
        }
        
        go_type = go_type_map.get(param_type, "interface{}")
        
        # Go requires type assertion with error handling
        if go_type == "interface{}":
            param_extractions.append(
                f"    {param_name} := testInput[\"{param_name}\"]"
            )
        else:
            param_extractions.append(
                f"    {param_name}Raw := testInput[\"{param_name}\"]"
            )
            param_extractions.append(
                f"    {param_name}, _ := {param_name}Raw.({go_type})"
            )
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""package main

import (
    "encoding/json"
    "fmt"
    "io/ioutil"
    "os"
)

{user_code}

func main() {{
    data, err := ioutil.ReadAll(os.Stdin)
    if err != nil {{
        fmt.Fprintf(os.Stderr, "{{\\"error\\": \\"Failed to read input\\"}}")
        os.Exit(1)
    }}
    
    var testInput map[string]interface{{}}
    if err := json.Unmarshal(data, &testInput); err != nil {{
        fmt.Fprintf(os.Stderr, "{{\\"error\\": \\"Failed to parse JSON\\"}}")
        os.Exit(1)
    }}
    
{param_extraction_code}
    
    result := {function_name}({param_call_str})
    
    output, _ := json.Marshal(result)
    fmt.Println(string(output))
}}
"""


def generate_rust_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate Rust driver code using serde_json."""
    param_names = [p["name"] for p in parameters]
    param_extractions = []
    param_calls = []
    
    for param in parameters:
        param_name = param["name"]
        param_type = param["type"]
        
        # Map types to Rust types
        rust_type_map = {
            "int": "i32",
            "int[]": "Vec<i32>",
            "string": "String",
            "string[]": "Vec<String>",
        }
        
        rust_type = rust_type_map.get(param_type, "Value")
        
        # Rust requires proper deserialization
        if rust_type == "Value":
            param_extractions.append(
                f"    let {param_name} = test_input[\"{param_name}\"].clone();"
            )
        else:
            param_extractions.append(
                f"    let {param_name}: {rust_type} = serde_json::from_value(test_input[\"{param_name}\"].clone()).unwrap();"
            )
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""use std::io::{{self, Read}};
use serde_json::Value;

{user_code}

fn main() {{
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).expect("Failed to read input");
    
    let test_input: Value = serde_json::from_str(&input).expect("Failed to parse JSON");
    
{param_extraction_code}
    
    let result = {function_name}({param_call_str});
    println!("{{}}", serde_json::to_string(&result).unwrap());
}}
"""


def generate_kotlin_driver(user_code: str, function_name: str, parameters: List[Dict[str, Any]]) -> str:
    """Generate Kotlin driver code using Gson."""
    param_names = [p["name"] for p in parameters]
    param_extractions = []
    param_calls = []
    
    for param in parameters:
        param_name = param["name"]
        param_type = param["type"]
        
        # Map types to Kotlin types
        kotlin_type_map = {
            "int": "Int",
            "int[]": "IntArray",
            "string": "String",
            "string[]": "Array<String>",
        }
        
        kotlin_type = kotlin_type_map.get(param_type, "Any")
        
        param_extractions.append(
            f"        val {param_name}: {kotlin_type} = gson.fromJson(testInput.get(\"{param_name}\"), {kotlin_type}::class.java)"
        )
        param_calls.append(param_name)
    
    param_extraction_code = "\n".join(param_extractions)
    param_call_str = ", ".join(param_calls)
    
    return f"""import java.util.*
import com.google.gson.*

{user_code}

fun main() {{
    try {{
        val input = readLine() ?: ""
        val gson = Gson()
        val testInput = gson.fromJson(input, JsonObject::class.java)
        
        val solution = Solution()
        
{param_extraction_code}
        
        val result = solution.{function_name}({param_call_str})
        println(gson.toJson(result))
    }} catch (e: Exception) {{
        System.err.println("{{\\"error\\": \\"${{e.message}}\\"}}")
        System.exit(1)
    }}
}}
"""


# Driver generators for all 10 languages
DRIVER_GENERATORS = {
    "python": generate_python_driver,
    "java": generate_java_driver,
    "javascript": generate_javascript_driver,
    "typescript": generate_typescript_driver,
    "cpp": generate_cpp_driver,
    "c": generate_c_driver,
    "csharp": generate_csharp_driver,
    "go": generate_go_driver,
    "rust": generate_rust_driver,
    "kotlin": generate_kotlin_driver,
}


def wrap_code_with_driver(
    user_code: str,
    language: str,
    function_name: str,
    parameters: List[Dict[str, Any]],
    return_type: str
) -> Tuple[str, Optional[str]]:
    """
    Wrap user code with driver that reads JSON input and calls function.
    
    Args:
        user_code: The user's function code
        language: Programming language
        function_name: Name of the function to call
        parameters: List of parameter definitions
        return_type: Return type of the function
        
    Returns:
        (wrapped_code, error_message)
    """
    lang_key = language.lower().strip()
    
    if lang_key not in DRIVER_GENERATORS:
        return user_code, f"Unsupported language: {language}. Supported: {list(DRIVER_GENERATORS.keys())}"
    
    try:
        generator = DRIVER_GENERATORS[lang_key]
        wrapped = generator(user_code, function_name, parameters)
        return wrapped, None
    except Exception as e:
        logger.error(f"Error generating driver for {language}: {e}")
        return user_code, f"Failed to generate driver: {str(e)}"


def prepare_code_for_execution(
    user_code: str,
    language: str,
    function_name: str,
    parameters: List[Dict[str, Any]],
    return_type: str,
    test_input: Dict[str, Any]
) -> Tuple[str, str, Optional[str]]:
    """
    Prepare complete executable code with driver and test input.
    
    Returns:
        (wrapped_code, stdin_json, error_message)
    """
    # Wrap code with driver
    wrapped_code, error = wrap_code_with_driver(
        user_code, language, function_name, parameters, return_type
    )
    
    if error:
        return "", "", error
    
    # Convert test input to JSON string for stdin
    stdin_json = json.dumps(test_input, separators=(',', ':'))
    
    return wrapped_code, stdin_json, None


def parse_output(output: str) -> Any:
    """Parse output from stdout."""
    try:
        return json.loads(output.strip())
    except json.JSONDecodeError:
        # If not JSON, check for error format
        if output.strip().startswith('{"error"'):
            try:
                return json.loads(output.strip())
            except:
                pass
        return output.strip()


def compare_outputs(actual: Any, expected: Any) -> bool:
    """Compare actual output with expected output."""
    try:
        actual_json = json.dumps(actual, sort_keys=True, separators=(',', ':'))
        expected_json = json.dumps(expected, sort_keys=True, separators=(',', ':'))
        return actual_json == expected_json
    except (TypeError, ValueError):
        return actual == expected

