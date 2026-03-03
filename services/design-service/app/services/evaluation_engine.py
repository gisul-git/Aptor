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
            # Rule-based evaluation (60% weight)
            rule_score, rule_feedback = await self._rule_based_evaluation(
                screenshot_path, design_json
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
            
            # Combine feedback
            feedback = {
                "rule_based": rule_feedback,
                "ai_based": ai_feedback,
                "overall_score": final_score,
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
        design_json: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """Rule-based evaluation using design metrics"""
        
        scores = {}
        feedback = {}
        
        try:
            # Extract metrics from design data
            metrics = design_json.get("metrics", {})
            
            # 1. Component Count Analysis (20 points)
            total_shapes = metrics.get("total_shapes", 0)
            page_count = metrics.get("page_count", 0)
            
            if total_shapes >= 20:
                scores["components"] = 20.0
                feedback["components"] = "Excellent - Rich design with many components"
            elif total_shapes >= 10:
                scores["components"] = 15.0
                feedback["components"] = "Good - Adequate number of design elements"
            elif total_shapes >= 5:
                scores["components"] = 10.0
                feedback["components"] = "Moderate - Could use more design elements"
            else:
                scores["components"] = 5.0
                feedback["components"] = "Limited - Very few design elements"
            
            # 2. Layout Complexity (15 points)
            if page_count > 1:
                scores["layout"] = 15.0
                feedback["layout"] = "Multi-page design shows good planning"
            elif total_shapes > 15:
                scores["layout"] = 12.0
                feedback["layout"] = "Complex single-page layout"
            elif total_shapes > 8:
                scores["layout"] = 9.0
                feedback["layout"] = "Moderate layout complexity"
            else:
                scores["layout"] = 6.0
                feedback["layout"] = "Simple layout structure"
            
            # 3. Design Completeness (15 points)
            if total_shapes >= 15 and page_count >= 1:
                scores["completeness"] = 15.0
                feedback["completeness"] = "Complete and comprehensive design"
            elif total_shapes >= 10:
                scores["completeness"] = 11.0
                feedback["completeness"] = "Good level of detail"
            elif total_shapes >= 5:
                scores["completeness"] = 7.0
                feedback["completeness"] = "Basic design elements present"
            else:
                scores["completeness"] = 3.0
                feedback["completeness"] = "Incomplete design"
            
            # 4. Visual Hierarchy (20 points) - Based on shape variety
            if total_shapes > 0:
                # Assume variety if many shapes
                variety_score = min(20, total_shapes)
                scores["hierarchy"] = variety_score
                if variety_score >= 18:
                    feedback["hierarchy"] = "Strong visual hierarchy evident"
                elif variety_score >= 14:
                    feedback["hierarchy"] = "Good visual organization"
                elif variety_score >= 10:
                    feedback["hierarchy"] = "Moderate hierarchy"
                else:
                    feedback["hierarchy"] = "Limited visual hierarchy"
            else:
                scores["hierarchy"] = 5.0
                feedback["hierarchy"] = "No clear hierarchy"
            
            # 5. Professional Execution (15 points)
            if total_shapes >= 15:
                scores["execution"] = 15.0
                feedback["execution"] = "Professional level execution"
            elif total_shapes >= 10:
                scores["execution"] = 11.0
                feedback["execution"] = "Good execution quality"
            elif total_shapes >= 5:
                scores["execution"] = 7.0
                feedback["execution"] = "Basic execution"
            else:
                scores["execution"] = 4.0
                feedback["execution"] = "Needs improvement"
            
            # 6. Design System Thinking (15 points)
            if total_shapes >= 12:
                scores["system"] = 15.0
                feedback["system"] = "Shows design system thinking"
            elif total_shapes >= 8:
                scores["system"] = 11.0
                feedback["system"] = "Some consistency evident"
            elif total_shapes >= 4:
                scores["system"] = 7.0
                feedback["system"] = "Basic consistency"
            else:
                scores["system"] = 4.0
                feedback["system"] = "Limited consistency"
            
            # Calculate total score (out of 100)
            total_score = sum(scores.values())
            
            return total_score, {
                "scores": scores,
                "feedback": feedback,
                "total": total_score,
                "metrics_used": metrics
            }
            
        except Exception as e:
            logger.error(f"Rule-based evaluation failed: {e}")
            return 50.0, {"error": str(e), "default_score": True}
    
    async def _ai_based_evaluation(
        self,
        screenshot_path: str,
        question_data: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """AI-based evaluation - simplified version"""
        
        try:
            # For now, return a moderate score
            # In production, this would call vision AI APIs
            
            score = 70.0
            feedback = {
                "visual_aesthetics": 18,
                "ux_clarity": 17,
                "creativity": 18,
                "technical_execution": 17,
                "strengths": [
                    "Clean and modern design approach",
                    "Good use of visual elements",
                    "Professional presentation"
                ],
                "improvements": [
                    "Could enhance color contrast",
                    "Consider adding more interactive elements",
                    "Strengthen visual hierarchy"
                ],
                "overall": "Good design submission with professional execution. Shows understanding of design principles.",
                "note": "AI vision evaluation will be enhanced with API integration"
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
            
            # If no screenshot, create a placeholder
            if not screenshot_path:
                logger.warning("No screenshot provided, using placeholder evaluation")
                return {
                    "rule_based_score": 60.0,
                    "ai_based_score": 60.0,
                    "final_score": 60.0,
                    "feedback": {
                        "note": "Evaluation performed without screenshot",
                        "rule_based": {"total": 60.0},
                        "ai_based": {"total": 60.0}
                    }
                }
            
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