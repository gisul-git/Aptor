"""
Advanced data integrity validation and consistency checks.
"""

from typing import Dict, List, Any, Optional, Tuple, Set
from datetime import datetime, timedelta
import hashlib
import json
import structlog
from collections import defaultdict

from app.models.question import Question, QuestionTopic, DifficultyLevel
from app.models.execution import ExecutionResult, ValidationResult, ValidationError
from app.models.user import UserProgress, Solution, SolutionStatus, SkillArea
from app.core.validation import DataValidationError

logger = structlog.get_logger()


class DataIntegrityChecker:
    """Advanced data integrity validation and consistency checking."""
    
    def __init__(self):
        self.validation_cache = {}
        self.consistency_rules = self._load_consistency_rules()
    
    def check_question_integrity(self, question: Question) -> Tuple[bool, List[str]]:
        """
        Perform comprehensive integrity check on question data.
        
        Args:
            question: Question object to validate
            
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        # Check data completeness
        completeness_issues = self._check_question_completeness(question)
        issues.extend(completeness_issues)
        
        # Check data consistency
        consistency_issues = self._check_question_consistency(question)
        issues.extend(consistency_issues)
        
        # Check data quality
        quality_issues = self._check_question_quality(question)
        issues.extend(quality_issues)
        
        # Check deterministic properties
        determinism_issues = self._check_question_determinism(question)
        issues.extend(determinism_issues)
        
        is_valid = len(issues) == 0
        return is_valid, issues
    
    def check_solution_integrity(self, solution: Solution, question: Optional[Question] = None) -> Tuple[bool, List[str]]:
        """
        Perform comprehensive integrity check on solution data.
        
        Args:
            solution: Solution object to validate
            question: Related question object (optional)
            
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        # Check solution completeness
        completeness_issues = self._check_solution_completeness(solution)
        issues.extend(completeness_issues)
        
        # Check solution-question consistency
        if question:
            consistency_issues = self._check_solution_question_consistency(solution, question)
            issues.extend(consistency_issues)
        
        # Check code quality and safety
        code_issues = self._check_code_integrity(solution.code)
        issues.extend(code_issues)
        
        # Check execution result consistency
        if solution.execution_result:
            exec_issues = self._check_execution_result_integrity(solution.execution_result)
            issues.extend(exec_issues)
        
        is_valid = len(issues) == 0
        return is_valid, issues
    
    def check_user_progress_integrity(self, progress: UserProgress, solutions: Optional[List[Solution]] = None) -> Tuple[bool, List[str]]:
        """
        Perform comprehensive integrity check on user progress data.
        
        Args:
            progress: UserProgress object to validate
            solutions: List of user's solutions (optional)
            
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        # Check progress data consistency
        consistency_issues = self._check_progress_consistency(progress)
        issues.extend(consistency_issues)
        
        # Check skill area calculations
        skill_issues = self._check_skill_area_calculations(progress)
        issues.extend(skill_issues)
        
        # Check against actual solutions if provided
        if solutions:
            solution_issues = self._check_progress_solution_consistency(progress, solutions)
            issues.extend(solution_issues)
        
        is_valid = len(issues) == 0
        return is_valid, issues
    
    def check_cross_model_consistency(
        self, 
        questions: List[Question], 
        solutions: List[Solution], 
        progress_records: List[UserProgress]
    ) -> Tuple[bool, List[str]]:
        """
        Check consistency across multiple related data models.
        
        Args:
            questions: List of questions
            solutions: List of solutions
            progress_records: List of user progress records
            
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        # Build lookup maps
        question_map = {q.id: q for q in questions}
        solution_map = defaultdict(list)
        for solution in solutions:
            solution_map[solution.user_id].append(solution)
        
        # Check question-solution consistency
        for solution in solutions:
            if solution.question_id not in question_map:
                issues.append(f"Solution {solution.id} references non-existent question {solution.question_id}")
        
        # Check user progress consistency
        for progress in progress_records:
            user_solutions = solution_map.get(progress.user_id, [])
            progress_issues = self._check_progress_against_solutions(progress, user_solutions, question_map)
            issues.extend(progress_issues)
        
        is_valid = len(issues) == 0
        return is_valid, issues
    
    def generate_data_fingerprint(self, data: Any) -> str:
        """
        Generate a unique fingerprint for data integrity verification.
        
        Args:
            data: Data object to fingerprint
            
        Returns:
            SHA-256 hash of the data
        """
        if hasattr(data, 'dict'):
            # Pydantic model
            data_dict = data.dict()
        elif isinstance(data, dict):
            data_dict = data
        else:
            data_dict = {'data': str(data)}
        
        # Sort keys for consistent hashing
        sorted_data = json.dumps(data_dict, sort_keys=True, default=str)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
    
    def verify_data_fingerprint(self, data: Any, expected_fingerprint: str) -> bool:
        """
        Verify data integrity using fingerprint comparison.
        
        Args:
            data: Data to verify
            expected_fingerprint: Expected fingerprint
            
        Returns:
            True if fingerprints match
        """
        actual_fingerprint = self.generate_data_fingerprint(data)
        return actual_fingerprint == expected_fingerprint
    
    def _check_question_completeness(self, question: Question) -> List[str]:
        """Check if question has all required data."""
        issues = []
        
        if not question.title or len(question.title.strip()) < 5:
            issues.append("Question title is missing or too short")
        
        if not question.description or len(question.description.strip()) < 50:
            issues.append("Question description is missing or too short")
        
        if not question.input_schema:
            issues.append("Question input schema is missing")
        
        if not question.sample_input:
            issues.append("Question sample input is missing")
        
        if not question.expected_output:
            issues.append("Question expected output is missing")
        
        if not question.test_cases:
            issues.append("Question test cases are missing")
        
        return issues
    
    def _check_question_consistency(self, question: Question) -> List[str]:
        """Check internal consistency of question data."""
        issues = []
        
        # Check difficulty-topic consistency
        advanced_topics = {QuestionTopic.PERFORMANCE_OPTIMIZATION, QuestionTopic.STREAMING}
        if question.difficulty_level == DifficultyLevel.BEGINNER and question.topic in advanced_topics:
            issues.append(f"Beginner difficulty inconsistent with advanced topic {question.topic}")
        
        # Check schema-sample consistency
        if question.input_schema and question.sample_input:
            schema_columns = set(question.input_schema.keys())
            sample_columns = set(question.sample_input.keys()) if isinstance(question.sample_input, dict) else set()
            
            if schema_columns != sample_columns:
                issues.append("Input schema columns don't match sample input columns")
        
        # Check test case consistency
        for i, test_case in enumerate(question.test_cases):
            if question.input_schema:
                test_input_columns = set(test_case.input_data.keys()) if isinstance(test_case.input_data, dict) else set()
                schema_columns = set(question.input_schema.keys())
                
                if test_input_columns != schema_columns:
                    issues.append(f"Test case {i} input columns don't match schema")
        
        return issues
    
    def _check_question_quality(self, question: Question) -> List[str]:
        """Check quality aspects of question data."""
        issues = []
        
        # Check description quality
        if question.description:
            word_count = len(question.description.split())
            if word_count < 20:
                issues.append("Question description is too brief (less than 20 words)")
            elif word_count > 500:
                issues.append("Question description is too verbose (more than 500 words)")
        
        # Check test case coverage
        if len(question.test_cases) < 2:
            issues.append("Question should have at least 2 test cases for proper validation")
        elif len(question.test_cases) > 10:
            issues.append("Question has too many test cases (more than 10)")
        
        # Check for duplicate test cases
        test_case_hashes = []
        for test_case in question.test_cases:
            case_hash = self.generate_data_fingerprint(test_case.input_data)
            if case_hash in test_case_hashes:
                issues.append("Question contains duplicate test cases")
                break
            test_case_hashes.append(case_hash)
        
        return issues
    
    def _check_question_determinism(self, question: Question) -> List[str]:
        """Check if question produces deterministic results."""
        issues = []
        
        # Check for non-deterministic operations in description
        non_deterministic_keywords = [
            'random', 'rand', 'current_timestamp', 'now()', 'uuid', 'guid'
        ]
        
        description_lower = question.description.lower()
        for keyword in non_deterministic_keywords:
            if keyword in description_lower:
                issues.append(f"Question description mentions potentially non-deterministic operation: {keyword}")
        
        return issues
    
    def _check_solution_completeness(self, solution: Solution) -> List[str]:
        """Check if solution has all required data."""
        issues = []
        
        if not solution.code or len(solution.code.strip()) < 10:
            issues.append("Solution code is missing or too short")
        
        if solution.status == SolutionStatus.SUBMITTED and not solution.execution_result:
            issues.append("Submitted solution missing execution result")
        
        if solution.status == SolutionStatus.REVIEWED and not solution.ai_review:
            issues.append("Reviewed solution missing AI review")
        
        return issues
    
    def _check_solution_question_consistency(self, solution: Solution, question: Question) -> List[str]:
        """Check consistency between solution and its question."""
        issues = []
        
        if solution.question_id != question.id:
            issues.append("Solution question_id doesn't match question id")
        
        # Check if code addresses the question topic
        topic_keywords = {
            QuestionTopic.TRANSFORMATIONS: ['select', 'withColumn', 'drop', 'filter', 'where'],
            QuestionTopic.AGGREGATIONS: ['groupBy', 'agg', 'sum', 'count', 'avg', 'max', 'min'],
            QuestionTopic.JOINS: ['join', 'leftJoin', 'rightJoin', 'innerJoin', 'outerJoin'],
            QuestionTopic.WINDOW_FUNCTIONS: ['Window', 'partitionBy', 'orderBy', 'rowsBetween'],
        }
        
        if question.topic in topic_keywords:
            keywords = topic_keywords[question.topic]
            code_lower = solution.code.lower()
            if not any(keyword.lower() in code_lower for keyword in keywords):
                issues.append(f"Solution code doesn't contain expected keywords for topic {question.topic}")
        
        return issues
    
    def _check_code_integrity(self, code: str) -> List[str]:
        """Check code safety and basic structure."""
        issues = []
        
        # Check for dangerous imports
        dangerous_imports = [
            'os', 'sys', 'subprocess', 'socket', 'urllib', 'requests',
            'pickle', 'marshal', 'shelve', 'dbm'
        ]
        
        code_lines = code.split('\n')
        for line_num, line in enumerate(code_lines, 1):
            line_stripped = line.strip().lower()
            if line_stripped.startswith('import ') or 'import ' in line_stripped:
                for dangerous in dangerous_imports:
                    if dangerous in line_stripped:
                        issues.append(f"Potentially dangerous import '{dangerous}' on line {line_num}")
        
        # Check for file operations
        file_operations = ['open(', 'file(', 'with open']
        for op in file_operations:
            if op in code.lower():
                issues.append(f"Code contains file operation: {op}")
        
        # Check for system calls
        system_calls = ['system(', 'popen(', 'exec(', 'eval(']
        for call in system_calls:
            if call in code.lower():
                issues.append(f"Code contains potentially dangerous system call: {call}")
        
        return issues
    
    def _check_execution_result_integrity(self, result: ExecutionResult) -> List[str]:
        """Check execution result data integrity."""
        issues = []
        
        # Check timing consistency
        if result.completed_at and result.created_at:
            if result.completed_at < result.created_at:
                issues.append("Execution completed_at is before created_at")
            
            duration = (result.completed_at - result.created_at).total_seconds()
            if abs(duration - result.execution_time) > 1.0:  # Allow 1 second tolerance
                issues.append("Execution time doesn't match timestamp difference")
        
        # Check resource usage reasonableness
        if result.memory_usage > 10000:  # 10GB
            issues.append("Memory usage seems unreasonably high")
        
        if result.execution_time > 300:  # 5 minutes
            issues.append("Execution time seems unreasonably long")
        
        return issues
    
    def _check_progress_consistency(self, progress: UserProgress) -> List[str]:
        """Check internal consistency of progress data."""
        issues = []
        
        # Check completion counts
        if progress.total_questions_completed > progress.total_questions_attempted:
            issues.append("Completed questions exceed attempted questions")
        
        if len(progress.completed_questions) != progress.total_questions_completed:
            issues.append("Completed questions list length doesn't match count")
        
        # Check success rate calculation
        if progress.total_questions_attempted > 0:
            expected_success_rate = progress.total_questions_completed / progress.total_questions_attempted
            if abs(progress.success_rate - expected_success_rate) > 0.01:  # Allow small floating point errors
                issues.append("Success rate calculation is incorrect")
        
        # Check skill area consistency
        total_skill_questions = sum(skill.questions_attempted for skill in progress.skill_areas)
        if total_skill_questions > progress.total_questions_attempted:
            issues.append("Sum of skill area questions exceeds total attempted")
        
        return issues
    
    def _check_skill_area_calculations(self, progress: UserProgress) -> List[str]:
        """Check skill area calculation accuracy."""
        issues = []
        
        for skill in progress.skill_areas:
            # Check proficiency score reasonableness
            if skill.questions_attempted == 0 and skill.proficiency_score > 0:
                issues.append(f"Skill {skill.topic} has proficiency score but no attempted questions")
            
            # Check completion consistency
            if skill.questions_completed > skill.questions_attempted:
                issues.append(f"Skill {skill.topic} completed questions exceed attempted")
        
        return issues
    
    def _check_progress_solution_consistency(self, progress: UserProgress, solutions: List[Solution]) -> List[str]:
        """Check progress data against actual solutions."""
        issues = []
        
        # Count actual completed solutions
        completed_solutions = [s for s in solutions if s.status == SolutionStatus.SUBMITTED]
        actual_completed = len(completed_solutions)
        
        if actual_completed != progress.total_questions_completed:
            issues.append(f"Progress shows {progress.total_questions_completed} completed, but found {actual_completed} completed solutions")
        
        # Check completed question IDs
        actual_completed_ids = {s.question_id for s in completed_solutions}
        progress_completed_ids = set(progress.completed_questions)
        
        if actual_completed_ids != progress_completed_ids:
            missing_in_progress = actual_completed_ids - progress_completed_ids
            extra_in_progress = progress_completed_ids - actual_completed_ids
            
            if missing_in_progress:
                issues.append(f"Progress missing completed questions: {list(missing_in_progress)}")
            if extra_in_progress:
                issues.append(f"Progress has extra completed questions: {list(extra_in_progress)}")
        
        return issues
    
    def _check_progress_against_solutions(
        self, 
        progress: UserProgress, 
        solutions: List[Solution], 
        question_map: Dict[str, Question]
    ) -> List[str]:
        """Check progress consistency against solutions and questions."""
        issues = []
        
        # Build skill area maps from solutions
        skill_attempts = defaultdict(int)
        skill_completions = defaultdict(int)
        
        for solution in solutions:
            if solution.question_id in question_map:
                question = question_map[solution.question_id]
                skill_attempts[question.topic] += 1
                
                if solution.status == SolutionStatus.SUBMITTED:
                    skill_completions[question.topic] += 1
        
        # Compare with progress skill areas
        progress_skills = {skill.topic: skill for skill in progress.skill_areas}
        
        for topic, attempts in skill_attempts.items():
            if topic in progress_skills:
                skill = progress_skills[topic]
                if skill.questions_attempted != attempts:
                    issues.append(f"Skill {topic} attempts mismatch: progress={skill.questions_attempted}, actual={attempts}")
                
                completions = skill_completions.get(topic, 0)
                if skill.questions_completed != completions:
                    issues.append(f"Skill {topic} completions mismatch: progress={skill.questions_completed}, actual={completions}")
        
        return issues
    
    def _load_consistency_rules(self) -> Dict[str, Any]:
        """Load consistency rules for validation."""
        return {
            'max_execution_time': 300,  # 5 minutes
            'max_memory_usage': 10000,  # 10GB
            'min_code_length': 10,
            'max_code_length': 50000,  # 50KB
            'min_description_words': 20,
            'max_description_words': 500,
            'min_test_cases': 2,
            'max_test_cases': 10,
        }


def create_data_integrity_report(
    questions: List[Question],
    solutions: List[Solution],
    progress_records: List[UserProgress]
) -> Dict[str, Any]:
    """
    Create a comprehensive data integrity report.
    
    Args:
        questions: List of questions to check
        solutions: List of solutions to check
        progress_records: List of progress records to check
        
    Returns:
        Dictionary containing integrity report
    """
    checker = DataIntegrityChecker()
    report = {
        'timestamp': datetime.utcnow().isoformat(),
        'summary': {
            'total_questions': len(questions),
            'total_solutions': len(solutions),
            'total_progress_records': len(progress_records),
            'questions_with_issues': 0,
            'solutions_with_issues': 0,
            'progress_with_issues': 0,
        },
        'question_issues': [],
        'solution_issues': [],
        'progress_issues': [],
        'cross_model_issues': [],
    }
    
    # Check questions
    for question in questions:
        is_valid, issues = checker.check_question_integrity(question)
        if not is_valid:
            report['summary']['questions_with_issues'] += 1
            report['question_issues'].append({
                'question_id': question.id,
                'issues': issues
            })
    
    # Check solutions
    question_map = {q.id: q for q in questions}
    for solution in solutions:
        question = question_map.get(solution.question_id)
        is_valid, issues = checker.check_solution_integrity(solution, question)
        if not is_valid:
            report['summary']['solutions_with_issues'] += 1
            report['solution_issues'].append({
                'solution_id': solution.id,
                'issues': issues
            })
    
    # Check progress records
    solution_map = defaultdict(list)
    for solution in solutions:
        solution_map[solution.user_id].append(solution)
    
    for progress in progress_records:
        user_solutions = solution_map.get(progress.user_id, [])
        is_valid, issues = checker.check_user_progress_integrity(progress, user_solutions)
        if not is_valid:
            report['summary']['progress_with_issues'] += 1
            report['progress_issues'].append({
                'user_id': progress.user_id,
                'issues': issues
            })
    
    # Check cross-model consistency
    is_valid, cross_issues = checker.check_cross_model_consistency(questions, solutions, progress_records)
    if not is_valid:
        report['cross_model_issues'] = cross_issues
    
    # Calculate overall health score
    total_items = len(questions) + len(solutions) + len(progress_records)
    items_with_issues = (report['summary']['questions_with_issues'] + 
                        report['summary']['solutions_with_issues'] + 
                        report['summary']['progress_with_issues'])
    
    if total_items > 0:
        health_score = ((total_items - items_with_issues) / total_items) * 100
    else:
        health_score = 100.0
    
    report['summary']['health_score'] = round(health_score, 2)
    report['summary']['cross_model_issues_count'] = len(cross_issues)
    
    return report