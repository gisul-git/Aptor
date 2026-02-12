"""
AI Question Generator for AIML Competency Assessment Platform
Generates complete AIML/Python competency questions with optional datasets.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from openai import OpenAI
from ..config import get_aiml_settings

logger = logging.getLogger("backend")


def _requires_dataset(skill: str, topic: Optional[str], difficulty: str) -> bool:
    """
    Determine if a dataset is REQUIRED based on skill, topic, and difficulty.
    
    DO NOT generate a dataset if the question is:
    - Basic Python
    - Basic NumPy operations
    - Simple array manipulation
    - Core library usage that can be solved with in-memory examples
    
    MUST generate a dataset if the question involves:
    - Pandas data analysis
    - Feature engineering
    - Machine Learning
    - Deep Learning
    - Model training or evaluation
    - AI-related data processing
    """
    skill_lower = skill.lower() if skill else ""
    topic_lower = topic.lower() if topic else ""
    difficulty_lower = difficulty.lower() if difficulty else ""
    
    # Skills that typically require datasets
    dataset_required_skills = [
        "machine learning", "ml", "deep learning", "dl", 
        "data science", "pandas", "data analysis"
    ]
    
    # Topics that require datasets
    dataset_required_topics = [
        "pandas", "data analysis", "feature engineering", 
        "model training", "model evaluation", "classification",
        "regression", "neural network", "deep learning",
        "data preprocessing", "data cleaning"
    ]
    
    # Check if skill requires dataset
    if any(ds_skill in skill_lower for ds_skill in dataset_required_skills):
        return True
    
    # Check if topic requires dataset
    if topic and any(ds_topic in topic_lower for ds_topic in dataset_required_topics):
        return True
    
    # Medium and Hard difficulty with ML/DL/AI skills typically need datasets
    if difficulty_lower in ["medium", "hard"]:
        if any(ml_term in skill_lower for ml_term in ["ml", "machine learning", "deep learning", "ai", "data science"]):
            return True
    
    # Basic Python, NumPy basics don't need datasets
    if skill_lower in ["python", "numpy"] and difficulty_lower == "easy":
        return False
    
    # Default: no dataset for basic operations
    return False


def _select_libraries(skill: str, topic: Optional[str], difficulty: str) -> List[str]:
    """
    Auto-select appropriate libraries based on skill, topic, and difficulty.
    """
    skill_lower = skill.lower() if skill else ""
    topic_lower = topic.lower() if topic else ""
    difficulty_lower = difficulty.lower() if difficulty else ""
    
    libraries = []
    
    # Always include Python for AIML questions
    if "python" not in [lib.lower() for lib in libraries]:
        libraries.append("Python")
    
    # Skill-based library selection
    if "numpy" in skill_lower or "array" in skill_lower:
        libraries.append("NumPy")
    
    if "pandas" in skill_lower or "data" in skill_lower:
        libraries.append("Pandas")
    
    if "matplotlib" in skill_lower or "seaborn" in skill_lower or "visualization" in skill_lower:
        libraries.append("Matplotlib")
        if "seaborn" in skill_lower:
            libraries.append("Seaborn")
    
    if "scikit" in skill_lower or "sklearn" in skill_lower or "machine learning" in skill_lower:
        libraries.append("Scikit-learn")
    
    if "tensorflow" in skill_lower or "keras" in skill_lower:
        libraries.append("TensorFlow")
        if "keras" in skill_lower:
            libraries.append("Keras")
    
    if "pytorch" in skill_lower:
        libraries.append("PyTorch")
    
    # Topic-based additions
    if topic:
        if "pandas" in topic_lower:
            libraries.append("Pandas")
        if "numpy" in topic_lower:
            libraries.append("NumPy")
        if "matplotlib" in topic_lower or "plotting" in topic_lower:
            libraries.append("Matplotlib")
        if "sklearn" in topic_lower or "scikit" in topic_lower:
            libraries.append("Scikit-learn")
        if "tensorflow" in topic_lower:
            libraries.append("TensorFlow")
        if "pytorch" in topic_lower:
            libraries.append("PyTorch")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_libraries = []
    for lib in libraries:
        lib_lower = lib.lower()
        if lib_lower not in seen:
            seen.add(lib_lower)
            unique_libraries.append(lib)
    
    # Default libraries if none selected
    if not unique_libraries or len(unique_libraries) == 1:
        if difficulty_lower == "easy":
            unique_libraries = ["Python", "NumPy"]
        elif difficulty_lower == "medium":
            unique_libraries = ["Python", "NumPy", "Pandas", "Scikit-learn"]
        else:  # hard
            unique_libraries = ["Python", "NumPy", "Pandas", "Scikit-learn", "TensorFlow"]
    
    return unique_libraries


async def generate_aiml_question(
    title: str,
    skill: str,
    topic: Optional[str] = None,
    difficulty: str = "medium",
    dataset_format: str = "csv"
) -> Dict[str, Any]:
    """
    Generate a complete AIML competency question using OpenAI.
    
    Args:
        title: Assessment title
        skill: Skill area (Python, AI, Machine Learning, Deep Learning, Data Science)
        topic: Optional specific topic
        difficulty: easy, medium, or hard
        dataset_format: Desired dataset format (csv, json, pdf, parquet, avro) - for backend conversion only
    
    Returns:
        Complete question JSON with assessment, question, and optional dataset fields
    """
    settings = get_aiml_settings()
    
    # Determine if dataset is required
    requires_dataset = _requires_dataset(skill, topic, difficulty)
    
    # Auto-select libraries
    libraries = _select_libraries(skill, topic, difficulty)
    
    # Determine seniority (default to Mid if not provided)
    seniority = "Mid"  # Default seniority level
    
    # Build simplified difficulty rules (adapted from ai_aiml_generator.py style)
    difficulty_rules_map = {
        "easy": {
            "Junior": "Basic pandas operations, simple sklearn fit/predict. Example: 'Load CSV, handle missing values, split into train/test.'",
            "Mid": "Load data, train basic model, interpret metrics. Example: 'Train RandomForest classifier and evaluate accuracy.'",
            "Senior": "Quick ML pipeline decisions. Example: 'Which feature engineering approach improves model performance?'",
            "Lead": "ML strategy decisions. Example: 'Which model architecture supports both accuracy and inference speed requirements?'"
        },
        "medium": {
            "Junior": "Feature engineering, hyperparameter tuning basics. Example: 'Build pipeline with StandardScaler + RandomForest, tune hyperparameters.'",
            "Mid": "Model selection, cross-validation, metric interpretation. Example: 'Compare 3 models using cross-validation and select best.'",
            "Senior": "Production pipeline design, model monitoring. Example: 'Design ML pipeline with data validation and model versioning.'",
            "Lead": "ML system architecture. Example: 'Design A/B testing framework for model deployment with rollback capability.'"
        },
        "hard": {
            "Junior": "Complex ML pipeline, multiple models, hyperparameter tuning. Example: 'Compare 3 models, tune hyperparameters with GridSearchCV, handle class imbalance.'",
            "Mid": "Advanced feature engineering, business metrics, model interpretation. Example: 'Build ML pipeline with feature selection, compare models, analyze business costs.'",
            "Senior": "Production ML system with constraints, model deployment strategy. Example: 'Design end-to-end ML system with A/B testing, monitoring, and cost optimization.'",
            "Lead": "ML architecture decisions, business impact analysis. Example: 'Design ML system architecture supporting multiple models, real-time inference, and business metrics.'"
        }
    }
    
    difficulty_rules = difficulty_rules_map.get(difficulty.lower(), {}).get(seniority, "Standard difficulty rules apply")
    
    # Build prompt (adapted from ai_aiml_generator.py for single question generation)
    prompt = f"""You are an expert AI/ML and Data Science assessment writer for a Jupyter-style IDE platform.
Generate ONE comprehensive AIML question for the topic: {topic if topic else skill}.

CRITICAL: You MUST generate EXACTLY ONE question. Do NOT generate fewer or more than one question.

**HARDWARE CONSTRAINTS**: Candidates run code on laptops in Jupyter notebooks.
Keep datasets SMALL for fast execution, but make questions COMPLEX through:
- Multiple models comparison
- Hyperparameter tuning
- Feature engineering
- Business analysis
- Cross-validation

Difficulty: {difficulty}
Required Libraries: {', '.join(libraries)}
Dataset Required: {"YES - MUST include dataset" if requires_dataset else "Optional"}
Assessment Title: {title} ⭐ PRIMARY CONTEXT - Use this to guide the problem domain and scenario

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
   - MUST relate to Assessment Title: "{title}" - use this as PRIMARY context for domain/scenario
   - Include real-world domain context, clear objective, and at least one practical constraint
2. **tasks**: Array of 3-5 specific tasks to complete (outcome-driven, decision-oriented, NOT procedural)
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
- Dataset feature names MUST reflect Assessment Title context: "{title}"

DIFFICULTY GUIDELINES:
- **Easy**: Basic operations, single model, accuracy only (dataset: 30-50 rows OR optional)
- **Medium**: Feature engineering, 2-3 models comparison, cross-validation, multiple metrics (dataset REQUIRED: 50-100 rows)
- **Hard**: Advanced feature engineering, 3+ models, GridSearchCV, business cost analysis, threshold tuning (dataset REQUIRED: 100-200 rows)

DATASET RULES (if required):
- Dataset size MUST match difficulty level (see requirements above)
- 4-7 columns (flexible based on difficulty)
- Include target/label column for ML tasks
- Realistic, meaningful data that reflects real-world scenarios
- Dataset MUST be in structured format (schema + rows arrays)
- Feature names MUST be domain-specific and reflect Assessment Title: "{title}"
- For Hard: Include realistic data distributions, missing values, outliers
- Avoid trivial correlations and target leakage
- Include mild ambiguity (contradictory samples)
- Add realistic noise/uncertainty

**DIFFICULTY IS DETERMINED BY**:
1. Number of models to compare (Easy: 1, Medium: 2-3, Hard: 3+)
2. Hyperparameter tuning (Easy: none, Medium: basic, Hard: GridSearchCV/RandomizedSearchCV)
3. Feature engineering complexity (Easy: basic, Medium: moderate, Hard: advanced)
4. Business analysis depth (Easy: none, Medium: basic metrics, Hard: cost analysis + threshold tuning)
5. Class imbalance handling (Medium+: SMOTE, class_weight)
6. Cross-validation strategy (Medium+: k-fold)
7. Evaluation metrics (Easy: accuracy only, Medium: precision/recall/F1/AUC, Hard: business metrics + threshold optimization)

Output format (JSON object):
{{
  "assessment": {{
    "title": "{title}",
    "skill": "{skill}",
    "topic": "{topic if topic else ''}",
    "difficulty": "{difficulty}",
    "libraries": {json.dumps(libraries)},
    "selected_dataset_format": "{dataset_format}"
  }},
  "question": {{
    "type": "aiml_coding",
    "execution_environment": "jupyter_notebook",
    "description": "2-3 paragraph problem statement explaining what needs to be done. MUST relate to Assessment Title '{title}'. Include real-world domain context, clear objective, and at least one practical constraint. NO examples here, NO detailed constraints here (those go in constraints field).",
    "tasks": [
      "Task 1: Specific outcome-driven, decision-oriented action to perform (NOT procedural like 'Load data')",
      "Task 2: Another outcome-driven action requiring reasoning/justification",
      "Task 3: Final outcome-driven action"
    ],
    "constraints": [
      "Constraint 1: Technical requirement",
      "Constraint 2: Another requirement"
    ]
  }},
  "dataset": {{"schema": [{{"name": "column1", "type": "int"}}, ...], "rows": [[1, 2.5, ...], ...]}} OR null
}}

CRITICAL: 
- If dataset is included, row count MUST match difficulty (hardware-friendly):
  * Easy: 30-50 rows, 4-6 columns
  * Medium: 50-100 rows, 6-10 columns
  * Hard: 100-200 rows, 8-12 columns
- Schema must have appropriate columns for difficulty level
- Tasks must be actionable, outcome-driven, and decision-oriented (NOT step-based/procedural)
- Description must be 2-3 paragraphs with business context and MUST relate to Assessment Title: "{title}"
- NO markdown, NO code blocks, ONLY JSON
- **Remember**: Difficulty comes from task complexity, not dataset size!
- Question MUST reflect Assessment Title context: "{title}"

Return ONLY a JSON object."""

    try:
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert AI assessment generator for AIML competency assessment. You create real-world, decision-based questions that test reasoning complexity, not just library knowledge. Always return valid JSON only. Never include markdown code blocks or explanations outside JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
        )
        
        if not response.choices or not response.choices[0].message.content:
            raise ValueError("OpenAI API returned empty response")
        
        content = response.choices[0].message.content.strip()
        logger.info(f"Raw AI response (first 500 chars): {content[:500]}")
        
        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Extract JSON object
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        
        if json_start >= 0 and json_end > json_start:
            content = content[json_start:json_end]
        
        if not content:
            raise ValueError("No JSON content found in AI response")
        
        # Parse JSON
        try:
            question_data = json.loads(content)
        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse JSON. Content preview: {content[:200]}")
            raise ValueError(f"Failed to parse AI response as JSON: {json_err}")
        
        # Validate structure
        if "assessment" not in question_data:
            raise ValueError("Missing 'assessment' field in AI response")
        if "question" not in question_data:
            raise ValueError("Missing 'question' field in AI response")
        if "dataset" not in question_data:
            raise ValueError("Missing 'dataset' field in AI response")
        
        # Validate dataset if present
        if question_data.get("dataset") is not None:
            dataset = question_data["dataset"]
            if "schema" not in dataset:
                raise ValueError("Dataset missing 'schema' field")
            if "rows" not in dataset:
                raise ValueError("Dataset missing 'rows' field")
            
            # Validate row count
            if len(dataset["rows"]) != 30:
                logger.warning(f"Dataset has {len(dataset['rows'])} rows, expected 30. Adjusting...")
                # Adjust to exactly 30 rows
                if len(dataset["rows"]) > 30:
                    dataset["rows"] = dataset["rows"][:30]
                else:
                    # Repeat last row to reach 30
                    last_row = dataset["rows"][-1] if dataset["rows"] else []
                    while len(dataset["rows"]) < 30:
                        dataset["rows"].append(last_row.copy() if last_row else [])
            
            # Validate column count
            schema_cols = len(dataset["schema"])
            if schema_cols < 4 or schema_cols > 7:
                logger.warning(f"Dataset has {schema_cols} columns, expected 4-7")
        
        # Ensure question has required fields
        if "type" not in question_data["question"]:
            question_data["question"]["type"] = "aiml_coding"
        if "execution_environment" not in question_data["question"]:
            question_data["question"]["execution_environment"] = "jupyter_notebook"
        if "tasks" not in question_data["question"]:
            question_data["question"]["tasks"] = []
        if "constraints" not in question_data["question"]:
            question_data["question"]["constraints"] = []
        
        logger.info(f"Successfully generated AIML question: {title}, skill={skill}, dataset_required={requires_dataset}")
        return question_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}")
    except Exception as e:
        logger.exception(f"Error generating AIML question: {e}")
        raise Exception(f"OpenAI API error: {e}")


async def generate_topic_suggestions(
    skill: str,
    difficulty: str
) -> List[str]:
    """
    Generate AI-suggested topics based on skill and difficulty level.
    
    Args:
        skill: Skill area (Python, AI, Machine Learning, Deep Learning, Data Science)
        difficulty: easy, medium, or hard
    
    Returns:
        List of suggested topics for the given skill and difficulty
    """
    settings = get_aiml_settings()
    
    prompt = f"""You are an expert AI/ML educator. Generate a list of relevant topics for creating competency assessment questions.

Skill: {skill}
Difficulty Level: {difficulty}

Generate 10-15 specific, actionable topics that are appropriate for {difficulty} level questions in {skill}.

Requirements:
- Topics should be specific and focused (e.g., "Array Operations" not just "Arrays")
- Topics should match the difficulty level ({difficulty})
- Topics should be relevant to {skill}
- Return ONLY a JSON array of topic strings
- No explanations, no markdown, just the JSON array

Example format:
["Topic 1", "Topic 2", "Topic 3", ...]

Return the JSON array now:"""

    try:
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert AI/ML educator. Always return valid JSON arrays only. Never include markdown code blocks or explanations outside JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        if not response.choices or not response.choices[0].message.content:
            raise ValueError("OpenAI API returned empty response")
        
        content = response.choices[0].message.content.strip()
        logger.info(f"Raw AI topic suggestions response (first 200 chars): {content[:200]}")
        
        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Extract JSON array
        json_start = content.find("[")
        json_end = content.rfind("]") + 1
        
        if json_start >= 0 and json_end > json_start:
            content = content[json_start:json_end]
        
        if not content:
            raise ValueError("No JSON array found in AI response")
        
        # Parse JSON
        try:
            topics = json.loads(content)
            if not isinstance(topics, list):
                raise ValueError("AI response is not a list")
            
            # Validate and clean topics
            valid_topics = []
            for topic in topics:
                if isinstance(topic, str) and topic.strip():
                    valid_topics.append(topic.strip())
            
            if not valid_topics:
                # Fallback to default topics if AI returns empty
                logger.warning(f"AI returned no valid topics, using fallback for skill={skill}, difficulty={difficulty}")
                return _get_fallback_topics(skill, difficulty)
            
            logger.info(f"Successfully generated {len(valid_topics)} topic suggestions for skill={skill}, difficulty={difficulty}")
            return valid_topics
            
        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse JSON. Content preview: {content[:200]}")
            # Fallback to default topics
            return _get_fallback_topics(skill, difficulty)
        
    except Exception as e:
        logger.exception(f"Error generating topic suggestions: {e}")
        # Fallback to default topics
        return _get_fallback_topics(skill, difficulty)


def _get_fallback_topics(skill: str, difficulty: str) -> List[str]:
    """Fallback topics if AI generation fails"""
    fallback_topics = {
        "Python": {
            "easy": ["Basic Python", "Data Types", "Control Flow", "Functions", "Lists and Tuples"],
            "medium": ["NumPy Basics", "Object-Oriented Programming", "File Handling", "Error Handling", "List Comprehensions"],
            "hard": ["Advanced NumPy", "Decorators", "Generators", "Context Managers", "Multithreading"]
        },
        "AI": {
            "easy": ["AI Basics", "Search Algorithms", "Problem Solving", "Heuristics"],
            "medium": ["Natural Language Processing Basics", "Computer Vision Basics", "Knowledge Representation"],
            "hard": ["Advanced NLP", "Advanced Computer Vision", "Expert Systems", "Planning and Reasoning"]
        },
        "Machine Learning": {
            "easy": ["ML Basics", "Supervised Learning", "Linear Regression", "Classification Basics"],
            "medium": ["Feature Engineering", "Model Evaluation", "Cross-Validation", "Hyperparameter Tuning"],
            "hard": ["Ensemble Methods", "Advanced Algorithms", "Model Optimization", "Bias-Variance Tradeoff"]
        },
        "Deep Learning": {
            "easy": ["Neural Networks Basics", "Forward Propagation", "Backpropagation Basics"],
            "medium": ["CNNs", "RNNs", "Transfer Learning", "Regularization"],
            "hard": ["Transformers", "GANs", "Advanced Architectures", "Optimization Techniques"]
        },
        "Data Science": {
            "easy": ["Data Analysis Basics", "Data Visualization", "Pandas Basics", "Statistical Basics"],
            "medium": ["Data Preprocessing", "Exploratory Data Analysis", "Feature Selection"],
            "hard": ["Advanced Data Analysis", "Time Series Analysis", "Hypothesis Testing", "Advanced Statistics"]
        }
    }
    
    skill_topics = fallback_topics.get(skill, {})
    difficulty_topics = skill_topics.get(difficulty.lower(), skill_topics.get("medium", ["General Topics"]))
    return difficulty_topics
