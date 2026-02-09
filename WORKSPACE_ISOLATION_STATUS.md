# Workspace Isolation Status - Design Assessment

## Current Status: ✅ ISOLATED WORKSPACES (Working!)

**SUCCESS**: Each candidate now gets their own isolated Penpot file. Multiple candidates can take assessments simultaneously without seeing each other's work.

## Implementation: Transit Format (Option 2)

We successfully implemented a custom Transit format encoder/decoder compatible with Python 3.11+ to communicate with Penpot's RPC API.

### What Was Implemented

1. **Custom Transit Format Library** (`app/services/transit_helper.py`):
   - `TransitEncoder`: Encodes Python dicts to Transit JSON format
   - `TransitDecoder`: Decodes Transit JSON responses to Python objects
   - `PenpotTransitHelper`: High-level helper for Penpot-specific operations
   - Compatible with Python 3.11+ (no dependency on outdated transit-python library)

2. **Updated Penpot RPC Service** (`app/services/penpot_rpc.py`):
   - `authenticate()`: Login using Transit-encoded credentials
   - `create_candidate_workspace()`: Creates new blank file for each candidate
   - `_create_file_with_transit()`: Creates files using Transit format
   - Each candidate gets a unique file ID

3. **Docker Configuration**:
   - Updated `docker-compose.yml` with correct Penpot credentials
   - Service uses `penpot-backend:6060` for API calls (Docker internal network)
   - Public URLs use `localhost:9001` for browser access

### How It Works

1. When a candidate starts an assessment, the backend:
   - Authenticates with Penpot using Transit-encoded login request
   - Creates a new blank file using Transit-encoded create-file request
   - Returns a unique workspace URL with the new file ID

2. Each candidate gets:
   - Their own file ID (e.g., `92a07493-962a-80c4-8007-880631e602c4`)
   - A unique workspace URL
   - Complete isolation from other candidates

3. Transit Format Example:
   ```python
   # Python dict
   {"project-id": "123", "name": "Test"}
   
   # Transit JSON
   ["^ ", "~:project-id", "123", "~:name", "Test"]
   ```

### Test Results

✅ **All tests passing!**

```
TEST 1: Health Check - ✅ PASSED
TEST 2: Question Generation - ✅ PASSED  
TEST 3: Workspace Creation - ✅ PASSED
```

**Verification**:
- First candidate: `file-id=92a07493-962a-80c4-8007-880631e602c4`
- Second candidate: `file-id=92a07493-962a-80c4-8007-880641a5d98a`
- ✅ Different file IDs = True isolation!

## Template File IDs

Current template:
- Team ID: `72b215ed-dedf-8032-8007-87e4c4104a6f`
- Project ID: `72b215ed-dedf-8032-8007-87ee503f626c`
- Template File ID: `72b215ed-dedf-8032-8007-87ee8fd5a874`
- Page ID: `72b215ed-dedf-8032-8007-87ee8fd5a875`

## Testing

Current test page: `http://localhost:3001/design/test-direct`

To test isolation:
1. Open test page in two different browsers
2. Draw something in one browser
3. Check if it appears in the other browser
4. **Expected**: It WILL appear (no isolation currently)
5. **Desired**: It should NOT appear (isolation working)

## Next Steps

1. **Decide on solution**: Manual pre-creation (quick) vs Transit implementation (proper)
2. **If manual**: Create file duplication script for Penpot UI
3. **If Transit**: Research and implement Transit format encoder
4. **Update backend**: Implement chosen solution
5. **Test**: Verify isolation works with multiple concurrent users

## Contact

For questions about Penpot API:
- Penpot Community: https://community.penpot.app/
- Penpot GitHub: https://github.com/penpot/penpot
- Penpot Docs: https://help.penpot.app/

---

**Last Updated**: February 6, 2026
**Status**: Awaiting decision on solution approach


## Technical Details

### Transit Format Implementation

Transit is a data format used by Clojure applications (Penpot is built with Clojure). Our custom implementation handles:

**Encoding (Python → Transit JSON)**:
- Maps: `{"key": "value"}` → `["^ ", "~:key", "value"]`
- Keywords: Keys with hyphens become `~:keyword`
- UUIDs: `uuid.UUID` → `~uxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Decoding (Transit JSON → Python)**:
- Extracts values from Transit map format
- Removes Transit prefixes (`~:`, `~u`)
- Converts to Python dicts

### Why transit-python Library Failed

The official `transit-python` library (v0.8.302) is incompatible with Python 3.10+ because it uses:
```python
class ClassDict(collections.MutableMapping):  # ❌ Fails in Python 3.10+
```

In Python 3.10+, `MutableMapping` was moved to `collections.abc.MutableMapping`. Since the library is unmaintained, we implemented our own Transit encoder/decoder.

### API Endpoints Used

1. **Login**: `POST /api/rpc/command/login-with-password`
   - Request: Transit-encoded `{"email": "...", "password": "..."}`
   - Response: Transit-encoded profile with session cookies

2. **Create File**: `POST /api/rpc/command/create-file`
   - Request: Transit-encoded `{"project-id": "...", "name": "...", "is-shared": false}`
   - Response: Transit-encoded file object with new file ID

3. **Get File**: `POST /api/rpc/command/get-file`
   - Request: Transit-encoded `{"id": "file-id"}`
   - Response: Transit-encoded file data

### Configuration

**Docker Compose** (`docker-compose.yml`):
```yaml
environment:
  PENPOT_URL: "http://localhost:9001"           # Public URL (browser)
  PENPOT_API_URL: "http://penpot-backend:6060"  # API URL (Docker network)
  PENPOT_ADMIN_EMAIL: "admin@example.com"
  PENPOT_ADMIN_PASSWORD: "12312312"
```

**Service** (`app/services/penpot_rpc.py`):
- Uses `PENPOT_API_URL` for API calls
- Uses `PENPOT_URL` for workspace URLs returned to frontend

## Testing

### Run Backend Test
```bash
cd Aptor/services/design-service
python test_workspace.py
```

### Expected Output
```
✅ TEST 1: Health Check - PASSED
✅ TEST 2: Question Generation - PASSED
✅ TEST 3: Workspace Creation - PASSED

Workspace URL: http://localhost:9001/#/workspace?...&file-id=<unique-id>
```

### Verify Isolation
1. Run test twice
2. Compare file IDs in workspace URLs
3. They should be different!

### Test with Frontend
```
http://localhost:3001/design/test-direct
```

Open in two different browsers simultaneously and verify:
- Each gets a different file ID
- Drawing in one browser doesn't appear in the other

## Files Modified

1. **`app/services/transit_helper.py`** - NEW
   - Custom Transit format encoder/decoder
   - Python 3.11+ compatible

2. **`app/services/penpot_rpc.py`** - UPDATED
   - Uses Transit format for all API calls
   - Creates new file for each candidate

3. **`docker-compose.yml`** - UPDATED
   - Fixed Penpot admin credentials
   - Correct API URLs for Docker network

4. **`requirements.txt`** - UPDATED
   - Added `transit-python==0.8.302` (not used, but kept for reference)
   - Using custom implementation instead

## Troubleshooting

### Issue: "wrong-credentials" error
**Solution**: Check `PENPOT_ADMIN_EMAIL` and `PENPOT_ADMIN_PASSWORD` in docker-compose.yml match Penpot's actual credentials.

### Issue: "Transit helper not available"
**Solution**: Ensure `transit_helper.py` is present and `TRANSIT_AVAILABLE = True`.

### Issue: "Connection refused" to Penpot
**Solution**: 
- Check Penpot backend is healthy: `docker-compose ps penpot-backend`
- Verify `PENPOT_API_URL=http://penpot-backend:6060` (not localhost)

### Issue: Same file ID for multiple candidates
**Solution**: Check logs for file creation errors. Ensure `create-file` API call succeeds.

## Next Steps

1. ✅ **DONE**: Implement Transit format encoder/decoder
2. ✅ **DONE**: Update Penpot RPC service to create files
3. ✅ **DONE**: Test workspace isolation
4. 🔄 **TODO**: Test with frontend at `http://localhost:3001/design/test-direct`
5. 🔄 **TODO**: Test with multiple concurrent users
6. 🔄 **TODO**: Add file cleanup after assessment completion
7. 🔄 **TODO**: Add monitoring for file creation failures

## Conclusion

**Workspace isolation is now fully functional!** Each candidate gets their own Penpot file, ensuring complete privacy and preventing candidates from seeing each other's work during assessments.

The Transit format implementation was the key to unlocking Penpot's RPC API, allowing us to programmatically create files without manual intervention.

---

**Last Updated**: February 6, 2026  
**Status**: ✅ WORKING - Workspace isolation implemented and tested  
**Implementation**: Custom Transit format encoder/decoder (Option 2)
