"""
Security utilities for code validation and sanitization.
"""

import ast
import re
import logging
from typing import List, Set, Tuple, Optional
from agent.config import Config

logger = logging.getLogger(__name__)

class SecurityError(Exception):
    """Raised when security check fails."""
    pass

def validate_code_security(code: str) -> Tuple[bool, Optional[str]]:
    """
    Validate code for security issues.
    
    Args:
        code: Python code to validate
        
    Returns:
        Tuple of (is_safe, error_message)
    """
    if not code:
        return True, None
    
    try:
        tree = ast.parse(code)
    except SyntaxError:
        # Syntax errors will be caught during execution
        return True, None
    
    # Check for dangerous imports and function calls
    dangerous_nodes = []
    
    for node in ast.walk(tree):
        # Check for dangerous imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _is_dangerous_import(alias.name):
                    dangerous_nodes.append(f"Dangerous import: {alias.name}")
        
        elif isinstance(node, ast.ImportFrom):
            if node.module and _is_dangerous_import(node.module):
                dangerous_nodes.append(f"Dangerous import from: {node.module}")
        
        # Check for dangerous function calls
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                if node.func.id in Config.BLOCKED_IMPORTS:
                    dangerous_nodes.append(f"Dangerous function call: {node.func.id}")
            elif isinstance(node.func, ast.Attribute):
                full_name = _get_full_name(node.func)
                if full_name in Config.BLOCKED_IMPORTS:
                    dangerous_nodes.append(f"Dangerous function call: {full_name}")
    
    if dangerous_nodes:
        return False, f"Security violation: {', '.join(dangerous_nodes)}"
    
    return True, None

def _is_dangerous_import(module_name: str) -> bool:
    """Check if an import is dangerous."""
    dangerous_modules = [
        'os', 'sys', 'subprocess', 'shutil', 'socket', 'urllib',
        'pickle', 'marshal', 'ctypes', '__builtin__', 'builtins'
    ]
    
    # Allow some safe uses
    safe_patterns = [
        r'^os\.path\.',
        r'^sys\.(version|platform|path)$',
    ]
    
    for pattern in safe_patterns:
        if re.match(pattern, module_name):
            return False
    
    return module_name.split('.')[0] in dangerous_modules

def _get_full_name(node: ast.Attribute) -> str:
    """Get full name of an attribute node."""
    parts = []
    current = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        parts.append(current.id)
    return '.'.join(reversed(parts))

def sanitize_pip_command(code: str) -> Tuple[str, bool]:
    """
    Sanitize pip install commands.
    
    Args:
        code: Code that may contain pip commands
        
    Returns:
        Tuple of (sanitized_code, was_pip_command)
    """
    if not Config.ALLOW_PIP_INSTALL:
        # Block all pip installs
        if '!pip' in code or '%pip' in code:
            raise SecurityError("pip install commands are not allowed")
        return code, False
    
    # If pip is allowed, check whitelist
    lines = code.split('\n')
    first_line = lines[0].strip()
    
    if first_line.startswith("!pip ") or first_line.startswith("%pip "):
        if Config.PIP_WHITELIST:
            # Extract package names and check against whitelist
            import shlex
            try:
                cmd = first_line.lstrip("!%")
                parts = shlex.split(cmd)
                if len(parts) >= 3 and parts[0] == "pip" and parts[1] == "install":
                    packages = parts[2:]
                    for package in packages:
                        # Remove version specifiers
                        pkg_name = re.split(r'[<>=!]', package)[0].strip()
                        if pkg_name not in Config.PIP_WHITELIST:
                            raise SecurityError(f"Package {pkg_name} is not in pip whitelist")
            except (ValueError, IndexError):
                pass  # Let it through, will fail during execution
    
    return code, True

