"""
Complete Candidate Data Viewer
Shows EVERYTHING: sessions, submissions, screenshots, events
"""
import subprocess
import sys
import re
from datetime import datetime

def run_query(query):
    try:
        result = subprocess.run(
            ["docker", "exec", "aptor-mongo-1", "mongosh", "--quiet", "--eval", query],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except:
        return None

if len(sys.argv) < 2:
    print("\n" + "="*80)
    print("📊 COMPLETE CANDIDATE DATA VIEWER")
    print("="*80)
    print("\nUsage: python view_complete_candidate_data.py <question_id>")
    print("Example: python view_complete_candidate_data.py 6985870673fb356c3c67c03c")
    print("\nOr view specific session:")
    print("python view_complete_candidate_data.py session <session_mongodb_id>")
    sys.exit(1)

if sys.argv[1] == "session":
    # View specific session
    session_id = sys.argv[2]
    
    print("\n" + "="*80)
    print(f"📊 COMPLETE DATA FOR SESSION: {session_id}")
    print("="*80 + "\n")
    
    # Get session details
    session_query = f"""
    db.getSiblingDB('aptor_design').design_sessions.findOne(
        {{_id: ObjectId('{session_id}')}},
        {{_id: 1, session_id: 1, user_id: 1, question_id: 1, started_at: 1, ended_at: 1, file_id: 1}}
    )
    """
    session_data = run_query(session_query)
    
    if not session_data or session_data == 'null':
        print("❌ Session not found!")
        sys.exit(1)
    
    print("📋 SESSION DETAILS:")
    print(session_data)
    print()
    
    # Get submission
    submission_query = f"""
    db.getSiblingDB('aptor_design').design_submissions.findOne(
        {{session_id: '{session_id}'}},
        {{final_score: 1, rule_based_score: 1, ai_based_score: 1, feedback: 1, submitted_at: 1}}
    )
    """
    submission_data = run_query(submission_query)
    
    print("📝 SUBMISSION:")
    if submission_data and submission_data != 'null':
        print(submission_data)
    else:
        print("❌ No submission yet")
    print()
    
    # Get screenshots
    screenshot_query = f"""
    db.getSiblingDB('aptor_design').screenshots.find(
        {{session_id: '{session_id}'}},
        {{timestamp: 1, file_size: 1, created_at: 1}}
    ).sort({{created_at: 1}}).toArray()
    """
    screenshot_data = run_query(screenshot_query)
    
    screenshot_count_query = f"""
    db.getSiblingDB('aptor_design').screenshots.countDocuments({{session_id: '{session_id}'}})
    """
    screenshot_count = run_query(screenshot_count_query)
    
    print(f"📸 SCREENSHOTS: {screenshot_count if screenshot_count else 0}")
    if screenshot_data and screenshot_data != '[]':
        print(screenshot_data[:500] + "..." if len(screenshot_data) > 500 else screenshot_data)
    print()
    
    # Get events
    event_query = f"""
    db.getSiblingDB('aptor_design').events.find(
        {{session_id: '{session_id}'}},
        {{type: 1, timestamp: 1, x: 1, y: 1, idle_seconds: 1}}
    ).sort({{timestamp: 1}}).toArray()
    """
    event_data = run_query(event_query)
    
    event_count_query = f"""
    db.getSiblingDB('aptor_design').events.countDocuments({{session_id: '{session_id}'}})
    """
    event_count = run_query(event_count_query)
    
    print(f"🎯 EVENTS: {event_count if event_count else 0}")
    if event_data and event_data != '[]':
        print(event_data[:500] + "..." if len(event_data) > 500 else event_data)
    print()
    
    # Event breakdown
    event_breakdown_query = f"""
    db.getSiblingDB('aptor_design').events.aggregate([
        {{$match: {{session_id: '{session_id}'}}}},
        {{$group: {{_id: '$type', count: {{$sum: 1}}}}}}
    ]).toArray()
    """
    event_breakdown = run_query(event_breakdown_query)
    
    if event_breakdown and event_breakdown != '[]':
        print("📊 EVENT BREAKDOWN:")
        print(event_breakdown)
    
    print("\n" + "="*80 + "\n")
    sys.exit(0)

# View all candidates for a question
question_id = sys.argv[1]

print("\n" + "="*80)
print(f"📊 ALL CANDIDATES FOR QUESTION: {question_id}")
print("="*80 + "\n")

# Get all sessions
sessions_query = f"""
db.getSiblingDB('aptor_design').design_sessions.find(
    {{question_id: '{question_id}'}},
    {{_id: 1, session_id: 1, user_id: 1, started_at: 1, ended_at: 1}}
).sort({{started_at: -1}}).toArray()
"""

sessions_data = run_query(sessions_query)

if not sessions_data or sessions_data == '[]':
    print("❌ No candidates found for this question!")
    sys.exit(0)

# Parse sessions
session_ids = re.findall(r"_id: ObjectId\('([^']+)'\)", sessions_data)
user_ids = re.findall(r"user_id: '([^']+)'", sessions_data)

print(f"✅ Found {len(session_ids)} candidates\n")

for i, (session_mongo_id, user_id) in enumerate(zip(session_ids, user_ids), 1):
    print(f"\n{'─'*80}")
    print(f"👤 CANDIDATE #{i}: {user_id}")
    print(f"{'─'*80}")
    print(f"Session ID: {session_mongo_id}")
    
    # Get submission
    submission_query = f"""
    db.getSiblingDB('aptor_design').design_submissions.findOne(
        {{session_id: '{session_mongo_id}'}},
        {{final_score: 1, rule_based_score: 1, ai_based_score: 1, submitted_at: 1}}
    )
    """
    submission_data = run_query(submission_query)
    
    if submission_data and submission_data != 'null':
        score_match = re.search(r"final_score: ([\d.]+)", submission_data)
        rule_match = re.search(r"rule_based_score: ([\d.]+)", submission_data)
        ai_match = re.search(r"ai_based_score: ([\d.]+)", submission_data)
        
        if score_match:
            print(f"\n📊 SCORE: {score_match.group(1)}/100")
            if rule_match and ai_match:
                print(f"   Rule-based: {rule_match.group(1)}")
                print(f"   AI-based: {ai_match.group(1)}")
    else:
        print(f"\n📊 SCORE: Not submitted yet")
    
    # Count screenshots
    screenshot_count_query = f"""
    db.getSiblingDB('aptor_design').screenshots.countDocuments({{session_id: '{session_mongo_id}'}})
    """
    screenshot_count = run_query(screenshot_count_query)
    
    print(f"\n📸 SCREENSHOTS: {screenshot_count if screenshot_count else 0}")
    
    # If screenshots exist, show first one
    if screenshot_count and int(screenshot_count) > 0:
        screenshot_sample_query = f"""
        db.getSiblingDB('aptor_design').screenshots.findOne(
            {{session_id: '{session_mongo_id}'}},
            {{timestamp: 1, file_size: 1}}
        )
        """
        screenshot_sample = run_query(screenshot_sample_query)
        if screenshot_sample:
            timestamp_match = re.search(r"timestamp: '([^']+)'", screenshot_sample)
            size_match = re.search(r"file_size: (\d+)", screenshot_sample)
            if timestamp_match:
                print(f"   First screenshot: {timestamp_match.group(1)}")
            if size_match:
                size_kb = int(size_match.group(1)) / 1024
                print(f"   File size: {size_kb:.1f} KB")
    
    # Count events
    event_count_query = f"""
    db.getSiblingDB('aptor_design').events.countDocuments({{session_id: '{session_mongo_id}'}})
    """
    event_count = run_query(event_count_query)
    
    print(f"\n🎯 EVENTS: {event_count if event_count else 0}")
    
    # Event breakdown
    if event_count and int(event_count) > 0:
        event_breakdown_query = f"""
        db.getSiblingDB('aptor_design').events.aggregate([
            {{$match: {{session_id: '{session_mongo_id}'}}}},
            {{$group: {{_id: '$type', count: {{$sum: 1}}}}}}
        ]).toArray()
        """
        event_breakdown = run_query(event_breakdown_query)
        
        if event_breakdown:
            click_match = re.search(r"_id: 'click'.*?count: (\d+)", event_breakdown)
            undo_match = re.search(r"_id: 'undo'.*?count: (\d+)", event_breakdown)
            redo_match = re.search(r"_id: 'redo'.*?count: (\d+)", event_breakdown)
            idle_match = re.search(r"_id: 'idle'.*?count: (\d+)", event_breakdown)
            
            breakdown_parts = []
            if click_match:
                breakdown_parts.append(f"Clicks: {click_match.group(1)}")
            if undo_match:
                breakdown_parts.append(f"Undo: {undo_match.group(1)}")
            if redo_match:
                breakdown_parts.append(f"Redo: {redo_match.group(1)}")
            if idle_match:
                breakdown_parts.append(f"Idle: {idle_match.group(1)}")
            
            if breakdown_parts:
                print(f"   {', '.join(breakdown_parts)}")
    
    print(f"\n💡 View complete data: python view_complete_candidate_data.py session {session_mongo_id}")

print(f"\n{'='*80}\n")
print(f"📊 SUMMARY:")
print(f"   Total Candidates: {len(session_ids)}")
print(f"   Question ID: {question_id}")
print(f"\n💡 To view detailed data for a specific candidate:")
print(f"   python view_complete_candidate_data.py session <session_id>")
print()
