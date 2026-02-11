"""
View designs by candidate when multiple candidates take the same test
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def list_candidates_by_question(question_id):
    """
    List all candidates who took a specific question
    
    Args:
        question_id: The question ID
    """
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["aptor_design"]
    
    # Get question details
    question = await db.design_questions.find_one({"_id": question_id})
    if not question:
        print(f"❌ Question {question_id} not found")
        return
    
    print("=" * 80)
    print(f"📋 QUESTION: {question.get('title')}")
    print(f"   Role: {question.get('role')} | Difficulty: {question.get('difficulty')}")
    print("=" * 80)
    print()
    
    # Get all sessions for this question
    sessions = await db.design_sessions.find({"question_id": question_id}).to_list(length=None)
    
    if not sessions:
        print("❌ No candidates have taken this test yet")
        return
    
    print(f"👥 TOTAL CANDIDATES: {len(sessions)}\n")
    
    # For each candidate, get their info
    for idx, session in enumerate(sessions, 1):
        session_id = session.get("_id")
        user_id = session.get("user_id", "Unknown")
        started = session.get("started_at", "N/A")
        ended = session.get("ended_at", "N/A")
        
        # Count screenshots
        screenshot_count = await db.screenshots.count_documents({"session_id": session_id})
        
        # Count events
        event_count = await db.events.count_documents({"session_id": session_id})
        
        # Get submission if exists
        submission = await db.design_submissions.find_one({"session_id": session_id})
        if submission:
            score = submission.get("final_score", "N/A")
            status = "✅ Submitted"
        else:
            score = "N/A"
            status = "⏳ In Progress" if not ended else "❌ Not Submitted"
        
        print(f"{'─' * 80}")
        print(f"CANDIDATE #{idx}: {user_id}")
        print(f"{'─' * 80}")
        print(f"  Session ID: {session_id}")
        print(f"  Status: {status}")
        print(f"  Score: {score}/100" if score != "N/A" else f"  Score: {score}")
        print(f"  Started: {started}")
        print(f"  Ended: {ended}")
        print(f"  Screenshots: {screenshot_count}")
        print(f"  Events: {event_count}")
        print()
        
        # Show command to view this candidate's screenshots
        print(f"  📸 View screenshots:")
        print(f"     python view_candidate_designs.py screenshots {session_id}")
        print()
    
    client.close()


async def view_candidate_screenshots(session_id):
    """
    View all screenshots for a specific candidate
    
    Args:
        session_id: The session ID
    """
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["aptor_design"]
    
    # Get session info
    session = await db.design_sessions.find_one({"_id": session_id})
    if not session:
        print(f"❌ Session {session_id} not found")
        return
    
    user_id = session.get("user_id", "Unknown")
    question_id = session.get("question_id")
    
    # Get question
    question = await db.design_questions.find_one({"_id": question_id})
    question_title = question.get("title", "Unknown") if question else "Unknown"
    
    print("=" * 80)
    print(f"👤 CANDIDATE: {user_id}")
    print(f"📋 QUESTION: {question_title}")
    print(f"🔗 SESSION: {session_id}")
    print("=" * 80)
    print()
    
    # Get all screenshots
    screenshots = await db.screenshots.find({"session_id": session_id}).sort("timestamp", 1).to_list(length=None)
    
    if not screenshots:
        print("❌ No screenshots found for this candidate")
        return
    
    print(f"📸 TOTAL SCREENSHOTS: {len(screenshots)}\n")
    
    # List all screenshots
    for idx, screenshot in enumerate(screenshots, 1):
        timestamp = screenshot.get("timestamp", "N/A")
        file_size = screenshot.get("file_size", 0)
        screenshot_id = screenshot.get("_id")
        
        print(f"Screenshot #{idx}")
        print(f"  ID: {screenshot_id}")
        print(f"  Time: {timestamp}")
        print(f"  Size: {file_size:,} bytes ({file_size/1024:.2f} KB)")
        print()
    
    print("=" * 80)
    print("💡 TO VIEW SCREENSHOTS IN MONGODB COMPASS:")
    print("=" * 80)
    print(f"1. Open 'screenshots' collection")
    print(f"2. Filter: {{'session_id': '{session_id}'}}")
    print(f"3. Click any screenshot document")
    print(f"4. Copy the 'image_data' field value")
    print(f"5. Paste in browser address bar")
    print(f"6. Press Enter to view the image")
    print()
    
    # Get submission results
    submission = await db.design_submissions.find_one({"session_id": session_id})
    if submission:
        print("=" * 80)
        print("📊 EVALUATION RESULTS:")
        print("=" * 80)
        print(f"  Final Score: {submission.get('final_score', 'N/A')}/100")
        print(f"  Rule-Based: {submission.get('rule_based_score', 'N/A')}/100")
        print(f"  AI-Based: {submission.get('ai_based_score', 'N/A')}/100")
        print()
        
        feedback = submission.get('feedback', {})
        if feedback:
            print("  Feedback:")
            print(f"    Overall: {feedback.get('overall', 'N/A')}")
            
            strengths = feedback.get('strengths', [])
            if strengths:
                print(f"    Strengths: {', '.join(strengths)}")
            
            improvements = feedback.get('improvements', [])
            if improvements:
                print(f"    Improvements: {', '.join(improvements)}")
    
    client.close()


async def list_all_questions():
    """List all questions with candidate counts"""
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["aptor_design"]
    
    print("=" * 80)
    print("📋 ALL QUESTIONS")
    print("=" * 80)
    print()
    
    questions = await db.design_questions.find().to_list(length=None)
    
    if not questions:
        print("❌ No questions found")
        return
    
    for idx, question in enumerate(questions, 1):
        question_id = question.get("_id")
        title = question.get("title", "Untitled")
        role = question.get("role", "N/A")
        difficulty = question.get("difficulty", "N/A")
        
        # Count candidates who took this question
        candidate_count = await db.design_sessions.count_documents({"question_id": question_id})
        
        print(f"{idx}. {title}")
        print(f"   ID: {question_id}")
        print(f"   Role: {role} | Difficulty: {difficulty}")
        print(f"   👥 Candidates: {candidate_count}")
        print()
        
        if candidate_count > 0:
            print(f"   📸 View all candidates:")
            print(f"      python view_candidate_designs.py question {question_id}")
            print()
    
    client.close()


async def main():
    """Main function"""
    import sys
    
    if len(sys.argv) < 2:
        print("=" * 80)
        print("🎨 DESIGN ASSESSMENT - VIEW CANDIDATE DESIGNS")
        print("=" * 80)
        print()
        print("USAGE:")
        print()
        print("  1. List all questions:")
        print("     python view_candidate_designs.py list")
        print()
        print("  2. View all candidates for a question:")
        print("     python view_candidate_designs.py question <question_id>")
        print()
        print("  3. View specific candidate's screenshots:")
        print("     python view_candidate_designs.py screenshots <session_id>")
        print()
        print("EXAMPLE:")
        print("  python view_candidate_designs.py list")
        print("  python view_candidate_designs.py question 698ad0f0772b7671c846d17f")
        print("  python view_candidate_designs.py screenshots 698ad415903a53da6f59527b")
        print()
        return
    
    command = sys.argv[1]
    
    if command == "list":
        await list_all_questions()
    elif command == "question":
        if len(sys.argv) < 3:
            print("❌ Please provide question_id")
            print("Usage: python view_candidate_designs.py question <question_id>")
        else:
            await list_candidates_by_question(sys.argv[2])
    elif command == "screenshots":
        if len(sys.argv) < 3:
            print("❌ Please provide session_id")
            print("Usage: python view_candidate_designs.py screenshots <session_id>")
        else:
            await view_candidate_screenshots(sys.argv[2])
    else:
        print(f"❌ Unknown command: {command}")
        print("Valid commands: list, question, screenshots")


if __name__ == "__main__":
    asyncio.run(main())
