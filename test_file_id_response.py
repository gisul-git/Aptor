"""
Quick test to verify file_id is returned in API response
"""

import requests
import json

BASE_URL = "http://localhost:3006/api/v1/design"

def test_workspace_creation():
    """Test that workspace creation returns file_id"""
    
    print("=" * 60)
    print("Testing Workspace Creation API Response")
    print("=" * 60)
    
    # Step 1: Generate question
    print("\n1. Generating question...")
    question_payload = {
        "role": "ui_designer",
        "difficulty": "intermediate",
        "task_type": "dashboard",
        "topic": "food delivery",
        "created_by": "test"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/questions/generate",
            json=question_payload,
            timeout=30
        )
        response.raise_for_status()
        question = response.json()
        question_id = question.get("_id") or question.get("id")
        print(f"   ✅ Question generated: {question_id}")
    except Exception as e:
        print(f"   ❌ Failed to generate question: {e}")
        return
    
    # Step 2: Create workspace
    print("\n2. Creating workspace...")
    workspace_payload = {
        "user_id": f"test_user_{question_id[:8]}",
        "assessment_id": "test_assessment",
        "question_id": question_id
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/workspace/create",
            json=workspace_payload,
            timeout=60
        )
        response.raise_for_status()
        workspace = response.json()
        
        print(f"   ✅ Workspace created successfully")
        print("\n" + "=" * 60)
        print("API RESPONSE:")
        print("=" * 60)
        print(json.dumps(workspace, indent=2))
        print("=" * 60)
        
        # Verify file_id is present
        print("\n3. Verifying response fields...")
        
        required_fields = [
            "session_id",
            "workspace_url",
            "session_token",
            "file_id",
            "project_id",
            "question",
            "time_limit_minutes"
        ]
        
        all_present = True
        for field in required_fields:
            if field in workspace:
                value = workspace[field]
                if field == "file_id":
                    print(f"   ✅ {field}: {value}")
                    if value and value != "N/A":
                        print(f"      🎉 File ID is valid!")
                    else:
                        print(f"      ❌ File ID is invalid: {value}")
                        all_present = False
                elif field == "workspace_url":
                    print(f"   ✅ {field}: {value[:50]}...")
                elif field == "question":
                    print(f"   ✅ {field}: [object]")
                else:
                    print(f"   ✅ {field}: {value}")
            else:
                print(f"   ❌ {field}: MISSING")
                all_present = False
        
        print("\n" + "=" * 60)
        if all_present:
            print("✅ ALL FIELDS PRESENT - API IS WORKING CORRECTLY!")
            print("=" * 60)
            print("\n🎉 You can now test in browsers:")
            print("   1. Open: http://localhost:3001/test-workspace.html")
            print("   2. File ID should be displayed (not 'N/A')")
            print("   3. Open in two browsers to test isolation")
        else:
            print("❌ SOME FIELDS MISSING - API NEEDS FIXING")
            print("=" * 60)
        
    except Exception as e:
        print(f"   ❌ Failed to create workspace: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response.text}")

if __name__ == "__main__":
    test_workspace_creation()
