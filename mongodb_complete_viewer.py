"""
Complete MongoDB Data Viewer
Shows ALL data in MongoDB for design assessments
"""
import subprocess

def run_query(query):
    try:
        result = subprocess.run(
            ["docker", "exec", "aptor-mongo-1", "mongosh", "--quiet", "--eval", query],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

print("\n" + "="*100)
print("📊 COMPLETE MONGODB DATA VIEWER - DESIGN ASSESSMENT PLATFORM")
print("="*100 + "\n")

# 1. DESIGN SESSIONS
print("1️⃣  DESIGN SESSIONS")
print("─"*100)
sessions_query = """
db.getSiblingDB('aptor_design').design_sessions.aggregate([
    {
        $project: {
            _id: 1,
            user_id: 1,
            question_id: 1,
            session_id: 1,
            file_id: 1,
            started_at: 1,
            ended_at: 1
        }
    },
    {
        $sort: {started_at: -1}
    },
    {
        $limit: 10
    }
]).toArray()
"""
sessions = run_query(sessions_query)
print(sessions)
print()

# 2. DESIGN SUBMISSIONS
print("\n2️⃣  DESIGN SUBMISSIONS (with scores)")
print("─"*100)
submissions_query = """
db.getSiblingDB('aptor_design').design_submissions.aggregate([
    {
        $project: {
            _id: 1,
            session_id: 1,
            user_id: 1,
            question_id: 1,
            final_score: 1,
            rule_based_score: 1,
            ai_based_score: 1,
            submitted_at: 1
        }
    },
    {
        $sort: {submitted_at: -1}
    },
    {
        $limit: 10
    }
]).toArray()
"""
submissions = run_query(submissions_query)
print(submissions)
print()

# 3. SCREENSHOTS
print("\n3️⃣  SCREENSHOTS")
print("─"*100)
screenshots_query = """
db.getSiblingDB('aptor_design').screenshots.aggregate([
    {
        $group: {
            _id: '$session_id',
            count: {$sum: 1},
            first_timestamp: {$first: '$timestamp'},
            total_size: {$sum: '$file_size'}
        }
    },
    {
        $sort: {count: -1}
    },
    {
        $limit: 10
    }
]).toArray()
"""
screenshots = run_query(screenshots_query)
print(screenshots)

# Total screenshots
total_screenshots_query = """
db.getSiblingDB('aptor_design').screenshots.countDocuments({})
"""
total_screenshots = run_query(total_screenshots_query)
print(f"\nTotal Screenshots: {total_screenshots}")
print()

# 4. EVENTS
print("\n4️⃣  EVENTS")
print("─"*100)
events_query = """
db.getSiblingDB('aptor_design').events.aggregate([
    {
        $group: {
            _id: {
                session_id: '$session_id',
                type: '$type'
            },
            count: {$sum: 1}
        }
    },
    {
        $sort: {count: -1}
    },
    {
        $limit: 15
    }
]).toArray()
"""
events = run_query(events_query)
print(events)

# Total events
total_events_query = """
db.getSiblingDB('aptor_design').events.countDocuments({})
"""
total_events = run_query(total_events_query)
print(f"\nTotal Events: {total_events}")

# Event type breakdown
event_types_query = """
db.getSiblingDB('aptor_design').events.aggregate([
    {
        $group: {
            _id: '$type',
            count: {$sum: 1}
        }
    },
    {
        $sort: {count: -1}
    }
]).toArray()
"""
event_types = run_query(event_types_query)
print(f"\nEvent Types Breakdown:")
print(event_types)
print()

# 5. DESIGN QUESTIONS
print("\n5️⃣  DESIGN QUESTIONS")
print("─"*100)
questions_query = """
db.getSiblingDB('aptor_design').design_questions.find(
    {},
    {_id: 1, title: 1, role: 1, difficulty: 1, created_at: 1}
).sort({created_at: -1}).limit(5).toArray()
"""
questions = run_query(questions_query)
print(questions)
print()

# 6. SUMMARY STATISTICS
print("\n6️⃣  SUMMARY STATISTICS")
print("─"*100)

# Count all collections
stats = {
    "design_sessions": run_query("db.getSiblingDB('aptor_design').design_sessions.countDocuments({})"),
    "design_submissions": run_query("db.getSiblingDB('aptor_design').design_submissions.countDocuments({})"),
    "screenshots": total_screenshots,
    "events": total_events,
    "design_questions": run_query("db.getSiblingDB('aptor_design').design_questions.countDocuments({})")
}

for collection, count in stats.items():
    print(f"   {collection:25} : {count:>10} documents")

print()

# 7. SAMPLE SCREENSHOT DATA
print("\n7️⃣  SAMPLE SCREENSHOT (first 500 chars of image data)")
print("─"*100)
sample_screenshot_query = """
db.getSiblingDB('aptor_design').screenshots.findOne(
    {},
    {session_id: 1, timestamp: 1, file_size: 1, image_data: 1}
)
"""
sample_screenshot = run_query(sample_screenshot_query)
if sample_screenshot and sample_screenshot != 'null':
    # Show first 500 chars
    print(sample_screenshot[:500] + "..." if len(sample_screenshot) > 500 else sample_screenshot)
else:
    print("No screenshots found")
print()

# 8. SAMPLE EVENT DATA
print("\n8️⃣  SAMPLE EVENTS (last 5)")
print("─"*100)
sample_events_query = """
db.getSiblingDB('aptor_design').events.find(
    {},
    {session_id: 1, type: 1, timestamp: 1, x: 1, y: 1, idle_seconds: 1}
).sort({timestamp: -1}).limit(5).toArray()
"""
sample_events = run_query(sample_events_query)
print(sample_events)
print()

print("="*100)
print("\n💡 USAGE:")
print("   View candidates for question: python view_complete_candidate_data.py <question_id>")
print("   View specific session: python view_complete_candidate_data.py session <session_id>")
print("   Quick check: python quick_check.py")
print()
