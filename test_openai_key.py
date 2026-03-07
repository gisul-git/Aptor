"""
Test OpenAI API Key directly
"""
import asyncio
from openai import AsyncOpenAI

async def test_api_key():
    api_key = "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"
    
    print(f"Testing API Key: {api_key[:20]}...{api_key[-10:]}")
    print(f"Key length: {len(api_key)}")
    
    try:
        client = AsyncOpenAI(api_key=api_key)
        
        print("\nSending test request to OpenAI...")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": "Say hello"}
            ],
            max_tokens=10
        )
        
        print("✅ SUCCESS! API Key is working!")
        print(f"Response: {response.choices[0].message.content}")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        print(f"\nError type: {type(e).__name__}")
        print(f"Error details: {str(e)}")
        return False

if __name__ == "__main__":
    asyncio.run(test_api_key())
