"""
View a single candidate's complete data
Shows all screenshots and events for one candidate
"""

from pymongo import MongoClient
from datetime import datetime
import sys

client = MongoClient('mongodb://localhost:27017/')
db = client['aptor_design']

def view_candidate_data(session_id):
    """View complete data for a single candidate"""
    
    print(f"\n{'='*80}")
    print(f"👤 CANDIDATE DATA")
    print(f"{'='*80}\n")
    
    # Get session info
    session = db.design_sessions.find_one({"session_id": session_id})
    
    if not session:
        print(f"❌ Session not found: {session_id}")
        return
    
    user_id = session.get('user_id', 'Unknown')
    question_id = session.get('question_id', 'Unknown')
    started_at = session.get('started_at', 'N/A')
    ended_at = session.get('ended_at', 'N/A')
    
    print(f"Session ID: {session_id}")
    print(f"User ID: {user_id}")
    print(f"Question ID: {question_id}")
    print(f"Started: {started_at}")
    print(f"Ended: {ended_at}")
    print(f"\n{'-'*80}\n")
    
    # Get screenshots
    screenshots = list(db.screenshots.find({"session_id": session_id}).sort("created_at", 1))
    print(f"📸 SCREENSHOTS ({len(screenshots)} total)\n")
    
    if screenshots:
        for i, screenshot in enumerate(screenshots, 1):
            timestamp = screenshot.get('timestamp', 'N/A')
            created_at = screenshot.get('created_at', 'N/A')
            file_size = screenshot.get('file_size', 0)
            
            print(f"   {i}. Captured at: {timestamp}")
            print(f"      Created: {created_at}")
            print(f"      Size: {file_size} bytes")
            print(f"      MongoDB ID: {screenshot['_id']}")
            print()
    else:
        print("   No screenshots found\n")
    
    print(f"{'-'*80}\n")
    
    # Get events
    events = list(db.events.find({"session_id": session_id}).sort("timestamp", 1))
    print(f"🎯 EVENTS ({len(events)} total)\n")
    
    if events:
        # Calculate stats
        clicks = [e for e in events if e.get("type") == "click"]
        undos = [e for e in events if e.get("type") == "undo"]
        redos = [e for e in events if e.get("type") == "redo"]
        idles = [e for e in events if e.get("type") == "idle"]
        
        print(f"   📊 STATISTICS:")
        print(f"      Total Events: {len(events)}")
        print(f"      Clicks: {len(clicks)}")
        print(f"      Undo: {len(undos)}")
        print(f"      Redo: {len(redos)}")
        print(f"      Idle periods: {len(idles)}")
        
        if idles:
            total_idle = sum(e.get("idle_seconds", 0) for e in idles)
            print(f"      Total idle time: {total_idle}s")
        
        print(f"\n   📝 EVENT DETAILS:\n")
        
        for i, event in enumerate(events[:20], 1):  # Show first 20 events
            event_type = event.get('type', 'unknown')
            timestamp = event.get('timestamp', 'N/A')
            
            if event_type == 'click':
                x = event.get('x', 'N/A')
                y = event.get('y', 'N/A')
                target = event.get('target', 'N/A')
                print(f"   {i}. CLICK at ({x}, {y}) on {target} - {timestamp}")
            elif event_type == 'undo':
                print(f"   {i}. UNDO - {timestamp}")
            elif event_type == 'redo':
                print(f"   {i}. REDO - {timestamp}")
            elif event_type == 'idle':
                idle_sec = event.get('idle_seconds', 0)
                print(f"   {i}. IDLE for {idle_sec}s - {timestamp}")
        
        if len(events) > 20:
            print(f"\n   ... and {len(events) - 20} more events")
    else:
        print("   No events found\n")
    
    print(f"\n{'-'*80}\n")
    
    # Get submission
    submission = db.design_submissions.find_one({"session_id": session_id})
    
    if submission:
        print(f"📊 EVALUATION RESULTS\n")
        print(f"   Rule-based Score: {submission.get('rule_based_score', 'N/A')}/100")
        print(f"   AI-based Score: {submission.get('ai_based_score', 'N/A')}/100")
        print(f"   ⭐ Final Score: {submission.get('final_score', 'N/A')}/100")
        
        feedback = submission.get('feedback', {})
        if feedback:
            print(f"\n   💬 FEEDBACK:")
            for key, value in feedback.items():
                print(f"      {key}: {value}")
    else:
        print(f"⏳ SUBMISSION STATUS: Not submitted yet")
    
    print(f"\n{'='*80}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n❌ Usage: python view_single_candidate.py <session_id>")
        print("\n💡 TIP: Get session_id from view_candidates_for_question.py")
        sys.exit(1)
    
    session_id = sys.argv[1]
    view_candidate_data(session_id)
