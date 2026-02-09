#!/usr/bin/env python3
"""
Development startup script for Design Service
Handles environment setup and service initialization
"""

import os
import sys
import asyncio
import subprocess
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are available"""
    print("🔍 Checking dependencies...")
    
    try:
        import fastapi
        import motor
        import pydantic
        print("✅ Core dependencies available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def setup_environment():
    """Setup development environment"""
    print("🔧 Setting up environment...")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_file.exists() and env_example.exists():
        print("📝 Creating .env from template...")
        with open(env_example) as src, open(env_file, 'w') as dst:
            content = src.read()
            # Set development defaults
            content = content.replace("DEBUG=true", "DEBUG=true")
            content = content.replace("your_openai_api_key_here", os.getenv("OPENAI_API_KEY", ""))
            dst.write(content)
        print("✅ Environment file created")
    
    # Load environment variables
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
        print("✅ Environment variables loaded")

def check_services():
    """Check if required services are running"""
    print("🔍 Checking required services...")
    
    services = {
        "MongoDB": ("localhost", 27017),
        "Redis": ("localhost", 6379),
        "MinIO": ("localhost", 9000),
        "Penpot": ("localhost", 9001)
    }
    
    available_services = []
    for name, (host, port) in services.items():
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                print(f"✅ {name} is running on {host}:{port}")
                available_services.append(name)
            else:
                print(f"⚠️  {name} not available on {host}:{port}")
        except Exception:
            print(f"❌ Could not check {name}")
    
    return available_services

def start_service():
    """Start the design service"""
    print("🚀 Starting Design Service...")
    
    try:
        # Import and run the main application
        from main import app
        import uvicorn
        
        port = int(os.getenv("PORT", 3006))
        debug = os.getenv("DEBUG", "true").lower() == "true"
        
        print(f"🌐 Service will be available at http://localhost:{port}")
        print("📚 API documentation at http://localhost:{port}/docs")
        print("❤️  Health check at http://localhost:{port}/health")
        print("\n🔥 Press Ctrl+C to stop the service\n")
        
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            reload=debug,
            log_level="info" if not debug else "debug"
        )
        
    except KeyboardInterrupt:
        print("\n👋 Service stopped by user")
    except Exception as e:
        print(f"❌ Failed to start service: {e}")
        return False
    
    return True

def main():
    """Main startup routine"""
    print("🎨 Design Service Development Startup")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Setup environment
    setup_environment()
    
    # Check services
    available_services = check_services()
    
    if "MongoDB" not in available_services:
        print("\n⚠️  MongoDB is required but not running.")
        print("Start it with: docker-compose up -d mongo")
        
        response = input("\nContinue anyway? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print("\n" + "=" * 50)
    
    # Start service
    success = start_service()
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()