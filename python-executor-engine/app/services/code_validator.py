"""Security validation for user code."""
import re
import ast
from typing import Optional, Tuple


class CodeValidator:
    """Validates user code for security violations."""
    
    # Dangerous patterns to block
    FORBIDDEN_PATTERNS = [
        (r'import\s+os\s*$', 'os module - File and system operations'),
        (r'from\s+os\s+import', 'os module - File and system operations'),
        (r'import\s+subprocess', 'subprocess module - Process execution'),
        (r'from\s+subprocess\s+import', 'subprocess module - Process execution'),
        (r'import\s+sys\s*$', 'sys module - System-specific parameters'),
        (r'from\s+sys\s+import', 'sys module - System-specific parameters'),
        (r'import\s+shutil', 'shutil module - File operations'),
        (r'from\s+shutil\s+import', 'shutil module - File operations'),
        (r'import\s+pickle', 'pickle module - Unsafe deserialization'),
        (r'from\s+pickle\s+import', 'pickle module - Unsafe deserialization'),
        (r'import\s+eval', 'eval function - Code execution'),
        (r'import\s+exec', 'exec function - Code execution'),
        (r'import\s+compile', 'compile function - Code compilation'),
        (r'__import__\s*\(', '__import__ function - Dynamic imports'),
        (r'open\s*\(', 'open() function - File I/O'),
        (r'file\s*\(', 'file() function - File I/O'),
        (r'eval\s*\(', 'eval() function - Code execution'),
        (r'exec\s*\(', 'exec() function - Code execution'),
        (r'compile\s*\(', 'compile() function - Code compilation'),
        (r'execfile\s*\(', 'execfile() function - Code execution'),
        (r'input\s*\(', 'input() function - User input'),
        (r'raw_input\s*\(', 'raw_input() function - User input'),
        (r'__builtins__', '__builtins__ - Built-in functions access'),
        (r'__file__', '__file__ - File path access'),
        (r'__import__', '__import__ - Dynamic imports'),
        (r'import\s+ctypes', 'ctypes module - C library access'),
        (r'from\s+ctypes\s+import', 'ctypes module - C library access'),
        (r'import\s+socket', 'socket module - Network access'),
        (r'from\s+socket\s+import', 'socket module - Network access'),
        (r'import\s+urllib', 'urllib module - Network access'),
        (r'from\s+urllib\s+import', 'urllib module - Network access'),
        (r'import\s+requests', 'requests module - HTTP requests'),
        (r'from\s+requests\s+import', 'requests module - HTTP requests'),
        (r'import\s+http', 'http module - HTTP operations'),
        (r'from\s+http\s+import', 'http module - HTTP operations'),
        (r'import\s+ftplib', 'ftplib module - FTP access'),
        (r'from\s+ftplib\s+import', 'ftplib module - FTP access'),
        (r'import\s+sqlite3', 'sqlite3 module - Database access'),
        (r'from\s+sqlite3\s+import', 'sqlite3 module - Database access'),
        (r'import\s+multiprocessing', 'multiprocessing module - Process creation'),
        (r'from\s+multiprocessing\s+import', 'multiprocessing module - Process creation'),
        (r'import\s+threading', 'threading module - Thread creation'),
        (r'from\s+threading\s+import', 'threading module - Thread creation'),
        (r'import\s+signal', 'signal module - Signal handling'),
        (r'from\s+signal\s+import', 'signal module - Signal handling'),
        (r'import\s+resource', 'resource module - Resource limits'),
        (r'from\s+resource\s+import', 'resource module - Resource limits'),
        (r'import\s+platform', 'platform module - Platform info'),
        (r'from\s+platform\s+import', 'platform module - Platform info'),
        (r'import\s+pwd', 'pwd module - User database'),
        (r'from\s+pwd\s+import', 'pwd module - User database'),
        (r'import\s+grp', 'grp module - Group database'),
        (r'from\s+grp\s+import', 'grp module - Group database'),
    ]
    
    # Allowed imports (whitelist)
    ALLOWED_IMPORTS = [
        'json', 'math', 'collections', 'itertools', 'functools',
        'operator', 'heapq', 'bisect', 'array', 'decimal',
        'fractions', 'statistics', 'random', 'string', 're',
        'datetime', 'time', 'copy', 'enum', 'typing', 'dataclasses',
        'abc', 'contextlib', 'types', 'inspect', 'warnings',
        'io', 'codecs', 'unicodedata', 'textwrap', 'difflib',
        'hashlib', 'hmac', 'secrets', 'base64', 'binascii',
        'struct', 'zlib', 'gzip', 'bz2', 'lzma', 'zipfile',
        'tarfile', 'csv', 'configparser', 'netrc', 'xdrlib',
        'plistlib', 'shelve', 'dbm', 'sqlite3',  # sqlite3 is allowed for in-memory only
    ]
    
    MAX_CODE_SIZE_KB = 50
    
    @staticmethod
    def validate(code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate code for security violations.
        
        Args:
            code: User's code string
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check code size (< 50KB)
        code_size_kb = len(code.encode('utf-8')) / 1024
        if code_size_kb > CodeValidator.MAX_CODE_SIZE_KB:
            return False, f"Code size ({code_size_kb:.2f} KB) exceeds maximum allowed size ({CodeValidator.MAX_CODE_SIZE_KB} KB)"
        
        # Check for empty code
        if not code or not code.strip():
            return False, "Code cannot be empty"
        
        # Check for if __name__ == '__main__' (user should not provide this)
        if re.search(r'if\s+__name__\s*==\s*[\'"]__main__[\'"]', code):
            return False, "User code must not contain 'if __name__ == \"__main__\"' block"
        
        # Check for function definition
        if not re.search(r'def\s+\w+\s*\(', code):
            return False, "User code must contain at least one function definition"
        
        # Check syntax first
        try:
            ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {str(e)}"
        except Exception as e:
            return False, f"Code parsing error: {str(e)}"
        
        # Check for forbidden patterns
        for pattern, description in CodeValidator.FORBIDDEN_PATTERNS:
            if re.search(pattern, code, re.MULTILINE):
                return False, f"Security violation: {description}"
        
        # Validate imports using AST
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if not CodeValidator._is_allowed_import(alias.name):
                            return False, f"Security violation: Import of '{alias.name}' is not allowed"
                elif isinstance(node, ast.ImportFrom):
                    if node.module and not CodeValidator._is_allowed_import(node.module):
                        return False, f"Security violation: Import from '{node.module}' is not allowed"
        except Exception:
            # If AST parsing fails, fall back to regex (already checked above)
            pass
        
        # Check for dangerous built-in usage
        dangerous_builtins = ['eval', 'exec', 'compile', '__import__', 'open', 'file', 'input', 'raw_input']
        for builtin in dangerous_builtins:
            # Check for direct calls (not just mentions in strings/comments)
            pattern = rf'\b{re.escape(builtin)}\s*\('
            if re.search(pattern, code):
                return False, f"Security violation: Use of '{builtin}()' is not allowed"
        
        return True, None
    
    @staticmethod
    def _is_allowed_import(module_name: str) -> bool:
        """Check if an import is allowed."""
        # Check exact match
        if module_name in CodeValidator.ALLOWED_IMPORTS:
            return True
        
        # Check if it's a submodule of an allowed import
        for allowed in CodeValidator.ALLOWED_IMPORTS:
            if module_name.startswith(allowed + '.'):
                return True
        
        # Block all other imports
        return False

