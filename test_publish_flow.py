#!/usr/bin/env python3
"""
Test script to verify Design Question Publish/Unpublish flow
"""
import requests
import json

BASE_URL = "http://localhost:3007/api/v1/design"

def test_publish_flow():
    print("=" * 60)
    print("Testing Design Question Publish/Unpublish Flow")
    print("=" * 60)
    
    # 1. Get all questions
    print("\n1. Fetching all questions...")
    response = requests.get(f"{BASE_URL}/questions")
    if response.status_code != 200:
        print(f"❌ Failed to fetch questions: {response.status_code}")
        return
    
    questions = response.json()
    print(f"✅ Found {len(questions)} questions")
    
    if len(questions) == 0:
        print("❌ No questions found to test")
        return
    
    # Get first question
    test_question = questions[0]
    question_id = test_question.get('id') or test_question.get('_id')
    current_status = test_question.get('is_published', False)
    
    print(f"\n2. Testing with question: {test_question.get('title')}")
    print(f"   ID: {question_id}")
    print(f"   Current status: {'Published' if current_status else 'Draft'}")
    
    # 3. Toggle publish status
    new_status = not current_status
    print(f"\n3. Toggling publish status to: {'Published' if new_status else 'Draft'}")
    
    response = requests.patch(
        f"{BASE_URL}/questions/{question_id}/publish",
        params={"is_published": new_status}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to update publish status: {response.status_code}")
        print(f"   Response: {response.text}")
        return
    
    result = response.json()
    print(f"✅ Publish status updated successfully")
    print(f"   Response: {json.dumps(result, indent=2)}")
    
    # 4. Verify the change
    print(f"\n4. Verifying the change...")
    response = requests.get(f"{BASE_URL}/questions")
    if response.status_code != 200:
        print(f"❌ Failed to fetch questions: {response.status_code}")
        return
    
    questions = response.json()
    updated_question = next((q for q in questions if (q.get('id') or q.get('_id')) == question_id), None)
    
    if not updated_question:
        print(f"❌ Question not found after update")
        return
    
    verified_status = updated_question.get('is_published', False)
    if verified_status == new_status:
        print(f"✅ Status verified: {verified_status}")
    else:
        print(f"❌ Status mismatch! Expected: {new_status}, Got: {verified_status}")
        return
    
    # 5. Toggle back to original status
    print(f"\n5. Toggling back to original status: {'Published' if current_status else 'Draft'}")
    response = requests.patch(
        f"{BASE_URL}/questions/{question_id}/publish",
        params={"is_published": current_status}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to restore original status: {response.status_code}")
        return
    
    print(f"✅ Restored to original status")
    
    # 6. Count published vs draft questions
    print(f"\n6. Summary of all questions:")
    response = requests.get(f"{BASE_URL}/questions")
    questions = response.json()
    
    published_count = sum(1 for q in questions if q.get('is_published', False))
    draft_count = len(questions) - published_count
    
    print(f"   Total questions: {len(questions)}")
    print(f"   Published: {published_count}")
    print(f"   Draft: {draft_count}")
    
    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        test_publish_flow()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
