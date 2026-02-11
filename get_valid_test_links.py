import requests
import json

# Get all questions from the backend
response = requests.get('http://localhost:3006/api/v1/design/questions')

if response.status_code == 200:
    questions = response.json()
    
    print(f"\n✅ Found {len(questions)} questions in the system\n")
    print("=" * 80)
    
    for i, q in enumerate(questions, 1):
        question_id = q.get('_id') or q.get('id')
        title = q.get('title', 'Untitled')
        difficulty = q.get('difficulty', 'N/A')
        role = q.get('role', 'N/A')
        
        print(f"\n📝 Question {i}:")
        print(f"   Title: {title}")
        print(f"   Role: {role}")
        print(f"   Difficulty: {difficulty}")
        print(f"   ID: {question_id}")
        print(f"\n   🔗 TEST LINK:")
        print(f"   http://localhost:3001/design/assessment/{question_id}")
        print("-" * 80)
    
    print(f"\n✅ All test links are ready to use!")
    print(f"\n💡 TIP: Open any of the above links in your browser to start the assessment")
    
else:
    print(f"❌ Failed to fetch questions: {response.status_code}")
    print(f"   Error: {response.text}")
