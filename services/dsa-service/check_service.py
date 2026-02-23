"""
Quick diagnostic script to check if DSA service can start properly
"""
import sys
import os
import asyncio

# Add the service directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def check_service():
    """Check if the service can be imported and initialized"""
    print("=" * 60)
    print("DSA Service Diagnostic Check")
    print("=" * 60)
    
    errors = []
    
    # 1. Check Python version
    print("\n1. Checking Python version...")
    print(f"   Python {sys.version}")
    if sys.version_info < (3, 8):
        errors.append("Python 3.8+ required")
        print("   ❌ Python version too old")
    else:
        print("   ✅ Python version OK")
    
    # 2. Check imports
    print("\n2. Checking imports...")
    try:
        from app.api.v1.dsa.routers import admin
        print("   ✅ Admin router imported")
    except Exception as e:
        errors.append(f"Admin router import failed: {e}")
        print(f"   ❌ Admin router import failed: {e}")
    
    try:
        from app.api.v1.dsa.services.ai_generator import generate_question
        print("   ✅ AI generator imported")
    except Exception as e:
        errors.append(f"AI generator import failed: {e}")
        print(f"   ❌ AI generator import failed: {e}")
    
    # 3. Check environment variables
    print("\n3. Checking environment variables...")
    from dotenv import load_dotenv
    load_dotenv()
    
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        print(f"   ✅ OPENAI_API_KEY is set (length: {len(openai_key)})")
    else:
        errors.append("OPENAI_API_KEY not set")
        print("   ⚠️  OPENAI_API_KEY is not set - AI generation will fail")
    
    mongo_uri = os.getenv("MONGODB_URI")
    if mongo_uri:
        print(f"   ✅ MONGODB_URI is set")
    else:
        print("   ⚠️  MONGODB_URI is not set")
    
    # 4. Check if service can be created
    print("\n4. Checking FastAPI app creation...")
    try:
        from main import app
        print("   ✅ FastAPI app created successfully")
        print(f"   ✅ App title: {app.title}")
        print(f"   ✅ App version: {app.version}")
    except Exception as e:
        errors.append(f"FastAPI app creation failed: {e}")
        print(f"   ❌ FastAPI app creation failed: {e}")
        import traceback
        traceback.print_exc()
    
    # 5. Check router registration
    print("\n5. Checking router registration...")
    try:
        from main import app
        routes = []
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                methods = list(route.methods) if hasattr(route, 'methods') else []
                routes.append((route.path, methods))
        
        admin_routes = [(path, methods) for path, methods in routes if 'admin' in path]
        if admin_routes:
            print(f"   ✅ Found {len(admin_routes)} admin routes:")
            for path, methods in admin_routes:
                method_str = ', '.join(methods) if methods else 'ANY'
                print(f"      - [{method_str}] {path}")
            
            # Check specifically for generate-question
            generate_routes = [(path, methods) for path, methods in admin_routes if 'generate-question' in path]
            if generate_routes:
                print(f"\n   ✅ Found generate-question route:")
                for path, methods in generate_routes:
                    method_str = ', '.join(methods) if methods else 'ANY'
                    print(f"      - [{method_str}] {path}")
            else:
                errors.append("generate-question route not found")
                print("\n   ❌ generate-question route not found in admin routes")
        else:
            errors.append("No admin routes found")
            print("   ❌ No admin routes found")
    except Exception as e:
        errors.append(f"Router check failed: {e}")
        print(f"   ❌ Router check failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    if errors:
        print("❌ DIAGNOSTIC FAILED - Found errors:")
        for i, error in enumerate(errors, 1):
            print(f"   {i}. {error}")
        print("\n⚠️  Service may not start properly. Fix the errors above.")
        return False
    else:
        print("✅ DIAGNOSTIC PASSED - Service should start successfully")
        print("\n💡 To start the service, run:")
        print("   uvicorn main:app --host 0.0.0.0 --port 3004 --reload")
        return True

if __name__ == "__main__":
    success = asyncio.run(check_service())
    sys.exit(0 if success else 1)

