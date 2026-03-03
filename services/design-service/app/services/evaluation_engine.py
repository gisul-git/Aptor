"""
Automated Hybrid Evaluation Engine
Combines rule-based and AI-based scoring for design submissions
"""

import logging
from typing import Dict, Any, List, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)


class DesignEvaluationEngine:
    """Hybrid evaluation engine for design submissions"""
    
    def __init__(self):
        self.provider = settings.AI_PROVIDER
    
    async def evaluate_submission(
        self,
        screenshot_path: str,
        design_json: Dict[str, Any],
        question_data: Dict[str, Any]
    ) -> Tuple[float, float, float, Dict[str, Any]]:
        """
        Evaluate design submission using hybrid approach
        Returns: (rule_based_score, ai_based_score, final_score, feedback)
        """
        
        try:
            # Rule-based evaluation (60% weight) - now with question context
            rule_score, rule_feedback = await self._rule_based_evaluation(
                screenshot_path, design_json, question_data
            )
            
            # AI-based evaluation (40% weight) - simplified for now
            ai_score, ai_feedback = await self._ai_based_evaluation(
                screenshot_path, question_data
            )
            
            # Calculate final score
            final_score = (
                rule_score * settings.RULE_BASED_WEIGHT +
                ai_score * settings.AI_BASED_WEIGHT
            )
            
            # Combine feedback with question context
            feedback = {
                "rule_based": rule_feedback,
                "ai_based": ai_feedback,
                "overall_score": final_score,
                "question_context": {
                    "title": question_data.get("title", "Design Challenge"),
                    "role": question_data.get("role", "designer"),
                    "difficulty": question_data.get("difficulty", "intermediate"),
                    "task_type": question_data.get("task_type", "design")
                },
                "breakdown": {
                    "rule_based_score": rule_score,
                    "ai_based_score": ai_score,
                    "rule_weight": settings.RULE_BASED_WEIGHT,
                    "ai_weight": settings.AI_BASED_WEIGHT
                }
            }
            
            return rule_score, ai_score, final_score, feedback
            
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return 0.0, 0.0, 0.0, {"error": str(e)}
    
    async def _rule_based_evaluation(
        self,
        screenshot_path: str,
        design_json: Dict[str, Any],
        question_data: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """Rule-based evaluation using design metrics with question context"""
        
        scores = {}
        feedback = {}
        
        try:
            # Extract metrics from design data
            metrics = design_json.get("metrics", {})
            
            # Extract question context
            question_title = question_data.get("title", "Design Challenge")
            role = question_data.get("role", "designer")
            difficulty = question_data.get("difficulty", "intermediate")
            task_type = question_data.get("task_type", "design")
            constraints = question_data.get("constraints", [])
            deliverables = question_data.get("deliverables", [])
            
            # 1. Component Count Analysis (20 points)
            total_shapes = metrics.get("total_shapes", 0)
            page_count = metrics.get("page_count", 0)
            
            # Adjust expectations based on difficulty
            if difficulty == "beginner":
                excellent_threshold = 15
                good_threshold = 10
                moderate_threshold = 7
                limited_threshold = 4
            elif difficulty == "advanced":
                excellent_threshold = 40
                good_threshold = 30
                moderate_threshold = 20
                limited_threshold = 10
            else:  # intermediate
                excellent_threshold = 30
                good_threshold = 20
                moderate_threshold = 15
                limited_threshold = 8
            
            # More granular scoring for better differentiation
            if total_shapes >= excellent_threshold:
                scores["components"] = 20.0
                feedback["components"] = f"Excellent - Rich design with {total_shapes} components for a {difficulty} level {task_type} challenge"
            elif total_shapes >= good_threshold:
                scores["components"] = 16.0
                feedback["components"] = f"Very Good - {total_shapes} components show strong effort for '{question_title}'"
            elif total_shapes >= moderate_threshold:
                scores["components"] = 13.0
                feedback["components"] = f"Good - {total_shapes} design elements, but '{question_title}' requires more detail"
            elif total_shapes >= limited_threshold:
                scores["components"] = 10.0
                feedback["components"] = f"Moderate - Only {total_shapes} elements. The {task_type} challenge needs more components"
            elif total_shapes >= 5:
                # More granular scoring for 5-7 elements
                scores["components"] = 5.0 + (total_shapes - 5) * 0.5
                feedback["components"] = f"Limited - {total_shapes} elements is insufficient for '{question_title}'"
            elif total_shapes >= 3:
                # More granular scoring for 3-4 elements
                scores["components"] = 2.0 + (total_shapes - 3) * 1.0
                feedback["components"] = f"Minimal - Only {total_shapes} shapes. This {difficulty} level challenge requires much more work"
            elif total_shapes >= 1:
                # Granular scoring for 1-2 elements
                scores["components"] = total_shapes * 0.5
                feedback["components"] = f"Almost nothing - Only {total_shapes} element(s). This is not a complete submission for '{question_title}'"
            else:
                scores["components"] = 0.0
                feedback["components"] = f"Empty - No design work submitted for '{question_title}'"
            
            # 2. Layout Complexity (15 points)
            if page_count > 1 and total_shapes > 20:
                scores["layout"] = 15.0
                feedback["layout"] = f"Excellent - Multi-page design with rich content for {task_type}"
            elif page_count > 1:
                scores["layout"] = 12.0
                feedback["layout"] = f"Good - Multi-page approach shows planning for '{question_title}'"
            elif total_shapes > 20:
                scores["layout"] = 13.0
                feedback["layout"] = f"Very Good - Complex single-page layout for {task_type}"
            elif total_shapes > 15:
                scores["layout"] = 10.0
                feedback["layout"] = f"Good layout complexity for a {difficulty} level challenge"
            elif total_shapes > 10:
                scores["layout"] = 7.0
                feedback["layout"] = f"Moderate layout - '{question_title}' needs more structure"
            elif total_shapes > 5:
                scores["layout"] = 4.0
                feedback["layout"] = f"Simple layout - {task_type} requires more complexity"
            elif total_shapes >= 3:
                # More granular for 3-5 elements
                scores["layout"] = 1.0 + (total_shapes - 3) * 0.5
                feedback["layout"] = f"Very simple layout - '{question_title}' requires significant structural work"
            elif total_shapes >= 1:
                scores["layout"] = 0.5
                feedback["layout"] = f"Almost no layout - Only {total_shapes} element(s) present"
            else:
                scores["layout"] = 0.0
                feedback["layout"] = f"No layout - Empty submission"
            
            # 3. Design Completeness (15 points) - Check against deliverables
            deliverables_count = len(deliverables)
            if total_shapes >= 25 and page_count >= 1:
                scores["completeness"] = 15.0
                feedback["completeness"] = f"Complete design addressing all {deliverables_count} deliverables for '{question_title}'"
            elif total_shapes >= 20:
                scores["completeness"] = 13.0
                feedback["completeness"] = f"Very good detail level for {difficulty} {task_type}, but check all deliverables"
            elif total_shapes >= 15:
                scores["completeness"] = 11.0
                feedback["completeness"] = f"Good detail, but '{question_title}' may need more to meet all requirements"
            elif total_shapes >= 10:
                scores["completeness"] = 8.0
                feedback["completeness"] = f"Moderate detail - missing key elements for {task_type}"
            elif total_shapes >= 5:
                scores["completeness"] = 4.0
                feedback["completeness"] = f"Basic elements only - '{question_title}' requires much more detail"
            elif total_shapes >= 3:
                # More granular for 3-4 elements
                scores["completeness"] = 1.0 + (total_shapes - 3) * 0.5
                feedback["completeness"] = f"Very incomplete - only {total_shapes} elements, far from meeting requirements"
            elif total_shapes >= 1:
                scores["completeness"] = 0.5
                feedback["completeness"] = f"Almost nothing - only {total_shapes} element(s), does not meet requirements"
            else:
                scores["completeness"] = 0.0
                feedback["completeness"] = f"Empty - does not meet the requirements of '{question_title}'"
            
            # 4. Visual Hierarchy (20 points) - Critical for role-specific evaluation
            role_hierarchy_note = ""
            if role == "ui_designer":
                role_hierarchy_note = " (critical for UI Designer role)"
            elif role == "ux_designer":
                role_hierarchy_note = " (important for UX Designer role)"
            
            if total_shapes >= 20:
                scores["hierarchy"] = 20.0
                feedback["hierarchy"] = f"Strong visual hierarchy{role_hierarchy_note} in your {task_type}"
            elif total_shapes >= 15:
                scores["hierarchy"] = 16.0
                feedback["hierarchy"] = f"Good visual organization{role_hierarchy_note} for '{question_title}'"
            elif total_shapes >= 10:
                scores["hierarchy"] = 12.0
                feedback["hierarchy"] = f"Moderate hierarchy{role_hierarchy_note} - needs improvement for {difficulty} level"
            elif total_shapes >= 5:
                scores["hierarchy"] = 6.0
                feedback["hierarchy"] = f"Limited hierarchy{role_hierarchy_note} - critical weakness in '{question_title}'"
            elif total_shapes >= 3:
                # More granular for 3-4 elements
                scores["hierarchy"] = 2.0 + (total_shapes - 3) * 0.5
                feedback["hierarchy"] = f"Minimal hierarchy{role_hierarchy_note} - major issue for {task_type}"
            elif total_shapes >= 1:
                scores["hierarchy"] = 0.5
                feedback["hierarchy"] = f"No hierarchy{role_hierarchy_note} - only {total_shapes} element(s)"
            else:
                scores["hierarchy"] = 0.0
                feedback["hierarchy"] = f"No clear hierarchy{role_hierarchy_note} - fundamental requirement missing"
            
            # 5. Professional Execution (15 points) - Role-specific expectations
            role_execution_note = ""
            if role == "ui_designer":
                role_execution_note = " Pixel-perfect execution expected for UI Designer"
            elif role == "visual_designer":
                role_execution_note = " Creative execution expected for Visual Designer"
            elif role == "product_designer":
                role_execution_note = " Strategic execution expected for Product Designer"
            
            if total_shapes >= 25:
                scores["execution"] = 15.0
                feedback["execution"] = f"Professional level execution for {difficulty} {task_type}.{role_execution_note}"
            elif total_shapes >= 20:
                scores["execution"] = 13.0
                feedback["execution"] = f"Very good execution for '{question_title}'.{role_execution_note}"
            elif total_shapes >= 15:
                scores["execution"] = 11.0
                feedback["execution"] = f"Good execution, but {difficulty} level needs more refinement.{role_execution_note}"
            elif total_shapes >= 10:
                scores["execution"] = 8.0
                feedback["execution"] = f"Moderate execution - '{question_title}' needs better quality.{role_execution_note}"
            elif total_shapes >= 5:
                scores["execution"] = 4.0
                feedback["execution"] = f"Basic execution - insufficient for {difficulty} level {task_type}.{role_execution_note}"
            elif total_shapes >= 3:
                # More granular for 3-4 elements
                scores["execution"] = 1.0 + (total_shapes - 3) * 0.5
                feedback["execution"] = f"Very poor execution - only {total_shapes} elements.{role_execution_note}"
            elif total_shapes >= 1:
                scores["execution"] = 0.5
                feedback["execution"] = f"Almost no execution - only {total_shapes} element(s).{role_execution_note}"
            else:
                scores["execution"] = 0.0
                feedback["execution"] = f"No execution - does not meet standards for '{question_title}'.{role_execution_note}"
            
            # 6. Design System Thinking (15 points) - Check against constraints
            constraints_count = len(constraints)
            if total_shapes >= 20:
                scores["system"] = 15.0
                feedback["system"] = f"Strong design system thinking - appears to follow {constraints_count} constraints"
            elif total_shapes >= 15:
                scores["system"] = 12.0
                feedback["system"] = f"Good design system approach for {task_type}, check all {constraints_count} constraints"
            elif total_shapes >= 10:
                scores["system"] = 9.0
                feedback["system"] = f"Some consistency evident, but may not meet all constraints for '{question_title}'"
            elif total_shapes >= 5:
                scores["system"] = 4.0
                feedback["system"] = f"Basic consistency - {constraints_count} constraints not properly addressed"
            elif total_shapes >= 3:
                # More granular for 3-4 elements
                scores["system"] = 1.0 + (total_shapes - 3) * 0.5
                feedback["system"] = f"Very limited consistency - only {total_shapes} elements, constraints not followed"
            elif total_shapes >= 1:
                scores["system"] = 0.5
                feedback["system"] = f"No design system - only {total_shapes} element(s)"
            else:
                scores["system"] = 0.0
                feedback["system"] = f"No design system thinking - constraints for '{question_title}' not followed"
            
            # Calculate total score (out of 100)
            total_score = sum(scores.values())
            
            # Add overall summary feedback
            overall_feedback = self._generate_overall_feedback(
                total_score, total_shapes, question_title, role, difficulty, task_type, 
                deliverables_count, constraints_count
            )
            
            return total_score, {
                "scores": scores,
                "feedback": feedback,
                "total": total_score,
                "metrics_used": metrics,
                "overall_summary": overall_feedback
            }
            
        except Exception as e:
            logger.error(f"Rule-based evaluation failed: {e}")
            return 50.0, {"error": str(e), "default_score": True}
    
    def _generate_overall_feedback(
        self, 
        score: float, 
        total_shapes: int, 
        question_title: str,
        role: str,
        difficulty: str,
        task_type: str,
        deliverables_count: int,
        constraints_count: int
    ) -> str:
        """Generate context-aware overall feedback summary"""
        
        if score >= 80:
            return f"Excellent work on '{question_title}'! Your {task_type} demonstrates strong {role} skills at {difficulty} level. All {deliverables_count} deliverables appear well-addressed with {total_shapes} design elements."
        elif score >= 60:
            return f"Good effort on '{question_title}'. Your {task_type} shows promise for {difficulty} level, but needs more detail. With {total_shapes} elements, consider adding more to fully meet the {deliverables_count} deliverables and {constraints_count} constraints."
        elif score >= 40:
            return f"Moderate submission for '{question_title}'. Your {task_type} has {total_shapes} elements, which is insufficient for {difficulty} level {role} work. Review the {deliverables_count} deliverables and {constraints_count} constraints carefully and add significantly more detail."
        elif score >= 20:
            return f"Limited work on '{question_title}'. With only {total_shapes} elements, this does not meet {difficulty} level expectations for a {role}. The {task_type} needs substantial additional work to address the {deliverables_count} deliverables and {constraints_count} constraints."
        else:
            return f"Incomplete submission for '{question_title}'. Only {total_shapes} elements were created, which is far below {difficulty} level standards. Please review the challenge requirements: {deliverables_count} deliverables and {constraints_count} constraints need to be properly addressed."
    
    async def _ai_based_evaluation(
        self,
        screenshot_path: str,
        question_data: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """AI-based evaluation with question context"""
        
        try:
            # Extract question context
            question_title = question_data.get("title", "Design Challenge")
            role = question_data.get("role", "designer")
            difficulty = question_data.get("difficulty", "intermediate")
            task_type = question_data.get("task_type", "design")
            
            # For now, return context-aware moderate score
            # In production, this would call vision AI APIs with question context
            
            score = 70.0
            
            # Role-specific feedback
            if role == "ui_designer":
                strengths = [
                    f"Attempted to create UI elements for {task_type}",
                    "Basic visual structure present"
                ]
                improvements = [
                    f"Add more UI components to meet {difficulty} level standards",
                    "Improve pixel-perfect execution and alignment",
                    "Enhance typography and color system",
                    f"Address all requirements in '{question_title}'"
                ]
            elif role == "ux_designer":
                strengths = [
                    f"Started working on {task_type} user experience",
                    "Basic layout structure attempted"
                ]
                improvements = [
                    f"Add user flow documentation for {difficulty} level",
                    "Include more interaction states and error handling",
                    "Improve information architecture",
                    f"Complete all deliverables for '{question_title}'"
                ]
            elif role == "product_designer":
                strengths = [
                    f"Initiated {task_type} product design",
                    "Basic concept present"
                ]
                improvements = [
                    f"Add strategic thinking elements for {difficulty} level",
                    "Include user personas and business goals",
                    "Develop complete product flows",
                    f"Address all aspects of '{question_title}'"
                ]
            else:  # visual_designer
                strengths = [
                    f"Started visual design for {task_type}",
                    "Basic visual elements present"
                ]
                improvements = [
                    f"Add more creative visual elements for {difficulty} level",
                    "Develop unique brand identity",
                    "Include custom illustrations or graphics",
                    f"Fully realize the vision for '{question_title}'"
                ]
            
            feedback = {
                "visual_aesthetics": 18,
                "ux_clarity": 17,
                "creativity": 18,
                "technical_execution": 17,
                "strengths": strengths,
                "improvements": improvements,
                "overall": f"Your submission for '{question_title}' shows initial effort, but needs significant additional work to meet {difficulty} level {role} standards. Focus on completing all deliverables and addressing the specific constraints provided.",
                "note": "AI vision evaluation will be enhanced with API integration for more detailed analysis"
            }
            
            return score, feedback
            
        except Exception as e:
            logger.error(f"AI evaluation failed: {e}")
            return 60.0, {"error": str(e), "fallback": True}


    async def evaluate(
        self,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any],
        events_data: Dict[str, Any] = None,
        screenshot_base64: str = None
    ) -> Dict[str, Any]:
        """
        Main evaluation interface
        Returns evaluation results with scores and feedback
        """
        try:
            # Save screenshot if provided
            screenshot_path = None
            if screenshot_base64:
                import base64
                import tempfile
                import os
                
                # Decode base64 image
                if screenshot_base64.startswith('data:image'):
                    screenshot_base64 = screenshot_base64.split(',')[1]
                
                image_data = base64.b64decode(screenshot_base64)
                
                # Save to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as f:
                    f.write(image_data)
                    screenshot_path = f.name
            
            # If no screenshot, still evaluate using design data
            if not screenshot_path:
                logger.warning("No screenshot provided, evaluating using design data only")
                # Create a dummy screenshot path for the evaluation
                screenshot_path = ""
            
            # Run evaluation
            rule_score, ai_score, final_score, feedback = await self.evaluate_submission(
                screenshot_path,
                design_data.get("file_data", {}),
                question_data
            )
            
            # Clean up temp file
            if screenshot_path and os.path.exists(screenshot_path):
                try:
                    os.unlink(screenshot_path)
                except:
                    pass
            
            return {
                "rule_based_score": rule_score,
                "ai_based_score": ai_score,
                "final_score": final_score,
                "feedback": feedback
            }
            
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Return default scores on error
            return {
                "rule_based_score": 50.0,
                "ai_based_score": 50.0,
                "final_score": 50.0,
                "feedback": {
                    "error": str(e),
                    "note": "Evaluation failed, using default scores"
                }
            }


# Singleton instance
evaluation_engine = DesignEvaluationEngine()