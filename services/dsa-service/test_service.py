"""
Quick test script to verify the DSA service can start and import all modules
"""
import sys
import os

# Add the service directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing imports...")
    from app.api.v1.dsa.routers import admin
    print("✅ Admin router imported successfully")
    
    from app.api.v1.dsa.services.ai_generator import generate_question
    print("✅ AI generator imported successfully")
    
    # Check for OpenAI API key
    from dotenv import load_dotenv
    load_dotenv()
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        print(f"✅ OPENAI_API_KEY is set (length: {len(openai_key)})")
    else:
        print("⚠️  OPENAI_API_KEY is not set - AI generation will fail")
    
    print("\n✅ All imports successful! Service should be able to start.")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

