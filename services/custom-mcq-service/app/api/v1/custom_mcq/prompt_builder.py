"""
Prompt Builder Module
Builds enhanced evaluation prompts with rubrics, examples, question breakdown, and detailed instructions.
"""
import logging
from typing import Dict, Any, Optional, List

# Import here to avoid circular dependency - imported inside function when needed
logger = logging.getLogger(__name__)


def build_enhanced_evaluation_prompt(
    question: str,
    answer: str,
    max_marks: float,
    question_analysis: Dict[str, Any],
    section: Optional[str] = None,
    rubric: Optional[str] = None,
    answer_key: Optional[str] = None,
    difficulty: str = "Medium"
) -> str:
    """
    Build enhanced evaluation prompt with all improvements.
    
    Args:
        question: Question text
        answer: Candidate's answer
        max_marks: Maximum marks
        question_analysis: Result from question_analyzer
        section: Optional section name
        rubric: Optional grading rubric
        answer_key: Optional ideal answer or key points
        difficulty: Question difficulty
    
    Returns:
        Complete evaluation prompt
    """
    
    # Build prompt sections
    sections = []
    
    # 1. System context
    sections.append(_build_system_context())
    
    # 2. Question breakdown (if multi-part)
    if question_analysis.get("is_multi_part", False):
        sections.append(_build_question_breakdown(question, question_analysis))
    
    # 3. Evaluation context
    sections.append(_build_evaluation_context(section, difficulty, max_marks))
    
    # 4. Question and answer
    sections.append(_build_question_answer_section(question, answer))
    
    # 5. Rubric and answer key (if provided)
    if rubric:
        sections.append(_build_rubric_section(rubric))
    
    if answer_key:
        sections.append(_build_answer_key_section(answer_key))
    
    # 6. Evaluation rules
    sections.append(_build_evaluation_rules(question_analysis))
    
    # 7. Scoring rubrics
    sections.append(_build_scoring_rubrics(question_analysis))
    
    # 8. Completeness checklist (if multi-part)
    if question_analysis.get("is_multi_part", False):
        sections.append(_build_completeness_checklist(question_analysis))
    
    # 9. Examples
    sections.append(_build_examples_section(question_analysis))
    
    # 10. Output format
    sections.append(_build_output_format_section(max_marks, question_analysis))
    
    # Combine all sections
    prompt = "\n\n".join(sections)
    
    return prompt


def _build_system_context() -> str:
    """Build system context section."""
    return """You are an expert evaluator grading subjective answers for technical assessments. 
Your role is to evaluate candidate answers fairly, accurately, and provide constructive feedback."""


def _build_question_breakdown(question: str, question_analysis: Dict[str, Any]) -> str:
    """Build question breakdown section for multi-part questions."""
    parts = question_analysis.get("parts", [])
    part_count = len(parts)
    
    breakdown = f"""
## QUESTION BREAKDOWN

This question has {part_count} REQUIRED PARTS. The candidate MUST address ALL parts for full marks.

REQUIRED PARTS:"""
    
    for part in parts:
        breakdown += f"\n- Part {part.get('id')}: {part.get('text')} (REQUIRED)"
    
    breakdown += f"""

IMPORTANT: The candidate must address ALL {part_count} parts. If any part is missing, the maximum possible score will be capped based on completeness.

Completeness Penalties:
"""
    
    if part_count == 2:
        breakdown += "- Missing 1 part: Maximum score = 50% of max_marks\n"
        breakdown += "- Both parts present: Can earn up to 100% of max_marks"
    elif part_count == 3:
        breakdown += "- Missing 1 part: Maximum score = 66% of max_marks\n"
        breakdown += "- Missing 2 parts: Maximum score = 33% of max_marks\n"
        breakdown += "- All parts present: Can earn up to 100% of max_marks"
    else:
        breakdown += f"- Missing parts: Maximum score = (parts_covered / {part_count}) × max_marks\n"
        breakdown += "- All parts present: Can earn up to 100% of max_marks"
    
    return breakdown


def _build_evaluation_context(section: Optional[str], difficulty: str, max_marks: float) -> str:
    """Build evaluation context section."""
    context = f"""
## EVALUATION CONTEXT

Maximum Marks: {max_marks}
Difficulty: {difficulty}
"""
    
    if section:
        context += f"Section: {section}\n"
    
    return context


def _build_question_answer_section(question: str, answer: str) -> str:
    """Build question and answer section."""
    return f"""
## QUESTION

{question}

## CANDIDATE'S ANSWER

{answer}
"""


def _build_rubric_section(rubric: str) -> str:
    """Build rubric section."""
    return f"""
## GRADING RUBRIC

{rubric}

Please use this rubric as a guide for evaluation. Follow the criteria and weights specified in the rubric.
"""


def _build_answer_key_section(answer_key: str) -> str:
    """Build answer key section."""
    return f"""
## KEY POINTS TO LOOK FOR

{answer_key}

These are the key points that should be covered in a good answer. Use this as a reference but don't penalize if the candidate uses different wording but covers the same concepts.
"""


def _build_evaluation_rules(question_analysis: Dict[str, Any]) -> str:
    """Build evaluation rules section."""
    is_multi_part = question_analysis.get("is_multi_part", False)
    
    rules = """
## EVALUATION RULES

Follow these rules STRICTLY:

### Two-Step Evaluation Process:

**STEP 1: Completeness Check (MUST DO FIRST)**
"""
    
    if is_multi_part:
        rules += """
1. Check if ALL required parts are addressed in the answer
2. For each part, verify:
   - Does the answer mention key concepts from this part?
   - Is there substantial content addressing this part?
   - If ANY part is missing: Maximum possible score = completeness cap (see Question Breakdown)
   - If ALL parts are present: Proceed to Step 2
"""
    else:
        rules += """
1. Check if the answer addresses the question
2. Verify key concepts are covered
3. If answer is completely off-topic or irrelevant: Maximum score = 20% of max_marks
4. If answer is relevant: Proceed to Step 2
"""
    
    rules += """
**STEP 2: Quality Evaluation (Only if Step 1 passed)**
1. Evaluate the quality of what was provided
2. Assess each criterion (accuracy, completeness, clarity, depth, relevance)
3. Award points based on quality
4. Apply completeness multiplier if parts are missing
5. Calculate final score

### Scoring Principles:
- Be FAIR but STRICT
- Award full marks ONLY if answer is excellent and comprehensive
- Deduct marks appropriately for errors, omissions, and issues
- Provide partial credit for partially correct answers
- Be consistent in your evaluation standards
"""
    
    return rules


def _build_scoring_rubrics(question_analysis: Dict[str, Any]) -> str:
    """Build detailed scoring rubrics for each criterion."""
    
    question_type = question_analysis.get("question_type", "general")
    is_multi_part = question_analysis.get("is_multi_part", False)
    
    # Get weights (import here to avoid circular dependency)
    try:
        from .question_analyzer import get_criteria_weights
        weights = get_criteria_weights(question_type, is_multi_part)
    except ImportError:
        # Fallback to default weights if import fails
        logger.warning("Could not import get_criteria_weights, using default weights")
        weights = {
            "accuracy": 25.0,
            "completeness": 25.0,
            "clarity": 20.0,
            "depth": 20.0,
            "relevance": 10.0
        }
    
    rubrics = f"""
## DETAILED SCORING RUBRICS

Evaluate each criterion and assign scores based on these rubrics. The weights indicate how much each criterion contributes to the final score.

### 1. ACCURACY (Weight: {weights.get('accuracy', 25)}%)

Rubric:
- 0-2 marks: Major factual errors, incorrect information, fundamental misunderstandings
- 3-5 marks: Minor errors but mostly correct, some inaccuracies that don't undermine the main points
- 6-8 marks: Mostly correct with minor issues, generally accurate with small factual errors
- 9-10 marks: Completely accurate, no factual errors, all information is correct

Deduction Rules:
- Major factual error: -2 points per error
- Minor factual error: -1 point per error
- Incorrect terminology: -0.5 points per instance

### 2. COMPLETENESS (Weight: {weights.get('completeness', 25)}%)

Rubric:
- 0-2 marks: Major gaps, most key points missing, incomplete answer
- 3-5 marks: Some key points covered but significant gaps remain
- 6-8 marks: Most key points covered, minor gaps
- 9-10 marks: All key points covered comprehensively, nothing significant missing

Deduction Rules:
"""
    
    if is_multi_part:
        rubrics += "- Missing required part: Automatic score cap applied (see Question Breakdown)\n"
    
    rubrics += """- Missing key point: -3 points per major point
- Missing minor point: -1 point per minor point

### 3. CLARITY (Weight: {weights.get('clarity', 20)}%)

Rubric:
- 0-2 marks: Very unclear, confusing, poor organization, hard to understand
- 3-5 marks: Somewhat unclear, needs improvement in structure and clarity
- 6-8 marks: Mostly clear, well-organized, easy to follow
- 9-10 marks: Extremely clear, well-structured, excellent communication

Deduction Rules:
- Poor structure: -2 points
- Very unclear explanation: -1 to -2 points
- Grammar issues (only if very poor): -1 point

### 4. DEPTH OF UNDERSTANDING (Weight: {weights.get('depth', 20)}%)

Rubric:
- 0-2 marks: Surface-level only, no depth, just definitions
- 3-5 marks: Some depth, basic understanding shown, simple examples
- 6-8 marks: Good depth, demonstrates solid understanding, detailed explanations
- 9-10 marks: Deep understanding, comprehensive analysis, excellent examples and insights

Deduction Rules:
- Surface-level only: -3 to -4 points
- Lacks examples/details: -1 to -2 points

### 5. RELEVANCE (Weight: {weights.get('relevance', 10)}%)

Rubric:
- 0-2 marks: Completely off-topic, irrelevant content
- 3-5 marks: Somewhat relevant but includes significant irrelevant content
- 6-8 marks: Mostly relevant, minimal irrelevant content
- 9-10 marks: Completely relevant, stays on topic throughout

Deduction Rules:
- Irrelevant content: -1 point per significant irrelevant sentence (max -5 points)
"""
    
    return rubrics.format(**weights)


def _build_completeness_checklist(question_analysis: Dict[str, Any]) -> str:
    """Build completeness checklist section."""
    parts = question_analysis.get("parts", [])
    
    checklist = """
## COMPLETENESS CHECKLIST

You MUST explicitly check each part and fill this checklist:

"""
    
    for part in parts:
        checklist += f"□ Part {part.get('id')}: {part.get('text', '')} - Covered? (Yes/No)\n"
    
    checklist += f"□ All {len(parts)} parts covered? (Yes/No)\n"
    checklist += """
If any part is marked as "No", you MUST apply the completeness cap to the score (see Question Breakdown).
"""
    
    return checklist


def _build_examples_section(question_analysis: Dict[str, Any]) -> str:
    """Build examples section with few-shot learning examples."""
    is_multi_part = question_analysis.get("is_multi_part", False)
    
    if is_multi_part:
        return """
## EVALUATION EXAMPLES

### Example 1: Incomplete Answer (Multi-Part Question)

Question: "What is SQL and non-SQL databases?"
Candidate's Answer: "SQL databases are relational databases that use structured query language. They store data in tables with rows and columns."
Evaluation:
- Completeness: Part 1 (SQL) covered ✓, Part 2 (Non-SQL) missing ✗ → INCOMPLETE
- Quality of Part 1: Good explanation (8/10)
- Completeness cap: Maximum score = 50% of max_marks = 5/10
- Final Score: 4/10 (8 × 0.5 multiplier, capped at 5)
- Feedback: "You explained SQL databases well, but the question asked for both SQL and non-SQL databases. Since you missed the non-SQL part, the maximum score is limited to 5/10."

### Example 2: Complete Answer (Multi-Part Question)

Question: "What is SQL and non-SQL databases?"
Candidate's Answer: "SQL databases are relational databases... [good SQL explanation]. Non-SQL databases are non-relational databases... [good NoSQL explanation]."
Evaluation:
- Completeness: Part 1 (SQL) covered ✓, Part 2 (Non-SQL) covered ✓ → COMPLETE
- Quality: Both parts well-explained (9/10)
- Final Score: 9/10 (no cap, excellent quality)
- Feedback: "Excellent answer covering both SQL and non-SQL databases with good examples."

### Example 3: Complete but Incorrect Answer

Question: "Explain the difference between SQL and non-SQL databases"
Candidate's Answer: Covers both parts but contains major factual errors
Evaluation:
- Completeness: Both parts covered ✓
- Accuracy: Major errors (-4 points)
- Final Score: 3/10 (completeness good but accuracy poor)
- Feedback: "You addressed both parts of the question, but there are significant factual errors. Review the fundamental concepts."

BAD Evaluation (What NOT to do):
- Giving full marks (8/10) for incomplete answers
- Ignoring missing parts
- Not applying completeness caps

GOOD Evaluation (What to do):
- Strictly checking completeness first
- Applying score caps when parts are missing
- Providing specific feedback about what's missing
"""
    else:
        return """
## EVALUATION EXAMPLES

### Example 1: Excellent Answer

Question: "Explain how authentication works"
Answer: Comprehensive, accurate, well-structured explanation
Score: 9/10
Reason: All criteria met - accurate, complete, clear, demonstrates deep understanding

### Example 2: Incomplete Answer

Question: "Explain how authentication works"
Answer: Only covers basic definition, missing key concepts
Score: 4/10
Reason: Incomplete - missing important aspects like tokens, sessions, etc.

### Example 3: Off-Topic Answer

Question: "Explain how authentication works"
Answer: Talks about authorization instead
Score: 2/10
Reason: Off-topic, addresses wrong concept

BAD Evaluation: Giving high marks for incomplete or off-topic answers
GOOD Evaluation: Strictly evaluating completeness and relevance
"""


def _build_output_format_section(max_marks: float, question_analysis: Dict[str, Any]) -> str:
    """Build output format section."""
    is_multi_part = question_analysis.get("is_multi_part", False)
    
    format_section = f"""
## OUTPUT FORMAT

You MUST return a JSON object with the following structure:

{{
  "score": <number between 0 and {max_marks}, can be decimal>,
  "max_marks": {max_marks},
  "percentage": <score/max_marks * 100>,
  
  "completeness_check": {{
    "all_parts_covered": <true/false>,"""
    
    if is_multi_part:
        parts = question_analysis.get("parts", [])
        for part in parts:
            format_section += f'\n    "part{part.get("id")}_covered": <true/false>,'
        format_section += '\n    "missing_parts": ["part name if missing"],'
    
    format_section += """
    "coverage_notes": "Brief explanation of what was covered and what was missing"
  },
  
  "criteria_scores": {
    "accuracy": {
      "score": <0-10>,
      "weight": <percentage weight>,
      "feedback": "Specific feedback on accuracy"
    },
    "completeness": {
      "score": <0-10>,
      "weight": <percentage weight>,
      "feedback": "Specific feedback on completeness"
    },
    "clarity": {
      "score": <0-10>,
      "weight": <percentage weight>,
      "feedback": "Specific feedback on clarity"
    },
    "depth": {
      "score": <0-10>,
      "weight": <percentage weight>,
      "feedback": "Specific feedback on depth"
    },
    "relevance": {
      "score": <0-10>,
      "weight": <percentage weight>,
      "feedback": "Specific feedback on relevance"
    }
  },
  
  "score_breakdown": {
    "quality_score": <calculated quality score before cap>,
    "completeness_multiplier": <0.0-1.0>,
    "final_score": <final score after all adjustments>,
    "max_possible_score": <maximum allowed based on completeness>,
    "deductions": {
      "factual_errors": <points deducted>,
      "missing_key_points": <points deducted>,
      "irrelevant_content": <points deducted>,
      "structure_issues": <points deducted>
    }
  },
  
  "feedback": {
    "summary": "2-3 sentence overall assessment",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "detailed_analysis": "In-depth evaluation",
    "suggestions": ["specific suggestion 1", "specific suggestion 2"]
  },
  
  "reasoning": "Brief explanation of why this score was awarded and how it was calculated",
  
  "flags": {
    "confidence_level": <0.0-1.0>,
    "requires_human_review": <true/false>,
    "incomplete_answer": <true/false>
  }
}}

IMPORTANT:
- Return ONLY valid JSON, no markdown, no explanations outside JSON
- Ensure all scores are within valid ranges
- If parts are missing, apply completeness cap
- Be specific in feedback - mention what was good and what was missing
- Show your reasoning clearly
"""
    
    return format_section

