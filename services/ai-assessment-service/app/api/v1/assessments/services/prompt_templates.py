"""
Module: prompt_templates.py
Purpose: Constants, keyword lists, and regex patterns for topic/question classification

This module contains ALL constants used across the assessment services.
By centralizing these, we can:
- Easily modify prompts without touching logic
- Version control prompt changes
- A/B test different keyword lists
- Maintain consistency across modules

Dependencies:
- NONE (zero imports - this is a constants-only module)

Example usage:
    ```python
    from app.api.v1.assessments.services.prompt_templates import V2_AIML_KEYWORDS
    
    if any(keyword in topic.lower() for keyword in V2_AIML_KEYWORDS):
        # Topic is AIML-related
    ```

Note: This module has ZERO dependencies to prevent circular imports.
All other modules can safely import from here.
"""
from __future__ import annotations

# ============================================================================
# JUDGE0 UNSUPPORTED FRAMEWORKS
# ============================================================================

# Moved from topic_service_v2.py:64-141
# List of frameworks/libraries not supported by Judge0
JUDGE0_UNSUPPORTED_FRAMEWORKS = [
    "django",
    "flask",
    "fastapi",
    "react",
    "angular",
    "vue",
    "next",
    "nextjs",
    "express",
    "spring",
    "hibernate",
    "laravel",
    "symfony",
    "rails",
    "ruby on rails",
    "asp.net",
    "dotnet",
    ".net",
    "tensorflow",
    "pytorch",
    "keras",
    "scikit-learn",
    "scikit",
    "pandas",
    "numpy",
    "matplotlib",
    "seaborn",
    "jupyter",
    "jupyter notebook",
    "selenium",
    "cypress",
    "jest",
    "mocha",
    "junit",
    "pytest",
    "unittest",
    "maven",
    "gradle",
    "npm",
    "yarn",
    "webpack",
    "babel",
    "gulp",
    "grunt",
    # Treat SQL/database topics as non-Judge0-coding to prevent auto-conversion to Coding
    "sql",
    "database",
    "mysql",
    "postgresql",
    "sqlite",
    "oracle",
    "mssql",
    # Web technologies / browser APIs (platform doesn't support web execution)
    "html",
    "css",
    "scss",
    "sass",
    "less",
    "tailwind",
    "bootstrap",
    "dom",
    "document",
    "window",
    "browser",
    "fetch",
    "localstorage",
    "sessionstorage",
    "cookie",
    "vite",
    "rollup",
    "parcel",
    "jquery",
    "d3",
    "chart.js",
    "three.js",
]


# ============================================================================
# JUDGE0 SUPPORTED PROGRAMMING LANGUAGES (FOR CODING QUESTIONS)
# ============================================================================

# CRITICAL: ONLY these 10 languages are supported by Judge0 platform
# These are the ONLY languages that should generate Coding question types
# Any other language/framework should be MCQ/Subjective
JUDGE0_SUPPORTED_LANGUAGES = [
    # 1. Python
    "python",
    
    # 2. JavaScript
    "javascript", "js", "node", "nodejs", "node.js",
    
    # 3. C++
    "c++", "cpp", "cplusplus", "c plus plus",
    
    # 4. Java
    "java",
    
    # 5. C
    "c", "c programming",
    
    # 6. Go
    "go", "golang",
    
    # 7. Rust
    "rust",
    
    # 8. C# (C Sharp)
    "csharp", "c#", "c sharp", "c-sharp",
    
    # 9. Kotlin
    "kotlin",
    
    # 10. TypeScript
    "typescript", "ts",
]

# Programming languages that require Coding questions (ONLY Judge0-supported)
# When user adds these as custom skills, topics MUST be assigned "Coding" type
# ⚠️ CRITICAL: Only these 10 languages - NO others
CODING_LANGUAGES = [
    "python",           # 1
    "javascript",       # 2
    "cpp",             # 3 (C++)
    "java",            # 4
    "c",               # 5
    "go",              # 6
    "rust",            # 7
    "csharp",          # 8 (C#)
    "kotlin",          # 9
    "typescript",      # 10
]


# ============================================================================
# AIML KEYWORDS
# ============================================================================

# Moved from topic_service_v2.py:143-153
# Additional deterministic classifiers for v2 topic flows (keeps UI consistent with backend restrictions)
V2_AIML_KEYWORDS = [
    "pandas", "numpy", "matplotlib", "seaborn", "plotly", "scipy",
    "tensorflow", "keras", "pytorch", "torch", "scikit-learn", "sklearn",
    "machine learning", "deep learning", "neural network", "random forest", "decision tree",
    "regression", "classification", "clustering", "supervised learning", "unsupervised learning",
    "gradient descent", "backpropagation",
    "jupyter", "notebook", "colab", "anaconda",
    "data preprocessing", "feature engineering", "model training", "dataframe", "series",
    "model evaluation", "cross validation",
]

# Moved from topic_service_v2.py:177-184
V2_AIML_THEORY_KEYWORDS = [
    " vs ", " versus ", "compare", "comparison", "difference", "differences",
    "advantages", "disadvantages", "benefits", "drawbacks",
    "concept", "concepts", "principle", "principles", "fundamental", "fundamentals", "basic", "basics",
    "theory", "explained", "explain", "explanation", "understanding", "overview", "introduction",
    "what is", "why", "when", "how does",
    "architecture", "design", "workflow", "process",
]

# Moved from topic_service_v2.py:186-193
V2_AIML_EXECUTION_KEYWORDS = [
    "implement", "implementation", "build", "train", "fit", "predict",
    "write code", "coding", "notebook", "jupyter", "colab",
    "using pandas", "with pandas", "using numpy", "with numpy",
    "using sklearn", "with sklearn", "using scikit-learn", "with scikit-learn",
    "using tensorflow", "with tensorflow", "using pytorch", "with pytorch",
    "data preprocessing", "feature engineering", "model training",
]


# ============================================================================
# SQL KEYWORDS
# ============================================================================

# Moved from topic_service_v2.py:155-165
V2_SQL_THEORY_KEYWORDS = [
    " vs ", " versus ", "compare", "comparison", "difference", "differences",
    "advantages", "disadvantages", "benefits", "drawbacks",
    "concept", "concepts", "principle", "principles", "fundamental", "fundamentals", "basic", "basics",
    "explained", "explain", "explanation", "understanding", "overview", "introduction",
    "types of", "what is", "why", "when",
    "strategy", "strategies", "approach", "approaches", "technique", "techniques", "best practice", "best practices",
    "design", "architecture", "modeling", "modelling",
    "vulnerability", "vulnerabilities", "security", "prevention", "mitigation",
    "injection",
]

# Moved from topic_service_v2.py:167-175
V2_SQL_EXECUTION_KEYWORDS = [
    "write sql", "write a sql", "write query", "write a query", "construct query", "create query",
    "sql query to", "query to", "using sql to",
    "implement stored procedure", "write stored procedure", "create stored procedure", "stored procedure implementation",
    "create procedure", "write procedure", "implement procedure",
    "create trigger", "write trigger", "trigger implementation",
    "optimize query", "optimizing query", "query optimization", "rewrite query", "improve query performance",
    "recursive query", "writing recursive",
]

# Moved from topic_service_v2.py:195-223
V2_SQL_INDICATOR_PATTERNS = [
    # DB indicators must be word-boundary based to avoid substring false positives (e.g., "overview" contains "view")
    r"\bsql\b",
    r"\bmysql\b",
    r"\bpostgresql\b",
    r"\bsqlite\b",
    r"\boracle\b",
    r"\bmssql\b",
    r"\bdatabase\b",
    r"\bdb\b",
    r"\bschema\b",
    r"\btable\b",
    r"\btables\b",
    r"\bquery\b",
    r"\bqueries\b",
    r"\bstored\s+procedure\b",
    r"\btrigger\b",
    r"\bview\b",
    r"\bindex\b",
    r"\bindexes\b",
    r"\bindexing\b",
    r"\btransaction\b",
    r"\btransactions\b",
    r"\bacid\b",
    r"\bprimary\s+key\b",
    r"\bforeign\s+key\b",
    r"\bnormalization\b",
    r"\bdenormalization\b",
]


# ============================================================================
# WEB KEYWORDS
# ============================================================================

# Moved from topic_service_v2.py:225-236
V2_WEB_KEYWORDS = [
    "react", "angular", "vue", "svelte", "nextjs", "next.js", "nuxt", "gatsby", "ember",
    "html", "css", "scss", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra ui", "ant design",
    "dom", "browser", "document", "window", "event listener", "fetch api", "localstorage", "sessionstorage",
    "cookie", "webstorage",
    "express", "koa", "fastify", "nest", "nestjs", "meteor",
    "webpack", "vite", "rollup", "parcel", "babel",
    "jquery", "d3", "chart.js", "three.js", "gsap", "anime.js",
    "frontend", "web development", "responsive design", "web page", "website", "web app", "web application",
    "spa", "single page", "ssr", "server side rendering", "csr", "client side rendering",
    "node server", "express server", "api endpoint", "http server", "rest api in node",
]

