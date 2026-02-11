"""
Quick check - Show all candidates and their scores
"""
import subprocess
import re

def run_query(query):
    try:
        result = subprocess.run(
            ["docker", "exec", "aptor-mongo-1", "mongosh", "--quiet", "--eval", query],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except:
        return None

print("\n" + "="*80)
print("📊 QUICK DATA CHECK - ALL CANDIDATES")
print("="*80 + "\n")

# Get all submissions with scores
query = """
db.getSiblingDB('aptor_design').design_submissions.aggregate([
    {
        $lookup: {
            from: 'design_sessions',
            localField: 'session_id',
            foreignField: '_id',
            as: 'session'
        }
    },
    {
        $project: {
            user_id: 1,
            question_id: 1,
            final_score: 1,
            rule_based_score: 1,
            ai_based_score: 1,
            submitted_at: 1,
            session_user: {$arrayElemAt: ['$session.user_id', 0]}
        }
    },
    {
        $sort: {submitted_at: -1}
    },
    {
        $limit: 20
    }
]).toArray()
"""

data = run_query(query)

if data and data != '[]':
    # Parse submissions
    user_ids = re.findall(r"user_id: '([^']+)'", data)
    scores = re.findall(r"final_score: ([\d.]+)", data)
    rule_scores = re.findall(r"rule_based_score: ([\d.]+)", data)
    ai_scores = re.findall(r"ai_based_score: ([\d.]+)", data)
    
    print(f"✅ Found {len(scores)} submissions\n")
    
    for i, (user, score, rule, ai) in enumerate(zip(user_ids, scores, rule_scores, ai_scores), 1):
        print(f"{i}. {user}")
        print(f"   Final Score: {score}/100 (Rule: {rule}, AI: {ai})")
        print()
else:
    print("❌ No submissions found yet")

print("="*80)
print("\n💡 To view candidates for a specific question:")
print("   python Aptor/view_candidates_working.py <question_id>")
print("\n💡 Example:")
print("   python Aptor/view_candidates_working.py 6985870673fb356c3c67c03c")
print()
