# Mandatory Task Requirements Fix - All Difficulty Levels

## Date: March 9, 2026
## Commit: e5cf653

---

## 🎯 The Critical Problem

**Issue**: Beginner UX questions were missing the Task Requirements section

**Example of the problem**:
```
Description: An online education platform allows students to explore courses...

Constraints:
• Canvas width: 375px mobile layout
• Grid system: 8-column grid
...
```

❌ **Missing**: Task Requirements section
❌ **Result**: Candidates don't know what screens to design

---

## ✅ The Fix

### Added STRUCTURE RULE (MANDATORY)

Every generated design challenge MUST include these 5 sections in order:

1. **Description**
2. **Task Requirements** ← MANDATORY FOR ALL
3. **Constraints**
4. **Deliverables**
5. **Evaluation Criteria**

**Critical**: The "Task Requirements" section is now MANDATORY for ALL difficulty levels (Beginner, Intermediate, Advanced).

---

## ✅ Added BEGINNER TASK REQUIREMENTS RULE

### Rule:
```
For beginner challenges, Task Requirements must include 2-3 simple screens or flows.
Clearly describe what should appear on each screen.
Focus on basic navigation and usability problems.
```

### Example Format:
```
Task Requirements

Design the following screens:

1️⃣ Course discovery screen
This screen should help users browse available courses.
Include:
• search bar for courses
• category filters
• featured courses section
• course cards with title and rating

2️⃣ Course details screen
This screen provides information about a selected course.
Include:
• course title
• instructor information
• course description
• course modules preview
• enrollment button
```

---

## ✅ Added ROLE-SPECIFIC TASK RULE

The type of artifacts must match the role:

- **UX Designer** → wireframes, user flows, research tasks, information architecture
- **UI Designer** → high-fidelity UI screens, component libraries, visual hierarchy
- **Product Designer** → end-to-end product flows, feature prioritization, product decisions
- **Visual Designer** → visual layouts, brand assets, iconography, visual systems

This ensures the challenge tests the right skills for each role.

---

## ✅ Added QUALITY RULE

**Rule**: Ensure the challenge clearly explains what the candidate must design.

### Avoid vague instructions:
❌ "Design an app"
❌ "Create a dashboard"
❌ "Improve the user experience"

### Use specific instructions:
✅ "Design the following screens: Home dashboard, Order tracking, Order history"
✅ "Create a course discovery interface with search, filters, and course cards"
✅ "Design an end-to-end itinerary planning experience with 5 screens"

**Quality Test**: "Can a candidate read this and know exactly what to design?"

---

## 📊 Complete Example: Beginner UX Question (CORRECT)

```
Education Platform User Research — UX Designer Challenge

Role: UX Designer
Difficulty: Beginner
Platform: Mobile

Description:
An online education platform allows students to explore courses across various subjects. 
However, many users find it difficult to quickly discover relevant courses and understand 
the platform's structure. The product team wants to improve the user experience by 
simplifying course discovery and navigation. The goal is to design a clear and intuitive 
structure that helps users easily find courses and understand available learning paths.

Task Requirements:
Create a simple UX solution that improves course discovery.

Design the following screens:

1️⃣ Course discovery screen
This screen should help users browse available courses.
Include:
• search bar for courses
• category filters
• featured courses section
• course cards with title and rating

2️⃣ Course details screen
This screen provides information about a selected course.
Include:
• course title
• instructor information
• course description
• course modules preview
• enrollment button

Constraints:
• Canvas width: 375px mobile layout
• Grid system: 8-column grid
• Spacing system: 8px baseline grid
• Maximum primary colors: 4
• Minimum contrast ratio: 4.5:1
• Minimum touch target height: 44px

Deliverables:
Candidates must submit:
• 2 wireframe screens
• Simple user flow diagram

Evaluation Criteria:
Submissions will be evaluated based on:

• Layout consistency — 20%
  Proper use of grid and spacing
• Navigation clarity — 20%
  Logical navigation structure
• Usability — 20%
  Ease of interaction and clarity of actions
• Constraint compliance — 20%
  Following the layout and accessibility rules
• User flow quality — 20%
  Clear and logical user journey
```

---

## 🔧 Updated Critical Instructions

### New Priority Order:

1. Topic must be the main subject
2. **STRUCTURE (CRITICAL)**: MUST include all 5 sections
3. **TASK REQUIREMENTS (MANDATORY)**: Must list specific screens for ALL difficulty levels
4. Platform detection (mobile vs desktop)
5. Problem-first approach
6. Age only when relevant
7. **Beginner Task Requirements**: 2-3 simple screens with clear descriptions
8. **Intermediate Task Requirements**: 3-5 screens with moderate descriptions
9. **Advanced Task Requirements**: 4-6 screens with detailed descriptions
10. Advanced complexity requirements
11. Concise constraints
12. Difficulty-specific rules
13. Title format
14. Neutral language
15. 8px baseline grid
16. Evaluation criteria descriptions
17. Return JSON only

---

## 📋 Task Requirements by Difficulty

### BEGINNER (2-3 screens)
- Simple descriptions (1-2 sentences)
- List what elements to include
- Focus on basic navigation

**Example**:
```
1️⃣ Home screen
This screen displays the main dashboard.
Include:
• navigation menu
• featured content
• quick actions
```

### INTERMEDIATE (3-5 screens)
- Moderate descriptions (2-3 sentences)
- Include key features
- Focus on component design

**Example**:
```
1️⃣ Dashboard screen
This screen provides an overview of user activity.
Include:
• summary cards with key metrics
• recent activity feed
• quick action buttons
```

### ADVANCED (4-6 screens)
- DETAILED descriptions (3-5 sentences with bullet points)
- Include specific features, interactions, edge cases
- Focus on system workflows

**Example**:
```
1️⃣ Trip Overview Screen
This screen provides a summary of an upcoming trip.
Include:
• destination information
• travel dates
• trip participants
• quick summary of booked items
• button to add new itinerary items
```

---

## 🎯 What This Achieves

### Before (Inconsistent):
- Some questions had Task Requirements
- Some questions skipped it (especially Beginner)
- Candidates confused about what to design

### After (Consistent):
- ✅ ALL questions have Task Requirements
- ✅ Beginner, Intermediate, Advanced all have clear screen lists
- ✅ Candidates know exactly what to design
- ✅ Every question follows the same structure

---

## 🧪 Testing Instructions

Generate a Beginner UX Designer question and verify:

1. ✅ Has Description section
2. ✅ Has Task Requirements section (MANDATORY)
3. ✅ Task Requirements lists 2-3 screens
4. ✅ Each screen has "Include:" format with bullet points
5. ✅ Has Constraints section
6. ✅ Has Deliverables section
7. ✅ Has Evaluation Criteria section

All 5 sections must be present!

---

## 📁 Files Modified

1. `Aptor/services/design-service/app/services/ai_question_generator.py`
   - Added STRUCTURE RULE (mandatory 5 sections)
   - Added BEGINNER TASK REQUIREMENTS RULE with examples
   - Added ROLE-SPECIFIC TASK RULE
   - Added QUALITY RULE
   - Updated CRITICAL INSTRUCTIONS with new priorities

---

## 🚀 System Status

**Services**:
- ✅ Design Service: Port 3007 (RESTARTED with fixes)
- ✅ Frontend: Port 3000 (running)
- ✅ MongoDB: Port 27017 (running)

**Git Status**:
- Branch: `rashya`
- Commit: `e5cf653`
- Status: ✅ Pushed to origin/rashya

---

## 🎉 Result

Every question now has consistent structure:
- ✅ Description (problem context)
- ✅ Task Requirements (what to design) ← NOW MANDATORY
- ✅ Constraints (design rules)
- ✅ Deliverables (what to submit)
- ✅ Evaluation Criteria (how it's graded)

No more missing sections. No more confusion. Every candidate knows exactly what to design!
