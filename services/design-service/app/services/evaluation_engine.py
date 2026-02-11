"""
Automated Hybrid Evaluation Engine
Combines rule-based and AI-based scoring for design submissions
"""

import logging
from typing import Dict, Any, List, Tuple
from PIL import Image
import cv2
import numpy as np
from app.core.config import settings
import openai
import google.generativeai as genai
from anthropic import Anthropic

logger = logging.getLogger(__name__)


class DesignEvaluationEngine:
    """Hybrid evaluation engine for design submissions"""
    
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self._setup_ai_client()
    
    def _setup_ai_client(self):
        """Setup AI client for vision analysis"""
        if self.provider == "openai":
            openai.api_key = settings.OPENAI_API_KEY
        elif self.provider == "gemini":
            genai.configure(api_key=settings.GEMINI_API_KEY)
        elif self.provider == "claude":
            self.anthropic_client = Anthropic(api_key=settings.CLAUDE_API_KEY)
    
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
            
            # AI-based evaluation (40% weight)
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
        """Rule-based evaluation using computer vision and design analysis"""
        
        scores = {}
        feedback = {}
        
        try:
            # Load image for analysis
            image = cv2.imread(screenshot_path)
            if image is None:
                raise ValueError("Could not load screenshot")
            
            # 1. Alignment Analysis (20 points)
            alignment_score = self._analyze_alignment(image)
            scores["alignment"] = alignment_score
            feedback["alignment"] = self._get_alignment_feedback(alignment_score)
            
            # 2. Spacing Consistency (15 points)
            spacing_score = self._analyze_spacing(image)
            scores["spacing"] = spacing_score
            feedback["spacing"] = self._get_spacing_feedback(spacing_score)
            
            # 3. Typography Hierarchy (15 points)
            typography_score = self._analyze_typography(image)
            scores["typography"] = typography_score
            feedback["typography"] = self._get_typography_feedback(typography_score)
            
            # 4. Color Contrast (15 points)
            contrast_score = self._analyze_color_contrast(image)
            scores["contrast"] = contrast_score
            feedback["contrast"] = self._get_contrast_feedback(contrast_score)
            
            # 5. Visual Hierarchy (20 points)
            hierarchy_score = self._analyze_visual_hierarchy(image)
            scores["hierarchy"] = hierarchy_score
            feedback["hierarchy"] = self._get_hierarchy_feedback(hierarchy_score)
            
            # 6. Component Consistency (15 points)
            consistency_score = self._analyze_component_consistency(design_json)
            scores["consistency"] = consistency_score
            feedback["consistency"] = self._get_consistency_feedback(consistency_score)
            
            # Calculate total score (out of 100)
            total_score = sum(scores.values())
            
            return total_score, {
                "scores": scores,
                "feedback": feedback,
                "total": total_score
            }
            
        except Exception as e:
            logger.error(f"Rule-based evaluation failed: {e}")
            return 0.0, {"error": str(e)}
    
    def _analyze_alignment(self, image: np.ndarray) -> float:
        """Analyze element alignment using edge detection"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Detect horizontal and vertical lines
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))
            
            horizontal_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, horizontal_kernel)
            vertical_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, vertical_kernel)
            
            # Count aligned elements
            h_lines = cv2.HoughLinesP(horizontal_lines, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
            v_lines = cv2.HoughLinesP(vertical_lines, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
            
            alignment_score = min(20, (len(h_lines or []) + len(v_lines or [])) * 2)
            return alignment_score
            
        except Exception:
            return 10.0  # Default moderate score
    
    def _analyze_spacing(self, image: np.ndarray) -> float:
        """Analyze spacing consistency"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Find contours (UI elements)
            contours, _ = cv2.findContours(gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contours) < 2:
                return 10.0
            
            # Calculate distances between elements
            centroids = []
            for contour in contours:
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    centroids.append((cx, cy))
            
            # Analyze spacing consistency
            distances = []
            for i in range(len(centroids)):
                for j in range(i + 1, len(centroids)):
                    dist = np.sqrt((centroids[i][0] - centroids[j][0])**2 + 
                                 (centroids[i][1] - centroids[j][1])**2)
                    distances.append(dist)
            
            if distances:
                std_dev = np.std(distances)
                # Lower standard deviation = more consistent spacing
                consistency = max(0, 15 - (std_dev / 10))
                return min(15, consistency)
            
            return 10.0
            
        except Exception:
            return 10.0
    
    def _analyze_typography(self, image: np.ndarray) -> float:
        """Analyze typography hierarchy (simplified)"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect text regions using morphological operations
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            text_regions = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
            
            # Find contours that might be text
            contours, _ = cv2.findContours(text_regions, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Analyze text size variations (hierarchy indicator)
            areas = [cv2.contourArea(c) for c in contours if cv2.contourArea(c) > 100]
            
            if len(areas) >= 3:
                # Good hierarchy if we have varied text sizes
                area_std = np.std(areas)
                hierarchy_score = min(15, area_std / 100)
                return hierarchy_score
            
            return 8.0  # Moderate score for limited text
            
        except Exception:
            return 8.0
    
    def _analyze_color_contrast(self, image: np.ndarray) -> float:
        """Analyze color contrast"""
        try:
            # Convert to LAB color space for better contrast analysis
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l_channel = lab[:, :, 0]
            
            # Calculate contrast ratio
            min_l = np.min(l_channel)
            max_l = np.max(l_channel)
            
            if min_l == 0:
                min_l = 1
            
            contrast_ratio = max_l / min_l
            
            # Score based on WCAG guidelines
            if contrast_ratio >= 7:  # AAA level
                return 15.0
            elif contrast_ratio >= 4.5:  # AA level
                return 12.0
            elif contrast_ratio >= 3:  # Acceptable
                return 8.0
            else:
                return 4.0
                
        except Exception:
            return 8.0
    
    def _analyze_visual_hierarchy(self, image: np.ndarray) -> float:
        """Analyze visual hierarchy using saliency"""
        try:
            # Create saliency map
            saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
            success, saliency_map = saliency.computeSaliency(image)
            
            if not success:
                return 12.0
            
            # Analyze distribution of salient regions
            saliency_map = (saliency_map * 255).astype(np.uint8)
            
            # Find peaks in saliency (focal points)
            _, thresh = cv2.threshold(saliency_map, 127, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Good hierarchy has 2-4 main focal points
            focal_points = len([c for c in contours if cv2.contourArea(c) > 500])
            
            if 2 <= focal_points <= 4:
                return 20.0
            elif focal_points == 1 or focal_points == 5:
                return 15.0
            else:
                return 10.0
                
        except Exception:
            return 12.0
    
    def _analyze_component_consistency(self, design_json: Dict[str, Any]) -> float:
        """Analyze component consistency from design data"""
        try:
            if not design_json:
                return 8.0
            
            # Analyze color consistency
            colors_used = set()
            button_styles = []
            text_styles = []
            
            # Extract style information (simplified)
            # This would need to be adapted based on actual Penpot JSON structure
            
            # For now, return a moderate score
            return 12.0
            
        except Exception:
            return 8.0
    
    async def _ai_based_evaluation(
        self,
        screenshot_path: str,
        question_data: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """AI-based evaluation using vision models"""
        
        try:
            # Prepare evaluation prompt
            prompt = self._build_evaluation_prompt(question_data)
            
            # Get AI evaluation
            if self.provider == "openai":
                score, feedback = await self._evaluate_with_openai(screenshot_path, prompt)
            elif self.provider == "gemini":
                score, feedback = await self._evaluate_with_gemini(screenshot_path, prompt)
            elif self.provider == "claude":
                score, feedback = await self._evaluate_with_claude(screenshot_path, prompt)
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
            
            return score, feedback
            
        except Exception as e:
            logger.error(f"AI evaluation failed: {e}")
            return 50.0, {"error": str(e), "fallback": True}
    
    def _build_evaluation_prompt(self, question_data: Dict[str, Any]) -> str:
        """Build AI evaluation prompt"""
        
        return f"""
Evaluate this design submission based on the following criteria:

Question Context:
- Title: {question_data.get('title', 'Design Challenge')}
- Description: {question_data.get('description', 'Design task')}
- Deliverables: {', '.join(question_data.get('deliverables', []))}
- Evaluation Criteria: {', '.join(question_data.get('evaluation_criteria', []))}

Please evaluate the design on a scale of 0-100 and provide specific feedback on:

1. Visual Aesthetics (25 points)
   - Overall visual appeal and polish
   - Color harmony and visual balance
   - Typography and visual consistency

2. UX Clarity (25 points)
   - Information hierarchy and readability
   - User flow and navigation clarity
   - Accessibility considerations

3. Creativity & Innovation (25 points)
   - Original thinking and creative solutions
   - Unique design approaches
   - Problem-solving creativity

4. Technical Execution (25 points)
   - Layout structure and organization
   - Responsive design considerations
   - Professional execution quality

Return your response in this JSON format:
{{
    "total_score": 85,
    "breakdown": {{
        "visual_aesthetics": 22,
        "ux_clarity": 20,
        "creativity": 23,
        "technical_execution": 20
    }},
    "feedback": {{
        "strengths": ["strength1", "strength2"],
        "improvements": ["improvement1", "improvement2"],
        "overall": "Overall assessment summary"
    }}
}}
"""
    
    async def _evaluate_with_openai(self, image_path: str, prompt: str) -> Tuple[float, Dict[str, Any]]:
        """Evaluate using OpenAI Vision"""
        # Note: This would require OpenAI Vision API implementation
        # For now, return a placeholder
        return 75.0, {
            "provider": "openai",
            "feedback": "AI evaluation completed",
            "note": "Vision API integration needed"
        }
    
    async def _evaluate_with_gemini(self, image_path: str, prompt: str) -> Tuple[float, Dict[str, Any]]:
        """Evaluate using Gemini Vision"""
        # Note: This would require Gemini Vision API implementation
        return 75.0, {
            "provider": "gemini",
            "feedback": "AI evaluation completed",
            "note": "Vision API integration needed"
        }
    
    async def _evaluate_with_claude(self, image_path: str, prompt: str) -> Tuple[float, Dict[str, Any]]:
        """Evaluate using Claude Vision"""
        # Note: This would require Claude Vision API implementation
        return 75.0, {
            "provider": "claude",
            "feedback": "AI evaluation completed",
            "note": "Vision API integration needed"
        }
    
    # Feedback generation methods
    def _get_alignment_feedback(self, score: float) -> str:
        if score >= 18:
            return "Excellent alignment - elements are well-organized and properly aligned"
        elif score >= 14:
            return "Good alignment with minor inconsistencies"
        elif score >= 10:
            return "Moderate alignment - some elements could be better positioned"
        else:
            return "Poor alignment - elements appear scattered and unorganized"
    
    def _get_spacing_feedback(self, score: float) -> str:
        if score >= 13:
            return "Consistent spacing creates good visual rhythm"
        elif score >= 10:
            return "Generally good spacing with some inconsistencies"
        elif score >= 7:
            return "Spacing needs improvement for better visual flow"
        else:
            return "Inconsistent spacing disrupts visual harmony"
    
    def _get_typography_feedback(self, score: float) -> str:
        if score >= 13:
            return "Clear typography hierarchy guides the user effectively"
        elif score >= 10:
            return "Good typography with room for hierarchy improvement"
        elif score >= 7:
            return "Typography hierarchy needs strengthening"
        else:
            return "Poor typography hierarchy affects readability"
    
    def _get_contrast_feedback(self, score: float) -> str:
        if score >= 13:
            return "Excellent color contrast ensures accessibility"
        elif score >= 10:
            return "Good contrast with minor accessibility concerns"
        elif score >= 7:
            return "Contrast could be improved for better readability"
        else:
            return "Poor contrast may cause accessibility issues"
    
    def _get_hierarchy_feedback(self, score: float) -> str:
        if score >= 18:
            return "Strong visual hierarchy guides attention effectively"
        elif score >= 14:
            return "Good visual hierarchy with clear focal points"
        elif score >= 10:
            return "Visual hierarchy needs strengthening"
        else:
            return "Weak visual hierarchy confuses user attention"
    
    def _get_consistency_feedback(self, score: float) -> str:
        if score >= 13:
            return "Consistent design patterns create cohesive experience"
        elif score >= 10:
            return "Generally consistent with minor variations"
        elif score >= 7:
            return "Some inconsistencies in design patterns"
        else:
            return "Inconsistent design patterns affect user experience"


# Singleton instance
evaluation_engine = DesignEvaluationEngine()