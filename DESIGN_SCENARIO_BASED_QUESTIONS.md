# Design Question Generator - Scenario-Based Improvements

## Date: March 9, 2026

## Summary

Transformed the question generator to produce problem-driven, scenario-based design challenges that match real hiring platforms (Google, Meta, Atlassian, Stripe).

---

## 🎯 The Problem

**Before**: Questions were generic UI exercises
```
Design a food delivery UI.
```

**After**: Questions are real product problems
```
A food delivery application allows users to browse restaurants and order meals online. 
However, frequent users struggle to quickly track active orders or reorder meals they 
previously purchased. The design goal is to create a mobile interface that allows users 
to quickly track ongoing orders, reorder favorite meals, and access order history easily.
```

---

## ✅ Improvement 1: Real-World Scenario Rule

**Added**: REAL-WORLD SCENARIO RULE

Every design challenge must begin with a short realistic scenario that describes:
- What the product does
- Who the primary users are
- What problem they are facing

**Format**:
```
[Product context] allows users to [main functionality]. 
However, [current problem users face].

The design goal is to create [interface type] that allows users to:
• [solve problem 1]
• [solve problem 2]
• [solve problem 3]
```

**Example Output**:
```
A marketing manager needs to track campaign performance across multiple platforms. 
However, current tools are fragmented and difficult to interpret. The design goal 
is to create a dashboard that helps them quickly understand campaign performance, 
identify underperforming campaigns, and make data-driven decisions.
```

---

## ✅ Improvement 2: Age Usage Rule

**Problem**: Age appeared in every question, even when irrelevant
- "Design a dashboard for users aged 25-40" ❌
- "Design an analytics tool for users aged 30-45" ❌

**Solution**: AGE USAGE RULE

Do NOT mention age unless it significantly affects design decisions.

**Use age ONLY for**:
- Healthcare applications (e.g., "adults aged 60+ tracking medication")
- Children's applications (e.g., "children aged 5-8 learning to read")
- Elderly accessibility scenarios (e.g., "seniors with limited tech experience")

**Do NOT use age for**:
- Dashboards
- Analytics tools
- Campaign tools
- Developer tools
- Most B2B applications

**Example**:

✅ **Good (age matters)**:
```
A healthcare application helps adults aged 60+ track their medication schedules. 
The interface must prioritize clarity and ease of use for elderly users with 
limited tech experience and potential visual or motor impairments.
```

❌ **Bad (age doesn't matter)**:
```
Design a project management dashboard for users aged 25-40.
```

---

## ✅ Improvement 3: Problem-First Rule

**Added**: PROBLEM-FIRST RULE

The design challenge must start by describing the user problem BEFORE asking to design the interface.

**Structure**:
1. Product context (what it does)
2. User problem (what users struggle with)
3. Design goal (what to achieve)

**Before**:
```
Design a mobile interface for a food delivery application.
```

**After**:
```
A food delivery application allows users to browse restaurants and order meals online. 
However, frequent users struggle to quickly track active orders or reorder meals they 
previously purchased. The design goal is to create a mobile interface that streamlines 
the ordering and tracking experience.
```

---

## 📝 Updated Description Requirements

### BEGINNER (3-4 sentences)
1. Product context (what the product does)
2. User problem (what users struggle with)
3. Design goal (what the interface should achieve)
4. Keep it simple and problem-focused

**Example**:
```
A task management application allows users to organize their daily tasks. However, 
users struggle to quickly see their most important tasks for the day. The design 
goal is to create a simple dashboard that highlights priority tasks and upcoming 
deadlines.
```

### INTERMEDIATE (4-5 sentences)
1. Product context (what the product does)
2. User problem (specific pain points)
3. User needs (2-3 key needs)
4. Design goal (what to achieve)
5. Expected outcome (simple goal)

**Example**:
```
A food delivery application allows users to browse restaurants and order meals online. 
However, frequent users struggle to quickly track active orders or reorder meals they 
previously purchased. Users need to quickly track ongoing orders, reorder favorite 
meals, and access order history easily. The design goal is to create a mobile interface 
that streamlines the ordering and tracking experience.
```

### ADVANCED (6-8 sentences)
1. Product/service context (what it is, why it exists)
2. User problem (detailed pain points)
3. Business goals (what the company wants)
4. User needs (3-4 specific needs)
5. Key features or functionality required
6. Design goal (what to achieve)
7. Expected outcome (with context)
8. Additional context (market, competitors, constraints)

**Example**:
```
A healthcare application helps adults aged 60+ track their medication schedules and 
health metrics. However, current solutions are complex and difficult for elderly users 
to navigate, leading to missed medications and poor health outcomes. The company aims 
to improve medication adherence and reduce hospital readmissions. Users need to easily 
view daily medication schedules, receive clear reminders, log health metrics, and share 
data with caregivers. The design goal is to create a simple, accessible mobile interface 
that prioritizes clarity and ease of use for elderly users with limited tech experience. 
The interface should reduce cognitive load and support users with visual or motor 
impairments.
```

---

## 🎯 Complete Example: Before vs After

### BEFORE (Generic UI Exercise)
```
Food Delivery Mobile UI — UI Designer Challenge

Description:
Design a mobile dashboard interface for a food delivery application targeting users 
aged 18 to 35 who frequently order food online.

Constraints:
- Canvas width: 1440px desktop layout
- Grid system: 8-column grid
...
```

### AFTER (Problem-Driven Challenge) ✅
```
Food Delivery Mobile UI — UI Designer Challenge

Role: UI Designer
Level: Intermediate
Platform: Mobile

Design Challenge:
A food delivery application allows users to browse restaurants and order meals online. 
However, frequent users struggle to quickly track active orders or reorder meals they 
previously purchased. Users need to quickly track ongoing orders, reorder favorite 
meals, and access order history easily. The design goal is to create a mobile interface 
that streamlines the ordering and tracking experience.

Task Requirements:
Design the following screens:

1️⃣ Home dashboard
   Include active order status, recommended restaurants, and quick reorder section

2️⃣ Order tracking screen
   Include delivery progress, driver status, and order summary

3️⃣ Order history screen
   Include past orders, reorder button, and delivery status

4️⃣ Order details screen
   Include item details, delivery information, and order summary

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

## 🎯 What This Achieves

### Before: Generic UI Exercise
- "Design a food delivery UI"
- No context
- No problem to solve
- Feels like homework

### After: Real Product Challenge
- Clear product context
- Specific user problem
- Design goal with user needs
- Feels like real work

---

## 📊 Impact

Questions now match the quality of:
- ✅ Google UX challenges
- ✅ Meta product design tasks
- ✅ Atlassian design assessments
- ✅ Stripe design hiring tests

**Key Improvements**:
1. Problem-driven (not just UI-driven)
2. Realistic scenarios (not generic prompts)
3. Age only when relevant (not always)
4. Clear user needs (not vague goals)

---

## 🧪 Testing Instructions

Generate "Food delivery mobile UI" and verify:

1. ✅ Description starts with product context and user problem
2. ✅ NO age mentioned (not relevant for food delivery)
3. ✅ Clear user needs listed (track orders, reorder meals, access history)
4. ✅ Design goal is problem-focused
5. ✅ Task Requirements section lists specific screens
6. ✅ Constraints are concise (one line each)
7. ✅ Canvas width: 375px mobile layout

---

## 📁 Files Modified

1. `Aptor/services/design-service/app/services/ai_question_generator.py`
   - Added REAL-WORLD SCENARIO RULE
   - Added AGE USAGE RULE
   - Added PROBLEM-FIRST RULE
   - Updated DESCRIPTION REQUIREMENTS with examples
   - Updated CRITICAL INSTRUCTIONS

---

## 🚀 System Status

**Services**:
- ✅ Design Service: Port 3007 (RESTARTED with scenario rules)
- ✅ Frontend: Port 3000 (running)
- ✅ MongoDB: Port 27017 (running)

**Git Status**:
- Branch: `rashya`
- Changes NOT YET COMMITTED (waiting for user approval)

---

## 🎉 Result

The generator now produces:
- ✅ Problem-driven challenges (not UI exercises)
- ✅ Realistic scenarios (like real hiring platforms)
- ✅ Age only when relevant (not always)
- ✅ Clear user needs and design goals
- ✅ Professional format matching industry standards

Questions feel like real product design work, not homework assignments!
