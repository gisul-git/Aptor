# Design Test - Multiple Questions Support

## Current State
- Design test page only loads the FIRST question
- No navigation between questions
- Single Penpot workspace for entire test

## Target State (Match AIML Flow)
- Load ALL questions assigned to the test
- Show question navigation sidebar (like AIML)
- Previous/Next buttons to navigate
- Separate Penpot workspace for each question
- Track completion status per question
- Show progress (e.g., "Question 2 of 5")

## Implementation Steps

### 1. Update State Management
```typescript
const [questions, setQuestions] = useState<any[]>([])
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
const [workspaces, setWorkspaces] = useState<Record<string, any>>({}) // questionId -> workspace
const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set())
```

### 2. Load All Questions
```typescript
// Fetch ALL questions instead of just the first one
const questionIds = testData.question_ids || [];
const questionPromises = questionIds.map(id => 
  fetch(`${API_URL}/questions/${id}`).then(r => r.json())
);
const allQuestions = await Promise.all(questionPromises);
setQuestions(allQuestions);
```

### 3. Create Workspace Per Question
- Create workspace when user navigates to a question
- Cache workspaces to avoid recreating
- Store workspace URL per question ID

### 4. Add Navigation UI
- Question sidebar (left side, collapsible)
- Previous/Next buttons in header
- Question counter: "Question 2 of 5"
- Completion indicators

### 5. Handle Submissions
- Submit per question (not entire test at once)
- Track which questions are completed
- Final "Submit Test" button after all questions

## Files to Modify

### Frontend:
- `Aptor/frontend/src/pages/design/tests/[testId]/take.tsx` - Main test taking page

### Backend (if needed):
- `Aptor/services/design-service/app/api/v1/design.py` - May need endpoint for per-question submission

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Timer | Question 2 of 5 | Submit Test               │
├──────────┬──────────────────────────────────────────────────┤
│ Q Nav    │ Question Panel (collapsible)                     │
│ ┌──┐     │ ┌────────────────────────────────────────────┐  │
│ │Q1│     │ │ Title: Healthcare Dashboard                │  │
│ │Q2│ ◄── │ │ Description: Design a dashboard...         │  │
│ │Q3│     │ │ Constraints: ...                           │  │
│ │Q4│     │ │ Deliverables: ...                          │  │
│ │Q5│     │ └────────────────────────────────────────────┘  │
│ └──┘     │ [Previous] [Next] [Submit Question]             │
│          ├──────────────────────────────────────────────────┤
│          │ Penpot Workspace (iframe)                        │
│          │                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

## Priority
HIGH - This is essential for multi-question tests to work properly

## Estimated Time
3-4 hours for full implementation

