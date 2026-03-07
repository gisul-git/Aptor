"""
Test if config is loading correctly from .env
"""
import sys
sys.path.insert(0, 'services/design-service')

from app.core.config import settings

print("=== Configuration Loading Test ===\n")
print(f"AI_PROVIDER: {settings.AI_PROVIDER}")
print(f"AI_MODEL: {settings.AI_MODEL}")
print(f"OPENAI_API_KEY: {settings.OPENAI_API_KEY[:20]}...{settings.OPENAI_API_KEY[-10:] if settings.OPENAI_API_KEY else 'EMPTY'}")
print(f"Key length: {len(settings.OPENAI_API_KEY)}")
print(f"\nExpected key: sk-proj-Fha-hC-Z_P-_...LsWT8RaiAA")
print(f"Expected length: 164")

if settings.OPENAI_API_KEY == "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":
    print("\n✅ API Key matches!")
else:
    print("\n❌ API Key does NOT match!")
    print(f"Loaded: {settings.OPENAI_API_KEY}")
