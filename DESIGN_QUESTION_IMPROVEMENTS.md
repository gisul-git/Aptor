# Design Question Generator Improvements

## Implementation Plan

### 1. ✅ Detailed Constraint Explanations (COMPLETED)
- Updated AI prompt to require detailed explanations for each constraint
- Format: "[Constraint]: [Value] - [Detailed explanation of WHY and HOW]"
- Example: "Canvas width: 375px mobile layout - This ensures the design is optimized for mobile devices. All elements must fit within this width without horizontal scrolling."

### 2. ✅ Detailed Question Descriptions (COMPLETED)
- Already implemented in previous update
- Questions now include clear task requirements with numbered steps
- Evaluation criteria include descriptions

### 3. 🔄 Open Requirements Field (IN PROGRESS)
**Purpose**: Allow users to add custom requirements/context when generating questions

**Implementation**:
- Add textarea field in AI generation form: "Additional Requirements (Optional)"
- Placeholder: "Add any specific requirements, constraints, or context for this question..."
- Pass this to the AI generator as additional context
- AI will incorporate these requirements into the generated question

**Location**: `Aptor/frontend/src/pages/design/questions/create.tsx`
- Add state: `const [openRequirements, setOpenRequirements] = useState('')`
- Add field after Task Type selection
- Include in API call to `/questions/generate`

**Backend**: `Aptor/services/design-service/app/api/v1/design.py`
- Add `open_requirements: Optional[str]` to request model
- Pass to AI generator prompt as additional context

### 4. 🔄 Multiple Question Generation with Next Button (IN PROGRESS)
**Purpose**: Generate multiple questions in sequence, review each, and make changes before saving

**Flow**:
1. User fills form and clicks "Generate Question"
2. Question is generated and shown in preview
3. User can:
   - Click "Save & Next" to save this question and generate another
   - Click "Edit" to modify the generated question
   - Click "Regenerate" to generate a new version
   - Click "Save & Finish" to save and go to questions list

**Implementation**:
- Add question preview component
- Add state for generated questions array
- Add "Save & Next" button
- Add "Edit" mode for generated questions
- Add question counter (e.g., "Question 1 of 5")

**UI Components Needed**:
- Question Preview Card
- Edit Modal
- Question Counter
- Navigation buttons (Previous, Next, Save & Finish)

### 5. 🔄 Review and Edit Capability (IN PROGRESS)
**Purpose**: Allow users to review and edit AI-generated questions before saving

**Features**:
- Inline editing of all fields (title, description, constraints, deliverables, etc.)
- Real-time preview
- Validation before saving
- Ability to regenerate specific sections

**Implementation**:
- Add edit mode toggle
- Make all fields editable in preview
- Add "Apply Changes" button
- Add "Discard Changes" button

## Priority Order

1. ✅ **DONE**: Detailed constraint explanations
2. ✅ **DONE**: Detailed question descriptions with task requirements
3. **NEXT**: Open requirements field (Quick win - 30 mins)
4. **THEN**: Multiple question generation with Next button (2-3 hours)
5. **FINALLY**: Full review and edit capability (1-2 hours)

## Files to Modify

### Frontend:
- `Aptor/frontend/src/pages/design/questions/create.tsx` - Main form
- Create new component: `Aptor/frontend/src/components/design/QuestionPreview.tsx`
- Create new component: `Aptor/frontend/src/components/design/QuestionEditor.tsx`

### Backend:
- `Aptor/services/design-service/app/api/v1/design.py` - Add open_requirements parameter
- `Aptor/services/design-service/app/services/ai_question_generator.py` - Use open_requirements in prompt

## Next Steps

1. Implement open requirements field (simple addition)
2. Test with AI generation
3. Implement multiple question flow
4. Add review/edit capability
5. Test end-to-end workflow
6. Commit and push changes

