"""
View all candidates who took a specific question
Shows each candidate's screenshots and events
"""

from pymongo import MongoClient
from datetime import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client['aptor_design']

def view_candidates_for_question(question_id):
    """View all candidates who took a specific question"""
    
    print(f"\n{'='*80}")
    print(f"📝 QUESTION: {question_id}")
    print(f"{'='*80}\n")
    
    # Get all sessions for this question
    sessions = list(db.design_sessions.find({"question_id": question_id}))
    
    if not sessions:
        print("❌ No candidates found for this question!")
        return
    
    print(f"✅ Found {len(sessions)} candidates who took this question\n")
    print(f"{'='*80}\n")
    
    for i, session in enumerate(sessions, 1):
        session_id = session.get('session_id')
        user_id = session.get('user_id', 'Unknown')
        started_at = session.get('started_at', 'N/A')
        ended_at = session.get('ended_at', 'N/A')
        
        print(f"👤 CANDIDATE {i}")
        print(f"   User ID: {user_id}")
        print(f"   Session ID: {session_id}")
        print(f"   Started: {started_at}")
        print(f"   Ended: {ended_at}")
        
        # Get screenshot count
        screenshot_count = db.screenshots.count_documents({"session_id": session_id})
        print(f"   📸 Screenshots: {screenshot_count}")
        
        # Get event count and stats
        events = list(db.events.find({"session_id": session_id}))
        total_clicks = sum(1 for e in events if e.get("type") == "click")
        total_undo = sum(1 for e in events if e.get("type") == "undo")
        total_redo = sum(1 for e in events if e.get("type") == "redo")
        total_idle = sum(e.get("idle_seconds", 0) for e in events if e.get("type") == "idle")
        
        print(f"   🎯 Events: {len(events)} total")
        print(f"      - Clicks: {total_clicks}")
        print(f"      - Undo: {total_undo}")
        print(f"      - Redo: {total_redo}")
        print(f"      - Idle time: {total_idle}s")
        
        # Get submission if exists
        submission = db.design_submissions.find_one({"session_id": session_id})
        if submission:
            score = submission.get('final_score', 'N/A')
            print(f"   ⭐ Final Score: {score}/100")
        else:
            print(f"   ⏳ Status: Not submitted yet")
        
        print(f"\n   🔗 View this candidate's data:")
        print(f"      python view_single_candidate.py {session_id}")
        print(f"\n{'-'*80}\n")


def list_questions_with_candidates():
    """List all questions and how many candidates took each"""
    
    print(f"\n{'='*80}")
    print(f"📋 ALL QUESTIONS WITH CANDIDATE COUNTS")
    print(f"{'='*80}\n")
    
    # Get all unique question_ids from sessions
    pipeline = [
        {"$group": {
            "_id": "$question_id",
            "candidate_count": {"$sum": 1}
        }},
        {"$sort": {"candidate_count": -1}}
    ]
    
    results = list(db.design_sessions.aggregate(pipeline))
    
    if not results:
        print("❌ No sessions found!")
        return
    
    for i, result in enumerate(results, 1):
        question_id = result['_id']
        candidate_count = result['candidate_count']
        
        # Get question details
        question = db.design_questions.find_one({"_id": question_id})
        title = question.get('title', 'Unknown') if question else 'Unknown'
        
        print(f"{i}. Question: {title}")
        print(f"   ID: {question_id}")
        print(f"   👥 Candidates: {candidate_count}")
        print(f"   🔗 View: python view_candidates_for_question.py {question_id}")
        print(f"{'-'*80}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # View specific question
        question_id = sys.argv[1]
        view_candidates_for_question(question_id)
    else:
        # List all questions
        list_questions_with_candidates()
        print(f"\n💡 TIP: To view candidates for a specific question:")
        print(f"   python view_candidates_for_question.py <question_id>")
