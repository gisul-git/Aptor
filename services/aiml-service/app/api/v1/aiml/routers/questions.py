from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
from ..database import get_aiml_database as get_database
from ..models.question import Question, QuestionCreate, QuestionUpdate
from ..services.ai_question_generator import generate_aiml_question, generate_topic_suggestions, generate_topic_suggestions
from app.core.dependencies import get_current_user, require_editor
from fastapi import Body

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/v1/aiml/questions", tags=["aiml"])

@router.get("/", response_model=List[dict])
async def get_questions(
    skip: int = 0, 
    limit: int = 1000,
    published_only: Optional[bool] = Query(None, description="Filter by published status. If None, returns all questions for the user"),
    library: Optional[str] = Query(None, description="Filter by library (numpy, matplotlib, pandas, etc.)"),
    ai_generated: Optional[bool] = Query(None, description="Filter by AI-generated status"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get questions list for the current user (requires authentication)
    Only returns questions created by the current user
    - published_only=True: Only return published questions
    - published_only=False: Only return unpublished questions
    - published_only=None: Return all questions created by the user
    - library: Filter by specific library
    - ai_generated: Filter by AI-generated status
    """
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_questions] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"[get_questions] Fetching AIML questions for user_id: '{user_id}'")
    
    user_id_normalized = str(user_id).strip()
    
    # Build strict query - exact string match
    base_conditions = [
        {"created_by": {"$exists": True}},
        {"created_by": {"$ne": None}},
        {"created_by": {"$ne": ""}},
        {"created_by": user_id_normalized}
    ]
    
    # Filter to only get AIML questions (isolate from DSA questions)
    base_conditions.append({"module_type": "aiml"})
    
    # Filter by published status if specified
    if published_only is not None:
        base_conditions.append({"is_published": published_only})
    
    # Filter by library if specified
    if library:
        base_conditions.append({"library": library})
    
    # Filter by AI-generated status if specified
    if ai_generated is not None:
        base_conditions.append({"ai_generated": ai_generated})
    
    query = {"$and": base_conditions}
    
    logger.info(f"[get_questions] MongoDB query: {query}")
    
    # Sort by created_at descending to show newest first
    questions_cursor = db.questions.find(query)
    questions = await questions_cursor.sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    logger.info(f"[get_questions] Found {len(questions)} questions in database for user_id: {user_id}")
    
    # Security check: filter out any question that doesn't match exactly
    filtered_questions = []
    for q in questions:
        q_created_by = q.get("created_by")
        if q_created_by is None or q_created_by == "":
            continue
        if str(q_created_by).strip() != user_id_normalized:
            continue
        filtered_questions.append(q)
    
    questions = filtered_questions
    
    result = []
    for q in questions:
        question_dict = {
            "id": str(q["_id"]),
            "title": q.get("title", ""),
            "description": q.get("description", ""),
            "difficulty": q.get("difficulty", ""),
            "languages": q.get("languages", []),
            "starter_code": q.get("starter_code", {}),
            "public_testcases": q.get("public_testcases", []),
            "hidden_testcases": q.get("hidden_testcases", []),
            "is_published": q.get("is_published", False),
            "library": q.get("library", "numpy"),
            "requires_dataset": q.get("requires_dataset", False),
            "ai_generated": q.get("ai_generated", False),
            "dataset_path": q.get("dataset_path"),
            # New format fields
            "tasks": q.get("tasks", []),
            "question_type": q.get("question_type"),
            "execution_environment": q.get("execution_environment"),
            "assessment_metadata": q.get("assessment_metadata"),
            "dataset": q.get("dataset"),
        }
        if "function_signature" in q and q.get("function_signature"):
            question_dict["function_signature"] = q["function_signature"]
        if "created_at" in q:
            question_dict["created_at"] = q["created_at"].isoformat() if isinstance(q.get("created_at"), datetime) else q.get("created_at")
        if "updated_at" in q:
            question_dict["updated_at"] = q["updated_at"].isoformat() if isinstance(q.get("updated_at"), datetime) else q.get("updated_at")
        result.append(question_dict)
    return result

@router.get("/{question_id}", response_model=dict)
async def get_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get a specific question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_question] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"[get_question] Fetching question {question_id} for user_id: '{user_id}'")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    question_created_by = question.get("created_by")
    if not question_created_by:
        logger.warning(f"[get_question] SECURITY: Question {question_id} has no created_by field")
        raise HTTPException(status_code=403, detail="You don't have permission to access this question")
    
    if str(question_created_by).strip() != user_id.strip():
        logger.error(f"[get_question] SECURITY ISSUE: User {user_id} attempted to access question {question_id} created by {question_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to access this question")
    
    logger.info(f"[get_question] Question {question_id} access granted to user {user_id}")
    
    # Convert ObjectId and datetime fields to JSON-serializable formats
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
        "library": question.get("library", "numpy"),
        "requires_dataset": question.get("requires_dataset", False),
        "ai_generated": question.get("ai_generated", False),
        "dataset_path": question.get("dataset_path"),
        # New format fields
        "tasks": question.get("tasks", []),
        "question_type": question.get("question_type"),
        "execution_environment": question.get("execution_environment"),
        "assessment_metadata": question.get("assessment_metadata"),
        "dataset": question.get("dataset"),
    }
    
    # Add function_signature if it exists
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    
    # Add optional fields if they exist
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    
    return question_dict

@router.post("/", response_model=dict)
async def create_question(
    question: QuestionCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Create a new question (requires authentication)
    Simplified for manual creation - only title and description are required.
    """
    db = get_database()
    question_dict = question.model_dump(exclude_none=True)
    
    # Set defaults for manual creation
    if not question_dict.get("difficulty"):
        question_dict["difficulty"] = "medium"
    if not question_dict.get("library"):
        question_dict["library"] = "numpy"
    if not question_dict.get("languages"):
        question_dict["languages"] = ["python3"]
    if not question_dict.get("public_testcases"):
        question_dict["public_testcases"] = []
    if not question_dict.get("hidden_testcases"):
        question_dict["hidden_testcases"] = []
    if not question_dict.get("starter_code"):
        question_dict["starter_code"] = {"python3": "import numpy as np\n# Your code here\n"}
    if not question_dict.get("constraints"):
        question_dict["constraints"] = []
    if not question_dict.get("ai_generated"):
        question_dict["ai_generated"] = False
    if not question_dict.get("requires_dataset"):
        question_dict["requires_dataset"] = False
    if not question_dict.get("question_type"):
        question_dict["question_type"] = "aiml_coding"
    if not question_dict.get("execution_environment"):
        question_dict["execution_environment"] = "jupyter_notebook"
    
    # Set default assessment_metadata if not provided
    if not question_dict.get("assessment_metadata"):
        question_dict["assessment_metadata"] = {
            "skill": "Python",
            "topic": None,
            "libraries": [question_dict.get("library", "numpy")],
            "selected_dataset_format": "csv"
        }
    
    # Store the actual user ID who created the question
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[create_question] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    question_dict["created_by"] = user_id
    now = datetime.utcnow()
    question_dict["created_at"] = now
    question_dict["updated_at"] = now
    question_dict["module_type"] = "aiml"  # Mark as AIML question to isolate from DSA
    
    logger.info(f"[create_question] Creating AIML question with created_by={user_id}, title={question_dict.get('title')}, library={question_dict.get('library')}")
    
    result = await db.questions.insert_one(question_dict)
    
    # Fetch the created question to return it
    created_question = await db.questions.find_one({"_id": result.inserted_id})
    if created_question:
        question_dict = {
            "id": str(created_question["_id"]),
            "title": created_question.get("title", ""),
            "description": created_question.get("description", ""),
            "difficulty": created_question.get("difficulty", ""),
            "languages": created_question.get("languages", []),
            "starter_code": created_question.get("starter_code", {}),
            "public_testcases": created_question.get("public_testcases", []),
            "hidden_testcases": created_question.get("hidden_testcases", []),
            "is_published": created_question.get("is_published", False),
            "library": created_question.get("library", "numpy"),
            "requires_dataset": created_question.get("requires_dataset", False),
            "ai_generated": created_question.get("ai_generated", False),
            "dataset_path": created_question.get("dataset_path"),
        }
        if "function_signature" in created_question and created_question.get("function_signature"):
            question_dict["function_signature"] = created_question["function_signature"]
        if "created_at" in created_question:
            question_dict["created_at"] = created_question["created_at"].isoformat() if isinstance(created_question.get("created_at"), datetime) else created_question.get("created_at")
        if "updated_at" in created_question:
            question_dict["updated_at"] = created_question["updated_at"].isoformat() if isinstance(created_question.get("updated_at"), datetime) else created_question.get("updated_at")
        return question_dict
    
    # Fallback if fetch fails
    question_dict["id"] = str(result.inserted_id)
    if "created_at" in question_dict and isinstance(question_dict.get("created_at"), datetime):
        question_dict["created_at"] = question_dict["created_at"].isoformat()
    return question_dict

@router.post("/suggest-topics", response_model=dict)
async def suggest_topics(
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate AI-suggested topics based on skill and difficulty level.
    """
    try:
        skill = request.get("skill")
        difficulty = request.get("difficulty", "medium")
        
        if not skill:
            raise HTTPException(status_code=400, detail="Skill is required")
        
        if difficulty not in ["easy", "medium", "hard"]:
            raise HTTPException(status_code=400, detail="Difficulty must be easy, medium, or hard")
        
        logger.info(f"Generating topic suggestions for skill={skill}, difficulty={difficulty}")
        
        # Generate topics using AI
        topics = await generate_topic_suggestions(
            skill=skill,
            difficulty=difficulty
        )
        
        return {
            "skill": skill,
            "difficulty": difficulty,
            "topics": topics
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error generating topic suggestions: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate topic suggestions: {str(exc)}")

@router.put("/{question_id}", response_model=dict)
async def update_question(
    question_id: str, 
    question_update: QuestionUpdate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Update a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[update_question] SECURITY ISSUE: User {user_id} attempted to update question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to update this question")
    
    update_data = {k: v for k, v in question_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.questions.update_one(
        {"_id": ObjectId(question_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
        "library": question.get("library", "numpy"),
        "requires_dataset": question.get("requires_dataset", False),
        "ai_generated": question.get("ai_generated", False),
        "dataset_path": question.get("dataset_path"),
    }
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    return question_dict

@router.patch("/{question_id}/publish", response_model=dict)
async def toggle_publish_question(
    question_id: str, 
    is_published: bool = Query(..., description="Set publish status"),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Toggle publish status of a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[toggle_publish_question] SECURITY ISSUE: User {user_id} attempted to publish/unpublish question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to publish/unpublish this question")
    
    result = await db.questions.update_one(
        {"_id": ObjectId(question_id)},
        {"$set": {"is_published": is_published, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
        "library": question.get("library", "numpy"),
        "requires_dataset": question.get("requires_dataset", False),
        "ai_generated": question.get("ai_generated", False),
        "dataset_path": question.get("dataset_path"),
    }
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    return question_dict

@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Delete a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[delete_question] SECURITY ISSUE: User {user_id} attempted to delete question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to delete this question")
    
    result = await db.questions.delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question deleted successfully"}


@router.post("/generate-ai", response_model=dict)
async def generate_ai_question(
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Generate an AI question for AIML competency assessment.
    Accepts new format: title, skill, topic (optional), difficulty, dataset_format.
    Returns question with optional dataset.
    """
    try:
        # Extract parameters (support both old and new format for backward compatibility)
        title = request.get("title") or request.get("assessment_title", "AIML Assessment")
        skill = request.get("skill") or request.get("library", "Python")
        topic = request.get("topic")
        difficulty = request.get("difficulty", "medium")
        dataset_format = request.get("dataset_format") or request.get("selected_dataset_format", "csv")
        
        # Legacy support: if library is provided, use it as skill
        if "library" in request and "skill" not in request:
            skill = request.get("library", "Python")
        
        if difficulty not in ["easy", "medium", "hard"]:
            raise HTTPException(status_code=400, detail="Difficulty must be easy, medium, or hard")
        
        logger.info(f"Generating AI question: title={title}, skill={skill}, topic={topic}, difficulty={difficulty}")
        
        # Generate question using AI (new format)
        generated_data = await generate_aiml_question(
            title=title,
            skill=skill,
            topic=topic,
            difficulty=difficulty,
            dataset_format=dataset_format
        )
        
        # Extract assessment, question, and dataset from response
        assessment = generated_data.get("assessment", {})
        question_info = generated_data.get("question", {})
        dataset_info = generated_data.get("dataset")
        
        # Transform to database schema
        question_data = {
            "title": assessment.get("title", title),
            "description": question_info.get("description", ""),
            "difficulty": assessment.get("difficulty", difficulty),
            "languages": ["python3"],  # AIML questions are Python-based
            "library": skill,  # Store skill as library for backward compatibility
            "requires_dataset": dataset_info is not None,
            "ai_generated": True,
            "tasks": question_info.get("tasks", []),
            "constraints": question_info.get("constraints", []),
            "question_type": question_info.get("type", "aiml_coding"),
            "execution_environment": question_info.get("execution_environment", "jupyter_notebook"),
            # Store assessment metadata
            "assessment_metadata": {
                "skill": assessment.get("skill", skill),
                "topic": assessment.get("topic", topic),
                "libraries": assessment.get("libraries", []),
                "selected_dataset_format": assessment.get("selected_dataset_format", dataset_format)
            },
            "dataset": dataset_info
        }
        
        # Store dataset format if dataset is present (always in JSON format internally)
        # Add format field to dataset for serving in the selected format
        if dataset_info:
            question_data["dataset"]["format"] = dataset_format  # Store the user-selected format
        
        # Set created_by and timestamps
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        user_id = str(user_id).strip()
        question_data["created_by"] = user_id
        now = datetime.utcnow()
        question_data["created_at"] = now
        question_data["updated_at"] = now
        question_data["module_type"] = "aiml"  # Mark as AIML question to isolate from DSA
        
        # Insert into database
        db = get_database()
        result = await db.questions.insert_one(question_data)
        
        # Fetch created question
        created_question = await db.questions.find_one({"_id": result.inserted_id})
        
        if created_question:
            # Return in new format
            response = {
                "id": str(created_question["_id"]),
                "assessment": {
                    "title": created_question.get("title", title),
                    "skill": created_question.get("assessment_metadata", {}).get("skill", skill),
                    "topic": created_question.get("assessment_metadata", {}).get("topic", topic),
                    "difficulty": created_question.get("difficulty", difficulty),
                    "libraries": created_question.get("assessment_metadata", {}).get("libraries", []),
                    "selected_dataset_format": created_question.get("assessment_metadata", {}).get("selected_dataset_format", dataset_format)
                },
                "question": {
                    "type": created_question.get("question_type", "aiml_coding"),
                    "execution_environment": created_question.get("execution_environment", "jupyter_notebook"),
                    "description": created_question.get("description", ""),
                    "tasks": created_question.get("tasks", []),
                    "constraints": created_question.get("constraints", [])
                },
                "dataset": created_question.get("dataset"),
                "ai_generated": True,
                "requires_dataset": created_question.get("requires_dataset", False),
                "created_at": created_question.get("created_at").isoformat() if isinstance(created_question.get("created_at"), datetime) else created_question.get("created_at")
            }
            return response
        
        raise HTTPException(status_code=500, detail="Failed to create question")
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error generating AI question: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(exc)}")


@router.get("/{question_id}/dataset-preview", response_model=dict)
async def get_dataset_preview(
    question_id: str,
    format: str = Query("csv", description="Dataset format: csv, json, pdf, parquet, avro"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get dataset preview in the specified format.
    """
    try:
        db = get_database()
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")
        
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Check ownership
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        user_id = str(user_id).strip()
        
        question_created_by = question.get("created_by")
        if question_created_by and str(question_created_by).strip() != user_id.strip():
            raise HTTPException(status_code=403, detail="You don't have permission to access this question")
        
        dataset = question.get("dataset")
        if not dataset:
            raise HTTPException(status_code=404, detail="Question does not have a dataset")
        
        schema = dataset.get("schema", [])
        rows = dataset.get("rows", [])
        
        if not schema or not rows:
            raise HTTPException(status_code=400, detail="Dataset is empty")
        
        # Convert dataset to requested format
        try:
            import pandas as pd
        except ImportError:
            raise HTTPException(status_code=500, detail="pandas library not installed. Please install pandas for dataset conversion support.")
        
        import io
        import json as json_lib
        
        # Create DataFrame from dataset - dynamically use schema column names
        column_names = [col["name"] for col in schema]
        
        df_data = []
        for row in rows:
            row_dict = {}
            for i, col in enumerate(schema):
                if i < len(row):
                    row_dict[col["name"]] = row[i]
                else:
                    row_dict[col["name"]] = None
            df_data.append(row_dict)
        
        # Create DataFrame with explicit column order from schema
        df = pd.DataFrame(df_data, columns=column_names)
        
        # Convert to requested format
        format_lower = format.lower()
        
        if format_lower == "csv":
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            return {
                "format": "csv",
                "content": csv_buffer.getvalue(),
                "mime_type": "text/csv"
            }
        
        elif format_lower == "json":
            json_data = df.to_dict(orient="records")
            return {
                "format": "json",
                "content": json_lib.dumps(json_data, indent=2),
                "mime_type": "application/json"
            }
        
        elif format_lower == "parquet":
            try:
                parquet_buffer = io.BytesIO()
                df.to_parquet(parquet_buffer, index=False)
                import base64
                return {
                    "format": "parquet",
                    "content": base64.b64encode(parquet_buffer.getvalue()).decode("utf-8"),
                    "mime_type": "application/octet-stream",
                    "is_binary": True
                }
            except ImportError as e:
                raise HTTPException(status_code=500, detail="pyarrow library not installed for Parquet support. Please install pyarrow using: pip install pyarrow")
            except Exception as e:
                if "pyarrow" in str(e).lower() or "fastparquet" in str(e).lower():
                    raise HTTPException(status_code=500, detail="Parquet support requires pyarrow. Please install using: pip install pyarrow")
                raise
        
        elif format_lower == "avro":
            try:
                from fastavro import writer, parse_schema  # type: ignore
                import io as io_module
                
                # Convert schema to Avro format
                avro_fields = []
                for col in schema:
                    avro_type = "string"
                    if col["type"] == "int":
                        avro_type = "int"
                    elif col["type"] == "float":
                        avro_type = "double"
                    elif col["type"] == "bool":
                        avro_type = "boolean"
                    
                    avro_fields.append({
                        "name": col["name"],
                        "type": avro_type
                    })
                
                avro_schema = {
                    "type": "record",
                    "name": "Dataset",
                    "fields": avro_fields
                }
                
                avro_buffer = io_module.BytesIO()
                records = df.to_dict(orient="records")
                writer(avro_buffer, parse_schema(avro_schema), records)
                
                import base64
                return {
                    "format": "avro",
                    "content": base64.b64encode(avro_buffer.getvalue()).decode("utf-8"),
                    "mime_type": "application/avro",
                    "is_binary": True
                }
            except ImportError:
                raise HTTPException(status_code=500, detail="fastavro library not installed for Avro support")
        
        elif format_lower == "pdf":
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
                import io as io_module
                
                pdf_buffer = io_module.BytesIO()
                doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
                
                # Prepare table data - header row first
                table_data = [[schema_col["name"] for schema_col in schema]]
                # Then data rows
                for row in rows:
                    table_data.append([str(val) if val is not None else "" for val in row])
                
                # Create table
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                doc.build([table])
                
                import base64
                return {
                    "format": "pdf",
                    "content": base64.b64encode(pdf_buffer.getvalue()).decode("utf-8"),
                    "mime_type": "application/pdf",
                    "is_binary": True
                }
            except ImportError:
                raise HTTPException(status_code=500, detail="reportlab library not installed for PDF support")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Supported formats: csv, json, parquet, avro, pdf")
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error generating dataset preview: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dataset preview: {str(exc)}")


@router.get("/{question_id}/dataset", response_model=dict)
async def get_dataset_for_candidate(
    question_id: str,
    format: str = Query("csv", description="Dataset format: csv, json, pdf, parquet, avro"),
    test_id: str = Query(..., description="Test ID for access validation"),
    user_id: str = Query(..., description="User ID from link token")
):
    """
    Get dataset for candidate (no authentication required, validated by test access).
    This endpoint allows candidates to access datasets without authentication.
    """
    try:
        db = get_database()
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")

        # Validate that the question belongs to the test
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if not test.get("is_published", False):
            raise HTTPException(status_code=403, detail="Test is not published")

        question_ids = test.get("question_ids", [])
        if question_id not in [str(qid) for qid in question_ids]:
            raise HTTPException(status_code=403, detail="Question does not belong to this test")

        # Get the question
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        dataset = question.get("dataset")
        if not dataset:
            raise HTTPException(status_code=404, detail="Question does not have a dataset")

        schema = dataset.get("schema", [])
        rows = dataset.get("rows", [])

        if not schema or not rows:
            raise HTTPException(status_code=400, detail="Dataset is empty")

        # Convert dataset to requested format (same logic as dataset-preview)
        try:
            import pandas as pd
        except ImportError:
            raise HTTPException(status_code=500, detail="pandas library not installed. Please install pandas for dataset conversion support.")

        import io
        import json as json_lib

        # Create DataFrame from dataset - dynamically use schema column names
        column_names = [col["name"] for col in schema]
        
        df_data = []
        for row in rows:
            row_dict = {}
            for i, col in enumerate(schema):
                if i < len(row):
                    row_dict[col["name"]] = row[i]
                else:
                    row_dict[col["name"]] = None
            df_data.append(row_dict)

        # Create DataFrame with explicit column order from schema
        df = pd.DataFrame(df_data, columns=column_names)

        # Convert to requested format
        format_lower = format.lower()

        if format_lower == "csv":
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            return {
                "format": "csv",
                "content": csv_buffer.getvalue(),
                "mime_type": "text/csv"
            }

        elif format_lower == "json":
            json_data = df.to_dict(orient="records")
            return {
                "format": "json",
                "content": json_lib.dumps(json_data, indent=2),
                "mime_type": "application/json"
            }

        elif format_lower == "parquet":
            parquet_buffer = io.BytesIO()
            df.to_parquet(parquet_buffer, index=False)
            import base64
            return {
                "format": "parquet",
                "content": base64.b64encode(parquet_buffer.getvalue()).decode("utf-8"),
                "mime_type": "application/octet-stream",
                "is_binary": True
            }

        elif format_lower == "avro":
            try:
                from fastavro import writer, parse_schema  # type: ignore
                import io as io_module

                # Convert schema to Avro format
                avro_fields = []
                for col in schema:
                    avro_type = "string"
                    if col["type"] == "int":
                        avro_type = "int"
                    elif col["type"] == "float":
                        avro_type = "double"
                    elif col["type"] == "bool":
                        avro_type = "boolean"

                    avro_fields.append({
                        "name": col["name"],
                        "type": avro_type
                    })

                avro_schema = {
                    "type": "record",
                    "name": "Dataset",
                    "fields": avro_fields
                }

                avro_buffer = io_module.BytesIO()
                records = df.to_dict(orient="records")
                writer(avro_buffer, parse_schema(avro_schema), records)

                import base64
                return {
                    "format": "avro",
                    "content": base64.b64encode(avro_buffer.getvalue()).decode("utf-8"),
                    "mime_type": "application/avro",
                    "is_binary": True
                }
            except ImportError:
                raise HTTPException(status_code=500, detail="fastavro library not installed for Avro support")

        elif format_lower == "pdf":
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
                import io as io_module

                pdf_buffer = io_module.BytesIO()
                doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)

                # Prepare table data - header row first
                table_data = [[schema_col["name"] for schema_col in schema]]
                # Then data rows
                for row in rows:
                    table_data.append([str(val) if val is not None else "" for val in row])

                # Create table
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))

                doc.build([table])

                import base64
                return {
                    "format": "pdf",
                    "content": base64.b64encode(pdf_buffer.getvalue()).decode("utf-8"),
                    "mime_type": "application/pdf",
                    "is_binary": True
                }
            except ImportError:
                raise HTTPException(status_code=500, detail="reportlab library not installed for PDF support")

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Supported formats: csv, json, parquet, avro, pdf")

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error generating dataset for candidate: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate dataset: {str(exc)}")


@router.get("/{question_id}/dataset-download")
async def download_dataset_for_candidate(
    question_id: str,
    format: Optional[str] = Query(None, description="Dataset format: csv, json, parquet, avro, pdf. If not provided, uses the format stored in the dataset."),
    test_id: str = Query(..., description="Test ID for access validation"),
    user_id: str = Query(..., description="User ID from link token")
):
    """
    Download dataset file directly for candidate (returns raw file content).
    This endpoint returns the file directly with proper Content-Type headers,
    making it easy to use with pandas: pd.read_csv(url) or pd.read_json(url)
    Uses the format stored in the dataset if format parameter is not provided.
    """
    from fastapi.responses import Response
    
    try:
        db = get_database()
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")

        # Validate that the question belongs to the test
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if not test.get("is_published", False):
            raise HTTPException(status_code=403, detail="Test is not published")

        question_ids = test.get("question_ids", [])
        if question_id not in [str(qid) for qid in question_ids]:
            raise HTTPException(status_code=403, detail="Question does not belong to this test")

        # Get the question
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        dataset = question.get("dataset")
        if not dataset:
            raise HTTPException(status_code=404, detail="Question does not have a dataset")
        
        # Use stored format if format parameter is not provided
        if format is None:
            format = dataset.get("format", "csv")  # Default to csv if format not stored

        schema = dataset.get("schema", [])
        rows = dataset.get("rows", [])

        if not schema or not rows:
            raise HTTPException(status_code=400, detail="Dataset is empty")

        # Convert dataset to requested format
        try:
            import pandas as pd
        except ImportError:
            raise HTTPException(status_code=500, detail="pandas library not installed")

        import io

        # Create DataFrame from dataset
        # Get column names from schema
        column_names = [col["name"] for col in schema]
        
        df_data = []
        for row in rows:
            row_dict = {}
            for i, col in enumerate(schema):
                if i < len(row):
                    row_dict[col["name"]] = row[i]
                else:
                    row_dict[col["name"]] = None
            df_data.append(row_dict)

        # Create DataFrame with explicit column order
        df = pd.DataFrame(df_data, columns=column_names)
        format_lower = format.lower()

        if format_lower == "csv":
            csv_buffer = io.StringIO()
            # Ensure column names are properly set
            if df.empty:
                # If DataFrame is empty, create with schema columns
                df = pd.DataFrame(columns=[col["name"] for col in schema])
            df.to_csv(csv_buffer, index=False, encoding='utf-8')
            csv_content = csv_buffer.getvalue()
            return Response(
                content=csv_content.encode('utf-8'),
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="dataset_{question_id}.csv"',
                    "Content-Type": "text/csv; charset=utf-8"
                }
            )

        elif format_lower == "json":
            json_data = df.to_dict(orient="records")
            import json as json_lib
            return Response(
                content=json_lib.dumps(json_data, indent=2),
                media_type="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="dataset_{question_id}.json"'
                }
            )

        elif format_lower == "parquet":
            parquet_buffer = io.BytesIO()
            df.to_parquet(parquet_buffer, index=False)
            import base64
            return Response(
                content=parquet_buffer.getvalue(),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="dataset_{question_id}.parquet"',
                    "Content-Type": "application/octet-stream"
                }
            )

        elif format_lower == "avro":
            try:
                from fastavro import writer, parse_schema  # type: ignore
                import io as io_module

                # Convert schema to Avro format
                avro_fields = []
                for col in schema:
                    avro_type = "string"
                    if col["type"] == "int":
                        avro_type = "int"
                    elif col["type"] == "float":
                        avro_type = "double"
                    elif col["type"] == "bool":
                        avro_type = "boolean"

                    avro_fields.append({
                        "name": col["name"],
                        "type": avro_type
                    })

                avro_schema = {
                    "type": "record",
                    "name": "Dataset",
                    "fields": avro_fields
                }

                avro_buffer = io_module.BytesIO()
                records = df.to_dict(orient="records")
                writer(avro_buffer, parse_schema(avro_schema), records)

                return Response(
                    content=avro_buffer.getvalue(),
                    media_type="application/avro",
                    headers={
                        "Content-Disposition": f'attachment; filename="dataset_{question_id}.avro"',
                        "Content-Type": "application/avro"
                    }
                )
            except ImportError:
                raise HTTPException(status_code=500, detail="fastavro library not installed for Avro support")

        elif format_lower == "pdf":
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
                import io as io_module

                pdf_buffer = io_module.BytesIO()
                doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)

                # Prepare table data - header row first
                table_data = [[schema_col["name"] for schema_col in schema]]
                # Then data rows
                for row in rows:
                    table_data.append([str(val) if val is not None else "" for val in row])

                # Create table
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))

                doc.build([table])

                return Response(
                    content=pdf_buffer.getvalue(),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f'attachment; filename="dataset_{question_id}.pdf"',
                        "Content-Type": "application/pdf"
                    }
                )
            except ImportError:
                raise HTTPException(status_code=500, detail="reportlab library not installed for PDF support")

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format for direct download: {format}. Supported formats: csv, json, parquet, avro, pdf")

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error downloading dataset for candidate: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to download dataset: {str(exc)}")

