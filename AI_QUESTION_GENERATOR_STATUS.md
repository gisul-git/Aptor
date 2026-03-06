# AI Question Generator Status

## Current Issue

The AI question generation is **NOT working properly** due to an **invalid OpenAI API key**.

### Test Results

**Test Parameters:**
- Role: Senior UX Designer
- Task Type: Agriculture Dashboard
- Experience: 3-5 years
- Difficulty: Advanced

**Generated Question (Current - GENERIC):**
```
Title: Agriculture dashboard Dashboard - Ux Designer Challenge

Description: Design a complete user journey with multiple screens dashboard UX system for a Agriculture dashboard with advanced workflows. Create comprehensive information architecture for different types of users with different needs. Think through the whole experience and handle different scenarios. Optimize for users with different skill levels.
```

**Expected Question (With Working AI - SPECIFIC):**
```
Title: Agriculture Crop Monitoring Dashboard - UX Designer Challenge

Description: Design a comprehensive dashboard UX system for an agriculture management platform that enables farmers and agricultural consultants to monitor crop health, track field conditions, analyze weather patterns, and manage irrigation schedules. The interface should allow users to view real-time sensor data from multiple fields, receive alerts for critical conditions, compare historical trends, and make data-driven farming decisions. Target users include farm managers (who need quick overviews), field technicians (who need detailed sensor data), and agricultural consultants (who need analytical tools). The goal is to reduce crop monitoring time by 50% and improve decision-making accuracy through clear data visualization and intuitive workflows.

Constraints:
- Canvas width: 1440px desktop layout
- 12-column grid system with 16px gutter
- Design multi-step user flows for: field monitoring, alert management, and data analysis
- Include accessibility features for outdoor use (high contrast, large touch targets)
- Design for 3 user personas: farm managers, field technicians, consultants
- Include error states for sensor failures and network issues
- Provide data export and reporting workflows
- Optimize for users with varying technical expertise

Deliverables:
- Complete user flow diagrams for all 3 personas
- Information architecture showing dashboard sections and navigation
- Low-to-mid fidelity wireframes for 8-10 key screens
- UX rationale document explaining design decisions
- Accessibility compliance documentation

Evaluation Criteria:
- User flow logic and completeness for agriculture workflows
- Information architecture clarity for complex agricultural data
- Accessibility and inclusive design for diverse users
- Error handling for sensor and network failures
- Strategic thinking in addressing real farming challenges
```

## Root Cause

### Error in Logs:
```
2026-03-06 20:24:00,800 - httpx - INFO - HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 401 Unauthorized"
2026-03-06 20:24:00,808 - app.services.ai_question_generator - ERROR - AI question generation failed: Error code: 401 - {'error': {'message': 'Incorrect API key provided...
```

### Current API Key (Invalid):
```
OPENAI_API_KEY=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
```

This API key is returning 401 Unauthorized, which means it's either:
1. Expired
2. Invalid
3. Revoked
4. Incorrectly formatted

## Fallback Behavior

When AI generation fails, the system falls back to `_generate_topic_based_question()` which uses generic templates:

```python
# Line 665 - UX Designer Advanced Dashboard template
TaskType.DASHBOARD: f"Design {scope} dashboard UX system for a {topic} with advanced workflows. Create comprehensive information architecture for {user_scope}. {complexity} Optimize for users with different skill levels."
```

This template:
- ❌ Does NOT mention agriculture-specific features (crop monitoring, field data, weather, irrigation)
- ❌ Does NOT provide specific user personas (farmers, consultants)
- ❌ Does NOT include agriculture-specific constraints (outdoor use, sensor data)
- ❌ Does NOT mention agriculture-specific deliverables (field monitoring flows, sensor dashboards)
- ✅ Only provides generic UX dashboard guidance

## Solutions

### Option 1: Fix OpenAI API Key (RECOMMENDED)
1. Get a valid OpenAI API key from https://platform.openai.com/api-keys
2. Update `.env` file:
   ```
   OPENAI_API_KEY=sk-proj-YOUR_VALID_KEY_HERE
   ```
3. Restart the design service
4. Test question generation again

### Option 2: Use Alternative AI Provider
If OpenAI is not available, switch to Gemini or Claude:

**For Gemini:**
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

**For Claude:**
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=your_claude_api_key_here
```

### Option 3: Improve Fallback Templates (NOT RECOMMENDED)
We could hardcode agriculture-specific templates, but this defeats the purpose of AI generation and won't scale to other topics.

## Prompt Quality

The new prompt structure (implemented in latest commit) is **GOOD** and will generate high-quality questions **IF** the AI provider is working:

✅ Clear role-specific task generation
✅ Difficulty scaling guidelines
✅ Measurable constraint rules
✅ Professional neutral language requirements
✅ Specific output format with examples

The prompt is ready - we just need a valid API key to use it!

## Next Steps

1. **URGENT**: Get a valid OpenAI API key
2. Update the `.env` file with the new key
3. Restart the design service
4. Test question generation with the same parameters
5. Verify that agriculture-specific details are included in the generated question

## Testing Command

Once API key is fixed, test with:
```bash
curl -X POST http://localhost:3007/api/v1/design/questions/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "role": "ux_designer",
    "difficulty": "advanced",
    "task_type": "dashboard",
    "topic": "Agriculture dashboard",
    "experience_level": "3-5 years"
  }'
```

Expected result: Specific agriculture dashboard question with crop monitoring, field data, weather conditions, irrigation, etc.
