"""
Helper script to find which candidate a screenshot belongs to
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def find_candidate_by_screenshot(screenshot_id=None, session_id=None):
    """
    Find candidate information from screenshot
    
    Args:
        screenshot_id: Screenshot document _id (optional)
        session_id: Session ID (optional)
    """
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["aptor_design"]
    
    print("🔍 Finding candidate information...\n")
    
    # If screenshot_id provided, get session_id first
    if screenshot_id:
        screenshot = await db.screenshots.find_one({"_id": screenshot_id})
        if not screenshot:
            print(f"❌ Screenshot {screenshot_id} not found")
            return
        session_id = screenshot.get("session_id")
        print(f"📸 Screenshot ID: {screenshot_id}")
        print(f"📅 Timestamp: {screenshot.get('timestamp')}")
        print(f"💾 File Size: {screenshot.get('file_size')} bytes")
        print(f"🔗 Session ID: {session_id}\n")
    
    # Get session information
    if session_id:
        session = await db.design_sessions.find_one({"_id": session_id})
        if not session:
            print(f"❌ Session {session_id} not found")
            return
        
        print("👤 CANDIDATE INFORMATION:")
        print(f"  User ID: {session.get('user_id')}")
        print(f"  Assessment ID: {session.get('assessment_id')}")
        print(f"  Question ID: {session.get('question_id')}")
        print(f"  Started: {session.get('started_at')}")
        print(f"  Ended: {session.get('ended_at')}")
        print()
        
        # Get question details
        question_id = session.get('question_id')
        if question_id:
            question = await db.design_questions.find_one({"_id": question_id})
            if question:
                print("📋 QUESTION DETAILS:")
                print(f"  Title: {question.get('title')}")
                print(f"  Role: {question.get('role')}")
                print(f"  Difficulty: {question.get('difficulty')}")
                print()
        
        # Get submission if exists
        submission = await db.design_submissions.find_one({"session_id": session_id})
        if submission:
            print("📊 SUBMISSION RESULTS:")
            print(f"  Final Score: {submission.get('final_score')}/100")
            print(f"  Rule-Based: {submission.get('rule_based_score')}/100")
            print(f"  AI-Based: {submission.get('ai_based_score')}/100")
            print()
        
        # Count screenshots and events for this session
        screenshot_count = await db.screenshots.count_documents({"session_id": session_id})
        event_count = await db.events.count_documents({"session_id": session_id})
        
        print("📈 SESSION STATISTICS:")
        print(f"  Total Screenshots: {screenshot_count}")
        print(f"  Total Events: {event_count}")
    
    client.close()


async def list_all_candidates_with_screenshots():
    """List all candidates who have screenshots"""
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["aptor_design"]
    
    print("📋 ALL CANDIDATES WITH SCREENSHOTS:\n")
    
    # Get all unique session_ids from screenshots
    pipeline = [
        {"$group": {
            "_id": "$session_id",
            "screenshot_count": {"$sum": 1},
            "first_screenshot": {"$min": "$timestamp"},
            "last_screenshot": {"$max": "$timestamp"}
        }}
    ]
    
    sessions = await db.screenshots.aggregate(pipeline).to_list(length=None)
    
    for idx, session_data in enumerate(sessions, 1):
        session_id = session_data["_id"]
        
        # Get session details
        session = await db.design_sessions.find_one({"_id": session_id})
        if session:
            user_id = session.get("user_id", "Unknown")
        else:
            user_id = "Unknown"
        
        # Get submission if exists
        submission = await db.design_submissions.find_one({"session_id": session_id})
        score = submission.get("final_score", "N/A") if submission else "N/A"
        
        print(f"{idx}. Session: {session_id}")
        print(f"   Candidate: {user_id}")
        print(f"   Screenshots: {session_data['screenshot_count']}")
        print(f"   First: {session_data['first_screenshot']}")
        print(f"   Last: {session_data['last_screenshot']}")
        print(f"   Score: {score}")
        print()
    
    client.close()


async def main():
    """Main function"""
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "list":
            await list_all_candidates_with_screenshots()
        elif sys.argv[1] == "session":
            if len(sys.argv) > 2:
                await find_candidate_by_screenshot(session_id=sys.argv[2])
            else:
                print("Usage: python find_candidate_screenshots.py session <session_id>")
        elif sys.argv[1] == "screenshot":
            if len(sys.argv) > 2:
                await find_candidate_by_screenshot(screenshot_id=sys.argv[2])
            else:
                print("Usage: python find_candidate_screenshots.py screenshot <screenshot_id>")
        else:
            print("Usage:")
            print("  python find_candidate_screenshots.py list")
            print("  python find_candidate_screenshots.py session <session_id>")
            print("  python find_candidate_screenshots.py screenshot <screenshot_id>")
    else:
        # Default: list all
        await list_all_candidates_with_screenshots()


if __name__ == "__main__":
    asyncio.run(main())
