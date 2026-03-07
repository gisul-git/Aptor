# Features To Implement

Based on your requirements, here's the status of the requested features:

## 1. ❌ Topic Suggestion by AI

**Status:** NOT IMPLEMENTED

**Current State:**
- The question creation page has a manual text input for "Topic"
- Users must type the topic themselves (e.g., "Agriculture dashboard", "E-commerce", "Healthcare")
- No AI suggestions are provided

**What Needs to Be Done:**
1. Add an AI endpoint to suggest topics based on:
   - Selected role (UI Designer, UX Designer, etc.)
   - Selected task type (Dashboard, Landing Page, etc.)
   - Selected difficulty level
2. Add a "Suggest Topics" button in the frontend
3. Display AI-suggested topics as clickable chips/buttons
4. Allow users to select a suggested topic or type their own

**Example Implementation:**
```typescript
// Frontend: Add button to get AI topic suggestions
<button onClick={handleGetTopicSuggestions}>
  🤖 Get AI Topic Suggestions
</button>

// Backend: New endpoint
@router.post("/questions/suggest-topics")
async def suggest_topics(
    role: DesignRole,
    task_type: TaskType,
    difficulty: DifficultyLevel
):
    # Use AI to suggest 5-10 relevant topics
    # Return: ["E-commerce Fashion Store", "Healthcare Patient Portal", ...]
```

---

## 2. ✅ Topic Included in Generated Question

**Status:** WORKING CORRECTLY

**Current State:**
- When you provide a topic (e.g., "Agriculture dashboard"), the AI generates a question specifically about that topic
- The generated question includes agriculture-specific details like:
  - "Design an agriculture management dashboard"
  - "Real-time data from weather, soil conditions, and crop health metrics"
  - "Target users are farm managers and agronomists"

**Test Result:**
```
Topic Input: "Agriculture dashboard"
Generated Title: "Agriculture Dashboard - UX Designer Challenge"
Generated Description: "Design an agriculture management dashboard aimed at 
enhancing decision-making for farm managers. The dashboard should integrate 
real-time data from various sources such as weather, soil conditions, and 
crop health metrics..."
```

**Conclusion:** ✅ This feature is working correctly!

---

## 3. ❌ Next Button for Multiple Questions

**Status:** NOT IMPLEMENTED

**Current State:**
- The design test taking page (`/design/tests/[testId]/take.tsx`) only loads the FIRST question from the test
- There is NO navigation between questions
- No "Next Question" button exists
- No "Previous Question" button exists
- Candidates can only complete one question per test session

**Code Evidence:**
```typescript
// Line 62-65 in take.tsx
const questionIds = testData.question_ids || [];
if (questionIds.length === 0) {
  throw new Error('No questions assigned to this test');
}

// Line 67-72: Only loads the FIRST question
const qResponse = await fetch(`${API_URL}/questions/${questionIds[0]}`);
```

**What Needs to Be Done:**

### Backend Changes:
1. ✅ Already supports multiple questions in tests (question_ids array)
2. ✅ Already has endpoints to fetch individual questions
3. ❌ Need to track which questions are completed in the session

### Frontend Changes:
1. **Load all questions** from the test instead of just the first one
2. **Add state management** for current question index
3. **Add navigation UI:**
   - Question counter: "Question 1 of 5"
   - "Next Question" button (disabled until current question is submitted)
   - "Previous Question" button (to review submitted questions)
   - Question navigation sidebar/dots
4. **Handle question transitions:**
   - Save current workspace state before moving to next question
   - Create new workspace for next question
   - Load previous workspace when going back
5. **Submission logic:**
   - Submit individual questions as they're completed
   - Final "Submit Test" button on the last question

**Example Implementation:**
```typescript
// State management
const [questions, setQuestions] = useState<any[]>([]);
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set());

// Navigation UI
<div className="question-navigation">
  <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
  
  <button 
    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
    disabled={currentQuestionIndex === 0}
  >
    ← Previous
  </button>
  
  <button 
    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
    disabled={
      currentQuestionIndex === questions.length - 1 || 
      !submittedQuestions.has(currentQuestionIndex)
    }
  >
    Next →
  </button>
</div>

// Question dots navigation
<div className="question-dots">
  {questions.map((_, index) => (
    <button
      key={index}
      className={`dot ${index === currentQuestionIndex ? 'active' : ''} ${submittedQuestions.has(index) ? 'completed' : ''}`}
      onClick={() => handleQuestionChange(index)}
    >
      {index + 1}
    </button>
  ))}
</div>
```

---

## Summary

| Feature | Status | Priority |
|---------|--------|----------|
| **Topic Suggestion by AI** | ❌ Not Implemented | Medium |
| **Topic in Generated Question** | ✅ Working | - |
| **Next Button for Multiple Questions** | ❌ Not Implemented | HIGH |

---

## Recommended Implementation Order

1. **HIGH PRIORITY: Next Button for Multiple Questions**
   - This is critical for tests with multiple questions
   - Currently, only the first question can be taken
   - Estimated time: 4-6 hours

2. **MEDIUM PRIORITY: Topic Suggestion by AI**
   - Nice-to-have feature for better UX
   - Users can still type topics manually
   - Estimated time: 2-3 hours

---

## Files That Need Changes

### For Next Button Feature:
1. `Aptor/frontend/src/pages/design/tests/[testId]/take.tsx` - Main changes needed
2. `Aptor/services/design-service/app/api/v1/design.py` - May need session tracking endpoints

### For Topic Suggestion Feature:
1. `Aptor/services/design-service/app/api/v1/design.py` - New endpoint
2. `Aptor/services/design-service/app/services/ai_question_generator.py` - New method
3. `Aptor/frontend/src/pages/design/questions/create.tsx` - Add suggestion UI

---

Would you like me to implement any of these features?
