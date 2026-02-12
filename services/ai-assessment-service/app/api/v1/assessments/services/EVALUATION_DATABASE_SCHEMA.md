# AI Evaluation Database Schema

This document defines the database schema for storing comprehensive AI evaluation results.

## Overview

The evaluation results are stored in submission documents with the following structure:

## Main Submission Document

```python
{
    "_id": ObjectId,
    "assessment_id": ObjectId,  # Reference to assessment
    "candidate_id": str,  # Candidate identifier (email or user_id)
    "candidate_name": str,
    "candidate_email": str,
    "submission_timestamp": datetime,
    "submitted_at": datetime,  # Alias for submission_timestamp
    
    # Individual question evaluations
    "question_evaluations": [
        {
            "question_id": str,  # Question identifier
            "question_type": "MCQ|Subjective|PseudoCode|Coding|SQL|AIML",
            "section": str,  # Optional section name
            
            # Scoring
            "score": float,
            "max_marks": float,
            "percentage": float,
            
            # Full AI evaluation object
            "evaluation": {
                "question_id": str,
                "section": str,
                "question_type": str,
                "score": float,
                "max_marks": float,
                "percentage": float,
                
                # Criteria-based scoring
                "criteria_scores": {
                    "accuracy": {
                        "score": float,
                        "weight": float,
                        "feedback": str
                    },
                    "completeness": {
                        "score": float,
                        "weight": float,
                        "feedback": str
                    },
                    "efficiency": {
                        "score": float,
                        "weight": float,
                        "feedback": str
                    },
                    "code_quality": {  # For coding questions
                        "score": float,
                        "weight": float,
                        "feedback": str
                    },
                    "best_practices": {
                        "score": float,
                        "weight": float,
                        "feedback": str
                    }
                },
                
                # Detailed feedback
                "feedback": {
                    "summary": str,
                    "strengths": [str],
                    "weaknesses": [str],
                    "detailed_analysis": str,
                    "suggestions": [str]
                },
                
                # Answer analysis
                "answer_log": {
                    "submitted_answer": str,
                    "expected_answer": str,  # If available
                    "key_points_covered": [str],
                    "key_points_missed": [str],
                    "incorrect_points": [str],
                    "partial_credit_reasoning": str
                },
                
                # Skill-based improvement
                "areas_of_improvement": [
                    {
                        "skill": str,
                        "current_level": "Beginner|Intermediate|Advanced",
                        "gap_analysis": str,
                        "priority": "High|Medium|Low",
                        "improvement_suggestions": [
                            {
                                "suggestion": str,
                                "resources": [str],
                                "practice_exercises": [str],
                                "estimated_time": str
                            }
                        ]
                    }
                ],
                
                # Comparative analysis
                "benchmarking": {
                    "compared_to_peers": "Below Average|Average|Above Average|Excellent",
                    "percentile": float,
                    "industry_standard": str
                },
                
                # Additional insights
                "insights": {
                    "time_efficiency": str,
                    "approach_quality": str,
                    "edge_case_handling": str,
                    "scalability_consideration": str,
                    "alternative_solutions": [str]
                },
                
                # Flags and warnings
                "flags": {
                    "plagiarism_risk": "Low|Medium|High",
                    "ai_generated_risk": "Low|Medium|High",
                    "incomplete_answer": bool,
                    "requires_human_review": bool,
                    "confidence_level": float
                }
            },
            
            # Metadata
            "evaluated_at": datetime,
            "evaluator": "AI|Human",
            "ai_confidence": float,
            "evaluation_version": str  # e.g., "1.0"
        }
    ],
    
    # Section-level summaries
    "section_summaries": [
        {
            "section_name": str,
            "total_questions": int,
            "questions_attempted": int,
            "section_score": float,
            "section_max_marks": float,
            "section_percentage": float,
            
            "section_performance": {
                "strength_areas": [str],
                "weak_areas": [str],
                "key_insights": str
            },
            
            "skill_breakdown": [
                {
                    "skill": str,
                    "questions_tested": int,
                    "average_score_percentage": float,
                    "proficiency_level": "Beginner|Intermediate|Advanced|Expert"
                }
            ]
        }
    ],
    
    # Overall assessment summary
    "overall_evaluation": {
        "overall_score": float,
        "overall_max_marks": float,
        "overall_percentage": float,
        "grade": "A+|A|B+|B|C+|C|D|F",
        
        "section_wise_performance": [
            {
                "section": str,
                "score": float,
                "percentage": float,
                "performance_level": "Excellent|Good|Average|Below Average|Poor"
            }
        ],
        
        "skill_matrix": [
            {
                "skill_category": str,
                "sub_skills": [
                    {
                        "skill": str,
                        "proficiency": "Beginner|Intermediate|Advanced|Expert",
                        "score_percentage": float,
                        "questions_count": int
                    }
                ]
            }
        ],
        
        "overall_strengths": [str],
        "overall_weaknesses": [str],
        
        "comprehensive_improvement_plan": {
            "immediate_focus_areas": [
                {
                    "area": str,
                    "reason": str,
                    "action_items": [str]
                }
            ],
            "short_term_goals": [
                {
                    "goal": str,
                    "steps": [str],
                    "resources": [str]
                }
            ],
            "long_term_development": [
                {
                    "goal": str,
                    "pathway": str,
                    "milestones": [str]
                }
            ]
        },
        
        "personalized_recommendations": {
            "learning_path": [str],
            "practice_resources": [
                {
                    "resource_type": "Course|Book|Platform|Tutorial",
                    "name": str,
                    "url": str,
                    "relevance": str
                }
            ],
            "project_suggestions": [str],
            "mentor_focus_areas": [str]
        },
        
        "readiness_assessment": {
            "job_role": str,
            "readiness_level": "Ready|Nearly Ready|Needs Preparation|Not Ready",
            "gap_to_readiness": str,
            "estimated_preparation_time": str
        }
    },
    
    # Evaluation metadata
    "evaluation_metadata": {
        "ai_model_used": str,  # e.g., "gpt-4o-mini"
        "evaluation_version": str,  # e.g., "1.0"
        "total_evaluation_time_ms": int,
        "requires_human_review": bool,
        "human_reviewed": bool,
        "human_reviewer_id": ObjectId,  # If reviewed by human
        "human_review_notes": str,
        "human_reviewed_at": datetime
    },
    
    # Legacy fields (for backward compatibility)
    "graded_submissions": [
        {
            "questionId": str,
            "questionType": str,
            "marksAwarded": float,
            "maxMarks": float,
            "feedback": str,
            # ... other legacy fields
        }
    ],
    "total_score": float,
    "total_marks": float,
    "percentage": float
}
```

## MongoDB Indexes

Recommended indexes for efficient querying:

```python
# Index on assessment_id and candidate_id for quick lookups
db.submissions.create_index([
    ("assessment_id", 1),
    ("candidate_id", 1)
])

# Index on submission_timestamp for time-based queries
db.submissions.create_index("submission_timestamp")

# Index on requires_human_review for filtering
db.submissions.create_index("evaluation_metadata.requires_human_review")

# Index on question evaluations for searching
db.submissions.create_index("question_evaluations.question_id")
```

## Python Models (Pydantic)

Example Pydantic models for type safety:

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class CriteriaScore(BaseModel):
    score: float
    weight: float
    feedback: str

class FeedbackDetail(BaseModel):
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    detailed_analysis: str
    suggestions: List[str]

class AnswerLog(BaseModel):
    submitted_answer: str
    expected_answer: Optional[str] = None
    key_points_covered: List[str]
    key_points_missed: List[str]
    incorrect_points: List[str]
    partial_credit_reasoning: str

class EvaluationFlags(BaseModel):
    plagiarism_risk: str  # "Low|Medium|High"
    ai_generated_risk: str
    incomplete_answer: bool
    requires_human_review: bool
    confidence_level: float

class QuestionEvaluation(BaseModel):
    question_id: str
    question_type: str
    section: Optional[str] = None
    score: float
    max_marks: float
    percentage: float
    criteria_scores: Dict[str, CriteriaScore]
    feedback: FeedbackDetail
    answer_log: AnswerLog
    areas_of_improvement: List[Dict[str, Any]]
    benchmarking: Dict[str, Any]
    insights: Dict[str, Any]
    flags: EvaluationFlags

class SubmissionEvaluation(BaseModel):
    assessment_id: str
    candidate_id: str
    submission_timestamp: datetime
    question_evaluations: List[QuestionEvaluation]
    section_summaries: List[Dict[str, Any]]
    overall_evaluation: Dict[str, Any]
    evaluation_metadata: Dict[str, Any]
```

## Storage Examples

### Example 1: Storing Evaluation in Custom MCQ Assessment

```python
# In custom_mcq/routers.py submit endpoint

submission_doc = {
    "assessment_id": assessment_id,
    "candidate_id": candidate_key,
    "candidate_name": request.name,
    "candidate_email": request.email,
    "submission_timestamp": datetime.utcnow(),
    
    "question_evaluations": [
        {
            "question_id": eval["question_id"],
            "question_type": eval["question_type"],
            "section": eval.get("section", ""),
            "score": eval["score"],
            "max_marks": eval["max_marks"],
            "percentage": eval["percentage"],
            "evaluation": eval,  # Full evaluation object
            "evaluated_at": datetime.utcnow(),
            "evaluator": "AI",
            "ai_confidence": eval.get("flags", {}).get("confidence_level", 0.8),
            "evaluation_version": "1.0"
        }
        for eval in all_evaluations
    ],
    
    "section_summaries": section_summaries,
    "overall_evaluation": overall_summary,
    
    "evaluation_metadata": {
        "ai_model_used": "gpt-4o-mini",
        "evaluation_version": "1.0",
        "total_evaluation_time_ms": evaluation_time_ms,
        "requires_human_review": any(
            eval.get("flags", {}).get("requires_human_review", False)
            for eval in all_evaluations
        ),
        "human_reviewed": False
    },
    
    # Legacy fields for backward compatibility
    "graded_submissions": graded_submissions,
    "total_score": total_score,
    "total_marks": total_marks,
    "percentage": percentage
}

# Update assessment with submission
await db.custom_mcq_assessments.update_one(
    {"_id": assessment_id},
    {
        "$set": {
            f"submissions.{candidate_key}": submission_doc
        }
    }
)
```

### Example 2: Storing Evaluation in DSA Assessment

```python
# In dsa/routers/assessment.py submit_sql endpoint

submission_doc = {
    "test_id": test_id,
    "question_id": question_id,
    "user_id": user_id,
    "sql_query": request.sql_query,
    "test_passed": passed,
    "submitted_at": datetime.utcnow(),
    
    "ai_evaluation": evaluation,  # Full evaluation from evaluate_sql_answer()
    
    "score": evaluation["score"],
    "max_marks": max_marks,
    "percentage": evaluation["percentage"],
    
    "evaluation_metadata": {
        "evaluated_at": datetime.utcnow(),
        "evaluator": "AI",
        "ai_model_used": "gpt-4o-mini",
        "ai_confidence": evaluation.get("flags", {}).get("confidence_level", 0.8),
        "requires_human_review": evaluation.get("flags", {}).get("requires_human_review", False)
    }
}

await db.submissions.insert_one(submission_doc)
```

## Querying Evaluation Data

### Get All Evaluations for an Assessment

```python
assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
submissions = assessment.get("submissions", {})

for candidate_key, submission in submissions.items():
    evaluations = submission.get("question_evaluations", [])
    overall = submission.get("overall_evaluation", {})
    print(f"Candidate: {candidate_key}")
    print(f"Overall Score: {overall.get('overall_percentage', 0)}%")
```

### Get Questions Requiring Human Review

```python
assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
submissions = assessment.get("submissions", {})

for candidate_key, submission in submissions.items():
    for eval in submission.get("question_evaluations", []):
        if eval.get("evaluation", {}).get("flags", {}).get("requires_human_review", False):
            print(f"Question {eval['question_id']} needs review")
```

### Get Skill Breakdown for a Candidate

```python
submission = await db.custom_mcq_assessments.find_one({
    "_id": assessment_id,
    f"submissions.{candidate_key}": {"$exists": True}
})

overall = submission["submissions"][candidate_key].get("overall_evaluation", {})
skill_matrix = overall.get("skill_matrix", [])

for category in skill_matrix:
    print(f"\n{category['skill_category']}:")
    for skill in category.get("sub_skills", []):
        print(f"  {skill['skill']}: {skill['proficiency']} ({skill['score_percentage']}%)")
```

## Migration Guide

If you have existing submissions without AI evaluation:

```python
# Migration script to add evaluation structure to existing submissions

async def migrate_submissions():
    assessments = await db.custom_mcq_assessments.find({}).to_list(length=None)
    
    for assessment in assessments:
        submissions = assessment.get("submissions", {})
        
        for candidate_key, submission in submissions.items():
            # Check if already migrated
            if "question_evaluations" in submission:
                continue
            
            # Migrate graded_submissions to question_evaluations format
            question_evaluations = []
            for graded in submission.get("graded_submissions", []):
                question_evaluations.append({
                    "question_id": graded.get("questionId"),
                    "question_type": graded.get("questionType", "").lower(),
                    "score": graded.get("marksAwarded", 0),
                    "max_marks": graded.get("maxMarks", 1),
                    "percentage": (graded.get("marksAwarded", 0) / graded.get("maxMarks", 1) * 100) if graded.get("maxMarks", 1) > 0 else 0,
                    "evaluation": {
                        "feedback": {
                            "summary": graded.get("feedback", ""),
                            "strengths": [],
                            "weaknesses": [],
                            "detailed_analysis": "",
                            "suggestions": []
                        }
                    },
                    "evaluated_at": submission.get("submitted_at", datetime.utcnow()),
                    "evaluator": "Legacy",
                    "ai_confidence": 0.5
                })
            
            # Update submission
            await db.custom_mcq_assessments.update_one(
                {"_id": assessment["_id"]},
                {
                    "$set": {
                        f"submissions.{candidate_key}.question_evaluations": question_evaluations
                    }
                }
            )
```


