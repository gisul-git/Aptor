#!/usr/bin/env python3
"""
Verify Design Competency Database - Check if everything is working
"""
from pymongo import MongoClient
from datetime import datetime, timedelta

# MongoDB connection
MONGODB_URL = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"

def verify_database():
    print("=" * 70)
    print("Design Competency Database Verification")
    print("=" * 70)
    
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URL)
        db = client.aptor_design_Competency
        
        print("\n✅ Connected to MongoDB: aptor_design_Competency")
        
        # 1. Check Questions
        print("\n" + "=" * 70)
        print("1. DESIGN QUESTIONS")
        print("=" * 70)
        
        questions = list(db.design_questions.find().limit(5))
        total_questions = db.design_questions.count_documents({})
        published_questions = db.design_questions.count_documents({"is_published": True})
        draft_questions = total_questions - published_questions
        
        print(f"Total Questions: {total_questions}")
        print(f"Published: {published_questions}")
        print(f"Draft: {draft_questions}")
        
        if questions:
            print(f"\nSample Question:")
            q = questions[0]
            print(f"  ID: {q.get('_id')}")
            print(f"  Title: {q.get('title')}")
            print(f"  Published: {q.get('is_published', False)}")
            print(f"  Has 'is_published' field: {'is_published' in q}")
        
        # 2. Check Tests
        print("\n" + "=" * 70)
        print("2. DESIGN TESTS")
        print("=" * 70)
        
        tests = list(db.design_tests.find().limit(5))
        total_tests = db.design_tests.count_documents({})
        published_tests = db.design_tests.count_documents({"is_published": True})
        
        print(f"Total Tests: {total_tests}")
        print(f"Published: {published_tests}")
        print(f"Draft: {total_tests - published_tests}")
        
        if tests:
            print(f"\nSample Test:")
            t = tests[0]
            print(f"  ID: {t.get('_id')}")
            print(f"  Title: {t.get('title')}")
            print(f"  Published: {t.get('is_published', False)}")
            print(f"  Has test_token: {'test_token' in t}")
            print(f"  Candidates: {len(t.get('candidates', []))}")
        
        # 3. Check Sessions
        print("\n" + "=" * 70)
        print("3. DESIGN SESSIONS")
        print("=" * 70)
        
        total_sessions = db.design_sessions.count_documents({})
        recent_sessions = list(db.design_sessions.find().sort("created_at", -1).limit(3))
        
        print(f"Total Sessions: {total_sessions}")
        
        if recent_sessions:
            print(f"\nRecent Sessions:")
            for i, s in enumerate(recent_sessions, 1):
                print(f"\n  Session {i}:")
                print(f"    ID: {s.get('_id')}")
                print(f"    User: {s.get('user_id')}")
                print(f"    File ID: {s.get('file_id')}")
                print(f"    Created: {s.get('created_at')}")
                print(f"    Ended: {s.get('ended_at', 'In Progress')}")
        
        # 4. Check Submissions
        print("\n" + "=" * 70)
        print("4. DESIGN SUBMISSIONS")
        print("=" * 70)
        
        total_submissions = db.design_submissions.count_documents({})
        recent_submissions = list(db.design_submissions.find().sort("created_at", -1).limit(3))
        
        print(f"Total Submissions: {total_submissions}")
        
        if recent_submissions:
            print(f"\nRecent Submissions:")
            for i, sub in enumerate(recent_submissions, 1):
                print(f"\n  Submission {i}:")
                print(f"    ID: {sub.get('_id')}")
                print(f"    User: {sub.get('user_id')}")
                print(f"    Question: {sub.get('question_id')}")
                print(f"    Rule Score: {sub.get('rule_based_score', 0)}")
                print(f"    AI Score: {sub.get('ai_based_score', 0)}")
                print(f"    Final Score: {sub.get('final_score', 0)}")
                print(f"    Created: {sub.get('created_at')}")
        else:
            print("\n⚠️  No submissions found yet")
            print("   This is normal if no one has submitted a design yet")
        
        # 5. Check Events
        print("\n" + "=" * 70)
        print("5. EVENTS (Activity Tracking)")
        print("=" * 70)
        
        total_events = db.events.count_documents({})
        print(f"Total Events: {total_events}")
        
        if total_events > 0:
            event_types = db.events.aggregate([
                {"$group": {"_id": "$type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ])
            print("\nEvent Types:")
            for et in event_types:
                print(f"  {et['_id']}: {et['count']}")
        
        # 6. Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        
        print(f"\n✅ Database: aptor_design_Competency")
        print(f"✅ Questions: {total_questions} ({published_questions} published)")
        print(f"✅ Tests: {total_tests} ({published_tests} published)")
        print(f"✅ Sessions: {total_sessions}")
        print(f"✅ Submissions: {total_submissions}")
        print(f"✅ Events: {total_events}")
        
        # Check if is_published field exists
        has_is_published = db.design_questions.count_documents({"is_published": {"$exists": True}})
        print(f"\n✅ Questions with 'is_published' field: {has_is_published}/{total_questions}")
        
        if has_is_published == total_questions:
            print("✅ All questions have the is_published field!")
        else:
            print(f"⚠️  {total_questions - has_is_published} questions missing is_published field")
        
        print("\n" + "=" * 70)
        print("✅ Database verification complete!")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_database()
