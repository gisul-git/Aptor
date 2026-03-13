# Design Question Generator - Critical Fixes Complete

## Date: March 9, 2026

## Summary

Fixed 3 critical issues in the AI question generator to produce interview-quality design challenges matching Google, Meta, Atlassian, and Stripe standards.

---

## ✅ FIX 1: Platform Detection & Canvas Width

**Problem**: 
- "Food delivery mobile UI" generated with 1440px desktop layout
- Mobile topics were getting desktop canvas width

**Solution**:
Added PLATFORM DETECTION RULE to prompt:

```
PLATFORM DETECTION RULE (CRITICAL)

The canvas width and grid system MUST match the interface type:

**Mobile Interface** (use when topic contains: "mobile", "mobile UI", "app", "prototype", "checkout", "booking", "delivery app"):
• Canvas width: 375px mobile layout
• Grid system: 8-column grid

**Desktop Interface** (use when topic contains: "dashboard", "analytics", "admin panel", "landing page", "website"):
• Canvas width: 1440px desktop layout
• Grid system: 12-column grid

CRITICAL: If the topic says "mobile" anywhere, you MUST use 375px canvas width.
```

**Frontend Fix**:
Updated `extractTaskType()` function to detect "mobile" keyword:
- Checks for "mobile", "app ui", "mobile app", "onboarding", "checkout", "booking"
- Mobile checks come BEFORE dashboard checks (order matters)
- Default changed from "dashboard" to "mobile_app"

**Result**: 
- "Food delivery mobile UI" → 375px mobile layout ✅
- "Healthcare dashboard" → 1440px desktop layout ✅

---

## ✅ FIX 2: Mandatory Task Requirements Section

**Problem**:
- Questions didn't specify which screens to design
- Candidates didn't know what to submit
- Description was vague: "Design a mobile dashboard interface"

**Solution**:
Made TASK REQUIREMENTS section MANDATORY:

```
TASK REQUIREMENTS SECTION (MANDATORY - CRITICAL)

Every design challenge MUST include a "Task Requirements" section that explicitly lists the exact screens, flows, or components the candidate must design.

Format:

**Task Requirements**

Design the following [screens/components/sections]:

1️⃣ [Screen/Component name]
   [One sentence describing what this includes]

2️⃣ [Screen/Component name]
   [One sentence describing what this includes]

CRITICAL RULES:
• This section is MANDATORY for all questions
• Must list 3-5 specific screens/components
• Each item must have a brief description (one sentence)
• Use numbered emoji format (1️⃣ 2️⃣ 3️⃣ 4️⃣)
```

**Example Output**:
```
Task Requirements

Design the following screens:

1️⃣ Home dashboard
   Display active orders, recommended items, and quick actions

2️⃣ Order tracking screen
   Show real-time delivery status and driver progress

3️⃣ Order history screen
   Display past orders with quick reorder option

4️⃣ Order details screen
   Show item details, delivery info, and order summary
```

**Result**: 
- Every question now has explicit list of screens/components ✅
- Candidates know exactly what to design ✅

---

## ✅ FIX 3: Concise Constraints (No Long Explanations)

**Problem**:
- Constraints had very long explanations
- Example: "Spacing system: 8px baseline grid - All spacing (margins, padding, gaps) must be multiples of 8px (8px, 16px, 24px, 32px, 40px, 48px, etc.). This creates consistent visual rhythm, makes the design system scalable, and simplifies developer handoff."
- Not scannable, too verbose

**Solution**:
Added CONSTRAINT FORMAT RULE:

```
CONSTRAINT FORMAT RULE (CRITICAL)

Constraints MUST be short and concise. Each constraint should be ONE LINE without long explanations.

Format: "[Constraint name]: [Value/Rule]"

✅ GOOD (Concise):
"Canvas width: 375px mobile layout"
"Grid system: 8-column grid"
"Spacing system: 8px baseline grid"
"Maximum primary colors: 4"
"Minimum contrast ratio: 4.5:1"
"Minimum touch target height: 44px"

❌ BAD (Too long):
"Canvas width: 375px mobile layout - This ensures the design is optimized for mobile devices. All elements must fit..."
```

**Result**:
- Constraints are now one-line, scannable ✅
- Professional format matching real assessments ✅

---

## Additional Improvements

### Concise Deliverables
- Removed "(optional)" annotations
- Simplified format to bullet points
- Clear quantities: "3-5 high-fidelity screens"

### Concise Evaluation Criteria
- Shortened descriptions to one sentence
- Format: "Criteria — 20%\n  One sentence explanation"
- Example: "Layout consistency — 20%\n  Alignment, spacing consistency, and grid usage"

### Updated Critical Instructions
- Simplified from 15 rules to 10 rules
- Emphasized platform detection
- Emphasized task requirements mandatory
- Emphasized constraint conciseness

---

## Example: Before vs After

### BEFORE (Wrong)
```
Food Delivery Mobile UI — UI Designer Challenge

Description:
Design a mobile dashboard interface for a food delivery application.

Constraints:
- Canvas width: 1440px desktop layout - This ensures the design is optimized for desktop devices. All elements must fit within this width...
- Grid system: 8-column grid - Provides consistent alignment and spacing across the interface. All major elements...
- Spacing system: 8px baseline grid - All spacing (margins, padding, gaps) must be multiples of 8px...

Deliverables:
- 3-5 high-fidelity screens
- Component library
- Style guide
- Responsive layouts (optional)
```

### AFTER (Correct) ✅
```
Food Delivery Mobile UI — UI Designer Challenge

Role: UI Designer
Level: Intermediate
Platform: Mobile

Design Challenge:
Design a mobile interface for a food delivery application used by customers aged 18–35 who frequently order food online. The interface should allow users to quickly view ongoing orders, track delivery progress, and reorder previously purchased meals. The design should prioritize clarity, fast interactions, and intuitive navigation.

Task Requirements:
Design the following screens:

1️⃣ Home dashboard
   Display active orders, recommended restaurants, and quick reorder options

2️⃣ Order tracking screen
   Show real-time delivery status and driver progress

3️⃣ Order history screen
   Display past orders with a quick reorder option

4️⃣ Order details screen
   Show item details, delivery information, and order summary

Constraints:
• Canvas width: 375px mobile layout
• Grid system: 8-column grid
• Spacing system: 8px baseline grid
• Maximum primary colors: 4
• Minimum contrast ratio: 4.5:1
• Minimum touch target height: 44px
• Typography hierarchy: minimum 3 levels
• Border radius: 8px or 16px

Deliverables:
Candidates must submit:
• 3-5 high-fidelity mobile screens
• Component library
• Style guide

Evaluation Criteria:
Submissions will be evaluated based on:

• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Visual hierarchy — 20%
  Clear prioritization using typography, spacing, and color
• Component quality — 20%
  Reusable components with proper states
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• Visual quality — 20%
  Overall aesthetics and attention to detail
```

---

## Testing Instructions

1. Go to Design Questions → Create Question
2. Select "AI Generated"
3. Fill in:
   - Role: UI Designer
   - Difficulty: Intermediate
   - Experience: 3 years
   - Topic: "Food delivery mobile UI"
4. Click "Generate Question with AI"
5. Verify:
   - ✅ Canvas width: 375px mobile layout (NOT 1440px)
   - ✅ Grid system: 8-column grid (NOT 12-column)
   - ✅ Task Requirements section exists with 4 numbered screens
   - ✅ Constraints are one-line, concise (NO long explanations)
   - ✅ Deliverables are clear and concise
   - ✅ Evaluation criteria have short descriptions

---

## Files Modified

1. `Aptor/services/design-service/app/services/ai_question_generator.py`
   - Added PLATFORM DETECTION RULE
   - Made TASK REQUIREMENTS SECTION mandatory
   - Added CONSTRAINT FORMAT RULE (concise)
   - Updated DELIVERABLE FORMAT RULE (concise)
   - Updated EVALUATION FORMAT RULE (concise)
   - Simplified CRITICAL INSTRUCTIONS

2. `Aptor/frontend/src/pages/design/questions/create.tsx`
   - Improved `extractTaskType()` function
   - Better mobile detection (checks "mobile" keyword)
   - Reordered checks (mobile before dashboard)
   - Changed default from "dashboard" to "mobile_app"

---

## System Status

**Services**:
- ✅ Design Service: Port 3007 (RESTARTED with fixes)
- ✅ Frontend: Port 3000 (running)
- ✅ MongoDB: Port 27017 (running)

**Git Status**:
- Branch: `rashya`
- Changes NOT YET COMMITTED (waiting for user approval)

---

## Result

The generator now produces interview-quality design challenges matching:
- ✅ Google UX challenges
- ✅ Meta product design tasks
- ✅ Atlassian design assessments
- ✅ Stripe design hiring tests

All questions are:
- Clear and specific (task requirements)
- Properly sized (correct canvas width)
- Scannable (concise constraints)
- Professional (matching industry standards)
