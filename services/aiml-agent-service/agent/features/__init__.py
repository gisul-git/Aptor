"""
Agent features module.
Contains non-destructive feature additions.
"""

from .restart_kernel import restart_kernel
from .file_upload import handle_file_upload

__all__ = ['restart_kernel', 'handle_file_upload']

