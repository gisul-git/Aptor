"""
Simple test script for Design Service
Tests basic functionality without full setup
"""

import asyncio
import sys
import os

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.models.design import DesignRole, DifficultyLevel, TaskType
from app.services.ai_question_generator import AIQuestionGenerator


async def test_question_generation():
    """Test AI question generation"""
    print("Testing AI Question Generation...")
    
    generator = AIQuestionGenerator()
    
    try:
        question = await generator.generate_question(
            role=DesignRole.UI_DESIGNER,
            difficulty=DifficultyLevel.INTERMEDIATE,
            task_type=TaskType.LANDING_PAGE,
            topic="e-commerce"
        )
        
        print(f"✅ Generated question: {question.title}")
        print(f"   Description: {question.description[:100]}...")
        print(f"   Time limit: {question.time_limit_minutes} minutes")
        print(f"   Constraints: {len(question.constraints)} items")
        print(f"   Deliverables: {len(question.deliverables)} items")
        
    except Exception as e:
        print(f"❌ Question generation failed: {e}")


async def test_evaluation_engine():
    """Test evaluation engine"""
    print("\nTesting Evaluation Engine...")
    
    from app.services.evaluation_engine import DesignEvaluationEngine
    
    engine = DesignEvaluationEngine()
    
    # Mock data for testing
    mock_question = {
        "title": "E-commerce Landing Page",
        "description": "Design a modern landing page",
        "deliverables": ["Wireframes", "Mockups"],
        "evaluation_criteria": ["Visual hierarchy", "UX clarity"]
    }
    
    try:
        # This would normally use real screenshot and design data
        rule_score, ai_score, final_score, feedback = await engine.evaluate_submission(
            screenshot_path="/tmp/mock_screenshot.png",  # Mock path
            design_json={"mock": "data"},
            question_data=mock_question
        )
        
        print(f"✅ Evaluation completed:")
        print(f"   Rule-based score: {rule_score}")
        print(f"   AI-based score: {ai_score}")
        print(f"   Final score: {final_score}")
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")


async def test_penpot_service():
    """Test Penpot service"""
    print("\nTesting Penpot Service...")
    
    from app.services.penpot_service import PenpotService
    
    service = PenpotService()
    
    try:
        # Test workspace creation (will use fallback if Penpot not available)
        session = await service.create_candidate_workspace(
            user_id="test_user",
            assessment_id="test_assessment", 
            question_id="test_question",
            question_title="Test Design Challenge"
        )
        
        print(f"✅ Workspace created:")
        print(f"   Session token: {session.session_token}")
        print(f"   Workspace URL: {session.workspace_url}")
        
    except Exception as e:
        print(f"❌ Workspace creation failed: {e}")


def test_models():
    """Test data models"""
    print("\nTesting Data Models...")
    
    try:
        from app.models.design import DesignQuestionModel
        
        question = DesignQuestionModel(
            role=DesignRole.UI_DESIGNER,
            difficulty=DifficultyLevel.INTERMEDIATE,
            task_type=TaskType.LANDING_PAGE,
            title="Test Question",
            description="Test description",
            constraints=["Mobile-first", "Accessible"],
            deliverables=["Wireframes", "Mockups"],
            evaluation_criteria=["Visual hierarchy", "UX clarity"],
            time_limit_minutes=60,
            created_by="test"
        )
        
        print(f"✅ Model validation passed:")
        print(f"   Question: {question.title}")
        print(f"   Role: {question.role}")
        print(f"   Difficulty: {question.difficulty}")
        
    except Exception as e:
        print(f"❌ Model validation failed: {e}")


async def main():
    """Run all tests"""
    print("🧪 Design Service Test Suite")
    print("=" * 40)
    
    # Test models (synchronous)
    test_models()
    
    # Test services (asynchronous)
    await test_question_generation()
    await test_evaluation_engine()
    await test_penpot_service()
    
    print("\n" + "=" * 40)
    print("✅ Test suite completed!")


if __name__ == "__main__":
    asyncio.run(main())