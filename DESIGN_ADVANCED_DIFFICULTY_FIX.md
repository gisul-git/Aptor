# Design Question Generator - Advanced Difficulty Fix

## Date: March 9, 2026

## Summary

Fixed Advanced difficulty to test system thinking, collaboration, edge cases, and product decisions - not just "design more screens".

---

## 🎯 The Problem

**Before**: Advanced challenges were just Intermediate with more screens
```
Advanced Product Designer:
- Design 5-8 screens
- Create user flow
- Feature prioritization list
```

**After**: Advanced challenges test senior-level thinking
```
Advanced Product Designer:
- Design end-to-end experience with 4-6 DETAILED screens
- Include collaboration features, edge cases, system workflows
- Explain key product decisions
- Product thinking weighted at 25% (highest)
```

---

## ✅ Fix 1: Enhanced Advanced Difficulty Rules

### Added Critical Advanced Rules

```
ADVANCED DIFFICULTY MUST:
• Focus on 5-8 screens with complex interactions and end-to-end workflows
• Include collaboration features, edge cases, or system complexity
• Require product thinking and decision explanation in deliverables
• Focus on system thinking, not just isolated screens
• Deliverables MUST include "Short explanation of key product decisions"
• Evaluation criteria MUST emphasize product thinking (25% weight for Product Designer)
```

### Key Changes:
1. **Collaboration features** - Multi-user scenarios, shared editing, permissions
2. **Edge cases** - Error states, empty states, loading states
3. **System workflows** - End-to-end flows, not isolated screens
4. **Product decisions** - Candidates must explain WHY they made design choices

---

## ✅ Fix 2: Detailed Task Requirements for Advanced

### Before (Too Simple):
```
1️⃣ Home dashboard - Display active orders
2️⃣ Order tracking - Show delivery status
```

### After (Detailed with Features):
```
Design an end-to-end itinerary planning experience that includes:

1️⃣ Trip Overview Screen
This screen provides a summary of an upcoming trip.
Include:
• destination information
• travel dates
• trip participants
• quick summary of booked items (flights, hotels, activities)
• button to add new itinerary items

2️⃣ Daily Itinerary Screen
This screen shows a day-by-day timeline of planned activities.
Include:
• timeline layout of activities
• time slots for events
• transportation details
• location previews or map references
• option to edit or reorder activities

3️⃣ Add Activity / Booking Screen
This screen allows users to add new itinerary items.
Include:
• activity title
• date and time
• location selection
• notes or attachments
• category (flight, hotel, activity, transport)

4️⃣ Trip Collaboration Screen
This screen allows users to collaborate with others.
Include:
• list of trip participants
• shared editing permissions
• comments or suggestions for activities
• notifications for itinerary changes

5️⃣ Travel Resource Screen
This screen provides helpful travel information.
Include:
• booking confirmations
• travel documents
• emergency contacts
• weather or travel updates
```

### Format Rules by Difficulty:

**BEGINNER (2-3 screens)**:
- Simple descriptions (one sentence)
- Focus on basic features

**INTERMEDIATE (3-5 screens)**:
- Moderate descriptions (1-2 sentences)
- Include key features

**ADVANCED (4-6 screens)**:
- DETAILED descriptions (2-4 sentences with bullet points)
- Include specific features, interactions, and edge cases
- Introduce complexity: collaboration, multi-user, system workflows
- Each screen must list 3-5 specific features using "Include:" format

---

## ✅ Fix 3: Advanced Deliverables Require Product Decisions

### Product Designer Advanced Deliverables:
```
Candidates must submit:
• 5-8 high-fidelity product screens
• User journey flow diagram
• Feature prioritization rationale
• Short explanation of key product decisions
```

**Key Addition**: "Short explanation of key product decisions"

This forces candidates to explain:
- Why they chose this workflow
- How they prioritized features
- What edge cases they considered
- How collaboration works
- What trade-offs they made

---

## ✅ Fix 4: Advanced Evaluation Emphasizes Product Thinking

### Product Designer Advanced Evaluation:
```
Product thinking — 25% (HIGHEST WEIGHT)
  Ability to simplify complex problems and explain design decisions

User flow clarity — 20%
  Logical sequence with clear user journeys

Layout consistency — 20%
  Alignment, spacing consistency, and grid usage

Constraint compliance — 15% (REDUCED)
  Adherence to grid, spacing, and accessibility rules

Interaction & usability — 20%
  Clarity of actions, editing flows, and collaboration features
```

**Key Changes**:
- Product thinking: 25% (was 20%)
- Constraint compliance: 15% (was 20%)
- New criterion: "Interaction & usability" for collaboration features

---

## ✅ Fix 5: Removed Contradictory Constraint

**Removed**: "Responsive breakpoints: mobile, tablet, desktop"

**Why**: This contradicts mobile-only assignments. If the task is "Design a mobile app", responsive breakpoints don't make sense.

**Replaced with**:
- Error states: validation and error handling
- Empty states: placeholder content

---

## 📊 Complete Example: Advanced Product Designer Challenge

```
Travel Itinerary Planning Experience — Product Designer Challenge

Role: Product Designer
Difficulty: Advanced
Platform: Mobile

Design Challenge:
A travel planning application helps users organize flights, hotels, and daily 
activities in one place. However, many travel apps struggle to provide a clear 
overview of complex itineraries. Users often find it difficult to organize multi-day 
trips, update plans quickly, collaborate with friends or family, and access important 
travel details while on the move. The product team wants to redesign the itinerary 
planning experience to make trip organization easier and more collaborative. The goal 
is to create a mobile experience that allows users to plan, manage, and share travel 
itineraries efficiently while keeping the interface simple and visually structured.

Task Requirements:
Design an end-to-end itinerary planning experience that includes the following screens:

1️⃣ Trip Overview Screen
This screen provides a summary of an upcoming trip.
Include:
• destination information
• travel dates
• trip participants
• quick summary of booked items (flights, hotels, activities)
• button to add new itinerary items

2️⃣ Daily Itinerary Screen
This screen shows a day-by-day timeline of planned activities.
Include:
• timeline layout of activities
• time slots for events
• transportation details
• location previews or map references
• option to edit or reorder activities

3️⃣ Add Activity / Booking Screen
This screen allows users to add new itinerary items.
Include:
• activity title
• date and time
• location selection
• notes or attachments
• category (flight, hotel, activity, transport)

4️⃣ Trip Collaboration Screen
This screen allows users to collaborate with others.
Include:
• list of trip participants
• shared editing permissions
• comments or suggestions for activities
• notifications for itinerary changes

5️⃣ Travel Resource Screen
This screen provides helpful travel information.
Include:
• booking confirmations
• travel documents
• emergency contacts
• weather or travel updates

Constraints:
• Canvas width: 375px mobile layout
• Grid system: 8-column grid
• Spacing system: 8px baseline grid
• Maximum primary colors: 4
• Minimum contrast ratio: 4.5:1
• Minimum touch target height: 44px
• Typography hierarchy: minimum 4 levels
• Shadow system: 3 elevation levels
• Error states: validation and error handling
• Empty states: placeholder content

Deliverables:
Candidates must submit:
• 5-8 high-fidelity mobile screens
• User journey flow diagram
• Feature prioritization rationale
• Short explanation of key product decisions

Evaluation Criteria:
Submissions will be evaluated based on:

• Product thinking — 25%
  Ability to simplify complex itinerary planning problems and explain design decisions

• User flow clarity — 20%
  Logical and intuitive trip planning workflow

• Layout consistency — 20%
  Proper use of spacing, hierarchy, and structure

• Constraint compliance — 15%
  Correct use of grid, spacing, and accessibility rules

• Interaction & usability — 20%
  Clarity of actions, editing flows, and collaboration features
```

---

## 🎯 What This Achieves

### Before: Just More Screens
- "Design 5-8 screens"
- No collaboration
- No edge cases
- No product thinking required

### After: Senior-Level Challenge
- End-to-end experience with detailed screens
- Collaboration features (multi-user, permissions, comments)
- Edge cases (error states, empty states)
- Product decisions required (explain WHY)
- System thinking (workflows, not isolated screens)

---

## 📋 Updated Rules in Prompt

### 1. Advanced Difficulty Rules
- Include collaboration, edge cases, system complexity
- Require product decision explanation
- Focus on end-to-end workflows

### 2. Task Requirements Format
- Beginner: Simple (1 sentence)
- Intermediate: Moderate (1-2 sentences)
- Advanced: Detailed (bullet points with "Include:" format)

### 3. Advanced Deliverables
- Must include "Short explanation of key product decisions"

### 4. Advanced Evaluation
- Product thinking: 25% (highest weight)
- Interaction & usability: 20% (new criterion)

### 5. Removed Constraints
- ❌ Responsive breakpoints (contradicts mobile-only)
- ✅ Error states, Empty states (more relevant)

---

## 🧪 Testing Instructions

Generate "Travel itinerary planning" with:
- Role: Product Designer
- Difficulty: Advanced
- Experience: 9 years

Verify:
1. ✅ 4-6 screens with DETAILED descriptions
2. ✅ Each screen has "Include:" format with bullet points
3. ✅ Collaboration screen included
4. ✅ Deliverables include "Short explanation of key product decisions"
5. ✅ Evaluation has "Product thinking — 25%"
6. ✅ NO "Responsive breakpoints" constraint
7. ✅ Description mentions collaboration and system complexity

---

## 📁 Files Modified

1. `Aptor/services/design-service/app/services/ai_question_generator.py`
   - Enhanced ADVANCED DIFFICULTY MUST rules
   - Updated TASK REQUIREMENTS with detailed format for Advanced
   - Updated Advanced deliverables to require product decisions
   - Updated Product Designer Advanced evaluation (25% product thinking)
   - Removed "Responsive breakpoints" constraint
   - Added "Error states" and "Empty states" constraints
   - Updated CRITICAL INSTRUCTIONS

---

## 🚀 System Status

**Services**:
- ✅ Design Service: Port 3007 (RESTARTED with advanced fixes)
- ✅ Frontend: Port 3000 (running)
- ✅ MongoDB: Port 27017 (running)

**Git Status**:
- Branch: `rashya`
- Changes NOT YET COMMITTED (waiting for user approval)

---

## 🎉 Result

Advanced challenges now test:
- ✅ System thinking (end-to-end workflows)
- ✅ Collaboration (multi-user features)
- ✅ Edge cases (error states, empty states)
- ✅ Product decisions (explain WHY)
- ✅ Senior-level complexity (not just more screens)

The generator now produces challenges that match Atlassian, Shopify, and Google senior design assessments!
