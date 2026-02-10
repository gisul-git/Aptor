"""
Design Evaluation Engine
Implements comprehensive rule-based and AI-based evaluation
"""

from typing import Dict, Any, List, Tuple
import logging
import math

logger = logging.getLogger(__name__)


class DesignEvaluationEngine:
    """
    Comprehensive design evaluation engine
    - Rule-Based Evaluation: 60% weight
    - AI-Based Evaluation: 40% weight (Real AI with GPT-4 Vision)
    """
    
    def __init__(self):
        self.rule_weight = 0.6  # 60%
        self.ai_weight = 0.4    # 40%
        
        # Import AI evaluator
        from app.services.ai_evaluator import ai_evaluator
        self.ai_evaluator = ai_evaluator
    
    async def evaluate(
        self,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any],
        events_data: Dict[str, Any] = None,
        screenshot_base64: str = None
    ) -> Dict[str, Any]:
        """
        Main evaluation method
        
        Args:
            design_data: Design structure (JSON from Penpot)
            question_data: Question requirements
            events_data: User interaction events (optional)
            screenshot_base64: Base64 screenshot for AI evaluation (optional)
        
        Returns:
            Complete evaluation results with scores and feedback
        """
        logger.info("🎯 Starting comprehensive design evaluation")
        
        # Extract metrics
        metrics = design_data.get("metrics", {})
        
        # 1. Rule-Based Evaluation (60%)
        rule_result = self.rule_based_evaluation(design_data, question_data, events_data)
        rule_score = rule_result["score"]
        
        # 2. AI-Based Evaluation (40%) - Use real AI if screenshot available
        if screenshot_base64 and self.ai_evaluator.client:
            logger.info("🤖 Using real AI evaluation with GPT-4 Vision")
            ai_result = await self.ai_based_evaluation_with_ai(
                screenshot_base64=screenshot_base64,
                design_data=design_data,
                question_data=question_data
            )
        else:
            logger.info("📊 Using heuristic evaluation (no screenshot or AI not available)")
            ai_result = self.ai_based_evaluation(design_data, question_data)
        
        ai_score = ai_result["score"]
        
        # 3. Final Score Aggregation
        final_score = (rule_score * self.rule_weight) + (ai_score * self.ai_weight)
        
        # 4. Generate Feedback
        feedback = self.generate_comprehensive_feedback(
            rule_result=rule_result,
            ai_result=ai_result,
            final_score=final_score,
            metrics=metrics
        )
        
        logger.info(f"✅ Evaluation complete: Rule={rule_score:.1f}, AI={ai_score:.1f}, Final={final_score:.1f}")
        
        return {
            "rule_based_score": rule_score,
            "ai_based_score": ai_score,
            "final_score": final_score,
            "feedback": feedback,
            "rule_details": rule_result,
            "ai_details": ai_result
        }
    
    async def ai_based_evaluation_with_ai(
        self,
        screenshot_base64: str,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI-Based Evaluation using real GPT-4 Vision
        """
        logger.info("🤖 Running AI-based evaluation with GPT-4 Vision...")
        
        try:
            # Call AI evaluator
            ai_response = await self.ai_evaluator.evaluate_design(
                screenshot_base64=screenshot_base64,
                design_data=design_data,
                question_data=question_data
            )
            
            if ai_response["success"]:
                scores = ai_response["scores"]["breakdown"]
                total_score = ai_response["scores"]["total"]
                feedback = ai_response["scores"]["feedback"]
                
                return {
                    "score": total_score,
                    "breakdown": scores,
                    "feedback": feedback,
                    "model": ai_response["model"],
                    "raw_response": ai_response["raw_feedback"]
                }
            else:
                # Fallback to heuristic
                return self.ai_based_evaluation(design_data, question_data)
                
        except Exception as e:
            logger.error(f"AI evaluation failed: {e}")
            return self.ai_based_evaluation(design_data, question_data)
    
    def rule_based_evaluation(
        self,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any],
        events_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Rule-Based Evaluation (60% weight)
        
        Evaluates:
        - Alignment
        - Spacing consistency
        - Typography hierarchy
        - Color contrast
        - Visual hierarchy
        - Component consistency
        - User interaction patterns
        """
        logger.info("📐 Running rule-based evaluation...")
        
        metrics = design_data.get("metrics", {})
        total_shapes = metrics.get("total_shapes", 0)
        page_count = metrics.get("page_count", 0)
        
        scores = {}
        max_scores = {}
        
        # 1. Layout Completeness (25 points)
        scores["completeness"], max_scores["completeness"] = self._evaluate_completeness(
            total_shapes, page_count
        )
        
        # 2. Alignment (15 points)
        scores["alignment"], max_scores["alignment"] = self._evaluate_alignment(design_data)
        
        # 3. Spacing Consistency (15 points)
        scores["spacing"], max_scores["spacing"] = self._evaluate_spacing(design_data)
        
        # 4. Typography Hierarchy (10 points)
        scores["typography"], max_scores["typography"] = self._evaluate_typography(design_data)
        
        # 5. Color Usage (10 points)
        scores["color"], max_scores["color"] = self._evaluate_color_usage(design_data)
        
        # 6. Visual Hierarchy (15 points)
        scores["hierarchy"], max_scores["hierarchy"] = self._evaluate_visual_hierarchy(design_data)
        
        # 7. User Interaction Quality (10 points) - if events available
        if events_data:
            scores["interaction"], max_scores["interaction"] = self._evaluate_interaction_quality(events_data)
        else:
            scores["interaction"], max_scores["interaction"] = 0, 10
        
        # Calculate total
        total_score = sum(scores.values())
        max_total = sum(max_scores.values())
        
        # Normalize to 100
        normalized_score = (total_score / max_total) * 100 if max_total > 0 else 0
        
        return {
            "score": normalized_score,
            "breakdown": scores,
            "max_scores": max_scores,
            "details": {
                "total_shapes": total_shapes,
                "page_count": page_count
            }
        }
    
    def _evaluate_completeness(self, total_shapes: int, page_count: int) -> Tuple[float, float]:
        """Evaluate design completeness (25 points max) - STRICT"""
        score = 0.0
        max_score = 25.0
        
        # STRICT scoring - minimal designs get very low scores
        if total_shapes == 0:
            return 0, max_score
        elif total_shapes < 5:
            # Very incomplete - FAIL
            score = 2
        elif total_shapes < 10:
            # Incomplete - POOR
            score = 5
        elif total_shapes < 20:
            # Basic - needs more work
            score = 10
        elif total_shapes < 30:
            # Acceptable
            score = 15
        elif total_shapes < 50:
            # Good
            score = 20
        else:
            # Excellent
            score = 25
        
        # Page count bonus (small)
        if page_count > 1:
            score += 2
        
        return min(score, max_score), max_score
    
    def _evaluate_alignment(self, design_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate alignment quality (15 points max)"""
        score = 0.0
        max_score = 15.0
        
        # Extract shape positions from design data
        shapes = self._extract_shapes(design_data)
        
        if len(shapes) < 2:
            return 0, max_score
        
        # Check for aligned elements (same x or y coordinates)
        aligned_count = 0
        for i, shape1 in enumerate(shapes):
            for shape2 in shapes[i+1:]:
                x1, y1 = shape1.get("x", 0), shape1.get("y", 0)
                x2, y2 = shape2.get("x", 0), shape2.get("y", 0)
                
                # Check alignment (within 5px tolerance)
                if abs(x1 - x2) < 5 or abs(y1 - y2) < 5:
                    aligned_count += 1
        
        # Score based on alignment ratio
        alignment_ratio = aligned_count / len(shapes) if len(shapes) > 0 else 0
        score = alignment_ratio * max_score
        
        return min(score, max_score), max_score
    
    def _evaluate_spacing(self, design_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate spacing consistency (15 points max)"""
        score = 0.0
        max_score = 15.0
        
        shapes = self._extract_shapes(design_data)
        
        if len(shapes) < 2:
            return 0, max_score
        
        # Calculate spacing between adjacent elements
        spacings = []
        sorted_shapes = sorted(shapes, key=lambda s: (s.get("y", 0), s.get("x", 0)))
        
        for i in range(len(sorted_shapes) - 1):
            s1 = sorted_shapes[i]
            s2 = sorted_shapes[i + 1]
            
            # Calculate distance
            dx = s2.get("x", 0) - (s1.get("x", 0) + s1.get("width", 0))
            dy = s2.get("y", 0) - (s1.get("y", 0) + s1.get("height", 0))
            distance = math.sqrt(dx**2 + dy**2)
            spacings.append(distance)
        
        # Check consistency (low standard deviation = consistent spacing)
        if spacings:
            avg_spacing = sum(spacings) / len(spacings)
            variance = sum((s - avg_spacing) ** 2 for s in spacings) / len(spacings)
            std_dev = math.sqrt(variance)
            
            # Lower std_dev = more consistent = higher score
            consistency_score = max(0, 1 - (std_dev / avg_spacing)) if avg_spacing > 0 else 0
            score = consistency_score * max_score
        
        return min(score, max_score), max_score
    
    def _evaluate_typography(self, design_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate typography hierarchy (10 points max)"""
        score = 0.0
        max_score = 10.0
        
        shapes = self._extract_shapes(design_data)
        text_elements = [s for s in shapes if s.get("type") == "text"]
        
        if not text_elements:
            return 0, max_score
        
        # Check for different font sizes (hierarchy)
        font_sizes = set()
        for text in text_elements:
            font_size = text.get("font_size", 12)
            font_sizes.add(font_size)
        
        # Score based on hierarchy levels
        if len(font_sizes) >= 3:
            score += 10  # Good hierarchy (3+ levels)
        elif len(font_sizes) == 2:
            score += 6   # Basic hierarchy (2 levels)
        elif len(font_sizes) == 1:
            score += 3   # No hierarchy
        
        return min(score, max_score), max_score
    
    def _evaluate_color_usage(self, design_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate color usage and contrast (10 points max)"""
        score = 0.0
        max_score = 10.0
        
        shapes = self._extract_shapes(design_data)
        
        # Extract colors
        colors = set()
        for shape in shapes:
            fill_color = shape.get("fill_color")
            stroke_color = shape.get("stroke_color")
            if fill_color:
                colors.add(fill_color)
            if stroke_color:
                colors.add(stroke_color)
        
        # Score based on color palette size
        color_count = len(colors)
        if 3 <= color_count <= 5:
            score += 10  # Good palette (3-5 colors)
        elif 2 <= color_count < 3 or 5 < color_count <= 7:
            score += 6   # Acceptable
        else:
            score += 3   # Too few or too many
        
        return min(score, max_score), max_score
    
    def _evaluate_visual_hierarchy(self, design_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate visual hierarchy (15 points max)"""
        score = 0.0
        max_score = 15.0
        
        shapes = self._extract_shapes(design_data)
        
        if not shapes:
            return 0, max_score
        
        # Check for size variation (indicates hierarchy)
        sizes = []
        for shape in shapes:
            width = shape.get("width", 0)
            height = shape.get("height", 0)
            area = width * height
            sizes.append(area)
        
        if sizes:
            max_size = max(sizes)
            min_size = min(sizes)
            size_ratio = max_size / min_size if min_size > 0 else 1
            
            # Good hierarchy has significant size variation
            if size_ratio > 5:
                score += 15
            elif size_ratio > 3:
                score += 10
            elif size_ratio > 2:
                score += 6
            else:
                score += 3
        
        return min(score, max_score), max_score
    
    def _evaluate_interaction_quality(self, events_data: Dict[str, Any]) -> Tuple[float, float]:
        """Evaluate user interaction quality (10 points max)"""
        score = 0.0
        max_score = 10.0
        
        if not events_data:
            return 0, max_score
        
        # Extract event counts
        mouse_clicks = events_data.get("mouse_clicks", 0)
        tool_selections = events_data.get("tool_selections", 0)
        object_creations = events_data.get("object_creations", 0)
        undo_redo = events_data.get("undo_redo", 0)
        idle_time = events_data.get("idle_time_seconds", 0)
        total_time = events_data.get("total_time_seconds", 1)
        
        # Active engagement score
        if object_creations > 10:
            score += 4
        elif object_creations > 5:
            score += 2
        
        # Tool usage diversity
        if tool_selections > 5:
            score += 3
        elif tool_selections > 2:
            score += 1
        
        # Idle time penalty
        idle_ratio = idle_time / total_time if total_time > 0 else 0
        if idle_ratio < 0.2:  # Less than 20% idle
            score += 3
        elif idle_ratio < 0.4:
            score += 1
        
        return min(score, max_score), max_score
    
    def _extract_shapes(self, design_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract shape data from design JSON"""
        shapes = []
        
        # Navigate through Penpot data structure
        data = design_data.get("data", {})
        pages_index = data.get("pages-index", {})
        
        for page_id, page_data in pages_index.items():
            objects = page_data.get("objects", {})
            for obj_id, obj_data in objects.items():
                if isinstance(obj_data, dict):
                    shapes.append(obj_data)
        
        return shapes
    
    def ai_based_evaluation(
        self,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI-Based Evaluation (40% weight) - STRICT HEURISTIC with HARD CAPS
        
        Evaluates:
        - Visual aesthetics
        - UX clarity
        - Creativity
        - Accessibility
        - Layout balance
        """
        logger.info("🤖 Running AI-based heuristic evaluation (STRICT)...")
        
        metrics = design_data.get("metrics", {})
        total_shapes = metrics.get("total_shapes", 0)
        page_count = metrics.get("page_count", 0)
        
        scores = {}
        
        # 1. Visual Aesthetics (30 points)
        scores["aesthetics"] = self._evaluate_aesthetics(design_data, total_shapes)
        
        # 2. UX Clarity (25 points)
        scores["ux_clarity"] = self._evaluate_ux_clarity(design_data, total_shapes)
        
        # 3. Creativity (20 points)
        scores["creativity"] = self._evaluate_creativity(design_data, total_shapes, page_count)
        
        # 4. Accessibility (15 points)
        scores["accessibility"] = self._evaluate_accessibility(design_data)
        
        # 5. Layout Balance (10 points)
        scores["balance"] = self._evaluate_layout_balance(design_data)
        
        # Calculate total (out of 100)
        total_score = sum(scores.values())
        
        # CRITICAL: Apply hard caps based on element count
        capped_scores = self._apply_heuristic_hard_caps(scores, total_score, total_shapes)
        
        logger.info(f"🔒 Heuristic evaluation: {capped_scores['total']:.1f}/100 (was {total_score:.1f}, {total_shapes} elements)")
        
        return {
            "score": capped_scores["total"],
            "breakdown": capped_scores["breakdown"]
        }
    
    def _apply_heuristic_hard_caps(
        self,
        scores: Dict[str, float],
        total_score: float,
        total_shapes: int
    ) -> Dict[str, Any]:
        """Apply hard caps to heuristic AI scores based on element count"""
        
        # Define maximum scores based on element count
        if total_shapes < 5:
            max_total = 15  # FAIL
        elif total_shapes < 10:
            max_total = 25  # POOR
        elif total_shapes < 20:
            max_total = 40  # BASIC
        elif total_shapes < 30:
            max_total = 60  # ACCEPTABLE
        else:
            # No caps for 30+ elements
            return {"breakdown": scores, "total": total_score}
        
        # If total exceeds cap, scale down proportionally
        if total_score > max_total:
            scale_factor = max_total / total_score
            capped_breakdown = {
                k: v * scale_factor for k, v in scores.items()
            }
            capped_total = max_total
        else:
            capped_breakdown = scores
            capped_total = total_score
        
        return {
            "breakdown": capped_breakdown,
            "total": capped_total
        }
    
    def _evaluate_aesthetics(self, design_data: Dict[str, Any], total_shapes: int) -> float:
        """Evaluate visual aesthetics (30 points max) - STRICT"""
        if total_shapes == 0:
            return 0
        elif total_shapes < 5:
            return 3  # Very low for minimal designs
        elif total_shapes < 10:
            return 8
        elif total_shapes < 20:
            return 15
        elif total_shapes < 30:
            return 20
        else:
            return 28
    
    def _evaluate_ux_clarity(self, design_data: Dict[str, Any], total_shapes: int) -> float:
        """Evaluate UX clarity (25 points max) - STRICT"""
        if total_shapes < 5:
            return 2  # Very low for minimal designs
        elif total_shapes < 10:
            return 6
        elif total_shapes < 20:
            return 12
        elif total_shapes < 30:
            return 18
        else:
            return 23
    
    def _evaluate_creativity(self, design_data: Dict[str, Any], total_shapes: int, page_count: int) -> float:
        """Evaluate creativity (20 points max) - STRICT"""
        score = 0
        
        # More shapes = more creative effort
        if total_shapes < 5:
            score += 2  # Very low
        elif total_shapes < 10:
            score += 4
        elif total_shapes < 20:
            score += 7
        elif total_shapes >= 20:
            score += 10
        
        # Multiple pages = creative thinking
        if page_count > 1:
            score += 10
        elif page_count == 1:
            score += 3
        
        return min(score, 20)
    
    def _evaluate_accessibility(self, design_data: Dict[str, Any]) -> float:
        """Evaluate accessibility (15 points max) - STRICT"""
        shapes = self._extract_shapes(design_data)
        text_count = len([s for s in shapes if s.get("type") == "text"])
        
        if len(shapes) < 5:
            return 2  # Very low for minimal designs
        elif text_count > 5:
            return 14
        elif text_count > 2:
            return 9
        else:
            return 4
    
    def _evaluate_layout_balance(self, design_data: Dict[str, Any]) -> float:
        """Evaluate layout balance (10 points max) - STRICT"""
        shapes = self._extract_shapes(design_data)
        
        if len(shapes) < 3:
            return 1  # Very low for minimal designs
        elif len(shapes) < 5:
            return 2
        
        # Check distribution across canvas
        x_positions = [s.get("x", 0) for s in shapes]
        y_positions = [s.get("y", 0) for s in shapes]
        
        # Good balance = elements spread across canvas
        x_range = max(x_positions) - min(x_positions) if x_positions else 0
        y_range = max(y_positions) - min(y_positions) if y_positions else 0
        
        if x_range > 500 and y_range > 300:
            return 9
        elif x_range > 300 and y_range > 200:
            return 6
        else:
            return 3
    
    def generate_comprehensive_feedback(
        self,
        rule_result: Dict[str, Any],
        ai_result: Dict[str, Any],
        final_score: float,
        metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate comprehensive feedback"""
        
        total_shapes = metrics.get("total_shapes", 0)
        page_count = metrics.get("page_count", 0)
        
        # Overall assessment
        if final_score >= 80:
            overall = "Excellent work! Your design demonstrates professional quality and attention to detail."
        elif final_score >= 60:
            overall = "Good effort! Your design shows solid fundamentals with room for improvement."
        elif final_score >= 40:
            overall = "Fair attempt. Your design needs significant improvements in structure and quality."
        else:
            overall = "Your design is incomplete. Focus on building a complete, well-structured design."
        
        # Detailed feedback
        strengths = []
        improvements = []
        
        # Analyze rule-based scores
        rule_breakdown = rule_result.get("breakdown", {})
        if rule_breakdown.get("completeness", 0) > 15:
            strengths.append("Good design completeness")
        else:
            improvements.append("Add more design elements")
        
        if rule_breakdown.get("alignment", 0) > 10:
            strengths.append("Well-aligned elements")
        else:
            improvements.append("Improve element alignment")
        
        if rule_breakdown.get("spacing", 0) > 10:
            strengths.append("Consistent spacing")
        else:
            improvements.append("Work on spacing consistency")
        
        # Analyze AI scores
        ai_breakdown = ai_result.get("breakdown", {})
        if ai_breakdown.get("aesthetics", 0) > 20:
            strengths.append("Strong visual aesthetics")
        else:
            improvements.append("Enhance visual appeal")
        
        if ai_breakdown.get("ux_clarity", 0) > 15:
            strengths.append("Clear UX design")
        else:
            improvements.append("Improve UX clarity")
        
        return {
            "overall": overall,
            "strengths": strengths,
            "improvements": improvements,
            "rule_based": {
                "score": rule_result["score"],
                "breakdown": rule_breakdown,
                "notes": f"Evaluated {total_shapes} elements across {page_count} page(s)"
            },
            "ai_based": {
                "score": ai_result["score"],
                "breakdown": ai_breakdown,
                "notes": "AI evaluation based on visual quality and UX principles"
            },
            "final_score": final_score,
            "weights": {
                "rule_based": "60%",
                "ai_based": "40%"
            }
        }
