"""
Test script for quality validation system.
Run this after implementing all quality improvements.

Usage:
    python -m app.api.v1.assessments.services.test_quality_validation
"""
import asyncio
import logging
from typing import Dict, Any, List

from .ai_question_generator import generate_questions_for_row_v2
from .ai_quality import validate_question_quality

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_difficulty_calibration():
    """Test that Easy/Medium/Hard are distinctly different."""
    
    print("\n" + "="*80)
    print("TEST 1: DIFFICULTY CALIBRATION")
    print("="*80)
    
    topic = "Python Sorting Algorithms"
    difficulties = ["Easy", "Medium", "Hard"]
    experience_max = 10  # Senior level
    
    results = {}
    
    for difficulty in difficulties:
        print(f"\n🔍 Testing {difficulty} difficulty...")
        
        questions = await generate_questions_for_row_v2(
            topic_label=topic,
            question_type="Coding",
            difficulty=difficulty,
            questions_count=1,
            can_use_judge0=True,
            experience_max=experience_max,
            job_designation="Senior Software Engineer"
        )
        
        if questions:
            q = questions[0]
            metrics = await validate_question_quality(
                question=q,
                question_type="Coding",
                difficulty=difficulty,
                experience_max=experience_max
            )
            
            results[difficulty] = {
                'question': q.get('question', q.get('questionText', q.get('description', '')))[:200],
                'overall_score': metrics.overall_score,
                'difficulty_match': metrics.difficulty_match,
                'issues': metrics.issues
            }
            
            print(f"  Quality Score: {metrics.overall_score:.2%}")
            print(f"  Difficulty Match: {metrics.difficulty_match:.2%}")
            if metrics.issues:
                print(f"  Issues: {', '.join(metrics.issues[:2])}")
    
    # Verify they're distinct
    print("\n📊 RESULTS:")
    for difficulty, data in results.items():
        print(f"\n{difficulty}:")
        print(f"  {data['question']}...")
        print(f"  Score: {data['overall_score']:.2%}")
    
    # Check if difficulty increases
    if results.get('Easy', {}).get('overall_score', 0) >= 0.75 and \
       results.get('Medium', {}).get('overall_score', 0) >= 0.75 and \
       results.get('Hard', {}).get('overall_score', 0) >= 0.75:
        print("\n✅ PASS: All difficulties meet quality threshold")
        return True
    else:
        print("\n❌ FAIL: Some difficulties below quality threshold")
        return False


async def test_experience_matching():
    """Test Junior vs Senior get different questions."""
    
    print("\n" + "="*80)
    print("TEST 2: EXPERIENCE-LEVEL MATCHING")
    print("="*80)
    
    topic = "REST API Design"
    difficulty = "Medium"
    
    test_cases = [
        {"experience_max": 2, "level": "Junior", "expected": "execution, syntax"},
        {"experience_max": 10, "level": "Senior", "expected": "architecture, scalability"}
    ]
    
    all_passed = True
    
    for tc in test_cases:
        print(f"\n🔍 Testing {tc['level']} level...")
        
        questions = await generate_questions_for_row_v2(
            topic_label=topic,
            question_type="Subjective",
            difficulty=difficulty,
            questions_count=1,
            can_use_judge0=False,
            experience_max=tc['experience_max'],
            job_designation=f"{tc['level']} Backend Engineer"
        )
        
        if questions:
            q = questions[0]
            question_text = q.get('question', '').lower()
            
            metrics = await validate_question_quality(
                question=q,
                question_type="Subjective",
                difficulty=difficulty,
                experience_max=tc['experience_max']
            )
            
            print(f"  Question: {q.get('question', '')[:200]}...")
            print(f"  Experience Match: {metrics.experience_match:.2%}")
            
            # Check for expected keywords
            has_expected = any(kw in question_text for kw in tc['expected'].split(', '))
            if has_expected:
                print(f"  ✅ Contains expected focus: {tc['expected']}")
            else:
                print(f"  ⚠️ Missing expected focus: {tc['expected']}")
                all_passed = False
    
    if all_passed:
        print("\n✅ PASS: Experience matching works")
    else:
        print("\n⚠️ PARTIAL: Some experience matching issues")
    
    return all_passed


async def test_role_framing():
    """Test company/role context is used."""
    
    print("\n" + "="*80)
    print("TEST 3: ROLE-SPECIFIC FRAMING")
    print("="*80)
    
    print(f"\n🔍 Testing role-based framing...")
    
    questions = await generate_questions_for_row_v2(
        topic_label="AWS Lambda Functions",
        question_type="MCQ",
        difficulty="Medium",
        questions_count=1,
        can_use_judge0=False,
        job_designation="Senior Backend Engineer",
        company_name="Gisul",
        assessment_requirements="Building serverless payment processing system",
        experience_max=8
    )
    
    if questions:
        q = questions[0]
        question_text = q.get('question', '')
        
        # Check for context usage
        has_company = 'gisul' in question_text.lower()
        has_role = 'senior backend' in question_text.lower() or 'engineer' in question_text.lower()
        has_context = 'payment' in question_text.lower() or 'serverless' in question_text.lower()
        
        print(f"  Question: {question_text[:300]}...")
        print(f"  ✅ Company mentioned: {has_company}")
        print(f"  ✅ Role mentioned: {has_role}")
        print(f"  ✅ Context used: {has_context}")
        
        if has_company and has_context:
            print("\n✅ PASS: Context properly used")
            return True
        else:
            print("\n⚠️ PARTIAL: Context partially used")
            return False
    else:
        print("\n❌ FAIL: No questions generated")
        return False


async def test_aiml_depth():
    """Test AIML Hard questions are production-level."""
    
    print("\n" + "="*80)
    print("TEST 4: AIML DEPTH (Hard = Production ML)")
    print("="*80)
    
    print(f"\n🔍 Testing Hard AIML depth...")
    
    questions = await generate_questions_for_row_v2(
        topic_label="Model Evaluation and Debugging",
        question_type="AIML",
        difficulty="Hard",
        questions_count=1,
        can_use_judge0=False,
        experience_max=10,
        job_designation="Senior ML Engineer"
    )
    
    if questions:
        q = questions[0]
        question_text = q.get('question', '').lower()
        
        # Check for production ML keywords
        production_keywords = ['production', 'debug', 'optimize', 'performance', 
                             'latency', 'scale', 'monitoring', 'deployment']
        
        found_keywords = [kw for kw in production_keywords if kw in question_text]
        
        print(f"  Question: {q.get('question', '')[:300]}...")
        print(f"  Production keywords found: {', '.join(found_keywords)}")
        
        if len(found_keywords) >= 2:
            print("\n✅ PASS: Production-level AIML question")
            return True
        else:
            print("\n❌ FAIL: Too simple for Hard AIML")
            return False
    else:
        print("\n❌ FAIL: No questions generated")
        return False


async def test_sql_complexity():
    """Test SQL Hard questions focus on optimization."""
    
    print("\n" + "="*80)
    print("TEST 5: SQL COMPLEXITY (Hard = Optimization)")
    print("="*80)
    
    print(f"\n🔍 Testing Hard SQL complexity...")
    
    questions = await generate_questions_for_row_v2(
        topic_label="Query Optimization and Performance",
        question_type="SQL",
        difficulty="Hard",
        questions_count=1,
        can_use_judge0=False,
        experience_max=10,
        job_designation="Senior Database Engineer"
    )
    
    if questions:
        q = questions[0]
        question_text = q.get('question', '').lower()
        
        # Check for optimization keywords
        optimization_keywords = ['optimize', 'performance', 'index', 'execution plan',
                                'slow', '10m', '50m', 'million', 'scale']
        
        found_keywords = [kw for kw in optimization_keywords if kw in question_text]
        
        print(f"  Question: {q.get('question', '')[:300]}...")
        print(f"  Optimization keywords found: {', '.join(found_keywords)}")
        
        if len(found_keywords) >= 2:
            print("\n✅ PASS: Optimization-focused SQL question")
            return True
        else:
            print("\n❌ FAIL: Missing optimization focus for Hard")
            return False
    else:
        print("\n❌ FAIL: No questions generated")
        return False


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("🧪 QUALITY VALIDATION TEST SUITE")
    print("="*80)
    
    results = {}
    
    try:
        results['difficulty'] = await test_difficulty_calibration()
        results['experience'] = await test_experience_matching()
        results['role_framing'] = await test_role_framing()
        results['aiml_depth'] = await test_aiml_depth()
        results['sql_complexity'] = await test_sql_complexity()
        
        print("\n" + "="*80)
        print("📊 FINAL RESULTS")
        print("="*80)
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, passed_test in results.items():
            status = "✅ PASS" if passed_test else "❌ FAIL"
            print(f"  {test_name}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print(f"\n⚠️ {total - passed} test(s) need attention")
        
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
        print(f"\n❌ TEST SUITE FAILED: {e}")


if __name__ == "__main__":
    asyncio.run(main())

