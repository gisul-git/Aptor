# 📊 Question Generation Flow - Complete Architecture

## 🎯 Overview

This document describes the complete flow of question generation in the assessment system, from API request to final question output.

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API REQUEST (HTTP POST)                                      │
│    Endpoint: /api/v1/assessments/generate-question              │
│    File: routers.py                                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ROUTER HANDLER                                               │
│    File: routers.py                                             │
│    Function: generate_question_endpoint_v2()                    │
│                                                                 │
│    - Validates user authentication                              │
│    - Loads assessment from MongoDB                              │
│    - Finds topic and question row                               │
│    - Extracts context (job role, experience, requirements)      │
│    - Prepares parameters for question generation               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. MAIN ENTRY POINT                                             │
│    File: ai_question_generator.py                              │
│    Function: generate_questions_for_row_v2()                   │
│                                                                 │
│    - Validates input parameters                                 │
│    - Normalizes question type                                   │
│    - Routes to specialized generator based on question type      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ MCQ          │ │ Subjective   │ │ PseudoCode   │
│ Generator    │ │ Generator    │ │ Generator    │
│ (Same file)  │ │ (Same file)  │ │ (Same file)  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Coding       │ │ SQL          │ │ AIML         │
│ Generator    │ │ Generator    │ │ Generator    │
│ ai_coding_   │ │ ai_sql_      │ │ ai_aiml_     │
│ generator.py │ │ generator.py │ │ generator.py │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. QUALITY VALIDATION (NEW - Phase 1)                          │
│    File: ai_quality.py                                         │
│    Function: validate_question_quality()                       │
│                                                                 │
│    Validates:                                                   │
│    - Clarity (grammar, ambiguity)                              │
│    - Technical accuracy                                         │
│    - Difficulty calibration                                     │
│    - Experience appropriateness                                │
│    - Role relevance                                            │
│    - Professional quality                                      │
│                                                                 │
│    Returns: QualityMetrics with scores and issues              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. QUESTION FORMATTING                                         │
│    Each generator formats questions according to type:          │
│                                                                 │
│    - MCQ: {question, options[], correctAnswer}                 │
│    - Subjective: {question}                                     │
│    - Coding: {title, description, testcases, starter_code}      │
│    - SQL: {question, schemas, sample_data, constraints}         │
│    - AIML: {question, tasks, dataset, constraints}              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RETURN TO ROUTER                                             │
│    - Questions saved to MongoDB                                │
│    - Row status updated to "generated"                          │
│    - Topic and assessment locked                                │
│    - Response sent to frontend                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Files Involved in Question Generation

### **1. Entry Point & API Layer**

#### `routers.py`
- **Location**: `backend/app/api/v1/assessments/routers.py`
- **Role**: API endpoint handler
- **Key Functions**:
  - `generate_question_endpoint_v2()` - Main API endpoint
  - Loads assessment from MongoDB
  - Extracts context (job role, experience, company, requirements)
  - Calls `generate_questions_for_row_v2()`
  - Saves generated questions to database

---

### **2. Main Question Generator (Router)**

#### `ai_question_generator.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_question_generator.py`
- **Role**: Main entry point and router
- **Key Functions**:
  - `generate_questions_for_row_v2()` - **MAIN ENTRY POINT**
    - Routes to specialized generators based on question type
    - Handles MCQ, Subjective, PseudoCode directly
    - Delegates Coding, SQL, AIML to specialized modules
  - `_generate_mcq_questions()` - MCQ generation
  - `_generate_subjective_questions()` - Subjective generation
  - `_generate_pseudocode_questions()` - PseudoCode generation

---

### **3. Specialized Generators**

#### `ai_coding_generator.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_coding_generator.py`
- **Role**: Coding question generation
- **Key Functions**:
  - `_generate_coding_questions()` - Generates coding questions
  - Integrates with DSA module (optional)
  - Creates Judge0-compatible questions
  - Includes test cases, starter code, function signatures

#### `ai_sql_generator.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_sql_generator.py`
- **Role**: SQL question generation
- **Key Functions**:
  - `_generate_sql_questions()` - Generates SQL questions
  - Creates database schemas and sample data
  - Includes constraints, hints, starter queries
  - Integrates with DSA SQL module (optional)

#### `ai_aiml_generator.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_aiml_generator.py`
- **Role**: AI/ML question generation
- **Key Functions**:
  - `_generate_aiml_questions()` - Generates AIML questions
  - Creates datasets (schema + rows)
  - Includes tasks, constraints, libraries
  - Integrates with AIML module (optional)

---

### **4. Quality Validation System (NEW)**

#### `ai_quality.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_quality.py`
- **Role**: Quality validation and scoring
- **Key Functions**:
  - `validate_question_quality()` - Main validation function
  - `_validate_clarity()` - Grammar and clarity checks
  - `_validate_technical_accuracy()` - Technical correctness
  - `_validate_difficulty_calibration()` - Difficulty matching
  - `_validate_experience_appropriateness()` - Seniority matching
  - `_validate_role_relevance()` - Job role alignment
  - `_get_difficulty_rules()` - Difficulty calibration rules
- **Classes**:
  - `QualityMetrics` - Holds quality scores and issues

---

### **5. Utility Modules**

#### `ai_utils.py`
- **Location**: `backend/app/api/v1/assessments/services/ai_utils.py`
- **Role**: Shared utilities
- **Key Functions**:
  - `_get_openai_client()` - OpenAI client management
  - `_parse_json_response()` - JSON parsing with error handling
  - `_process_requirements_for_subjective()` - Requirements processing
  - URL processing, topic classification

#### `prompt_templates.py`
- **Location**: `backend/app/api/v1/assessments/services/prompt_templates.py`
- **Role**: Constants and keywords
- **Contains**:
  - Judge0 supported/unsupported languages
  - AIML keywords
  - SQL keywords
  - Web keywords
  - Classification patterns

#### `judge0_utils.py` (for Coding questions)
- **Location**: `backend/app/api/v1/assessments/services/judge0_utils.py`
- **Role**: Judge0 integration utilities
- **Key Functions**:
  - `_get_judge0_language_id()` - Language ID mapping
  - `_get_starter_code_template()` - Starter code templates
  - `_validate_and_fix_function_signature()` - Signature validation

---

## 🔀 Detailed Flow by Question Type

### **MCQ Questions**

```
routers.py
  └─> generate_question_endpoint_v2()
      └─> generate_questions_for_row_v2() [ai_question_generator.py]
          └─> _generate_mcq_questions() [ai_question_generator.py]
              ├─> Builds personalization context
              ├─> Gets difficulty rules from ai_quality.py
              ├─> Calls OpenAI API
              ├─> Parses JSON response
              ├─> validate_question_quality() [ai_quality.py]
              └─> Returns MCQ questions
```

### **Coding Questions**

```
routers.py
  └─> generate_question_endpoint_v2()
      └─> generate_questions_for_row_v2() [ai_question_generator.py]
          └─> _generate_coding_questions() [ai_coding_generator.py]
              ├─> Tries DSA module (optional)
              ├─> Falls back to OpenAI generation
              ├─> Gets difficulty rules from ai_quality.py
              ├─> Calls OpenAI API
              ├─> Formats test cases
              ├─> Gets starter code from judge0_utils.py
              ├─> validate_question_quality() [ai_quality.py]
              └─> Returns Coding questions
```

### **SQL Questions**

```
routers.py
  └─> generate_question_endpoint_v2()
      └─> generate_questions_for_row_v2() [ai_question_generator.py]
          └─> _generate_sql_questions() [ai_sql_generator.py]
              ├─> Tries DSA SQL module (optional)
              ├─> Falls back to OpenAI generation
              ├─> Gets difficulty rules from ai_quality.py
              ├─> Calls OpenAI API
              ├─> Formats schemas and sample data
              ├─> validate_question_quality() [ai_quality.py]
              └─> Returns SQL questions
```

### **AIML Questions**

```
routers.py
  └─> generate_question_endpoint_v2()
      └─> generate_questions_for_row_v2() [ai_question_generator.py]
          └─> _generate_aiml_questions() [ai_aiml_generator.py]
              ├─> Tries AIML module (optional)
              ├─> Falls back to OpenAI generation
              ├─> Gets difficulty rules from ai_quality.py
              ├─> Calls OpenAI API
              ├─> Formats dataset (schema + rows)
              ├─> validate_question_quality() [ai_quality.py]
              └─> Returns AIML questions
```

---

## 📋 Function Call Sequence

### **Complete Sequence for MCQ Generation:**

1. **Frontend** → HTTP POST `/api/v1/assessments/generate-question`
2. **routers.py** → `generate_question_endpoint_v2()`
   - Loads assessment from MongoDB
   - Extracts context
3. **ai_question_generator.py** → `generate_questions_for_row_v2()`
   - Validates parameters
   - Routes to MCQ generator
4. **ai_question_generator.py** → `_generate_mcq_questions()`
   - Builds personalization context
   - Gets difficulty rules from `ai_quality._get_difficulty_rules()`
   - Builds prompt with context and rules
5. **ai_utils.py** → `_get_openai_client()`
   - Returns OpenAI client
6. **OpenAI API** → Generates questions
7. **ai_utils.py** → `_parse_json_response()`
   - Parses JSON response
8. **ai_quality.py** → `validate_question_quality()`
   - Validates each question
   - Returns quality scores
9. **ai_question_generator.py** → Filters questions by quality (>= 0.75)
10. **routers.py** → Saves to MongoDB
11. **Response** → Returns to frontend

---

## 🔧 Key Dependencies

### **Import Chain:**

```
routers.py
  └─> imports from services/__init__.py
      └─> ai_question_generator.py
          ├─> ai_utils.py
          ├─> ai_quality.py
          ├─> ai_coding_generator.py
          │   ├─> ai_utils.py
          │   ├─> ai_quality.py
          │   └─> judge0_utils.py
          ├─> ai_sql_generator.py
          │   ├─> ai_utils.py
          │   └─> ai_quality.py
          └─> ai_aiml_generator.py
              ├─> ai_utils.py
              └─> ai_quality.py
```

---

## 🎯 Entry Points Summary

### **Primary Entry Point:**
- **File**: `routers.py`
- **Function**: `generate_question_endpoint_v2()`
- **Endpoint**: `POST /api/v1/assessments/generate-question`

### **Main Generator Entry Point:**
- **File**: `ai_question_generator.py`
- **Function**: `generate_questions_for_row_v2()`
- **Called by**: `routers.py`

### **Specialized Generator Entry Points:**
- **MCQ/Subjective/PseudoCode**: `_generate_mcq_questions()`, `_generate_subjective_questions()`, `_generate_pseudocode_questions()` in `ai_question_generator.py`
- **Coding**: `_generate_coding_questions()` in `ai_coding_generator.py`
- **SQL**: `_generate_sql_questions()` in `ai_sql_generator.py`
- **AIML**: `_generate_aiml_questions()` in `ai_aiml_generator.py`

---

## 📊 Data Flow

```
Input (from API):
├─ assessmentId
├─ topicId
├─ rowId
├─ topicLabel
├─ questionType
├─ difficulty
├─ questionsCount
└─ (context: job role, experience, company, requirements)

Processing:
├─ Load assessment from MongoDB
├─ Extract context
├─ Generate questions (with quality validation)
└─ Format questions

Output (to MongoDB & API):
├─ questions[] (formatted for question type)
├─ row.status = "generated"
├─ row.locked = true
└─ topic.locked = true
```

---

## 🚀 Quick Reference

### **To Generate Questions:**

1. **API Call**: `POST /api/v1/assessments/generate-question`
2. **Handler**: `routers.py::generate_question_endpoint_v2()`
3. **Generator**: `ai_question_generator.py::generate_questions_for_row_v2()`
4. **Specialized**: Type-specific generator function
5. **Validation**: `ai_quality.py::validate_question_quality()`
6. **Save**: Back to `routers.py` → MongoDB

### **Files to Modify for Changes:**

- **Add new question type**: `ai_question_generator.py` (add routing + generator)
- **Change quality rules**: `ai_quality.py`
- **Update prompts**: Individual generator files
- **Change API contract**: `routers.py`
- **Update constants**: `prompt_templates.py`

---

**Last Updated**: December 26, 2024
**Status**: Complete flow documentation

