"""
Configuration management for AIML Agent Service.
Supports environment variables with sensible defaults.
"""

import os
from typing import Optional

class Config:
    """Configuration class with environment variable support."""
    
    # Server Configuration 
    HOST: str = os.getenv('AGENT_HOST', '127.0.0.1')
    PORT: int = int(os.getenv('AGENT_PORT', '8889'))
    HEALTH_PORT: int = int(os.getenv('AGENT_HEALTH_PORT', '8080'))
    
    # Execution Configuration
    EXECUTION_TIMEOUT: int = int(os.getenv('EXECUTION_TIMEOUT', '120'))
    MAX_CODE_SIZE: int = int(os.getenv('MAX_CODE_SIZE', str(1024 * 1024)))  # 1MB
    MAX_OUTPUT_SIZE: int = int(os.getenv('MAX_OUTPUT_SIZE', str(10 * 1024 * 1024)))  # 10MB
    MAX_IMAGE_COUNT: int = int(os.getenv('MAX_IMAGE_COUNT', '10'))
    
    # Kernel Configuration
    KERNEL_IDLE_TIMEOUT: int = int(os.getenv('KERNEL_IDLE_TIMEOUT', '3600'))  # 1 hour
    KERNEL_MAX_LIFETIME: int = int(os.getenv('KERNEL_MAX_LIFETIME', '7200'))  # 2 hours
    MAX_KERNELS: int = int(os.getenv('MAX_KERNELS', '1000'))
    KERNEL_HEALTH_CHECK_INTERVAL: int = int(os.getenv('KERNEL_HEALTH_CHECK_INTERVAL', '60'))  # 60s
    
    # Session Configuration
    SESSION_IDLE_TIMEOUT: int = int(os.getenv('SESSION_IDLE_TIMEOUT', '1800'))  # 30 minutes
    SESSION_MAX_LIFETIME: int = int(os.getenv('SESSION_MAX_LIFETIME', '3600'))  # 1 hour
    
    # Security Configuration
    ALLOW_PIP_INSTALL: bool = os.getenv('ALLOW_PIP_INSTALL', 'false').lower() == 'true'
    PIP_WHITELIST: list = os.getenv('PIP_WHITELIST', '').split(',') if os.getenv('PIP_WHITELIST') else []
    BLOCKED_IMPORTS: list = [
        'os.system', 'subprocess', 'eval', 'exec', 'compile', '__import__',
        'open', 'file', 'input', 'raw_input', 'execfile'
    ]
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = int(os.getenv('MAX_FILE_SIZE', str(50 * 1024 * 1024)))  # 50MB
    ALLOWED_FILE_EXTENSIONS: list = os.getenv('ALLOWED_FILE_EXTENSIONS', '.csv,.json,.txt,.png,.jpg,.jpeg').split(',')
    UPLOAD_BASE_DIR: str = os.getenv('UPLOAD_BASE_DIR', 'uploads')
    
    # Validation Configuration
    SESSION_ID_PATTERN: str = r'^[a-zA-Z0-9_-]{1,100}$'
    RUN_ID_PATTERN: str = r'^[a-zA-Z0-9_-]{1,200}$'
    
    # Queue Configuration
    MAX_QUEUE_SIZE: int = int(os.getenv('MAX_QUEUE_SIZE', '1000'))
    QUEUE_TIMEOUT: int = int(os.getenv('QUEUE_TIMEOUT', '300'))  # 5 minutes
    
    # Connection Configuration
    MAX_CONNECTIONS: int = int(os.getenv('MAX_CONNECTIONS', '1000'))
    CONNECTION_TIMEOUT: int = int(os.getenv('CONNECTION_TIMEOUT', '300'))  # 5 minutes
    MAX_MESSAGE_SIZE: int = int(os.getenv('MAX_MESSAGE_SIZE', str(10 * 1024 * 1024)))  # 10MB
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT: str = os.getenv('LOG_FORMAT', 'json')  # 'json' or 'text'
    
    # Metrics Configuration
    ENABLE_METRICS: bool = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'
    METRICS_PORT: int = int(os.getenv('METRICS_PORT', '9090'))
    
    @classmethod
    def validate(cls) -> bool:
        """Validate configuration values."""
        if cls.MAX_CODE_SIZE <= 0:
            raise ValueError("MAX_CODE_SIZE must be positive")
        if cls.EXECUTION_TIMEOUT <= 0:
            raise ValueError("EXECUTION_TIMEOUT must be positive")
        if cls.MAX_KERNELS <= 0:
            raise ValueError("MAX_KERNELS must be positive")
        return True

