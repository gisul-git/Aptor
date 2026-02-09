"""
Validate Design Service Setup
Simple validation without external dependencies
"""

import os
import sys

def validate_file_structure():
    """Validate that all required files exist"""
    print("🔍 Validating file structure...")
    
    required_files = [
        "main.py",
        "requirements.txt",
        "Dockerfile",
        ".env.example",
        "app/__init__.py",
        "app/models/design.py",
        "app/services/ai_question_generator.py",
        "app/services/penpot_service.py", 
        "app/services/evaluation_engine.py",
        "app/repositories/design_repository.py",
        "app/api/v1/design.py",
        "app/core/config.py",
        "app/db/mongo.py"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return False
    else:
        print("✅ All required files present")
        return True


def validate_imports():
    """Validate that imports work correctly"""
    print("\n🔍 Validating imports...")
    
    try:
        # Test basic imports
        sys.path.append('app')
        
        from app.models.design import DesignRole, DifficultyLevel, TaskType
        print("✅ Models import successfully")
        
        from app.core.config import Settings
        print("✅ Config import successfully")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False


def validate_docker_setup():
    """Validate Docker configuration"""
    print("\n🔍 Validating Docker setup...")
    
    if os.path.exists("Dockerfile"):
        with open("Dockerfile", "r") as f:
            content = f.read()
            
        if "python:3.11" in content:
            print("✅ Dockerfile uses Python 3.11")
        else:
            print("⚠️  Dockerfile may need Python version update")
            
        if "EXPOSE 3006" in content:
            print("✅ Dockerfile exposes correct port")
        else:
            print("❌ Dockerfile missing port configuration")
            
        return True
    else:
        print("❌ Dockerfile not found")
        return False


def validate_api_structure():
    """Validate API endpoint structure"""
    print("\n🔍 Validating API structure...")
    
    try:
        with open("app/api/v1/design.py", "r") as f:
            content = f.read()
        
        required_endpoints = [
            "/questions/generate",
            "/workspace/create", 
            "/submit",
            "/health"
        ]
        
        missing_endpoints = []
        for endpoint in required_endpoints:
            if endpoint not in content:
                missing_endpoints.append(endpoint)
        
        if missing_endpoints:
            print(f"❌ Missing endpoints: {missing_endpoints}")
            return False
        else:
            print("✅ All required endpoints present")
            return True
            
    except FileNotFoundError:
        print("❌ API file not found")
        return False


def main():
    """Run all validations"""
    print("🧪 Design Service Setup Validation")
    print("=" * 50)
    
    validations = [
        validate_file_structure,
        validate_imports,
        validate_docker_setup,
        validate_api_structure
    ]
    
    results = []
    for validation in validations:
        try:
            result = validation()
            results.append(result)
        except Exception as e:
            print(f"❌ Validation failed: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    
    if all(results):
        print("🎉 All validations passed! Design Service is ready.")
        print("\nNext steps:")
        print("1. Copy .env.example to .env and configure")
        print("2. Start dependencies: docker-compose up mongo redis minio penpot-*")
        print("3. Run service: python main.py")
        print("4. Test API: curl http://localhost:3006/health")
    else:
        print("❌ Some validations failed. Please fix the issues above.")
        
    return all(results)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)