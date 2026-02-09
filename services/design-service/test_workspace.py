"""
Test script to verify Penpot workspace creation
Run this to test the backend directly
"""

import requests
import json

BASE_URL = "http://localhost:3006/api/v1/design"

def test_health():
    """Test if backend is running"""
    print("=" * 60)
    print("TEST 1: Health Check")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:3006/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        print("✅ Backend is running!\n")
        return True
    except Exception as e:
        print(f"❌ Backend is not running: {e}\n")
        return False

def test_question_generation():
    """Test question generation"""
    print("=" * 60)
    print("TEST 2: Question Generation")
    print("=" * 60)
    
    try:
        payload = {
            "role": "ui_designer",
            "difficulty": "intermediate",
            "task_type": "dashboard",
            "topic": "food delivery",
            "created_by": "test_script"
        }
        
        response = requests.post(
            f"{BASE_URL}/questions/generate",
            json=payload,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Question ID: {data.get('_id') or data.get('id')}")
            print(f"Title: {data.get('title')}")
            print(f"Time Limit: {data.get('time_limit_minutes')} minutes")
            print("✅ Question generated successfully!\n")
            return data.get('_id') or data.get('id')
        else:
            print(f"❌ Failed: {response.text}\n")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return None

def test_workspace_creation(question_id):
    """Test workspace creation"""
    print("=" * 60)
    print("TEST 3: Workspace Creation")
    print("=" * 60)
    
    try:
        payload = {
            "user_id": "test_user_123",
            "assessment_id": "test_assessment_456",
            "question_id": question_id
        }
        
        print(f"Creating workspace for question: {question_id}")
        
        response = requests.post(
            f"{BASE_URL}/workspace/create",
            json=payload,
            timeout=60
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Session ID: {data.get('session_id')}")
            print(f"Workspace URL: {data.get('workspace_url')}")
            print(f"Session Token: {data.get('session_token')}")
            print(f"Time Limit: {data.get('time_limit_minutes')} minutes")
            print("\n✅ Workspace created successfully!")
            print(f"\n🎨 Open this URL in your browser:")
            print(f"   {data.get('workspace_url')}\n")
            return True
        else:
            print(f"❌ Failed: {response.text}\n")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("DESIGN WORKSPACE CREATION TEST")
    print("=" * 60 + "\n")
    
    # Test 1: Health check
    if not test_health():
        print("❌ Backend is not running. Start it with: python main.py")
        return
    
    # Test 2: Generate question
    question_id = test_question_generation()
    if not question_id:
        print("❌ Question generation failed")
        return
    
    # Test 3: Create workspace
    success = test_workspace_creation(question_id)
    
    if success:
        print("=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print("\nYou can now:")
        print("1. Open the workspace URL in your browser")
        print("2. Test the frontend at: http://localhost:3003/design/test-direct")
        print("=" * 60 + "\n")
    else:
        print("=" * 60)
        print("❌ TESTS FAILED")
        print("=" * 60)
        print("\nCheck the backend logs for errors")
        print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
