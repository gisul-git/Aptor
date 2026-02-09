# Isolated Workspace Solution for Design Assessments

## Current Challenge

Penpot's RPC API uses Transit format (Clojure data format) which is complex to work with from Python. Creating isolated workspaces programmatically via API is challenging.

## Recommended Solutions

### Solution 1: Manual Pre-creation (Quick, Works Now)

**How it works:**
1. Manually create template projects in Penpot (one per difficulty level/role)
2. For each assessment, assign a specific template
3. Candidates work in separate sessions but same file
4. Track changes by timestamp and user_id in database
5. Export final designs via Penpot's export API

**Pros:**
- ✅ Works immediately
- ✅ No complex API integration
- ✅ Reliable

**Cons:**
- ❌ Candidates might see each other's work if they open at same time
- ❌ Need manual cleanup between assessments

### Solution 2: File Duplication via Penpot UI (Semi-automated)

**How it works:**
1. Create a template file
2. Before each assessment, duplicate the file in Penpot UI
3. Get the new file URL
4. Use that URL for the candidate

**Pros:**
- ✅ True isolation
- ✅ Simple process

**Cons:**
- ❌ Requires manual step before each assessment

### Solution 3: Use Penpot's Export/Import API (Best for Production)

**How it works:**
1. Export template file as .penpot file
2. For each candidate, import the template programmatically
3. This creates a new file automatically
4. Return the new file URL

**Implementation:**
```python
# Export template once
GET /api/export/file/{file-id}

# Import for each candidate
POST /api/import/file
Body: .penpot file data
```

**Pros:**
- ✅ True isolation per candidate
- ✅ Automated
- ✅ Scalable

**Cons:**
- ❌ Requires implementing export/import API calls

### Solution 4: Database-based Isolation (Current Workaround)

**How it works:**
1. All candidates use same Penpot file
2. Track each candidate's session in database
3. Use timestamps to separate work
4. Export snapshots at submission time

**Pros:**
- ✅ Works with current setup
- ✅ No Penpot API complexity

**Cons:**
- ❌ Not true isolation
- ❌ Candidates might interfere with each other

## Recommended Approach for Your Project

**Phase 1 (Now):** Use Solution 4 with clear instructions
- Add warning: "Do not refresh or open multiple tabs"
- Track sessions carefully in database
- Export work immediately on submit

**Phase 2 (Production):** Implement Solution 3
- Set up export/import API
- Automate file duplication
- True isolation per candidate

## Implementation Status

Currently implemented: **Solution 4** (Database-based tracking)
- Each candidate gets unique session_id
- Same Penpot file for all
- Work tracked by user_id and timestamp

To upgrade to Solution 3, we need to:
1. Implement Penpot export API call
2. Store template .penpot file
3. Implement import API for each candidate
4. Handle file creation response

Would you like me to implement Solution 3 (export/import)?
