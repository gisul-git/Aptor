"""
Test publish endpoint directly
"""

import requests

API_URL = "http://localhost:3006/api/v1/design"
question_id = "698dc4d0988067e56eb458ed"

print("Testing publish endpoint...")
print(f"URL: {API_URL}/questions/{question_id}/publish?is_published=true")
print()

try:
    response = requests.patch(
        f"{API_URL}/questions/{question_id}/publish?is_published=true",
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    print()
    
    if response.status_code == 200:
        print("✅ SUCCESS!")
    else:
        print("❌ FAILED!")
        
except Exception as e:
    print(f"❌ Error: {e}")
