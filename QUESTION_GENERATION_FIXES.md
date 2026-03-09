# Question Generation Performance Fixes

## Summary
Implemented comprehensive fixes to achieve ZERO failures with fast and accurate question generation.

## Problems Identified

### 1. DSA Service Down (localhost:3004)
- **Issue**: Every coding question tried DSA service first, waited 30s for timeout, then fell back to OpenAI
- **Impact**: 30-second delay per coding question

### 2. Sequential Processing
- **Issue**: Backend processed all questions one-by-one (no concurrency)
- **Impact**: 10 questions = 10x longer generation time

### 3. OpenAI Timeout Too Low
- **Issue**: 180s (3 minutes) timeout insufficient for complex coding questions
- **Impact**: Legitimate requests timing out

### 4. No Circuit Breaker
- **Issue**: System kept retrying DSA/OpenAI even when clearly failing
- **Impact**: Wasted time on known-failing services

### 5. Frontend Timeout Too Short
- **Issue**: 2-minute frontend timeout while backend needs more time
- **Impact**: User sees errors while backend still processing

## Fixes Implemented

### Backend Fixes

#### 1. Disabled DSA Service Calls
**File**: `services/ai-assessment-service/.env`
```env
DISABLE_DSA_SERVICE=true
```

**File**: `services/ai-assessment-service/app/api/v1/assessments/services/ai_coding_generator.py`
- Added environment variable check to skip DSA service
- Go directly to OpenAI for coding questions
- **Benefit**: Saves 30 seconds per coding question

#### 2. Increased OpenAI Timeout to 300s (5 minutes)
**File**: `services/ai-assessment-service/.env`
```env
OPENAI_TIMEOUT_READ=300  # Increased from 180s
```

**File**: `services/ai-assessment-service/app/api/v1/assessments/services.py`
- Updated OpenAI client initialization with new timeout
- Added logging for timeout configuration
- **Benefit**: Prevents legitimate requests from timing out

#### 3. Added Concurrent Processing with Semaphore
**File**: `services/ai-assessment-service/.env`
```env
MAX_CONCURRENT_QUESTIONS=2
```

**File**: `services/ai-assessment-service/app/api/v1/assessments/routers.py`
- Implemented semaphore-based concurrent processing
- Process 2 topics at a time (configurable)
- Uses `asyncio.gather()` for parallel execution
- **Benefit**: 2-3x faster generation, prevents API overload

#### 4. Implemented Circuit Breaker Pattern
**File**: `services/ai-assessment-service/app/utils/circuit_breaker.py` (NEW)
- Created circuit breaker utility with 3 states: CLOSED, OPEN, HALF_OPEN
- Opens circuit after 5 consecutive failures
- Waits 2 minutes before testing recovery
- Distinguishes permanent errors (auth, quota) from temporary errors

**File**: `services/ai-assessment-service/app/api/v1/assessments/services/ai_coding_generator.py`
- Wrapped OpenAI API calls with circuit breaker
- Provides better error messages when circuit is open
- **Benefit**: Stops wasting time on failing services, faster failure detection

### Frontend Fixes

#### 1. Increased API Timeout to 10 Minutes
**File**: `frontend/src/config/api.config.ts`
```typescript
timeout: 600000, // 10 minutes (increased from 2 minutes)
```
- **Benefit**: Allows backend enough time to generate all questions

## Expected Results

### Performance Improvements
- **Coding Questions**: 30s faster per question (no DSA timeout)
- **Overall Generation**: 2-3x faster (concurrent processing)
- **Failure Rate**: Near zero (circuit breaker + better timeouts)

### Example Scenario
**Before**: 10 coding questions
- DSA timeout: 10 × 30s = 300s (5 minutes)
- Sequential processing: 10 × 60s = 600s (10 minutes)
- **Total**: ~15 minutes with frequent failures

**After**: 10 coding questions
- No DSA timeout: 0s
- Concurrent processing (2 at a time): 5 batches × 60s = 300s (5 minutes)
- **Total**: ~5 minutes with zero failures

## Configuration

### Environment Variables
```env
# OpenAI Configuration
OPENAI_TIMEOUT_CONNECT=30
OPENAI_TIMEOUT_READ=300
OPENAI_MAX_RETRIES=5

# Question Generation
DISABLE_DSA_SERVICE=true
MAX_CONCURRENT_QUESTIONS=2
```

### Adjustable Parameters

#### Concurrent Processing
- Increase `MAX_CONCURRENT_QUESTIONS` to 3-4 for faster generation (if API rate limits allow)
- Decrease to 1 if hitting rate limits

#### Circuit Breaker
Edit `services/ai-assessment-service/app/utils/circuit_breaker.py`:
```python
CircuitBreaker(
    failure_threshold=5,  # Open after N failures
    recovery_timeout=120.0,  # Wait N seconds before retry
)
```

#### OpenAI Timeout
- Increase `OPENAI_TIMEOUT_READ` if still seeing timeouts
- Decrease if questions generate faster than expected

## Testing Recommendations

1. **Test with 10 questions** (mix of MCQ, Subjective, Coding)
   - Should complete in 5-7 minutes
   - Zero failures expected

2. **Test with coding-heavy assessment** (8-10 coding questions)
   - Should complete in 5-8 minutes
   - No DSA timeout delays

3. **Monitor logs** for:
   - "DSA service disabled" messages
   - "Circuit breaker" state changes
   - OpenAI timeout values on startup

4. **Verify concurrent processing**:
   - Check logs for parallel question generation
   - Should see multiple "Generating question" logs simultaneously

## Rollback Instructions

If issues occur, revert these changes:

1. **Re-enable DSA service**:
   ```env
   DISABLE_DSA_SERVICE=false
   ```

2. **Reduce timeout**:
   ```env
   OPENAI_TIMEOUT_READ=180
   ```

3. **Disable concurrent processing**:
   ```env
   MAX_CONCURRENT_QUESTIONS=1
   ```

4. **Frontend timeout**:
   ```typescript
   timeout: 120000, // 2 minutes
   ```

## Files Modified

### Backend
1. `services/ai-assessment-service/.env`
2. `services/ai-assessment-service/app/api/v1/assessments/services/ai_coding_generator.py`
3. `services/ai-assessment-service/app/api/v1/assessments/services.py`
4. `services/ai-assessment-service/app/api/v1/assessments/routers.py`
5. `services/ai-assessment-service/app/utils/circuit_breaker.py` (NEW)

### Frontend
1. `frontend/src/config/api.config.ts`

## Monitoring

### Success Indicators
- ✅ All questions generate successfully
- ✅ Generation completes in 5-7 minutes for 10 questions
- ✅ No timeout errors in logs
- ✅ Circuit breaker stays CLOSED (normal operation)

### Warning Signs
- ⚠️ Circuit breaker opens (check OpenAI API status)
- ⚠️ Timeout errors still occurring (increase `OPENAI_TIMEOUT_READ`)
- ⚠️ Rate limit errors (decrease `MAX_CONCURRENT_QUESTIONS`)

## Support

If issues persist:
1. Check OpenAI API status: https://status.openai.com/
2. Verify API key has sufficient quota
3. Review logs for specific error messages
4. Adjust configuration parameters as needed
