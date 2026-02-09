# Design Question Generation - Prompt Engineering Guide

## 🎯 Overview

The Design Service uses a sophisticated prompt engineering system to generate high-quality, role-specific design assessment questions. This guide explains how the system works and how to customize it.

---

## 📋 Prompt Structure

### Input Parameters

The system accepts these parameters:

```python
{
    "role": "UI Designer | UX Designer | Product Designer | Visual Designer",
    "difficulty": "Easy | Medium | High | Expert",
    "task_type": "landing_page | mobile_app | dashboard | component",
    "topic": "Optional specific topic (e.g., 'food delivery', 'fintech')"
}
```

### Generation Rules

1. **Role-Focused**: Questions are tailored to specific design roles
2. **Difficulty-Based**: Complexity scales with difficulty level
3. **Real-World Practicality**: All scenarios reflect actual business needs
4. **Clear Deliverables**: Explicit outputs required from candidates
5. **Constraint Design**: Realistic limitations based on difficulty

---

## 🏗️ Prompt Architecture

### Master Prompt Template

```
You are an intelligent Design Question Generation Engine for a professional 
hiring assessment platform. Your task is to generate high-quality, role-specific, 
difficulty-based, and practical design challenges.

INPUT PARAMETERS:
Role: {role}
Difficulty Level: {difficulty}
Topic: {topic}
Question Type: UI design task

QUESTION GENERATION RULES:
1. Role-Focused: Tailor strictly to {role}
2. Difficulty-Based Complexity Control
3. Clear Deliverables
4. Real-World Practicality
5. Constraint Design

OUTPUT FORMAT:
**Role:** {role}
**Level:** {difficulty}
**Topic:** {topic}
**Design Challenge:** (complete problem statement)
**Constraints:** (4-8 realistic constraints)
**Expected Deliverables:** (clear outputs)
```

---

## 📊 Difficulty Level Mapping

### Easy (Beginner)
- **Scope**: Single screen or simple task
- **Constraints**: Minimal (2-4 constraints)
- **Time**: 30-45 minutes
- **Example**: Login screen, simple form, single component

**Characteristics:**
- Basic layout and visual rules
- Clear, straightforward requirements
- Limited decision-making needed
- Focus on visual execution

### Medium (Intermediate)
- **Scope**: Multi-section screens or simple flows
- **Constraints**: Moderate (4-6 constraints)
- **Time**: 45-60 minutes
- **Example**: Dashboard, multi-step form, feature page

**Characteristics:**
- Clear layout, spacing, and hierarchy rules
- Multiple sections to organize
- Some user flow consideration
- Balance between aesthetics and function

### High (Advanced)
- **Scope**: Complete user flows or complex scenarios
- **Constraints**: Strong (6-8 constraints)
- **Time**: 60-90 minutes
- **Example**: Booking flow, onboarding, complex workflow

**Characteristics:**
- Multiple screens and logical decision-making
- Accessibility and usability constraints
- Edge case handling
- Strategic UX thinking

### Expert (Senior)
- **Scope**: Product-level or system-level thinking
- **Constraints**: Comprehensive (8+ constraints)
- **Time**: 90-120 minutes
- **Example**: Complete product design, design system

**Characteristics:**
- Multi-step workflows
- Business goals and user personas
- Brand strategy and UX strategy
- Scalability considerations

---

## 🎨 Role-Specific Adaptations

### UI Designer
**Focus**: Visual interfaces, components, interactions
**Key Skills**: Visual hierarchy, typography, color, spacing
**Deliverables**: High-fidelity screens, component specs

**Example Constraints:**
- Maintain 8px grid system
- Use maximum 3 primary colors
- Ensure 44px minimum touch targets
- Follow Material Design / iOS HIG

### UX Designer
**Focus**: User experience, workflows, usability
**Key Skills**: User flows, wireframes, research, accessibility
**Deliverables**: Flow diagrams, wireframes, UX rationale

**Example Constraints:**
- Design for elderly users
- Minimize cognitive load
- Handle error states
- WCAG 2.1 AA compliance

### Product Designer
**Focus**: End-to-end product design and strategy
**Key Skills**: Business alignment, personas, strategy
**Deliverables**: Personas, journey maps, strategy docs

**Example Constraints:**
- Define user personas
- Align with business goals
- Consider scalability
- Balance trust and simplicity

### Visual Designer
**Focus**: Branding, typography, visual aesthetics
**Key Skills**: Visual identity, brand consistency
**Deliverables**: Brand guidelines, visual assets

**Example Constraints:**
- Create cohesive visual language
- Maintain brand consistency
- Design for emotional impact
- Consider cultural context

---

## 📝 Output Format

### JSON Structure

```json
{
    "title": "Brief descriptive title (max 100 chars)",
    "description": "Complete design challenge with context and expectations",
    "constraints": [
        "Constraint 1: Platform and layout requirements",
        "Constraint 2: Visual and design system rules",
        "Constraint 3: Accessibility and usability requirements",
        "Constraint 4: Business and user context"
    ],
    "deliverables": [
        "Deliverable 1: Primary design output",
        "Deliverable 2: Supporting documentation",
        "Deliverable 3: Specifications or rationale"
    ],
    "evaluation_criteria": [
        "Visual hierarchy and clarity",
        "User experience and usability",
        "Design consistency",
        "Technical feasibility"
    ],
    "time_limit_minutes": 60
}
```

---

## 🔄 Fallback System

When AI generation fails, the system uses high-quality template questions:

### Template Categories

1. **UI Designer + Easy + Landing Page**
   - Online Learning Platform Login Screen
   
2. **UI Designer + Medium + Dashboard**
   - Food Delivery Dashboard
   
3. **UX Designer + High + Mobile App**
   - Hospital Appointment Booking Flow
   
4. **Product Designer + Expert + Mobile App**
   - Fintech Mobile App Product Design

Each template follows the same quality standards as AI-generated questions.

---

## 🎯 Quality Checklist

Before outputting any question, the system validates:

- ✅ Is the task role-specific?
- ✅ Is the difficulty level properly reflected?
- ✅ Are the constraints realistic?
- ✅ Are the deliverables clear and measurable?
- ✅ Does it reflect real-world scenarios?
- ✅ Is the time limit appropriate?

---

## 🔧 Customization Guide

### Adding New Roles

1. Update `DesignRole` enum in `app/models/design.py`
2. Add role mapping in `_build_generation_prompt()`
3. Create fallback templates for the new role
4. Update evaluation criteria

### Adding New Task Types

1. Update `TaskType` enum in `app/models/design.py`
2. Add task type mapping in prompt builder
3. Create task-specific templates
4. Update constraint guidelines

### Adjusting Difficulty Levels

1. Modify time mappings in `_generate_fallback_question()`
2. Update constraint counts in prompt
3. Adjust complexity descriptions
4. Update evaluation weights

---

## 📊 Example Generations

### Example 1: UI Designer - Easy

**Input:**
```json
{
    "role": "ui_designer",
    "difficulty": "beginner",
    "task_type": "landing_page",
    "topic": "login screen"
}
```

**Output:**
```
Title: Online Learning Platform Login Screen

Description: You are designing a mobile app for a new online learning 
platform aimed at college students and fresh graduates. Design a clean, 
simple, and user-friendly login screen for first-time users.

Constraints:
- Design for mobile platform (Android / iOS)
- Use clear visual hierarchy
- Limit color palette to 2-3 primary colors
- Include email and password fields
- Maintain minimum 44px touch targets

Deliverables:
- One high-fidelity mobile UI screen
- Color and typography style reference
```

### Example 2: UX Designer - High

**Input:**
```json
{
    "role": "ux_designer",
    "difficulty": "advanced",
    "task_type": "mobile_app",
    "topic": "hospital appointment booking"
}
```

**Output:**
```
Title: Hospital Appointment Booking Flow

Description: Design the end-to-end appointment booking experience for 
a multi-specialty hospital's mobile application serving diverse age groups 
including elderly users.

Constraints:
- Multi-step user flow with progress indicators
- WCAG 2.1 accessibility compliance
- Design for edge cases (unavailability, errors)
- Optimize for elderly users
- Error prevention and recovery mechanisms

Deliverables:
- Complete user flow diagram
- Low-to-mid fidelity wireframes
- UX rationale document
```

---

## 🚀 Best Practices

### For AI Generation

1. **Be Specific**: Provide topic when possible
2. **Match Difficulty**: Ensure difficulty matches candidate level
3. **Review Output**: Always validate generated questions
4. **Iterate**: Refine prompts based on output quality

### For Template Creation

1. **Real Scenarios**: Base on actual industry problems
2. **Clear Context**: Provide business and user context
3. **Measurable Deliverables**: Define concrete outputs
4. **Realistic Constraints**: Use industry-standard requirements

### For Evaluation

1. **Objective Criteria**: Use measurable evaluation points
2. **Role-Specific**: Align criteria with role expectations
3. **Balanced Scoring**: Weight criteria appropriately
4. **Feedback-Ready**: Criteria should guide feedback generation

---

## 📚 References

- **WCAG 2.1**: Web Content Accessibility Guidelines
- **Material Design**: Google's design system
- **iOS HIG**: Apple's Human Interface Guidelines
- **Nielsen Norman Group**: UX research and best practices

---

## 🔄 Continuous Improvement

The prompt system is designed to evolve:

1. **Collect Feedback**: Track question quality metrics
2. **Analyze Patterns**: Identify successful question types
3. **Update Templates**: Refine based on real usage
4. **A/B Testing**: Compare different prompt variations
5. **Community Input**: Incorporate designer feedback

---

**Last Updated**: 2024
**Version**: 1.0.0