"""
Design Tests API - Following AIML pattern
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel

from app.repositories.design_repository import design_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/design/tests", tags=["Design Tests"])


class TestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    question_ids: List[str] = []
    duration_minutes: Optional[int] = 60
    timer_mode: Optional[str] = "GLOBAL"
    question_timings: Optional[List[Dict[str, Any]]] = []
    examMode: Optional[str] = "strict"
    schedule: Optional[Dict[str, Any]] = None
    proctoringSettings: Optional[Dict[str, Any]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    class Config:
        extra = "allow"


@router.post("/", response_model=dict)
async def create_test(test: TestCreate):
    """Create a new design test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Validate questions exist
        if test.question_ids:
            question_ids = [ObjectId(qid) if ObjectId.is_valid(qid) else None for qid in test.question_ids]
            question_ids = [qid for qid in question_ids if qid is not None]
            
            if question_ids:
                questions = await db.design_questions.find({"_id": {"$in": question_ids}}).to_list(length=len(question_ids))
                found_ids = {str(q["_id"]) for q in questions}
                requested_ids = {str(qid) for qid in question_ids}
                
                if found_ids != requested_ids:
                    raise HTTPException(status_code=400, detail="Some questions not found")
        
        # Handle exam window configuration
        test_dict = test.model_dump()
        exam_mode = test_dict.get("examMode", "strict")
        schedule_obj = test_dict.get("schedule") or {}
        
        start_dt = (schedule_obj.get("startTime") if schedule_obj else None) or test_dict.get("startTime") or test_dict.get("start_time")
        end_dt = (schedule_obj.get("endTime") if schedule_obj else None) or test_dict.get("endTime") or test_dict.get("end_time")
        duration = (schedule_obj.get("duration") if schedule_obj else None) or test_dict.get("duration") or test_dict.get("duration_minutes", 60)
        
        # Calculate end time for strict mode
        if exam_mode == "strict" and start_dt and duration:
            if isinstance(start_dt, str):
                start_dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
            end_dt = start_dt + timedelta(minutes=int(duration))
        
        # Extract proctoring and candidate requirements
        proctoring_settings = test_dict.get("proctoringSettings") or {}
        candidate_reqs = schedule_obj.get("candidateRequirements") if schedule_obj else {}
        
        # Build schedule payload
        schedule_payload = {
            "startTime": start_dt,
            "endTime": end_dt,
            "duration": int(duration) if duration else 60,
            "candidateRequirements": candidate_reqs,
            "proctoringSettings": proctoring_settings,
        }
        
        # Create test document
        test_doc = {
            "_id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "title": test.title,
            "description": test.description,
            "question_ids": test.question_ids,
            "duration_minutes": int(duration) if duration else 60,
            "timer_mode": test_dict.get("timer_mode", "GLOBAL"),
            "question_timings": test_dict.get("question_timings", []),
            "examMode": exam_mode,
            "schedule": schedule_payload,
            "proctoringSettings": proctoring_settings,
            "start_time": start_dt,
            "end_time": end_dt,
            "created_by": test_dict.get("created_by", "system"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_active": True,
            "is_published": False,
            "test_type": "design",
            "invited_users": []
        }
        
        result = await db.design_tests.insert_one(test_doc)
        
        logger.info(f"Created design test: {test_doc['_id']}")
        
        return {
            "id": test_doc["_id"],
            "message": "Test created successfully",
            "test": test_doc
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create test: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=dict)
async def get_tests(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0)
):
    """Get all design tests"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        tests = await db.design_tests.find(
            {"is_active": True}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        for test in tests:
            test["id"] = str(test.pop("_id"))
            if "created_at" in test and isinstance(test["created_at"], datetime):
                test["created_at"] = test["created_at"].isoformat()
            if "updated_at" in test and isinstance(test["updated_at"], datetime):
                test["updated_at"] = test["updated_at"].isoformat()
        
        # Return array directly for frontend compatibility
        return tests
        
    except Exception as e:
        logger.error(f"Failed to get tests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{test_id}", response_model=dict)
async def get_test(test_id: str):
    """Get a specific test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        test = await db.design_tests.find_one({"_id": test_id})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        test["id"] = str(test.pop("_id"))
        if "created_at" in test and isinstance(test["created_at"], datetime):
            test["created_at"] = test["created_at"].isoformat()
        if "updated_at" in test and isinstance(test["updated_at"], datetime):
            test["updated_at"] = test["updated_at"].isoformat()
        
        return test
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{test_id}/publish", response_model=dict)
async def publish_test(test_id: str):
    """Publish a test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        result = await db.design_tests.update_one(
            {"_id": test_id},
            {"$set": {"is_published": True, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Test not found")
        
        return {"message": "Test published successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to publish test: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class AddCandidateRequest(BaseModel):
    email: str
    name: str


@router.post("/{test_id}/candidates", response_model=dict)
async def add_candidate(test_id: str, candidate: AddCandidateRequest):
    """Add a candidate to a test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Check if test exists
        test = await db.design_tests.find_one({"_id": test_id})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        # Check if candidate already exists
        existing = await db.design_candidates.find_one({
            "test_id": test_id,
            "email": candidate.email
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Candidate already added")
        
        # Create candidate document
        candidate_doc = {
            "_id": str(datetime.utcnow().timestamp()).replace(".", ""),
            "test_id": test_id,
            "email": candidate.email,
            "name": candidate.name,
            "status": "pending",
            "invited": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.design_candidates.insert_one(candidate_doc)
        
        logger.info(f"Added candidate {candidate.email} to test {test_id}")
        
        return {
            "message": "Candidate added successfully",
            "candidate": candidate_doc
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add candidate: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{test_id}/candidates", response_model=dict)
async def get_candidates(test_id: str):
    """Get all candidates for a test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        candidates = await db.design_candidates.find(
            {"test_id": test_id}
        ).to_list(length=None)
        
        for candidate in candidates:
            candidate["id"] = str(candidate.pop("_id"))
            if "created_at" in candidate and isinstance(candidate["created_at"], datetime):
                candidate["created_at"] = candidate["created_at"].isoformat()
            if "updated_at" in candidate and isinstance(candidate["updated_at"], datetime):
                candidate["updated_at"] = candidate["updated_at"].isoformat()
        
        return {"candidates": candidates, "total": len(candidates)}
        
    except Exception as e:
        logger.error(f"Failed to get candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SendInvitationRequest(BaseModel):
    email: str


@router.post("/{test_id}/send-invitation", response_model=dict)
async def send_invitation(test_id: str, request: SendInvitationRequest):
    """Send invitation email to a single candidate"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Get test
        test = await db.design_tests.find_one({"_id": test_id})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if not test.get("is_published", False):
            raise HTTPException(status_code=400, detail="Test must be published before sending invitations")
        
        # Get candidate
        candidate = await db.design_candidates.find_one({
            "test_id": test_id,
            "email": request.email
        })
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found for this test")
        
        # Ensure test token exists
        test_token = test.get("test_token")
        if not test_token:
            import secrets
            test_token = secrets.token_urlsafe(32)
            await db.design_tests.update_one(
                {"_id": test_id},
                {"$set": {"test_token": test_token}}
            )
        
        # Build test URL
        import os
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3002")
        test_link = f"{frontend_url}/design/tests/{test_id}/take?token={test_token}"
        
        # Get candidate details
        candidate_name = candidate.get("name", "Candidate")
        candidate_email = candidate.get("email")
        
        # Add email and name to URL
        import urllib.parse
        encoded_email = urllib.parse.quote(candidate_email)
        encoded_name = urllib.parse.quote(candidate_name)
        exam_url_with_params = f"{test_link}&email={encoded_email}&name={encoded_name}"
        
        # Get test details
        test_title = test.get("title", "Design Assessment")
        test_description = test.get("description", "")
        duration_minutes = test.get("duration_minutes", 60)
        
        # Format duration
        duration_text = ""
        if duration_minutes:
            hours = duration_minutes // 60
            minutes = duration_minutes % 60
            if hours > 0:
                duration_text = f"{hours} hour{'s' if hours > 1 else ''}"
                if minutes > 0:
                    duration_text += f" {minutes} minute{'s' if minutes > 1 else ''}"
            else:
                duration_text = f"{minutes} minute{'s' if minutes > 1 else ''}"
        
        # Build email HTML
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .content {{ background-color: #F9F5FF; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #7C3AED; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #7C3AED; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="color: #7C3AED;">Design Assessment Invitation</h1>
                </div>
                
                <div class="content">
                    <p><strong>Hello {candidate_name},</strong></p>
                    <p>You have been invited to take the design assessment: <strong>{test_title}</strong></p>
                    {f'<p>{test_description}</p>' if test_description else ''}
                    <p><strong>Duration:</strong> {duration_text}</p>
                    <div style="text-align: center;">
                        <a href="{exam_url_with_params}" class="button">Start Assessment</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send email using SendGrid
        import os
        sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        sendgrid_from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@aaptor.com")
        
        if not sendgrid_api_key:
            logger.warning("SendGrid API key not configured, skipping email send")
            # Update candidate as invited anyway
            await db.design_candidates.update_one(
                {"_id": candidate["_id"]},
                {"$set": {"invited": True, "invited_at": datetime.utcnow()}}
            )
            return {"message": "Email service not configured, but candidate marked as invited"}
        
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        
        message = Mail(
            from_email=sendgrid_from_email,
            to_emails=candidate_email,
            subject=f"Invitation: {test_title}",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        # Update candidate as invited
        await db.design_candidates.update_one(
            {"_id": candidate["_id"]},
            {"$set": {"invited": True, "invited_at": datetime.utcnow()}}
        )
        
        logger.info(f"Sent invitation email to {candidate_email} for test {test_id}")
        
        return {
            "message": "Invitation sent successfully",
            "email": candidate_email,
            "status_code": response.status_code
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send invitation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{test_id}/send-invitations-to-all", response_model=dict)
async def send_invitations_to_all(test_id: str):
    """Send invitation emails to all candidates for a test"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Get test
        test = await db.design_tests.find_one({"_id": test_id})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if not test.get("is_published", False):
            raise HTTPException(status_code=400, detail="Test must be published before sending invitations")
        
        # Get all candidates
        candidates = await db.design_candidates.find({"test_id": test_id}).to_list(length=None)
        
        if not candidates:
            raise HTTPException(status_code=400, detail="No candidates found for this test")
        
        success_count = 0
        failed_emails = []
        
        for candidate in candidates:
            try:
                # Call send_invitation for each candidate
                await send_invitation(test_id, SendInvitationRequest(email=candidate["email"]))
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send invitation to {candidate['email']}: {e}")
                failed_emails.append(candidate["email"])
        
        return {
            "message": f"Sent {success_count} invitations successfully",
            "success_count": success_count,
            "failed_count": len(failed_emails),
            "failed_emails": failed_emails
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send invitations: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Alias endpoint for frontend compatibility
@router.post("/create", response_model=dict)
async def create_test_alias(test: TestCreate):
    """Create a new design test (alias for /)"""
    return await create_test(test)
