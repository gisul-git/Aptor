"""
View all candidates who took a specific question
Works with Docker MongoDB
"""
import subprocess
import sys
import json

def run_mongo_query(query):
    """Run MongoDB query in Docker container"""
    try:
        result = subprocess.run(
            ["docker", "exec", "aptor-mongo-1", "mongosh", "--quiet", "--eval", query],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error: {e.stderr}")
        return None

if len(sys.argv) < 2:
    print("Usage: python view_candidates_working.py <question_id>")
    print("Example: python view_candidates_working.py 6985870673fb356c3c67c03c")
    sys.exit(1)

question_id = sys.argv[1]

print(f"\n{'='*80}")
print(f"📊 CANDIDATES FOR QUESTION: {question_id}")
print(f"{'='*80}\n")

# Get all sessions for this question
query = f"""
db.getSiblingDB('aptor_design').design_sessions.find(
    {{question_id: '{question_id}'}},
    {{_id: 1, session_id: 1, user_id: 1, started_at: 1, ended_at: 1}}
).sort({{started_at: -1}}).toArray()
"""

sessions_data = run_mongo_query(query)
if not sessions_data or sessions_data == '[]':
    print("❌ No candidates found for this question!")
    sys.exit(0)

print(f"✅ Found candidates!\n")

# Parse sessions (simple approach)
try:
    # Extract session info manually
    import re
    
    # Find all ObjectIds
    session_ids = re.findall(r"_id: ObjectId\('([^']+)'\)", sessions_data)
    user_ids = re.findall(r"user_id: '([^']+)'", sessions_data)
    
    if not session_ids:
        print("Could not parse session data")
        print(sessions_data)
        sys.exit(1)
    
    print(f"Total Candidates: {len(session_ids)}\n")
    
    for i, (session_mongo_id, user_id) in enumerate(zip(session_ids, user_ids), 1):
        print(f"\n{'─'*80}")
        print(f"Candidate #{i}")
        print(f"{'─'*80}")
        print(f"User ID: {user_id}")
        print(f"Session MongoDB ID: {session_mongo_id}")
        
        # Get submission for this session
        submission_query = f"""
        db.getSiblingDB('aptor_design').design_submissions.findOne(
            {{session_id: '{session_mongo_id}'}},
            {{final_score: 1, rule_based_score: 1, ai_based_score: 1, submitted_at: 1}}
        )
        """
        submission_data = run_mongo_query(submission_query)
        
        if submission_data and submission_data != 'null':
            # Extract score
            score_match = re.search(r"final_score: ([\d.]+)", submission_data)
            if score_match:
                score = score_match.group(1)
                print(f"Final Score: {score}/100")
                
                rule_match = re.search(r"rule_based_score: ([\d.]+)", submission_data)
                ai_match = re.search(r"ai_based_score: ([\d.]+)", submission_data)
                if rule_match and ai_match:
                    print(f"  - Rule-based: {rule_match.group(1)}")
                    print(f"  - AI-based: {ai_match.group(1)}")
        else:
            print(f"Final Score: Not submitted yet")
        
        # Count screenshots
        screenshot_query = f"""
        db.getSiblingDB('aptor_design').screenshots.countDocuments(
            {{session_id: '{session_mongo_id}'}}
        )
        """
        screenshot_count = run_mongo_query(screenshot_query)
        print(f"Screenshots: {screenshot_count if screenshot_count else 0}")
        
        # Count events
        event_query = f"""
        db.getSiblingDB('aptor_design').events.countDocuments(
            {{session_id: '{session_mongo_id}'}}
        )
        """
        event_count = run_mongo_query(event_query)
        print(f"Events: {event_count if event_count else 0}")
        
        # Get event breakdown
        if event_count and int(event_count) > 0:
            event_breakdown_query = f"""
            db.getSiblingDB('aptor_design').events.aggregate([
                {{$match: {{session_id: '{session_mongo_id}'}}}},
                {{$group: {{_id: '$type', count: {{$sum: 1}}}}}}
            ]).toArray()
            """
            event_breakdown = run_mongo_query(event_breakdown_query)
            if event_breakdown:
                print(f"Event Breakdown:")
                # Parse event types
                click_match = re.search(r"_id: 'click'.*?count: (\d+)", event_breakdown)
                undo_match = re.search(r"_id: 'undo'.*?count: (\d+)", event_breakdown)
                redo_match = re.search(r"_id: 'redo'.*?count: (\d+)", event_breakdown)
                idle_match = re.search(r"_id: 'idle'.*?count: (\d+)", event_breakdown)
                
                if click_match:
                    print(f"  - Clicks: {click_match.group(1)}")
                if undo_match:
                    print(f"  - Undo: {undo_match.group(1)}")
                if redo_match:
                    print(f"  - Redo: {redo_match.group(1)}")
                if idle_match:
                    print(f"  - Idle periods: {idle_match.group(1)}")

    print(f"\n{'='*80}\n")
    
except Exception as e:
    print(f"Error parsing data: {e}")
    print("\nRaw data:")
    print(sessions_data)
