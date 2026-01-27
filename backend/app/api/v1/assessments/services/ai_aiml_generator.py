"""
Module: ai_aiml_generator.py
Purpose: AIML question generation with AIML module integration

This module generates AI/ML questions with complete datasets (schema + rows),
tasks, constraints, and required libraries. It integrates with the AIML module
for high-quality question generation.

Dependencies:
- External: openai (for fallback generation)
- Internal: ai_utils (for OpenAI client, JSON parsing)
- External: AIML module (optional - aiml_generate_question)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_aiml_generator import _generate_aiml_questions
    
    questions = await _generate_aiml_questions(
        topic="Decision Tree Classifier",
        difficulty="Medium",
        count=1,
        experience_mode="corporate"
    )
    ```

Note: AIML module integration is optional. If unavailable, falls back to basic generation.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

# AIML module integration (optional)
AIML_AVAILABLE = False
aiml_generate_question = None

try:
    from ...aiml.services.ai_question_generator import generate_aiml_question as aiml_generate_question
    AIML_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    logging.getLogger(__name__).warning(
        f"AIML module not available. AIML questions will use basic generation. Error: {e}"
    )

from .ai_utils import _get_openai_client, _parse_json_response
from .ai_quality import (
    validate_question_quality,
    _get_difficulty_rules,
)

logger = logging.getLogger(__name__)


# ============================================================================
# AIML QUESTION GENERATION
# ============================================================================

async def _generate_aiml_questions(
    topic: str,
    difficulty: str,
    count: int,
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generate AIML (AI/ML + data science) questions using structured format from AIML generator.
    
    Returns questions with datasets (schema + rows), tasks, constraints, etc.
    Similar to how coding questions use DSA generator.
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional additional requirements
        
    Returns:
        List of AIML question dictionaries with:
        - question/questionText (formatted with dataset schema and sample data)
        - type: "AIML"
        - difficulty
        - aiml_data: {
            - title, description, difficulty
            - skill, topic, libraries
            - type, execution_environment
            - tasks: [...]
            - constraints: [...]
            - dataset: {schema: [...], rows: [...]}
            - requires_dataset: bool
          }
    """
    logger.info(f"Generating {count} AIML question(s) for topic: {topic}, difficulty: {difficulty}")
    
    # Try AIML module first if available
    if AIML_AVAILABLE and aiml_generate_question is not None:
        try:
            logger.info("Using AIML module for question generation")
            questions = []
            for _ in range(count):
                question_data = await aiml_generate_question(
                    topic=topic,
                    difficulty=difficulty,
                    experience_mode=experience_mode
                )
                if question_data:
                    questions.append(question_data)
            
            if questions:
                logger.info(f"Successfully generated {len(questions)} AIML questions using AIML module")
                return questions
            else:
                logger.warning("AIML module returned no questions, falling back to basic generation")
        except Exception as exc:
            logger.warning(f"AIML generator failed: {exc}. Falling back to basic generation")
    
    # Fallback: Comprehensive AIML question generation using OpenAI
    logger.info("Using comprehensive AIML question generation (OpenAI)")
    
    # Determine if dataset is required based on topic and difficulty
    topic_lower = topic.lower()
    requires_dataset = any(keyword in topic_lower for keyword in [
        "pandas", "data", "feature", "model", "training", "evaluation",
        "classification", "regression", "neural", "machine learning", "deep learning"
    ]) or difficulty.lower() in ["medium", "hard"]
    
    # Auto-select appropriate libraries
    libraries = ["Python"]
    if any(kw in topic_lower for kw in ["numpy", "array"]):
        libraries.append("NumPy")
    if any(kw in topic_lower for kw in ["pandas", "data"]):
        libraries.append("Pandas")
    if any(kw in topic_lower for kw in ["scikit", "sklearn", "machine learning"]):
        libraries.append("Scikit-learn")
    if any(kw in topic_lower for kw in ["tensorflow", "keras"]):
        libraries.append("TensorFlow")
    if "pytorch" in topic_lower:
        libraries.append("PyTorch")
    
    # Default libraries based on difficulty if none selected
    if len(libraries) == 1:  # Only Python
        if difficulty.lower() == "easy":
            libraries = ["Python", "NumPy"]
        elif difficulty.lower() == "medium":
            libraries = ["Python", "NumPy", "Pandas", "Scikit-learn"]
        else:  # hard
            libraries = ["Python", "NumPy", "Pandas", "Scikit-learn", "TensorFlow"]
    
    # Determine seniority for difficulty rules
    if experience_max is not None:
        if experience_max <= 2:
            seniority = "Junior"
        elif experience_max <= 5:
            seniority = "Mid"
        elif experience_max <= 10:
            seniority = "Senior"
        else:
            seniority = "Lead"
    else:
        seniority = "Mid"  # Default
    
    # Get AIML-specific difficulty rules
    difficulty_rules = _get_difficulty_rules("AIML", difficulty, seniority)
    
    prompt = f"""You are an expert AI/ML and Data Science assessment writer for a Jupyter-style IDE platform.
Generate EXACTLY {count} comprehensive AIML question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {count} question(s). Do NOT generate fewer or more than {count} questions.

**HARDWARE CONSTRAINTS**: Candidates run code on laptops in Jupyter notebooks.
Keep datasets SMALL for fast execution, but make questions COMPLEX through:
- Multiple models comparison
- Hyperparameter tuning
- Feature engineering
- Business analysis
- Cross-validation

Difficulty: {difficulty}
Experience Mode: {experience_mode}
Required Libraries: {', '.join(libraries)}
Dataset Required: {"YES - MUST include dataset" if requires_dataset else "Optional"}
{f"Additional Requirements: {additional_requirements}" if additional_requirements else ""}

**TARGET EXECUTION TIME** (on candidate laptops):
- Easy: < 30 seconds
- Medium: < 1 minute
- Hard: < 2 minutes

{'=' * 80}
AIML QUESTION QUALITY STANDARDS (CRITICAL - MUST FOLLOW)
{'=' * 80}

Current Difficulty: {difficulty}
Seniority Level: {seniority}

**CRITICAL: AIML questions must reflect REAL ML workflows**

**{difficulty.upper()} Difficulty Rules for AIML ({seniority}):**

{difficulty_rules}

**FORBIDDEN (too simple for Hard, even with small datasets):**
❌ "What is gradient descent?" (this is Easy)
❌ "Explain the difference between supervised and unsupervised learning" (Easy/Medium)
❌ "What does fit() do in sklearn?" (Easy)
❌ Single model only (just Logistic Regression)
❌ Just fit() and predict() with no analysis
❌ Accuracy as the only metric
❌ No hyperparameter tuning
❌ No business context

**REQUIRED for Hard (even with 100-200 rows):**
✅ Multiple models comparison (3+ models)
✅ Hyperparameter tuning (GridSearchCV/RandomizedSearchCV with 3+ parameters)
✅ Cross-validation (5-fold minimum)
✅ Business metrics (cost analysis, ROI, threshold tuning)
✅ Feature engineering (interaction features, encoding, scaling)
✅ Class imbalance handling (SMOTE, class_weight if applicable)
✅ Model evaluation beyond accuracy (precision/recall/F1/AUC)
✅ Decision threshold optimization for business goals

**Examples by Difficulty (Notice: complexity, not dataset size):**

**Easy (30-50 rows):**
"Load CSV with pandas, handle missing values, split train/test (80/20), train Logistic Regression, report accuracy"

**Medium (50-100 rows):**
"Build pipeline: StandardScaler + feature engineering (2 interaction features), compare 3 models (Logistic Regression, Random Forest, XGBoost) with 5-fold cross-validation, report precision/recall/F1/AUC, select best model"

**Hard (100-200 rows):**
"Customer purchase prediction with class imbalance (15% positive). Compare 3+ models with cross-validation, tune hyperparameters with GridSearchCV, analyze business costs (false positive: $5 wasted marketing, false negative: $50 missed revenue), find optimal decision threshold minimizing total cost, provide feature importance insights for marketing strategy"

{'=' * 80}

CRITICAL STRUCTURE REQUIREMENTS:
Each question MUST include:
1. **description**: 2-3 paragraph problem statement (NO examples, NO constraints)
2. **tasks**: Array of 3-5 specific tasks to complete
3. **constraints**: Array of 2-3 technical constraints
4. **libraries**: {libraries}
5. **dataset** (if required): {{
     "schema": [{{"name": "col", "type": "int|float|string|bool"}}],
     "rows": [dataset rows as arrays - size depends on difficulty]
   }}

**CRITICAL DATASET SIZE REQUIREMENTS (HARDWARE-FRIENDLY):**

**HARDWARE CONSTRAINTS**: Candidates run code on laptops in Jupyter notebooks.
Keep datasets SMALL for fast execution, but make questions COMPLEX through:
- Multiple models comparison
- Hyperparameter tuning
- Feature engineering
- Business analysis
- Cross-validation

**DATASET SIZE GUIDELINES** (considering candidate hardware):
- **Easy**: 30-50 rows, 4-6 columns (basic ML workflow, < 30 seconds execution)
- **Medium**: 50-100 rows, 6-10 columns (model comparison + tuning, < 1 minute execution)
- **Hard**: 100-200 rows, 8-12 columns (full ML pipeline + business analysis, < 2 minutes execution)

**IMPORTANT**: 
- Dataset size does NOT determine difficulty
- Difficulty comes from: model complexity, feature engineering, business analysis
- Keep datasets small for fast execution on candidate hardware
- Focus on ML thinking, not big data processing

DIFFICULTY GUIDELINES:
- **Easy**: Basic operations, single model, accuracy only (dataset: 30-50 rows OR optional)
- **Medium**: Feature engineering, 2-3 models comparison, cross-validation, multiple metrics (dataset REQUIRED: 50-100 rows)
- **Hard**: Advanced feature engineering, 3+ models, GridSearchCV, business cost analysis, threshold tuning (dataset REQUIRED: 100-200 rows)

DATASET RULES (if required):
- Dataset size MUST match difficulty level (see requirements above)
- 4-7 columns
- Include target/label column for ML tasks
- Realistic, meaningful data that reflects real-world scenarios
- Dataset MUST be in structured format (schema + rows arrays)
- For Hard: Include realistic data distributions, missing values, outliers

QUESTION COMPLEXITY BY DIFFICULTY (Notice: same dataset size range, different complexity):

- **Easy** (30-50 rows, 4-6 columns):
  {{"description": "...", "tasks": ["Load data", "Handle missing values", "Split train/test", "Train single model (Logistic Regression)", "Report accuracy"], "constraints": [...], "dataset": {{"schema": [...], "rows": [30-50 rows]}}}}
  
- **Medium** (50-100 rows, 6-10 columns):
  {{"description": "...", "tasks": ["Feature engineering (create 2 interaction features)", "Handle class imbalance with class_weight", "Compare 3 models with 5-fold cross-validation", "Report precision, recall, F1, AUC", "Select best model"], "constraints": [...], "dataset": {{"schema": [...], "rows": [50-100 rows]}}}}
  
- **Hard** (100-200 rows, 8-12 columns):
  {{"description": "Production scenario with business context...", "tasks": ["Advanced feature engineering + SMOTE for imbalance", "Compare 3+ models with 5-fold cross-validation", "Hyperparameter tuning with GridSearchCV (3+ parameters)", "Business cost analysis (false positive vs false negative costs)", "Find optimal decision threshold minimizing total cost", "Feature importance analysis with business recommendations"], "constraints": ["Performance requirements", "Business constraints"], "dataset": {{"schema": [...], "rows": [100-200 rows]}}}}

**DIFFICULTY IS DETERMINED BY**:
1. Number of models to compare (Easy: 1, Medium: 2-3, Hard: 3+)
2. Hyperparameter tuning (Easy: none, Medium: basic, Hard: GridSearchCV/RandomizedSearchCV)
3. Feature engineering complexity (Easy: basic, Medium: moderate, Hard: advanced)
4. Business analysis depth (Easy: none, Medium: basic metrics, Hard: cost analysis + threshold tuning)
5. Class imbalance handling (Medium+: SMOTE, class_weight)
6. Cross-validation strategy (Medium+: k-fold)
7. Evaluation metrics (Easy: accuracy only, Medium: precision/recall/F1/AUC, Hard: business metrics + threshold optimization)

Output format (JSON object with questions array):
{{
  "questions": [
    {{
      "description": "2-3 paragraph problem statement explaining what needs to be done. NO examples here, NO constraints here.",
      "tasks": [
        "Task 1: Specific action to perform",
        "Task 2: Another specific action",
        "Task 3: Final action"
      ],
      "constraints": [
        "Constraint 1: Technical requirement",
        "Constraint 2: Another requirement"
      ],
      "libraries": {json.dumps(libraries)},
      "dataset": {{"schema": [{{"name": "column1", "type": "int"}}, ...], "rows": [[1, 2.5, ...], ...]}} OR null
    }}
  ]
}}

CRITICAL: 
- If dataset is included, row count MUST match difficulty (hardware-friendly):
  * Easy: 30-50 rows, 4-6 columns
  * Medium: 50-100 rows, 6-10 columns
  * Hard: 100-200 rows, 8-12 columns
- Schema must have appropriate columns for difficulty level
- Tasks must be actionable and specific
- Description must be 2-3 paragraphs with business context
- NO markdown, NO code blocks, ONLY JSON
- **Remember**: Difficulty comes from task complexity, not dataset size!

Return ONLY a JSON object with questions array."""

    client = _get_openai_client()
    try:
        # ✅ SPEED OPTIMIZATION: Use gpt-4o (newer, faster) with fallback to gpt-4-turbo-preview
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
        except Exception as gpt4o_error:
            logger.warning(f"gpt-4o failed, falling back to gpt-4-turbo-preview: {gpt4o_error}")
            response = await client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
    except Exception as exc:
        logger.error(f"OpenAI API error in _generate_aiml_questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AIML questions") from exc

    # Parse response
    content = response.choices[0].message.content.strip() if response.choices else ""
    data = _parse_json_response(content)
    
    # Handle response format
    if isinstance(data, dict) and "questions" in data:
        questions_list = data["questions"]
    elif isinstance(data, list):
        questions_list = data
    elif isinstance(data, dict) and "description" in data:
        # Single question object (new format)
        questions_list = [data]
    elif isinstance(data, dict) and "question" in data:
        # Single question object (old format)
        questions_list = [data]
    else:
        logger.error(f"Unexpected response format for AIML questions: {data}")
        raise HTTPException(status_code=500, detail="Invalid response format from AI")
    
    # Format questions with comprehensive structure
    result = []
    for q in questions_list[:count]:
        if not isinstance(q, dict):
            continue
        
        # Build question text from components
        description = q.get("description", q.get("question", ""))
        tasks = q.get("tasks", [])
        constraints = q.get("constraints", [])
        dataset = q.get("dataset")
        question_libraries = q.get("libraries", libraries)
        
        # Validate dataset if present
        if dataset and isinstance(dataset, dict):
            schema = dataset.get("schema", [])
            rows = dataset.get("rows", [])
            
            # Validate row count based on difficulty (hardware-friendly sizes)
            if difficulty.lower() == "easy":
                expected_min, expected_max = 30, 50
            elif difficulty.lower() == "medium":
                expected_min, expected_max = 50, 100
            else:  # hard
                expected_min, expected_max = 100, 200
            
            if len(rows) < expected_min:
                logger.warning(
                    f"Dataset has {len(rows)} rows, expected {expected_min}-{expected_max} for {difficulty} difficulty. "
                    f"Current size may be too small, but complexity matters more than size."
                )
                # Be lenient - focus on task complexity, not strict size
                if len(rows) >= expected_min * 0.7:  # Allow 70% of minimum
                    logger.info(f"Accepting {len(rows)} rows for {difficulty} (focus on task complexity)")
            elif len(rows) > expected_max:
                logger.warning(
                    f"Dataset has {len(rows)} rows, larger than recommended {expected_max} for {difficulty}. "
                    f"Consider smaller dataset for faster execution on candidate hardware. "
                    f"Keeping all rows but recommend {expected_max} max for optimal performance."
                )
                # Keep all rows but warn about hardware constraints
            
            # Validate column count
            if len(schema) < 4 or len(schema) > 7:
                logger.warning(f"Dataset has {len(schema)} columns, expected 4-7")
        
        # Format complete question
        question_text = description
        
        if tasks:
            question_text += "\n\n**Tasks:**\n" + "\n".join(f"{i+1}. {task}" for i, task in enumerate(tasks))
        
        if constraints:
            question_text += "\n\n**Constraints:**\n" + "\n".join(f"- {constraint}" for constraint in constraints)
        
        if dataset:
            schema = dataset.get("schema", [])
            rows = dataset.get("rows", [])[:5]  # Show first 5 rows as sample
            
            question_text += "\n\n**Dataset Schema:**\n"
            question_text += "| " + " | ".join(col.get("name", "") for col in schema) + " |\n"
            question_text += "|" + "|".join("---" for _ in schema) + "|\n"
            
            question_text += "\n**Sample Data (first 5 rows):**\n"
            for row in rows:
                question_text += "| " + " | ".join(str(val) for val in row) + " |\n"
            
            question_text += f"\n*(Full dataset contains {len(dataset.get('rows', []))} rows)*"
        
        if question_libraries:
            question_text += f"\n\n**Required Libraries:** {', '.join(question_libraries)}"
        
        # Create question object
        question_obj = {
            "question": question_text,
            "type": "AIML",
            "difficulty": difficulty,
            "aiml_data": {
                "description": description,
                "tasks": tasks,
                "constraints": constraints,
                "libraries": question_libraries,
                "dataset": dataset,
                "requires_dataset": dataset is not None,
                "execution_environment": "jupyter_notebook"
            }
        }
        
        # Quality validation
        try:
            metrics = await validate_question_quality(
                question=question_obj,
                question_type="AIML",
                difficulty=difficulty,
                experience_min=experience_min,
                experience_max=experience_max,
                job_designation=job_designation,
                assessment_requirements=assessment_requirements,
                topic=topic
            )
            
            if metrics.overall_score >= 0.75:
                result.append(question_obj)
                logger.debug(f"✅ AIML quality score: {metrics.overall_score:.2f}")
            else:
                logger.warning(
                    f"⚠️ Low quality AIML (score={metrics.overall_score:.2f}): "
                    f"{description[:100]}... Issues: {', '.join(metrics.issues[:3])}"
                )
                # Include anyway if not too low
                if metrics.overall_score >= 0.60:
                    result.append(question_obj)
        except Exception as e:
            logger.warning(f"Quality validation failed for AIML: {e}, including anyway")
            result.append(question_obj)
    
    if not result:
        raise HTTPException(status_code=500, detail="No valid AIML questions generated")
    
    logger.info(f"Successfully generated {len(result)} AIML questions with comprehensive structure")
    return result



