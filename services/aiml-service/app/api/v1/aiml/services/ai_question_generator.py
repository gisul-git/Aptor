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

**REQUIRED for Hard (even with 40-50 rows):**
✅ Multiple models comparison (3+ models)
✅ Hyperparameter tuning (GridSearchCV/RandomizedSearchCV with 3+ parameters)
✅ Cross-validation (5-fold minimum)
✅ Business metrics (cost analysis, ROI, threshold tuning)
✅ Feature engineering (interaction features, encoding, scaling)
✅ Class imbalance handling (SMOTE, class_weight if applicable)
✅ Model evaluation beyond accuracy (precision/recall/F1/AUC)
✅ Decision threshold optimization for business goals

**Examples by Difficulty (Notice: complexity, not dataset size):**

**Easy (10-15 rows):**
"Load CSV with pandas, handle missing values, split train/test (80/20), train Logistic Regression, report accuracy"

**Medium (20-30 rows):**
"Build pipeline: StandardScaler + feature engineering (2 interaction features), compare 3 models (Logistic Regression, Random Forest, XGBoost) with 5-fold cross-validation, report precision/recall/F1/AUC, select best model"

**Hard (40-50 rows):**
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
- **Easy**: 10-15 rows, 4-6 columns (basic ML workflow, < 30 seconds execution)
- **Medium**: 20-30 rows, 6-10 columns (model comparison + tuning, < 1 minute execution)
- **Hard**: 40-50 rows, 8-12 columns (full ML pipeline + business analysis, < 2 minutes execution)

**CRITICAL: Generate EXACTLY the specified number of rows. Do NOT use '...' or truncate. Every row must be complete and unique.**

**IMPORTANT**: 
- Dataset size does NOT determine difficulty
- Difficulty comes from: model complexity, feature engineering, business analysis
- Keep datasets small for fast execution on candidate hardware
- Focus on ML thinking, not big data processing
- Dataset feature names MUST reflect Assessment Title context: "{title}"

DIFFICULTY GUIDELINES:
- **Easy**: Basic operations, single model, accuracy only (dataset: 10-15 rows OR optional)
- **Medium**: Feature engineering, 2-3 models comparison, cross-validation, multiple metrics (dataset REQUIRED: 20-30 rows)
- **Hard**: Advanced feature engineering, 3+ models, GridSearchCV, business cost analysis, threshold tuning (dataset REQUIRED: 40-50 rows)

{'=' * 80}
DATASET STRATEGY - CHOOSE ONE OF THREE OPTIONS:
{'=' * 80}

**CRITICAL**: Choose the most appropriate dataset source for the question.

OPTION 1: sklearn Built-in Dataset (PREFERRED when topic matches)
------------------------------------------------------------------

Use sklearn datasets when the question fits standard ML problems:
- Classification → iris, wine, breast_cancer, digits
- Regression → diabetes, california_housing, boston
- Clustering → iris (unsupervised)

**Available sklearn Datasets:**

1. **load_iris** - Iris flower classification
   - 150 samples, 4 features, 3 classes (setosa, versicolor, virginica)
   - Topics: Classification, Data Preprocessing, Model Comparison
   - Difficulty: Easy, Medium

2. **load_wine** - Wine quality classification
   - 178 samples, 13 features, 3 wine classes
   - Topics: Classification, Feature Engineering, Hyperparameter Tuning
   - Difficulty: Medium

3. **load_breast_cancer** - Cancer diagnosis (malignant/benign)
   - 569 samples, 30 features, binary classification
   - Topics: Binary Classification, Medical Diagnosis, Model Evaluation
   - Difficulty: Medium, Hard

4. **load_diabetes** - Diabetes progression prediction
   - 442 samples, 10 features, regression target
   - Topics: Regression, Feature Scaling, Model Evaluation
   - Difficulty: Medium

5. **fetch_california_housing** - California house price prediction
   - 20,640 samples, 8 features, regression target
   - Topics: Regression, Large Dataset Handling, Feature Engineering
   - Difficulty: Medium, Hard

6. **load_digits** - Handwritten digit recognition
   - 1,797 samples, 64 features (8x8 images), 10 classes
   - Topics: Image Classification, Multi-class Classification
   - Difficulty: Medium, Hard

**If using sklearn dataset:**

1. In question description, provide COMPLETE loading code:

Example for iris:
"This question uses the Iris flower dataset from sklearn. Load it using:
```python
from sklearn.datasets import load_iris
import pandas as pd

# Load the dataset
iris = load_iris(as_frame=True)
df = iris.frame

# Separate features and target
X = df.drop('target', axis=1)
y = df['target']

# Feature names: ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)']
# Target names: ['setosa', 'versicolor', 'virginica']
```

The dataset contains 150 samples of iris flowers with measurements of sepal and petal dimensions."

2. In JSON response, use this format:
```json
{{
  "dataset": {{
    "source": "sklearn",
    "name": "iris",
    "load_code": "from sklearn.datasets import load_iris\\nimport pandas as pd\\n\\niris = load_iris(as_frame=True)\\ndf = iris.frame\\nX = df.drop('target', axis=1)\\ny = df['target']",
    "description": "Iris flower classification dataset with 150 samples, 4 features, and 3 classes",
    "samples": 150,
    "features": 4,
    "target_column": "target"
  }}
}}
```

**Benefits of sklearn datasets:**
- No JSON generation (no truncation errors)
- Candidates recognize the dataset
- Well-documented, tested data
- Fast loading from library


OPTION 2: AI-Generated Synthetic Dataset (For custom scenarios)
----------------------------------------------------------------

Use when:
- Topic doesn't match sklearn datasets
- Custom business scenario (e.g., "company sales prediction")
- Specific domain context (e.g., "IoT sensor data", "customer behavior")
- Assessment Title requires unique dataset

**CRITICAL REQUIREMENTS FOR SYNTHETIC DATA:**

1. **Row Count Guidelines** (hardware-friendly execution):
   - Easy: 10-15 rows, 4-6 columns (< 30 seconds execution)
   - Medium: 20-30 rows, 6-10 columns (< 1 minute execution)
   - Hard: 40-50 rows, 8-12 columns (< 2 minutes execution)

2. **CRITICAL: YOU MUST INCLUDE ALL ROWS IN COMPLETE JSON FORMAT**
   - Generate EXACTLY the specified number of rows (10-15 for Easy, 20-30 for Medium, 40-50 for Hard)
   - NO "..." abbreviations
   - NO ellipsis or truncation
   - Every row must be a complete array
   - All rows must be included in the JSON response
   - Do NOT use '...' or truncate - every row must be complete and unique

3. **Data Quality Requirements:**
   - Realistic data that reflects real-world scenarios
   - Feature names MUST be domain-specific and reflect Assessment Title: "{title}"
   - Include target/label column for supervised learning
   - For Hard: Include realistic distributions, missing values (use null), outliers
   - Avoid trivial correlations and target leakage
   - Include mild ambiguity (contradictory samples)
   - Add realistic noise/uncertainty

4. **Schema Requirements:**
   - Simple schema (4-12 columns based on difficulty)
   - Types: "int", "float", "string", "bool"
   - Column names must be meaningful and domain-specific

**Example of CORRECT synthetic dataset (25 rows for Medium difficulty):**
```json
{{
  "dataset": {{
    "source": "synthetic",
    "schema": [
      {{"name": "customer_id", "type": "int"}},
      {{"name": "age", "type": "int"}},
      {{"name": "income", "type": "float"}},
      {{"name": "credit_score", "type": "int"}},
      {{"name": "months_active", "type": "int"}},
      {{"name": "purchase_frequency", "type": "float"}},
      {{"name": "churned", "type": "bool"}}
    ],
    "rows": [
      [1, 25, 50000.0, 680, 12, 2.5, false],
      [2, 30, 60000.0, 720, 24, 4.2, false],
      [3, 28, 55000.0, 650, 6, 1.8, true],
      [4, 35, 75000.0, 750, 36, 5.1, false],
      [5, 22, 45000.0, 620, 3, 1.2, true],
      ... (continue for ALL 25 rows - DO NOT USE "..." HERE!)
      [25, 31, 62000.0, 710, 18, 3.8, false]
    ]
  }}
}}
```

**CRITICAL**: You MUST include all rows completely (10-15 for Easy, 20-30 for Medium, 40-50 for Hard).
The example above shows "..." only as a placeholder in this documentation. 
In your actual JSON response, include EVERY SINGLE ROW. Do NOT use '...' or truncate.


OPTION 3: Kaggle/External Dataset (For large-scale real-world scenarios)
-------------------------------------------------------------------------

Use when:
- Question requires very large datasets (10,000+ rows)
- Real-world complexity beyond sklearn scope
- Domain-specific data not available in sklearn
- Difficulty is Hard and scenario demands production-scale data

**When to use Kaggle datasets:**
- Hard difficulty questions requiring extensive data
- Specific domains: finance (stock prices), healthcare (medical records), e-commerce (transactions)
- When dataset size is critical to the learning objective

**JSON Format for Kaggle datasets:**
```json
{{
  "dataset": {{
    "source": "kaggle",
    "name": "Telco Customer Churn Dataset",
    "kaggle_url": "https://www.kaggle.com/datasets/blastchar/telco-customer-churn",
    "download_instructions": "Admin: Please download this dataset from Kaggle and upload it via the 'Dataset Upload' page in question creation. The dataset will then be available to candidates as a CSV file.",
    "description": "Telco customer churn dataset with 7,043 customer records including demographics, services subscribed, account information, and churn status.",
    "file_format": "csv",
    "expected_columns": ["customerID", "gender", "SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges", "Churn"],
    "samples": 7043,
    "features": 21
  }}
}}
```

**In question description, tell candidates:**

"This question uses the Telco Customer Churn dataset. The dataset will be provided as a CSV file.

Load it using:
```python
import pandas as pd
df = pd.read_csv('telco_customer_churn.csv')
```

The dataset contains 7,043 customer records with 21 features including customer demographics, services, account details, and churn status."

**Admin workflow for Kaggle datasets:**
1. Admin receives question with Kaggle dataset requirement
2. Admin downloads dataset from provided Kaggle URL
3. Admin uploads CSV via "Dataset Upload" page in question editor
4. Dataset becomes available to candidates when they take the test


{'=' * 80}
DATASET SELECTION DECISION TREE:
{'=' * 80}

STEP 1: Does the topic/task match a sklearn dataset?
→ YES: Use OPTION 1 (sklearn) - include COMPLETE loading code

STEP 2: Is it a custom scenario requiring moderate data (10-50 rows)?
→ YES: Use OPTION 2 (synthetic) - generate ALL rows completely (no "...")

STEP 3: Does it require large-scale real-world data (10,000+ rows)?
→ YES: Use OPTION 3 (kaggle) - provide download URL and admin instructions

**DEFAULT**: If unsure, use OPTION 2 (synthetic) with appropriate row count for difficulty.


{'=' * 80}
DATASET VALIDATION RULES:
{'=' * 80}

**For sklearn datasets:**
- ✅ Must include "source": "sklearn"
- ✅ Must include complete "load_code" with imports
- ✅ Must mention dataset name in question description
- ✅ Must provide context about features and target

**For synthetic datasets:**
- ✅ Must include "source": "synthetic"
- ✅ Row count MUST match difficulty (Easy: 10-15, Medium: 20-30, Hard: 40-50)
- ✅ ALL rows must be included in JSON (NO "..." or ellipsis)
- ✅ Generate EXACTLY the specified number of rows - do NOT truncate
- ✅ Schema must have appropriate columns for difficulty
- ✅ Feature names must be domain-specific
- ✅ Data must be realistic with appropriate noise/variation

**For Kaggle datasets:**
- ✅ Must include "source": "kaggle"
- ✅ Must include valid "kaggle_url"
- ✅ Must include "download_instructions" for admin
- ✅ Must mention dataset loading in question description
- ✅ Must list "expected_columns"

{'=' * 80}

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
  "dataset": {{
    // OPTION 1: sklearn dataset
    "source": "sklearn",
    "name": "iris",
    "load_code": "from sklearn.datasets import load_iris\\nimport pandas as pd\\niris = load_iris(as_frame=True)\\ndf = iris.frame",
    "description": "Dataset description",
    "samples": 150,
    "features": 4
  }} OR {{
    // OPTION 2: Synthetic dataset
    "source": "synthetic",
    "schema": [{{"name": "column1", "type": "int"}}, {{"name": "column2", "type": "float"}}],
    "rows": [[1, 2.5], [2, 3.5], ... ALL ROWS INCLUDED, NO "..." ]
  }} OR {{
    // OPTION 3: Kaggle dataset
    "source": "kaggle",
    "name": "Dataset Name",
    "kaggle_url": "https://www.kaggle.com/datasets/...",
    "download_instructions": "Admin: Download and upload via Dataset Upload page",
    "description": "Dataset description",
    "file_format": "csv",
    "expected_columns": ["col1", "col2"],
    "samples": 10000,
    "features": 20
  }} OR null,
  "test_cases": [
    {{
      "task_number": 1,
      "description": "Verify dataset loading and preprocessing",
      "validation_type": "dataset_load_check",
      "expected_output": "pd.read_csv",
      "points": 20
    }},
    {{
      "task_number": 1,
      "description": "Verify TfidfVectorizer import",
      "validation_type": "import_check",
      "expected_output": "sklearn.feature_extraction.text.TfidfVectorizer",
      "points": 13.33
    }},
    {{
      "task_number": 2,
      "description": "Verify cross-validation was performed",
      "validation_type": "function_call_check",
      "expected_output": "cross_val_score",
      "points": 20
    }},
    {{
      "task_number": 2,
      "description": "Verify model training (.fit() called)",
      "validation_type": "model_training_check",
      "expected_output": ".fit(",
      "points": 13.33
    }},
    {{
      "task_number": 3,
      "description": "Verify hyperparameter tuning (GridSearchCV or RandomizedSearchCV)",
      "validation_type": "function_call_check",
      "expected_output": "GridSearchCV",
      "points": 20
    }},
    {{
      "task_number": 3,
      "description": "Verify output contains numeric results",
      "validation_type": "output_structure_check",
      "expected_output": "numeric",
      "points": 13.34
    }}
  ]
}}

CRITICAL: 
- **Dataset Strategy**: Choose sklearn (preferred), synthetic (custom scenarios), or kaggle (large-scale) based on topic and requirements
- **For sklearn datasets**: Include complete load_code with imports in question description
- **For synthetic datasets**: Row count MUST match difficulty (hardware-friendly):
  * Easy: 10-15 rows, 4-6 columns
  * Medium: 20-30 rows, 6-10 columns
  * Hard: 40-50 rows, 8-12 columns
  * **CRITICAL**: Generate EXACTLY the specified number of rows - Include ALL rows completely - NO "..." or ellipsis in JSON
- **For kaggle datasets**: Provide kaggle_url and download_instructions for admin
- Schema must have appropriate columns for difficulty level
- Tasks must be actionable, outcome-driven, and decision-oriented (NOT step-based/procedural)
- Description must be 2-3 paragraphs with business context and MUST relate to Assessment Title: "{title}"
- **CRITICAL: Include test_cases array with validation criteria for each task.**
  For each task, specify MULTIPLE test_cases to comprehensively validate:
  - task_number: Which task this test case validates (1-indexed)
  - description: What to check (e.g., "Verify dataset loading", "Verify model training")
  - validation_type: How to validate (use multiple types per task):
    **CRITICAL: PREFER AST-based validation over string matching for code verification**
    * "import_check": ✅ PREFERRED - Verify import exists using AST (e.g., "sklearn.feature_extraction.text.TfidfVectorizer")
    * "function_call_check": ✅ PREFERRED - Verify function was called using AST (e.g., "cross_val_score", "fit", "GridSearchCV")
    * "dataset_load_check": ✅ PREFERRED - Verify dataset loading code exists using AST (expected_output can be "pd.read_csv")
    * "model_training_check": ✅ PREFERRED - Verify model.fit() was called using AST (expected_output can be ".fit(")
    * "output_structure_check": Verify output format (expected_output: "numeric|contains_dataframe|contains_array")
    * "exact_match": Output must exactly match expected_output
    * "contains": Output must contain expected_output as substring/keyword
    * "numeric_range": Expected_output is range like "0.8-0.9", check if number is in range
    * "code_check": ⚠️ AVOID - Only use for simple string patterns that can't be detected by AST (e.g., checking for specific comments or docstrings)
  - expected_output: The value/pattern to check against
  - points: Distribute points across test_cases (total should equal 100)
- IMPORTANT: 
  - Use multiple test_cases per task for comprehensive validation
  - **PREFER AST-based validation (import_check, function_call_check) over code_check**
  - **NEVER use code_check for function/class names - use function_call_check instead**
  - **NEVER use code_check for imports - use import_check instead**
  - code_check can be fooled by print statements - AST validation checks actual code structure
  - Verify actual implementation using AST, not just string matching
  - Total points should equal 100 across all test_cases
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
        
        # DEBUG: Print full response to console
        print("\n" + "="*80)
        print("FULL GPT RESPONSE:")
        print("="*80)
        print(content)
        print("="*80 + "\n")
        
        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Remove JavaScript-style comments BEFORE JSON extraction - JSON doesn't support comments!
        import re
        # Remove single-line comments (// ...) - but be careful not to remove // in strings
        # More robust approach: process character by character to track string state
        cleaned_content = []
        i = 0
        in_string = False
        quote_char = None
        while i < len(content):
            char = content[i]
            
            # Track string state
            if char in ('"', "'") and (i == 0 or content[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    quote_char = char
                elif char == quote_char:
                    in_string = False
                    quote_char = None
                cleaned_content.append(char)
            # Check for // comment (only if not in string)
            elif char == '/' and i < len(content) - 1 and content[i+1] == '/' and not in_string:
                # Skip to end of line
                while i < len(content) and content[i] != '\n':
                    i += 1
                # Keep the newline
                if i < len(content):
                    cleaned_content.append('\n')
            # Check for /* comment (only if not in string)
            elif char == '/' and i < len(content) - 1 and content[i+1] == '*' and not in_string:
                # Skip to end of comment */
                i += 2  # Skip /*
                while i < len(content) - 1:
                    if content[i] == '*' and content[i+1] == '/':
                        i += 2  # Skip */
                        break
                    i += 1
            else:
                cleaned_content.append(char)
            i += 1
        
        content = ''.join(cleaned_content)
        
        # Extract JSON object - use a more robust method
        json_start = content.find("{")
        if json_start < 0:
            raise ValueError("No JSON object found in AI response")
        
        # Find the matching closing brace by counting braces
        brace_count = 0
        json_end = -1
        for i in range(json_start, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_end = i + 1
                    break
        
        if json_end <= json_start:
            logger.warning(f"Could not find matching closing brace. Using rfind fallback.")
            json_end = content.rfind("}") + 1
            if json_end <= json_start:
                raise ValueError("No complete JSON object found in AI response")
        
        content = content[json_start:json_end]
        
        if not content:
            raise ValueError("No JSON content found in AI response")
        
        # Try to fix common JSON issues
        # Remove trailing commas before closing braces/brackets
        content = re.sub(r',(\s*[}\]])', r'\1', content)
        
        # Fix incomplete arrays - check for unclosed brackets
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        if open_brackets > close_brackets:
            # Add missing closing brackets at the end
            missing_brackets = open_brackets - close_brackets
            content = content + ']' * missing_brackets
            logger.info(f"Fixed {missing_brackets} missing closing bracket(s) in JSON")
        
        # Fix incomplete dataset rows array specifically
        # Look for "rows": [ pattern and ensure it's closed
        rows_match = re.search(r'"rows"\s*:\s*\[', content)
        if rows_match:
            start_pos = rows_match.end()
            # Find the matching closing bracket for rows array
            bracket_count = 1
            end_pos = -1
            in_string = False
            quote_char = None
            
            for i in range(start_pos, len(content)):
                char = content[i]
                # Track string state to avoid counting brackets inside strings
                if char in ('"', "'") and (i == 0 or content[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        quote_char = char
                    elif char == quote_char:
                        in_string = False
                        quote_char = None
                elif not in_string:
                    if char == '[':
                        bracket_count += 1
                    elif char == ']':
                        bracket_count -= 1
                        if bracket_count == 0:
                            end_pos = i + 1
                            break
            
            # If rows array is not closed, try to close it properly
            if bracket_count > 0:
                # Find the last complete row (ending with ],)
                rows_section = content[start_pos:]
                # Try to find where the last complete row ends (look for ], pattern)
                last_complete_row = rows_section.rfind('],')
                if last_complete_row >= 0:
                    # Close the array after the last complete row
                    insert_pos = start_pos + last_complete_row + 2
                    content = content[:insert_pos] + ']' + content[insert_pos:]
                    logger.info("Fixed incomplete rows array in JSON")
                else:
                    # Check if there's at least one row
                    if '[' in rows_section[:100]:  # Check first 100 chars for at least one row
                        # Find the last ] that closes a row
                        last_row_end = rows_section.rfind(']')
                        if last_row_end >= 0:
                            insert_pos = start_pos + last_row_end + 1
                            content = content[:insert_pos] + ']' + content[insert_pos:]
                            logger.info("Fixed incomplete rows array - closed after last row")
                        else:
                            # No rows found, close as empty array
                            content = content[:start_pos] + '[]' + content[start_pos:]
                            logger.warning("Rows array had no complete rows, closed as empty array")
                    else:
                        # No rows found, close as empty array
                        content = content[:start_pos] + '[]' + content[start_pos:]
                        logger.warning("Rows array was empty/incomplete, closed it as empty array")
        
        # Parse JSON with better error reporting
        try:
            question_data = json.loads(content)
            
            # Validate dataset completeness
            dataset_info = question_data.get("dataset")
            if dataset_info:
                source = dataset_info.get("source")
                
                if source == "sklearn":
                    # Validate sklearn dataset
                    if not dataset_info.get("load_code"):
                        raise ValueError("sklearn dataset missing 'load_code'")
                    if "import" not in dataset_info.get("load_code", ""):
                        raise ValueError("sklearn load_code must include import statements")
                    logger.info(f"✅ Using sklearn dataset: {dataset_info.get('name')}")
                    
                elif source == "synthetic":
                    # Validate synthetic dataset completeness
                    rows = dataset_info.get("rows", [])
                    schema = dataset_info.get("schema", [])
                    
                    if len(rows) < 10:
                        logger.warning(f"⚠️ Synthetic dataset has only {len(rows)} rows (expected 10+)")
                    
                    # Check for truncation patterns
                    rows_str = str(rows)
                    if "..." in rows_str or "…" in rows_str or "[...]" in rows_str:
                        raise ValueError(
                            f"Synthetic dataset contains ellipsis/truncation. "
                            f"AI must include ALL {len(rows)} rows completely. "
                            f"Detected patterns: '...' or '…' in dataset JSON."
                        )
                    
                    # Validate row structure
                    expected_cols = len(schema)
                    for i, row in enumerate(rows[:5]):  # Check first 5 rows
                        if len(row) != expected_cols:
                            raise ValueError(
                                f"Row {i} has {len(row)} columns but schema defines {expected_cols}"
                            )
                    
                    logger.info(f"✅ Using synthetic dataset: {len(rows)} rows, {len(schema)} columns")
                    
                elif source == "kaggle":
                    # Validate kaggle dataset
                    if not dataset_info.get("kaggle_url"):
                        raise ValueError("Kaggle dataset missing 'kaggle_url'")
                    if not dataset_info.get("download_instructions"):
                        raise ValueError("Kaggle dataset missing 'download_instructions'")
                    logger.info(f"✅ Using Kaggle dataset: {dataset_info.get('name')}")
                    
                else:
                    raise ValueError(f"Unknown dataset source: {source}")
                    
        except json.JSONDecodeError as json_err:
            # Log more context around the error
            error_pos = json_err.pos if hasattr(json_err, 'pos') else 0
            error_line = json_err.lineno if hasattr(json_err, 'lineno') else 0
            error_col = json_err.colno if hasattr(json_err, 'colno') else 0
            
            logger.error(f"JSON parse error:")
            logger.error(f"  Position: {error_pos}")
            logger.error(f"  Line: {error_line}, Column: {error_col}")
            logger.error(f"  Error: {json_err}")
            
            # Show content around error
            start_pos = max(0, error_pos - 300)
            end_pos = min(len(content), error_pos + 300)
            logger.error(f"Content around error (chars {start_pos}-{end_pos}):")
            logger.error(f"{content[start_pos:end_pos]}")
            
            # Show line-by-line around error line
            lines = content.split('\n')
            if error_line > 0 and error_line <= len(lines):
                start_line = max(0, error_line - 3)
                end_line = min(len(lines), error_line + 3)
                logger.error(f"Lines around error ({start_line+1}-{end_line}):")
                for i in range(start_line, end_line):
                    marker = ">>> " if i == error_line - 1 else "    "
                    logger.error(f"{marker}{i+1}: {lines[i]}")
            
            logger.error(f"Full content length: {len(content)}")
            logger.error(f"First 1000 chars: {content[:1000]}")
            logger.error(f"Last 1000 chars: {content[-1000:]}")
            
            # Check specifically for dataset truncation
            if '"rows"' in content and "..." in content[content.find('"rows"'):]:
                logger.error("❌ DATASET TRUNCATION DETECTED!")
                logger.error("The AI truncated the dataset with '...'")
                logger.error("This breaks JSON parsing.")
                logger.error("Solution: Use sklearn dataset OR reduce synthetic dataset size")
            
            # Try to save problematic JSON to a file for debugging
            try:
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    f.write(content)
                    logger.error(f"Problematic JSON saved to: {f.name}")
            except Exception as save_err:
                logger.warning(f"Could not save problematic JSON: {save_err}")
            
            raise ValueError(f"Failed to parse AI response as JSON: {json_err}")
        
        # Validate structure
        if "assessment" not in question_data:
            raise ValueError("Missing 'assessment' field in AI response")
        if "question" not in question_data:
            raise ValueError("Missing 'question' field in AI response")
        # Dataset field is optional (can be null for questions without datasets)
        # Validation happens later if dataset is present
        
        # Validate test_cases if present
        if "test_cases" in question_data and question_data["test_cases"]:
            test_cases = question_data["test_cases"]
            total_points = sum(tc.get("points", 0) for tc in test_cases)
            
            # Warn if points don't total 100
            if abs(total_points - 100.0) > 0.1:
                logger.warning(f"Test cases total points: {total_points}, expected 100")
            
            # Ensure each test case has required fields
            for tc in test_cases:
                if "task_number" not in tc:
                    raise ValueError("Test case missing 'task_number'")
                if "validation_type" not in tc:
                    raise ValueError("Test case missing 'validation_type'")
                if "description" not in tc:
                    tc["description"] = f"Validation for task {tc['task_number']}"
                if "expected_output" not in tc:
                    tc["expected_output"] = ""
                if "points" not in tc:
                    tc["points"] = 0
        else:
            logger.warning("No test_cases field in AI response, will be generated during evaluation")
            question_data["test_cases"] = []
        
        # Validate dataset if present (handles all three types: sklearn, synthetic, kaggle)
        if question_data.get("dataset") is not None:
            dataset = question_data["dataset"]
            source = dataset.get("source")
            
            if source == "synthetic":
                # Validate synthetic dataset structure
                if "schema" not in dataset:
                    raise ValueError("Synthetic dataset missing 'schema' field")
                if "rows" not in dataset:
                    raise ValueError("Synthetic dataset missing 'rows' field")
                
                # Validate minimum rows exist
                if len(dataset["rows"]) < 5:
                    raise ValueError(f"Synthetic dataset too small: {len(dataset['rows'])} rows, need at least 5")
                
                # Validate column count
                schema_cols = len(dataset["schema"])
                if schema_cols < 4 or schema_cols > 12:
                    logger.warning(f"Synthetic dataset has {schema_cols} columns, expected 4-12")
            elif source == "sklearn":
                # sklearn datasets are validated earlier in the code
                pass
            elif source == "kaggle":
                # Kaggle datasets are validated earlier in the code
                pass
            else:
                # Legacy format or missing source - try to validate as synthetic
                if "schema" in dataset and "rows" in dataset:
                    logger.warning("Dataset missing 'source' field, assuming synthetic format")
                    if len(dataset["rows"]) < 5:
                        raise ValueError(f"Dataset too small: {len(dataset['rows'])} rows, need at least 5")
                else:
                    raise ValueError(f"Dataset missing required fields. Expected 'source' field or 'schema'/'rows' for legacy format")
        
        # Ensure question has required fields
        if "type" not in question_data["question"]:
            question_data["question"]["type"] = "aiml_coding"
        if "execution_environment" not in question_data["question"]:
            question_data["question"]["execution_environment"] = "jupyter_notebook"
        if "tasks" not in question_data["question"]:
            question_data["question"]["tasks"] = []
        if "constraints" not in question_data["question"]:
            question_data["question"]["constraints"] = []
        
        logger.info(f"Successfully generated AIML question with {len(question_data.get('test_cases', []))} test cases: {title}, skill={skill}, dataset_required={requires_dataset}")
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
