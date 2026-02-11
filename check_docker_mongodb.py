"""
Check MongoDB data in Docker container
This script connects to the MongoDB running inside Docker
"""
import subprocess
import json

print("\n" + "="*80)
print("📊 DOCKER MONGODB DATA CHECK")
print("="*80 + "\n")

def run_mongo_command(command):
    """Run a MongoDB command in the Docker container"""
    try:
        result = subprocess.run(
            ["docker", "exec", "aptor-mongo-1", "mongosh", "--quiet", "--eval", command],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error: {e.stderr}")
        return None

# Check sessions
sessions_count = run_mongo_command("db.getSiblingDB('aptor_design').design_sessions.countDocuments({})")
print(f"✅ design_sessions: {sessions_count} documents")

if sessions_count and int(sessions_count) > 0:
    sessions_data = run_mongo_command(
        "db.getSiblingDB('aptor_design').design_sessions.find({}, {session_id: 1, user_id: 1, question_id: 1, _id: 0}).limit(5).toArray()"
    )
    if sessions_data:
        print(f"   Recent sessions:")
        # Parse and display
        try:
            sessions = eval(sessions_data)  # Simple eval for demo
            for i, s in enumerate(sessions, 1):
                print(f"   {i}. session_id: {s.get('session_id')}, user: {s.get('user_id')}, question: {s.get('question_id')}")
        except:
            print(f"   {sessions_data}")

# Check screenshots
screenshots_count = run_mongo_command("db.getSiblingDB('aptor_design').screenshots.countDocuments({})")
print(f"\n✅ screenshots: {screenshots_count} documents")

if screenshots_count and int(screenshots_count) > 0:
    screenshots_data = run_mongo_command(
        "db.getSiblingDB('aptor_design').screenshots.find({}, {session_id: 1, timestamp: 1, _id: 0}).limit(3).toArray()"
    )
    if screenshots_data:
        print(f"   Recent screenshots:")
        try:
            screenshots = eval(screenshots_data)
            for i, s in enumerate(screenshots, 1):
                print(f"   {i}. session_id: {s.get('session_id')}, timestamp: {s.get('timestamp')}")
        except:
            print(f"   {screenshots_data}")

# Check events
events_count = run_mongo_command("db.getSiblingDB('aptor_design').events.countDocuments({})")
print(f"\n✅ events: {events_count} documents")

if events_count and int(events_count) > 0:
    events_data = run_mongo_command(
        "db.getSiblingDB('aptor_design').events.find({}, {session_id: 1, type: 1, _id: 0}).limit(3).toArray()"
    )
    if events_data:
        print(f"   Recent events:")
        try:
            events = eval(events_data)
            for i, e in enumerate(events, 1):
                print(f"   {i}. session_id: {e.get('session_id')}, type: {e.get('type')}")
        except:
            print(f"   {events_data}")

# Check submissions
submissions_count = run_mongo_command("db.getSiblingDB('aptor_design').design_submissions.countDocuments({})")
print(f"\n✅ design_submissions: {submissions_count} documents")

if submissions_count and int(submissions_count) > 0:
    submissions_data = run_mongo_command(
        "db.getSiblingDB('aptor_design').design_submissions.find({}, {session_id: 1, final_score: 1, _id: 0}).limit(3).toArray()"
    )
    if submissions_data:
        print(f"   Recent submissions:")
        try:
            submissions = eval(submissions_data)
            for i, sub in enumerate(submissions, 1):
                print(f"   {i}. session_id: {sub.get('session_id')}, score: {sub.get('final_score')}")
        except:
            print(f"   {submissions_data}")

print("\n" + "="*80 + "\n")
