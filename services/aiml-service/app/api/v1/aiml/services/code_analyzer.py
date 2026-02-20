"""
Code Analyzer for AIML Evaluation
Uses AST parsing to verify actual code implementation
"""
import ast
from typing import List, Dict, Any, Set


class CodeAnalyzer:
    """Analyzes Python code using AST to verify actual implementation"""
    
    def __init__(self, source_code: str):
        self.source_code = source_code
        # Clean code: Remove pip install lines and other non-Python code
        cleaned_code = self._clean_code(source_code)
        try:
            self.tree = ast.parse(cleaned_code)
        except SyntaxError:
            self.tree = None
    
    def _clean_code(self, code: str) -> str:
        """Remove non-Python code that breaks AST parsing"""
        lines = code.split('\n')
        cleaned_lines = []
        skip_next = False
        
        for line in lines:
            stripped = line.strip()
            # Skip pip install lines
            if stripped.startswith('pip install'):
                continue
            # Skip shell commands
            if stripped.startswith('!') or stripped.startswith('%'):
                continue
            # Skip markdown cells
            if stripped.startswith('# ---') and 'Cell' in stripped:
                continue
            # Skip empty lines at start (but keep them later for formatting)
            cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)
    
    def get_imports(self) -> Set[str]:
        """Extract all imports from code"""
        if not self.tree:
            return set()
        
        imports = set()
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.add(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    if module:
                        imports.add(f"{module}.{alias.name}")
                    else:
                        imports.add(alias.name)
        return imports
    
    def get_function_calls(self) -> Set[str]:
        """Extract all function calls from code"""
        if not self.tree:
            return set()
        
        calls = set()
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    calls.add(node.func.attr)
                    # Also add full path for common patterns
                    if isinstance(node.func.value, ast.Name):
                        calls.add(f"{node.func.value.id}.{node.func.attr}")
        return calls
    
    def has_dataset_loading(self) -> bool:
        """Check if dataset loading code exists"""
        dataset_patterns = ['read_csv', 'read_excel', 'read_json', 'load_dataset', 'StringIO', 'read_parquet']
        calls = self.get_function_calls()
        source_lower = self.source_code.lower()
        # Check both AST calls and string patterns (for cases where AST parsing fails)
        return any(pattern in calls for pattern in dataset_patterns) or \
               any(pattern in source_lower for pattern in dataset_patterns)
    
    def has_model_training(self) -> bool:
        """Check if model training code exists (.fit())"""
        calls = self.get_function_calls()
        source_lower = self.source_code.lower()
        # Check both AST calls and string patterns
        return 'fit' in calls or '.fit(' in source_lower
    
    def has_cross_validation(self) -> bool:
        """Check if cross-validation code exists"""
        calls = self.get_function_calls()
        cv_patterns = ['cross_val_score', 'cross_validate', 'KFold', 'StratifiedKFold', 'cross_val']
        source_lower = self.source_code.lower()
        # Check both AST calls and string patterns
        return any(pattern in calls for pattern in cv_patterns) or \
               any(pattern in source_lower for pattern in cv_patterns)
    
    def verify_import(self, import_path: str) -> bool:
        """Check if specific import exists"""
        imports = self.get_imports()
        import_path_lower = import_path.lower()
        # Handle both full paths and partial matches
        # Check for exact match or module/class match
        for imp in imports:
            imp_lower = imp.lower()
            if import_path_lower in imp_lower or imp_lower in import_path_lower:
                return True
        
        # Also check source code directly (fallback for complex imports)
        source_lower = self.source_code.lower()
        # Normalize import path for checking (remove common prefixes)
        check_path = import_path_lower.replace('sklearn.', '').replace('sklearn', '')
        if check_path and check_path in source_lower:
            return True
        
        return False
    
    def verify_function_call(self, function_name: str) -> bool:
        """Check if specific function was called"""
        calls = self.get_function_calls()
        function_name_lower = function_name.lower()
        
        # Check exact match
        if function_name_lower in [c.lower() for c in calls]:
            return True
        
        # Check source code directly (fallback)
        source_lower = self.source_code.lower()
        return function_name_lower in source_lower
