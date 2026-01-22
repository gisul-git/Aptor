"""
Semantic topic suggestions and context generation for Aptitude, Communication, and Logical Reasoning.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

from ....core.config import get_settings

logger = logging.getLogger(__name__)


def _is_technical_topic(topic: str) -> bool:
    """
    Detect if a topic is technical/programming-related.
    Returns True if the topic appears to be technical, False otherwise.
    """
    topic_lower = topic.lower()
    
    technical_keywords = [
        # Programming languages
        "java", "python", "javascript", "typescript", "c++", "c#", "cpp", "c ", "go ", "rust", "ruby", "php", "swift", "kotlin", "scala", "r ",
        # Frameworks and libraries
        "react", "angular", "vue", "node", "express", "django", "flask", "spring", "laravel", "rails", ".net",
        # Databases
        "sql", "mysql", "postgresql", "mongodb", "redis", "oracle", "database", "db ",
        # Technical concepts
        "api", "rest", "graphql", "microservice", "docker", "kubernetes", "aws", "azure", "gcp", "cloud",
        "algorithm", "data structure", "dsa", "leetcode", "coding", "programming", "software engineering",
        "system design", "architecture", "devops", "ci/cd", "git", "github", "gitlab",
        # Technical terms
        "function", "class", "object", "variable", "array", "list", "hash", "tree", "graph", "stack", "queue",
        "oop", "mvc", "mvp", "mvvm", "design pattern", "refactoring", "testing", "unit test", "integration test",
        "frontend", "backend", "full stack", "web development", "mobile development"
    ]
    
    # Check if topic contains any technical keywords
    for keyword in technical_keywords:
        if keyword in topic_lower:
            return True
    
    # Check if topic is a single programming language name
    programming_languages = ["java", "python", "javascript", "typescript", "c", "cpp", "c++", "go", "rust", "ruby", "php", "swift", "kotlin", "scala", "r"]
    if topic_lower.strip() in programming_languages:
        return True
    
    return False


def _get_openai_client() -> AsyncOpenAI:
    """Get OpenAI client instance."""
    settings = get_settings()
    api_key = getattr(settings, 'openai_api_key', None)
    if not api_key:
        raise ValueError("OpenAI API key not configured")
    return AsyncOpenAI(api_key=api_key)


async def suggest_topic_contexts(
    partial_input: str,
    category: str  # "aptitude", "communication", "logical_reasoning"
) -> List[Dict[str, Any]]:
    """
    Generate semantic topic suggestions based on partial user input.
    Returns list of suggested topic contexts with their semantic meaning.
    """
    if not partial_input or len(partial_input.strip()) < 2:
        return []
    
    category_descriptions = {
        "aptitude": "numerical problem-solving, quantitative reasoning, mathematical calculations",
        "communication": "written communication, professional correspondence, clarity and tone",
        "logical_reasoning": "analytical thinking, pattern recognition, logical problem-solving"
    }
    
    category_description = category_descriptions.get(category.lower(), "general assessment")
    
    # Build strict prompt for soft-skill categories
    soft_skill_categories = ["aptitude", "communication", "logical_reasoning"]
    is_soft_skill = category.lower() in soft_skill_categories
    
    if is_soft_skill:
        prompt = f"""You are an expert assessment designer. Generate ONLY soft-skill topic suggestions.

User is typing: "{partial_input}"
Category: {category_description}

CRITICAL RULES - STRICTLY ENFORCE:
- Generate ONLY non-technical, soft-skill topics
- ABSOLUTELY FORBIDDEN: programming languages, coding, algorithms, software engineering, technical frameworks
- Even if user types technical terms, suggest ONLY soft-skill topics related to the category

Generate 4-6 relevant topic suggestions that:
- Are ONLY soft-skill, non-technical topics
- Match the semantic meaning of the partial input (interpreted as soft-skill context)
- Are specific and assessment-ready
- Fit naturally within the {category_description} category
- Are domain-agnostic (work for any context)

Return ONLY a JSON array of topic labels:
[
  "Topic Suggestion 1",
  "Topic Suggestion 2",
  "Topic Suggestion 3",
  ...
]

Do NOT include explanations or markdown. Return only the JSON array."""
    else:
        prompt = f"""You are an expert assessment designer. Generate topic suggestions based on semantic understanding.

User is typing: "{partial_input}"
Category: {category_description}

Generate 4-6 relevant topic suggestions that:
- Match the semantic meaning of the partial input
- Are specific and assessment-ready
- Fit naturally within the {category_description} category
- Are domain-agnostic (work for any context)

Return ONLY a JSON array of topic labels:
[
  "Topic Suggestion 1",
  "Topic Suggestion 2",
  "Topic Suggestion 3",
  ...
]

Do NOT include explanations or markdown. Return only the JSON array."""
    
    try:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert assessment designer. Always return valid JSON arrays. Never include markdown code blocks."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        suggestions = json.loads(content)
        if not isinstance(suggestions, list):
            suggestions = [suggestions] if suggestions else []
        
        # Filter out technical topics for soft-skill categories
        filtered_suggestions = []
        for s in suggestions:
            if s and isinstance(s, str):
                topic_str = str(s).strip()
                # For soft-skill categories, filter out technical topics
                if is_soft_skill and _is_technical_topic(topic_str):
                    logger.warning(f"Filtered out technical suggestion: {topic_str}")
                    continue
                filtered_suggestions.append({"label": topic_str, "value": topic_str})
        
        return filtered_suggestions
        
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        return []


async def generate_topic_context_summary(
    topic_name: str,
    category: str
) -> Dict[str, Any]:
    """
    Generate context summary and suggested question type for a topic.
    Returns: {
        "contextSummary": str,
        "suggestedQuestionType": "MCQ" | "Subjective" | "Coding" | "SQL" | "AIML" | "PseudoCode",
        "reasoning": str
    }
    """
    # ⭐ CRITICAL: Check if topic is Coding, SQL, or AIML BEFORE generating context
    # ORDER MATTERS: Coding first (to catch Java, Kotlin, C, etc.), then SQL, then AIML
    from .services.ai_utils import _v2_is_aiml_execution_topic, _v2_is_sql_execution_topic
    from .services.ai_topic_generator import CODING_LANGUAGES
    from .services.judge0_utils import contains_unsupported_framework
    import re
    
    topic_lower = topic_name.lower().strip()
    topic_clean = topic_name.strip()
    
    # ⭐ STEP 1: Check for Coding topics FIRST (programming languages)
    # This must come BEFORE AIML check to prevent Java/Kotlin from being classified as AIML
    # ORDER: Check Coding languages first, then SQL, then AIML
    
    # Language aliases for user input variations
    LANGUAGE_ALIASES = {
        "cpp": ["c++", "cpp", "c plus plus"],
        "csharp": ["c#", "csharp", "c sharp"],
        "c": ["c"],
        "java": ["java"],
        "kotlin": ["kotlin"],
        "python": ["python"],
        "javascript": ["javascript", "js"],
        "typescript": ["typescript", "ts"],
        "go": ["go", "golang"],
        "rust": ["rust"]
    }
    
    for lang in CODING_LANGUAGES:
        matches = False
        lang_lower = lang.lower()
        
        # Get aliases for this language
        aliases = LANGUAGE_ALIASES.get(lang_lower, [lang_lower])
        
        # Check if topic matches any alias
        for alias in aliases:
            if lang_lower == "c":
                # Special handling for "C" to avoid matching "C++" or "C#"
                if topic_clean.lower() == "c" or topic_clean.lower() == "c ":
                    matches = True
                    break
                elif re.search(r'\bc\b(?![\+\#\w])', topic_lower):
                    # Additional check: must be "C programming", "C language", or start with "C "
                    c_context = r'\bc\s+(programming|language|code)'
                    if re.search(c_context, topic_lower) or re.search(r'^c\s+', topic_lower):
                        matches = True
                        break
            elif lang_lower == "cpp":
                # Match "C++", "cpp", "C Plus Plus", etc.
                if alias in topic_lower or "c++" in topic_lower or "c plus" in topic_lower:
                    matches = True
                    break
            elif lang_lower == "csharp":
                # Match "C#", "csharp", "C Sharp", etc.
                if alias in topic_lower or "c#" in topic_lower or "c sharp" in topic_lower:
                    matches = True
                    break
            else:
                # For other languages, match whole word
                pattern = r'\b' + re.escape(alias) + r'\b'
                if re.search(pattern, topic_lower):
                    matches = True
                    break
        
        if matches:
            # Check if it's a framework (not supported for Coding)
            is_framework, _ = contains_unsupported_framework(topic_lower)
            if not is_framework:
                # ⭐ CRITICAL: For simple language names (like "C", "Java", "Kotlin", "C++", "C#"), 
                # classify as Coding even without implementation keywords
                # Only require implementation keywords for complex topics
                IMPLEMENTATION_KW = [
                    "implement", "write", "create", "build", "develop", "code", "program",
                    "algorithm", "data structure", "function", "method", "class"
                ]
                has_impl = any(kw in topic_lower for kw in IMPLEMENTATION_KW)
                
                # Simple language name patterns
                is_simple_lang = (
                    topic_clean.lower() == lang_lower or
                    topic_clean.lower() in [alias for alias in aliases] or
                    topic_clean.lower().startswith(lang_lower + " ") or
                    any(topic_clean.lower().startswith(alias + " ") for alias in aliases) or
                    topic_clean.lower() == f"{lang_lower} programming" or
                    topic_clean.lower() == f"{lang_lower} language" or
                    (lang_lower == "cpp" and ("c++" in topic_clean.lower() or "cpp" in topic_clean.lower())) or
                    (lang_lower == "csharp" and ("c#" in topic_clean.lower() or "csharp" in topic_clean.lower()))
                )
                
                if is_simple_lang or has_impl:
                    # Map internal names to display names
                    display_name = {
                        "cpp": "C++",
                        "csharp": "C#",
                        "c": "C"
                    }.get(lang_lower, lang_lower.capitalize())
                    
                    return {
                        "contextSummary": f"This topic covers {topic_name} programming concepts and implementation.",
                        "suggestedQuestionType": "Coding",
                        "reasoning": f"Topic '{topic_name}' is identified as a Coding topic (language: {display_name})."
                    }
            break
    
    # ⭐ STEP 2: Check for SQL topics
    if _v2_is_sql_execution_topic(topic_lower):
        return {
            "contextSummary": f"This topic covers {topic_name} concepts and database query operations.",
            "suggestedQuestionType": "SQL",
            "reasoning": f"Topic '{topic_name}' is identified as a SQL topic based on keywords and context."
        }
    
    # ⭐ STEP 3: Check for AIML topics LAST (after Coding check)
    # This prevents Java, Kotlin, etc. from being classified as AIML
    # AIML is ONLY for Python + ML libraries
    if _v2_is_aiml_execution_topic(topic_lower):
        # ⭐ CRITICAL: Double-check that no non-Python language is mentioned
        mentions_non_python = False
        for lang in CODING_LANGUAGES:
            if lang.lower() == "python":
                continue
            pattern = r'\b' + re.escape(lang.lower()) + r'\b'
            if re.search(pattern, topic_lower):
                mentions_non_python = True
                break
        
        # Only classify as AIML if no non-Python language is mentioned
        if not mentions_non_python:
            return {
                "contextSummary": f"This topic covers {topic_name} concepts and practical applications in machine learning and data science.",
                "suggestedQuestionType": "AIML",
                "reasoning": f"Topic '{topic_name}' is identified as an AIML (AI/ML) topic based on keywords and context."
            }
    
    category_descriptions = {
        "aptitude": "numerical problem-solving and quantitative reasoning",
        "communication": "written communication, professional correspondence",
        "logical_reasoning": "analytical thinking and logical problem-solving"
    }
    
    category_description = category_descriptions.get(category.lower(), "general assessment")
    
    prompt = f"""You are an expert assessment designer. Analyze this topic and generate a context summary.

Topic: "{topic_name}"
Category: {category_description}

Generate:
1. A brief context summary (1-2 sentences) explaining what this topic evaluates
2. Suggested question type: MCQ or Subjective
   - MCQ: for numeric calculations, factual recall, quick assessment
   - Subjective: for explanations, scenarios, written responses
3. Brief reasoning for the question type choice

Return ONLY JSON:
{{
  "contextSummary": "This topic evaluates...",
  "suggestedQuestionType": "MCQ" or "Subjective",
  "reasoning": "Brief explanation"
}}"""
    
    try:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert assessment designer. Always return valid JSON. Never include markdown code blocks."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        result = json.loads(content)
        
        # Validate question type - allow AIML, SQL, Coding, PseudoCode in addition to MCQ and Subjective
        suggested_type = result.get("suggestedQuestionType", "MCQ")
        if suggested_type not in ["MCQ", "Subjective", "Coding", "SQL", "AIML", "PseudoCode"]:
            suggested_type = "MCQ"
        
        return {
            "contextSummary": result.get("contextSummary", f"This topic evaluates {category_description}."),
            "suggestedQuestionType": suggested_type,
            "reasoning": result.get("reasoning", "Based on topic analysis")
        }
        
    except Exception as exc:
        logger.error(f"Error generating context summary: {exc}", exc_info=True)
        # Fallback
        return {
            "contextSummary": f"This topic evaluates {category_description}.",
            "suggestedQuestionType": "MCQ",
            "reasoning": "Default assignment"
        }


async def suggest_topics(
    category: str,
    query: str
) -> List[str]:
    """
    Generate AI-powered topic suggestions based on category and partial query.
    
    Args:
        category: "aptitude" | "communication" | "logical_reasoning" | "technical" | "auto"
        query: Partial user input
    
    Returns:
        List of suggested topic names
    """
    if not query or len(query.strip()) < 1:
        # If query is empty, return popular suggestions for the category
        return await _get_popular_suggestions(category)
    
    category_lower = category.lower()
    soft_skill_categories = ["aptitude", "communication", "logical_reasoning"]
    is_soft_skill = category_lower in soft_skill_categories
    
    category_descriptions = {
        "aptitude": "numerical problem-solving, quantitative reasoning, mathematical calculations, percentages, ratios, time/speed/distance, profit/loss, logical puzzles, quant skills, problem-solving items. NO programming, coding, or software topics.",
        "communication": "speaking skills, grammar, writing skills, comprehension, listening, professional correspondence, language skills, writing clarity, email etiquette, professional tone. NO technical or programming topics.",
        "logical_reasoning": "deductions, patterns, non-verbal reasoning, analytical puzzles, syllogisms, sequences, logical problem-solving. NO coding, algorithms, or software engineering topics.",
        "technical": "programming, software engineering, technology, frameworks, tools, systems, implementation, real-world engineering topics",
        "auto": "mixed categories - infer the most suitable category based on the query"
    }
    
    category_description = category_descriptions.get(category_lower, "general assessment topics")
    
    # Build strict prompt for soft-skill categories
    if is_soft_skill:
        prompt = f"""You are an expert in generating SOFT-SKILL assessment topics. Generate ONLY non-technical topics.

CRITICAL RULES - STRICTLY ENFORCE:
- Category: {category}
- User entered text: "{query}"

ABSOLUTELY FORBIDDEN - DO NOT SUGGEST:
- Programming languages (Java, Python, JavaScript, C, C++, etc.)
- Coding or programming topics
- Data structures or algorithms
- System design or software architecture
- Any software engineering topics
- Technical frameworks or tools

REQUIRED - ONLY SUGGEST:
- For aptitude: numerical reasoning, logical puzzles, quant skills, problem-solving items (math-based, NOT coding)
- For communication: speaking skills, grammar, writing skills, comprehension, listening, professional writing
- For logical reasoning: deductions, patterns, non-verbal reasoning, analytical puzzles (NOT coding puzzles)

Even if user types technical terms like "java" or "python", suggest ONLY soft-skill topics that relate to the category.

Generate 6-10 suggested topics that:
- Are ONLY soft-skill, non-technical topics
- Fit the {category} category perfectly
- Are relevant to the user's input (but interpret it as soft-skill context)
- Are concise, specific, and assessment-ready
- Are NOT repetitive
- Are appropriate for professional assessments

Return ONLY a JSON array of topic names:
["Topic A", "Topic B", "Topic C", ...]

Do NOT include explanations or markdown. Return only the JSON array."""
    else:
        prompt = f"""You are an expert in categorizing and generating assessment topics.

Given:
- Selected category: {category}
- User entered text: "{query}"

Generate a list of 6-10 suggested topics that:
- Belong naturally to the specified category (or inferred category if auto-detect)
- Are relevant completions or extensions of the user partial query
- Are concise, specific, and assessment-ready
- Are not repetitive
- Are appropriate for professional assessments
- For technical: include real-world engineering topics
- For aptitude: include numerical/quantitative reasoning topics
- For communication: include language, writing, comprehension topics
- For logical reasoning: include pattern, deduction, puzzle, analysis topics
- For auto-detect: infer the most suitable category based on the query and return mixed suggestions

Return ONLY a JSON array of topic names:
["Topic A", "Topic B", "Topic C", ...]

Do NOT include explanations or markdown. Return only the JSON array."""
    
    try:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert assessment designer. Always return valid JSON arrays. Never include markdown code blocks."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        suggestions = json.loads(content)
        if not isinstance(suggestions, list):
            suggestions = [suggestions] if suggestions else []
        
        # Filter out technical topics for soft-skill categories
        filtered_suggestions = []
        for s in suggestions:
            if s and isinstance(s, str):
                topic_str = str(s).strip()
                # For soft-skill categories, filter out technical topics
                if is_soft_skill and _is_technical_topic(topic_str):
                    logger.warning(f"Filtered out technical suggestion: {topic_str}")
                    continue
                filtered_suggestions.append(topic_str)
        
        # Return only valid strings, limit to 10
        return filtered_suggestions[:10]
        
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        return []


async def _get_popular_suggestions(category: str) -> List[str]:
    """Get popular/default suggestions for a category when query is empty."""
    popular_by_category = {
        "aptitude": [
            "Percentage Calculations",
            "Ratio & Proportion",
            "Time & Work Problems",
            "Profit & Loss",
            "Simple & Compound Interest",
            "Average & Mixtures",
            "Number Systems",
            "Algebra Basics"
        ],
        "communication": [
            "Email Etiquette",
            "Professional Writing",
            "Sentence Reconstruction",
            "Reading Comprehension",
            "Grammar & Vocabulary",
            "Business Communication",
            "Report Writing",
            "Presentation Skills"
        ],
        "logical_reasoning": [
            "Syllogisms",
            "Seating Arrangements",
            "Pattern Recognition",
            "Blood Relations",
            "Direction Sense",
            "Coding-Decoding",
            "Analytical Puzzles",
            "Logical Sequences"
        ],
        "technical": [
            "REST API Design",
            "Database Optimization",
            "System Design Principles",
            "Algorithm Complexity",
            "Security Best Practices",
            "Code Refactoring",
            "Testing Strategies",
            "Performance Optimization"
        ],
        "auto": [
            "Problem Solving",
            "Critical Thinking",
            "Data Analysis",
            "System Design",
            "Communication Skills",
            "Technical Writing",
            "Logical Reasoning",
            "Quantitative Analysis"
        ]
    }
    
    return popular_by_category.get(category.lower(), popular_by_category["auto"])


async def classify_technical_topic(topic: str) -> Dict[str, Any]:
    """
    Classify a technical topic to determine question type, coding support, and context.
    
    Returns:
    {
        "questionType": "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML",
        "canUseJudge0": bool,  # True ONLY for Coding type with strict Judge0 support
        "coding_supported": bool,  # Engine-driven coding support flag (kept)
        "competency": "general" | "coding" | "sql" | "aiml",
        "executionEnvironment": "judge0" | "sql_sandbox" | "jupyter_notebook" | "none",
        "supportedLanguages": List[str] | None,  # Only for Coding type
        "resourceLimits": Dict[str, Any] | None,  # Only for AIML competency
        "contextExplanation": str
    }
    """
    from .services import determine_topic_coding_support

    def _contains_any(haystack: str, needles: List[str]) -> bool:
        return any(n in haystack for n in needles)

    topic_raw = topic or ""
    topic_lower = topic_raw.lower().strip()

    # Judge0 supported languages (restricted set)
    JUDGE0_LANGUAGES = [
        "javascript",
        "cpp",        # c++
        "csharp",     # c#
        "go",
        "rust",
        "python",
        "typescript",
        "java",
        "c",
        "kotlin",
    ]

    # Language surface forms to detect in topic text
    LANGUAGE_ALIASES = {
        "javascript": ["javascript", "js"],
        "typescript": ["typescript", "ts"],
        "python": ["python"],
        "java": ["java"],
        "cpp": ["c++", "cpp"],
        "c": [" c ", "c language", "c programming", "c (", " c,"],
        "csharp": ["c#", "csharp", "c sharp"],
        "go": [" golang", "go language", "go programming", " go "],
        "rust": ["rust"],
        "kotlin": ["kotlin"],
    }

    AIML_KEYWORDS = [
        # Data science libraries
        "pandas", "numpy", "matplotlib", "seaborn", "plotly", "scipy",
        # ML frameworks
        "tensorflow", "keras", "pytorch", "torch", "scikit-learn", "sklearn",
        # ML concepts
        "machine learning", "deep learning", "neural network", "random forest", "decision tree",
        "regression", "classification", "clustering", "supervised learning", "unsupervised learning",
        "gradient descent", "backpropagation",
        # Tools
        "jupyter", "notebook", "colab", "anaconda",
        # Operations
        "data preprocessing", "feature engineering", "model training", "dataframe", "series",
        "model evaluation", "cross validation",
    ]

    # SQL detection MUST avoid substring false positives (e.g., "overview" contains "view").
    # We therefore use word-boundary regex patterns for indicators and require strong context for ops.
    SQL_INDICATOR_PATTERNS = [
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
    # SQL operations require context (e.g., SELECT ... FROM) to avoid generic words.
    SQL_OP_PATTERNS = [
        r"\bselect\b.*\bfrom\b",
        r"\bjoin\b.*\bon\b",
        r"\bgroup\s+by\b",
        r"\border\s+by\b",
        r"\bwhere\b",
        r"\bhaving\b",
        r"\binsert\b.*\binto\b",
        r"\bupdate\b.*\bset\b",
        r"\bdelete\b.*\bfrom\b",
        r"\bsubquery\b",
        r"\bsubqueries\b",
    ]

    def _is_sql_topic(text: str) -> bool:
        # Strong DB indicator wins immediately (word-boundary patterns)
        for pat in SQL_INDICATOR_PATTERNS:
            if re.search(pat, text):
                return True
        # Otherwise require multiple SQL ops (with strong context) to avoid accidental matches
        op_hits = 0
        for pat in SQL_OP_PATTERNS:
            if re.search(pat, text):
                op_hits += 1
                if op_hits >= 2:
                    return True
        return False

    WEB_KEYWORDS = [
        # Frontend frameworks
        "react", "angular", "vue", "svelte", "nextjs", "next.js", "nuxt", "gatsby", "ember",
        # Web technologies
        "html", "css", "scss", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra ui", "ant design",
        # Browser/DOM
        "dom", "browser", "document", "window", "event listener", "fetch api", "localstorage", "sessionstorage",
        "cookie", "webstorage",
        # Web frameworks (backend)
        "express", "koa", "fastify", "nest", "nestjs", "meteor",
        # Frontend build tools
        "webpack", "vite", "rollup", "parcel", "babel",
        # UI libraries
        "jquery", "d3", "chart.js", "three.js", "gsap", "anime.js",
        # Web concepts
        "frontend", "web development", "responsive design", "web page", "website", "web app", "web application",
        "spa", "single page", "ssr", "server side rendering", "csr", "client side rendering",
        # Node.js web
        "node server", "express server", "api endpoint", "http server", "rest api in node",
    ]

    DSA_KEYWORDS = [
        "algorithm", "algorithms", "data structure", "data structures", "dsa", "problem solving",
        "sorting", "searching", "binary search", "merge sort", "quick sort", "quicksort",
        "two sum", "array", "arrays", "string", "strings", "hash", "hash table", "hashtable",
        "stack", "queue", "linked list", "tree", "binary tree", "bst", "heap", "trie",
        "graph", "bfs", "dfs", "dijkstra", "dynamic programming", "dp", "recursion",
    ]

    DISALLOWED_CODING_KEYWORDS = [
        # External libs / DS
        "pandas", "numpy", "matplotlib", "seaborn", "plotly", "scipy",
        "tensorflow", "keras", "pytorch", "torch", "scikit-learn", "sklearn",
        "jupyter", "notebook", "colab", "anaconda",
        # Non-judge0 / non-stdin-stdout constraints
        "file", "filesystem", "read file", "write file", "file i/o", "io file",
        "network", "socket", "http", "api call", "request", "requests", "beautifulsoup", "web scraping",
        "gui", "window", "desktop app", "mobile app", "android", "ios",
        "database", "sql", "mysql", "postgresql", "mongodb", "redis", "connection",
        # Web technologies / browser execution (platform not supported)
        "react", "angular", "vue", "svelte", "nextjs", "next.js", "nuxt", "gatsby", "ember",
        "html", "css", "scss", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra ui", "ant design",
        "dom", "browser", "document", "window", "event listener", "fetch api", "localstorage", "sessionstorage",
        "cookie", "webstorage",
        "express", "koa", "fastify", "nest", "nestjs", "meteor",
        "webpack", "vite", "rollup", "parcel", "babel",
        "jquery", "d3", "chart.js", "three.js", "gsap", "anime.js",
        "frontend", "web development", "responsive design", "web page", "website", "web app", "web application",
        "spa", "single page", "ssr", "server side rendering", "csr", "client side rendering",
    ]

    def _detect_judge0_language(text: str) -> Optional[str]:
        hits: List[str] = []
        for lang, aliases in LANGUAGE_ALIASES.items():
            for a in aliases:
                if a in text:
                    hits.append(lang)
                    break
        # STRICT: must mention exactly one of the supported languages
        hits = list(dict.fromkeys(hits))  # de-dupe while preserving order
        if len(hits) == 1 and hits[0] in JUDGE0_LANGUAGES:
            return hits[0]
        return None

    def _is_strict_coding_topic(text: str) -> bool:
        lang = _detect_judge0_language(text)
        if not lang:
            return False
        if not _contains_any(text, DSA_KEYWORDS):
            return False
        if _contains_any(text, AIML_KEYWORDS) or _is_sql_topic(text):
            return False
        if _contains_any(text, DISALLOWED_CODING_KEYWORDS):
            return False
        # Heuristic: must look like a runnable task
        runnable_markers = ["implement", "write", "solve", "program", "function", "stdin", "stdout", "input/output"]
        if not _contains_any(text, runnable_markers) and not _contains_any(text, DSA_KEYWORDS):
            return False
        return True
    
    # Determine coding support using ENGINE-DRIVEN logic
    coding_supported = await determine_topic_coding_support(topic)

    # Deterministic high-priority classification to avoid Judge0 false positives
    if _contains_any(topic_lower, AIML_KEYWORDS):
        return {
            "questionType": "AIML",
            "canUseJudge0": False,
            "coding_supported": coding_supported,
            "competency": "aiml",
            "executionEnvironment": "jupyter_notebook",
            "supportedLanguages": None,
            "resourceLimits": {"maxRows": 30, "maxColumns": 10, "gpuEnabled": False},
            "contextExplanation": "Topic indicates AI/ML or data science tools/libraries (e.g., pandas/numpy/sklearn), which are not Judge0-executable.",
        }

    if _is_sql_topic(topic_lower):
        return {
            "questionType": "SQL",
            "canUseJudge0": False,
            "coding_supported": coding_supported,
            "competency": "sql",
            "executionEnvironment": "sql_sandbox",
            "supportedLanguages": None,
            "resourceLimits": None,
            "contextExplanation": "Topic indicates SQL/database competency; classify as SQL and do not enable Judge0 code execution.",
        }

    # Web technology topics are NEVER Coding (platform doesn't support browser/web execution)
    if _contains_any(topic_lower, WEB_KEYWORDS):
        implementation_keywords = ["build", "create", "implement", "design", "develop", "write"]
        web_question_type = "Subjective" if _contains_any(topic_lower, implementation_keywords) else "MCQ"
        web_context = (
            "Topic involves web technologies/frameworks/browser APIs which require a browser/web runtime not supported by this platform. "
            "Classified as Subjective for implementation/design or MCQ for theory/concepts."
        )
        return {
            "questionType": web_question_type,
            "canUseJudge0": False,
            "coding_supported": False,
            "competency": "general",
            "executionEnvironment": "none",
            "supportedLanguages": None,
            "resourceLimits": None,
            "contextExplanation": web_context,
        }

    if coding_supported and _is_strict_coding_topic(topic_lower):
        return {
            "questionType": "Coding",
            "canUseJudge0": True,
            "coding_supported": coding_supported,
            "competency": "coding",
            "executionEnvironment": "judge0",
            "supportedLanguages": JUDGE0_LANGUAGES,
            "resourceLimits": None,
            "contextExplanation": "Topic is a Judge0-compatible DSA/algorithmic coding task in a supported language with no external library requirements.",
        }
    
    prompt = f"""You are an expert technical assessor. Analyze this topic: "{topic_raw}"

STRICT CLASSIFICATION RULES (in priority order):

1. AIML COMPETENCY (canUseJudge0=false, environment=jupyter_notebook)
   - Triggers: pandas, numpy, matplotlib, sklearn, tensorflow, keras, pytorch, machine learning, deep learning, neural network, jupyter, data preprocessing, feature engineering, dataframe, model training
   - Examples: "NumPy Arrays", "Pandas DataFrame Operations", "Matplotlib Visualization", "Train RandomForest Model", "Scikit-learn Classification"
   - Return: {{"questionType": "AIML", "competency": "aiml", "canUseJudge0": false, "executionEnvironment": "jupyter_notebook"}}

2. SQL COMPETENCY (canUseJudge0=false, environment=sql_sandbox)
   - Triggers: sql, mysql, postgresql, database, query, select, join, normalization, indexing, transaction
   - Examples: "SQL Joins", "Database Normalization", "Complex Subqueries", "Query Optimization"
   - Return: {{"questionType": "SQL", "competency": "sql", "canUseJudge0": false, "executionEnvironment": "sql_sandbox"}}

3. WEB TECHNOLOGY TOPICS (NEVER Coding - platform doesn't support browser/web execution)
   - Triggers: react, angular, vue, html, css, dom, browser, document, window, fetch api, localstorage, express, next.js, webpack, vite, jquery, d3, chart.js, three.js, frontend, web development
   - Classification:
     * Theory/Concepts → MCQ
     * Implementation/Design/Architecture → Subjective
     * NEVER → Coding
   - Return: {{"questionType": "MCQ" or "Subjective", "competency": "general", "canUseJudge0": false, "executionEnvironment": "none"}}

4. CODING COMPETENCY - Judge0 ONLY (canUseJudge0=true, environment=judge0)
   - STRICT REQUIREMENTS (ALL must be true):
     a) Topic mentions ONE of these 10 languages: JavaScript, TypeScript, Java, Python, C++, C#, C, Go, Rust, Kotlin
     b) Topic is DSA/algorithmic: sorting, searching, trees, graphs, dynamic programming, recursion, linked lists, stacks, queues, hash tables, arrays, strings, heaps, tries
     c) Topic is executable with stdin/stdout test cases
     d) Topic does NOT use external libraries (NO pandas, numpy, matplotlib, sklearn, tensorflow, pytorch, beautifulsoup, requests, etc.)
     e) Topic does NOT use web technologies/frameworks/browser APIs (NO react, angular, vue, express, dom, html, css, etc.)
     f) Topic does NOT require: file I/O, GUI, network operations, database connections, browser environment
   - Return: {{"questionType": "Coding", "competency": "coding", "canUseJudge0": true, "executionEnvironment": "judge0", "supportedLanguages": ["javascript", "typescript", "java", "python", "cpp", "csharp", "c", "go", "rust", "kotlin"]}}

5. PSEUDOCODE (canUseJudge0=false, environment=none)
   - Complex algorithms needing design but not full code execution OR algorithmic topics in non-Judge0 languages.
   - Return: {{"questionType": "PseudoCode", "competency": "coding", "canUseJudge0": false, "executionEnvironment": "none"}}

6. SUBJECTIVE (canUseJudge0=false, environment=none)
   - Conceptual, architectural, explanation-focused, comparison topics; OR topics requiring external libraries / file/network/gui.
   - Return: {{"questionType": "Subjective", "competency": "general", "canUseJudge0": false, "executionEnvironment": "none"}}

7. MCQ (canUseJudge0=false, environment=none)
   - Factual recall / theory / basic concepts.
   - Return: {{"questionType": "MCQ", "competency": "general", "canUseJudge0": false, "executionEnvironment": "none"}}

CRITICAL RULES:
- If topic mentions pandas, numpy, sklearn, tensorflow, matplotlib, seaborn → ALWAYS AIML (never Coding)
- If topic mentions SQL, database, query → ALWAYS SQL (never Coding)
- If topic mentions react, angular, vue, express, dom, browser, html, css → MCQ or Subjective (NEVER Coding)
- canUseJudge0=true is ONLY allowed when questionType="Coding"
- For AIML, add resourceLimits: {{"maxRows": 30, "maxColumns": 10, "gpuEnabled": false}}
- For Coding, add supportedLanguages: ["javascript", "typescript", "java", "python", "cpp", "csharp", "c", "go", "rust", "kotlin"]
- Python Coding questions: ONLY standard library (no numpy/pandas/matplotlib)

Return ONLY valid JSON:
{{
  "questionType": "MCQ|Subjective|PseudoCode|Coding|SQL|AIML",
  "competency": "general|coding|sql|aiml",
  "canUseJudge0": true/false,
  "executionEnvironment": "judge0|sql_sandbox|jupyter_notebook|none",
  "supportedLanguages": ["javascript","typescript","java","python","cpp","csharp","c","go","rust","kotlin"] or null,
  "resourceLimits": {{"maxRows": 30, "maxColumns": 10, "gpuEnabled": false}} or null,
  "contextExplanation": "Brief explanation"
}}"""
    
    try:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert technical assessor. Always return valid JSON. Never include markdown code blocks."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        result = json.loads(content)
        
        # Validate question type
        valid_types = ["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"]
        question_type = result.get("questionType", "MCQ")
        if question_type not in valid_types:
            question_type = "MCQ"
        
        # Validate competency
        valid_competencies = ["general", "coding", "sql", "aiml"]
        competency = result.get("competency", "general")
        if competency not in valid_competencies:
            competency = "general"

        # Validate executionEnvironment
        valid_environments = ["judge0", "sql_sandbox", "jupyter_notebook", "none"]
        execution_env = result.get("executionEnvironment", "none")
        if execution_env not in valid_environments:
            execution_env = "none"

        # Enforce canUseJudge0 rules
        can_use_judge0 = bool(result.get("canUseJudge0", False))
        if question_type != "Coding":
            can_use_judge0 = False
        else:
            # Even for Coding, enforce engine + strict constraints
            if not coding_supported or not _is_strict_coding_topic(topic_lower):
                can_use_judge0 = False
                # Downgrade if model tried to force Coding but it's not Judge0-safe
                question_type = "PseudoCode" if _contains_any(topic_lower, DSA_KEYWORDS) else "Subjective"
                competency = "coding" if question_type == "PseudoCode" else "general"
                execution_env = "none"

        # supportedLanguages for Coding type (only when Judge0 is actually enabled)
        supported_languages = None
        if question_type == "Coding" and can_use_judge0:
            supported_languages = JUDGE0_LANGUAGES
            competency = "coding"
            execution_env = "judge0"

        # resourceLimits for AIML
        resource_limits = None
        if question_type == "AIML" or competency == "aiml":
            question_type = "AIML"
            competency = "aiml"
            execution_env = "jupyter_notebook"
            resource_limits = {"maxRows": 30, "maxColumns": 10, "gpuEnabled": False}
            can_use_judge0 = False

        # enforce SQL environment (only if topic is actually SQL-like)
        if question_type == "SQL" or competency == "sql":
            if _is_sql_topic(topic_lower):
                question_type = "SQL"
                competency = "sql"
                execution_env = "sql_sandbox"
                can_use_judge0 = False
            else:
                # Downgrade invalid SQL classifications
                question_type = "Subjective" if _contains_any(topic_lower, ["vs", "versus", "difference", "compare", "comparison"]) else "MCQ"
                competency = "general"
                execution_env = "none"
                can_use_judge0 = False
        
        return {
            "questionType": question_type,
            "canUseJudge0": can_use_judge0,
            "coding_supported": coding_supported,  # NEW: Engine-driven coding support
            "competency": competency,
            "executionEnvironment": execution_env,
            "supportedLanguages": supported_languages,
            "resourceLimits": resource_limits,
            "contextExplanation": result.get("contextExplanation", f"This topic evaluates technical knowledge in {topic}.")
        }
        
    except Exception as exc:
        logger.error(f"Error classifying technical topic: {exc}", exc_info=True)
        # Fallback to safe defaults
        return {
            "questionType": "MCQ",
            "canUseJudge0": False,
            "coding_supported": coding_supported,  # Still use the determined coding support
            "competency": "general",
            "executionEnvironment": "none",
            "supportedLanguages": None,
            "resourceLimits": None,
            "contextExplanation": f"This topic evaluates technical knowledge in {topic}."
        }


async def _detect_category_semantically(topic_name: str) -> str:
    """
    Detect topic category using semantic understanding.
    Returns: "aptitude", "communication", "logical_reasoning", or "technical"
    """
    prompt = f"""You are an expert at categorizing assessment topics. Analyze this topic and determine its category.

Topic: "{topic_name}"

Categories:
1. "aptitude" - Numerical problem-solving, quantitative reasoning, mathematical calculations, percentages, ratios, time/speed/distance, profit/loss
2. "communication" - Written communication, professional correspondence, email etiquette, formal writing, clarity and tone
3. "logical_reasoning" - Analytical thinking, pattern recognition, logical problem-solving, puzzles, sequences, deductions
4. "technical" - Programming, technology, frameworks, tools, systems, implementation (default for technical topics)

Return ONLY the category name (one word): aptitude, communication, logical_reasoning, or technical
No explanations, just the category."""
    
    try:
        client = _get_openai_client()
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at categorizing topics. Always return only the category name, no explanations."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=10,
        )
        
        content = response.choices[0].message.content.strip().lower()
        
        # Validate category
        valid_categories = ["aptitude", "communication", "logical_reasoning", "technical"]
        if content in valid_categories:
            return content
        
        return "technical"  # Default fallback
        
    except Exception as exc:
        logger.warning(f"Error detecting category: {exc}. Defaulting to technical.")
        return "technical"
