# How to Create File Pool for Isolated Workspaces

## Problem
Penpot's API requires Transit format (Clojure data format) which is complex to implement. Until we implement proper Transit encoding, we need to manually create files.

## Solution: Manual File Pool Creation

### Step 1: Login to Penpot
1. Open http://localhost:9001
2. Login with:
   - Email: `admin@example.com`
   - Password: `12312312`

### Step 2: Navigate to Template Project
1. Go to "Design Assessment" project
2. Find the "Template" file

### Step 3: Duplicate Files
For each file you want in the pool:

1. Right-click on "Template" file
2. Select "Duplicate"
3. Rename to something like:
   - `Candidate_001`
   - `Candidate_002`
   - `Candidate_003`
   - etc.

4. Open the duplicated file
5. Copy the file ID from the URL:
   ```
   http://localhost:9001/#/workspace?team-id=...&project-id=...&file-id=THIS-IS-THE-FILE-ID&page-id=...
   ```

### Step 4: Create File Pool Configuration

Create a file: `Aptor/services/design-service/file_pool.json`

```json
{
  "team_id": "72b215ed-dedf-8032-8007-87e4c4104a6f",
  "project_id": "72b215ed-dedf-8032-8007-87ee503f626c",
  "files": [
    {
      "id": "72b215ed-dedf-8032-8007-87ee8fd5a874",
      "name": "Template",
      "status": "available"
    },
    {
      "id": "YOUR-FILE-ID-HERE",
      "name": "Candidate_001",
      "status": "available"
    },
    {
      "id": "YOUR-FILE-ID-HERE",
      "name": "Candidate_002",
      "status": "available"
    }
  ]
}
```

### Step 5: Update Backend to Use File Pool

The backend will:
1. Read from `file_pool.json`
2. Assign an available file to each candidate
3. Mark file as "in-use"
4. Return file to pool when assessment completes

## How Many Files to Create?

- **Development**: 5-10 files
- **Small scale** (< 50 concurrent users): 50 files
- **Medium scale** (50-200 concurrent users): 200 files
- **Large scale** (> 200 concurrent users): 500+ files

## Automation Script (Future)

Once we implement Transit format encoding, we can automate this:

```python
# create_file_pool.py
import requests

def create_file_pool(count=50):
    for i in range(count):
        # Use Penpot API to duplicate template
        # Store file IDs in database
        pass
```

## Quick Start (Minimum Viable)

For immediate testing, create just 3 files:
1. Duplicate "Template" 3 times
2. Name them: Candidate_001, Candidate_002, Candidate_003
3. Get their file IDs
4. Test with 3 concurrent users

## Verification

To verify isolation works:
1. Open assessment in Browser 1 with Candidate_001 file
2. Open assessment in Browser 2 with Candidate_002 file
3. Draw something in Browser 1
4. Check Browser 2 - it should NOT appear
5. ✅ Isolation working!

## Future Improvement

Once Transit format is implemented:
- Automatic file creation via API
- Dynamic pool management
- Auto-cleanup of old files
- File pool monitoring dashboard

---

**Current Status**: Manual creation required
**Estimated Time**: 5 minutes for 10 files
**Recommended**: Create 20-50 files for production use
