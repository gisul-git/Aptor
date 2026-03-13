"""
Real AI-Based Design Evaluation using OpenAI GPT-4 Vision
"""

import logging
import base64
import os
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
import json

logger = logging.getLogger(__name__)


class AIDesignEvaluator:
    """
    Real AI-based design evaluation using GPT-4 Vision
    """
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ OPENAI_API_KEY not set. AI evaluation will use fallback heuristics.")
            self.client = None
        else:
            self.client = AsyncOpenAI(api_key=self.api_key)
            logger.info("✅ OpenAI client initialized for AI evaluation")
    
    async def evaluate_design(
        self,
        screenshot_base64: str,
        design_data: Dict[str, Any],
        question_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate design using GPT-4 Vision
        
        Args:
            screenshot_base64: Base64 encoded screenshot of the design
            design_data: Design structure data from Penpot
            question_data: Question requirements
        
        Returns:
            AI evaluation scores and feedback
        """
        if not self.client:
            logger.warning("OpenAI client not available. Using fallback heuristics.")
            return self._fallback_evaluation(design_data)
        
        try:
            logger.info("🤖 Starting AI evaluation with GPT-4 Vision...")
            
            # Prepare the prompt
            prompt = self._create_evaluation_prompt(question_data, design_data)
            
            # Prepare the image
            image_url = self._prepare_image_url(screenshot_base64)
            
            # Call GPT-4 Vision
            response = await self.client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert UI/UX designer evaluating design submissions. Provide objective, constructive feedback with specific scores."
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.3  # Lower temperature for more consistent scoring
            )
            
            # Parse the response
            ai_response = response.choices[0].message.content
            logger.info(f"✅ AI evaluation completed. Response length: {len(ai_response)}")
            
            # Extract scores from response
            scores = self._parse_ai_response(ai_response)
            
            # CRITICAL: Apply hard caps based on element count (override GPT-4's generous scoring)
            total_shapes = design_data.get("metrics", {}).get("total_shapes", 0)
            scores = self._apply_hard_caps(scores, total_shapes)
            
            return {
                "scores": scores,
                "raw_feedback": ai_response,
                "model": "gpt-4-vision-preview",
                "success": True
            }
            
        except Exception as e:
            logger.error(f"❌ AI evaluation failed: {e}")
            logger.info("Falling back to heuristic evaluation")
            return self._fallback_evaluation(design_data)
    
    def _create_evaluation_prompt(
        self,
        question_data: Dict[str, Any],
        design_data: Dict[str, Any]
    ) -> str:
        """Create detailed evaluation prompt for GPT-4"""
        
        metrics = design_data.get("metrics", {})
        total_shapes = metrics.get("total_shapes", 0)
        page_count = metrics.get("page_count", 0)
        
        question_title = question_data.get("title", "Design Challenge")
        question_desc = question_data.get("description", "")
        
        prompt = f"""
You are an EXTREMELY STRICT professional design evaluator. You must be HARSH and CRITICAL.

**Challenge:** {question_title}
**Requirements:** {question_desc}

**Actual Design Metrics:**
- Elements created: {total_shapes}
- Pages: {page_count}

**CRITICAL RULES - READ CAREFULLY:**
1. If design has < 5 elements: Maximum total score = 15 points
2. If design has < 10 elements: Maximum total score = 25 points  
3. If design has < 20 elements: Maximum total score = 40 points
4. If design doesn't match requirements: Deduct 50% from all scores
5. Empty/minimal designs = FAIL (< 20 points total)

**STRICT SCORING (Be VERY harsh):**

1. **Visual Aesthetics (0-30):**
   - < 5 elements: MAX 5 points
   - < 10 elements: MAX 10 points
   - Basic shapes only: MAX 12 points
   - No proper colors/typography: Deduct 10 points

2. **UX Clarity (0-25):**
   - < 5 elements: MAX 3 points
   - < 10 elements: MAX 8 points
   - No clear hierarchy: MAX 10 points
   - Missing navigation: Deduct 8 points

3. **Creativity (0-20):**
   - < 5 elements: MAX 2 points
   - < 10 elements: MAX 5 points
   - Just basic shapes: MAX 6 points
   - No innovation: MAX 8 points

4. **Accessibility (0-15):**
   - < 5 elements: MAX 2 points
   - < 10 elements: MAX 5 points
   - Poor contrast: Deduct 5 points

5. **Layout Balance (0-10):**
   - < 5 elements: MAX 1 point
   - < 10 elements: MAX 3 points
   - Poor spacing: Deduct 3 points

**EXPECTED TOTAL SCORES:**
- 0-5 elements: 10-15 points (FAIL)
- 5-10 elements: 15-25 points (POOR)
- 10-20 elements: 25-40 points (BASIC)
- 20-30 elements: 40-60 points (ACCEPTABLE)
- 30-50 elements: 60-80 points (GOOD)
- 50+ elements: 80-95 points (EXCELLENT)

**Response Format (JSON ONLY):**
```json
{{
  "aesthetics": <0-30>,
  "ux_clarity": <0-25>,
  "creativity": <0-20>,
  "accessibility": <0-15>,
  "balance": <0-10>,
  "feedback": {{
    "strengths": ["specific strength if any"],
    "improvements": ["critical improvement 1", "critical improvement 2", "critical improvement 3"],
    "overall": "HARSH critical assessment"
  }}
}}
```

BE EXTREMELY STRICT. This is a professional hiring test. Most designs should FAIL.
"""
        return prompt
    
    def _prepare_image_url(self, screenshot_base64: str) -> str:
        """Prepare image URL for GPT-4 Vision"""
        # If already has data URL prefix, return as is
        if screenshot_base64.startswith('data:image'):
            return screenshot_base64
        
        # Otherwise, add the prefix
        return f"data:image/jpeg;base64,{screenshot_base64}"
    
    def _apply_hard_caps(self, scores: Dict[str, Any], total_shapes: int) -> Dict[str, Any]:
        """
        Apply HARD CAPS on AI scores based on element count
        This overrides GPT-4's generous scoring to ensure accuracy
        """
        breakdown = scores.get("breakdown", {})
        
        # Define maximum scores based on element count
        if total_shapes < 5:
            # Very minimal design - FAIL
            max_aesthetics = 5
            max_ux_clarity = 3
            max_creativity = 2
            max_accessibility = 2
            max_balance = 1
            max_total = 15
        elif total_shapes < 10:
            # Incomplete design - POOR
            max_aesthetics = 10
            max_ux_clarity = 8
            max_creativity = 5
            max_accessibility = 5
            max_balance = 3
            max_total = 25
        elif total_shapes < 20:
            # Basic design - BASIC
            max_aesthetics = 15
            max_ux_clarity = 12
            max_creativity = 8
            max_accessibility = 7
            max_balance = 5
            max_total = 40
        elif total_shapes < 30:
            # Acceptable design
            max_aesthetics = 20
            max_ux_clarity = 18
            max_creativity = 12
            max_accessibility = 10
            max_balance = 7
            max_total = 60
        else:
            # Good design - no caps needed
            return scores
        
        # Apply caps to each category
        capped_breakdown = {
            "aesthetics": min(breakdown.get("aesthetics", 0), max_aesthetics),
            "ux_clarity": min(breakdown.get("ux_clarity", 0), max_ux_clarity),
            "creativity": min(breakdown.get("creativity", 0), max_creativity),
            "accessibility": min(breakdown.get("accessibility", 0), max_accessibility),
            "balance": min(breakdown.get("balance", 0), max_balance)
        }
        
        # Apply total cap as well
        capped_total = min(sum(capped_breakdown.values()), max_total)
        
        # If total exceeds cap, scale down proportionally
        if sum(capped_breakdown.values()) > max_total:
            scale_factor = max_total / sum(capped_breakdown.values())
            capped_breakdown = {
                k: v * scale_factor for k, v in capped_breakdown.items()
            }
        
        logger.info(f"🔒 Applied hard caps for {total_shapes} elements: {sum(capped_breakdown.values()):.1f}/100 (was {scores.get('total', 0):.1f})")
        
        return {
            "breakdown": capped_breakdown,
            "total": sum(capped_breakdown.values()),
            "feedback": scores.get("feedback", {}),
            "capped": True,
            "original_total": scores.get("total", 0)
        }
    
    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse AI response to extract scores"""
        try:
            # Try to extract JSON from response
            # Look for JSON block in markdown code fence
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            else:
                # Try to parse entire response as JSON
                json_str = response.strip()
            
            # Parse JSON
            data = json.loads(json_str)
            
            # Extract scores
            scores = {
                "aesthetics": float(data.get("aesthetics", 20)),
                "ux_clarity": float(data.get("ux_clarity", 15)),
                "creativity": float(data.get("creativity", 10)),
                "accessibility": float(data.get("accessibility", 10)),
                "balance": float(data.get("balance", 5))
            }
            
            # Extract feedback
            feedback = data.get("feedback", {})
            
            return {
                "breakdown": scores,
                "total": sum(scores.values()),
                "feedback": feedback
            }
            
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            logger.debug(f"Response was: {response}")
            
            # Return default scores if parsing fails
            return {
                "breakdown": {
                    "aesthetics": 20,
                    "ux_clarity": 15,
                    "creativity": 10,
                    "accessibility": 10,
                    "balance": 5
                },
                "total": 60,
                "feedback": {
                    "strengths": ["Design submitted"],
                    "improvements": ["Could not parse AI feedback"],
                    "overall": "Evaluation completed with default scores"
                }
            }
    
    def _fallback_evaluation(self, design_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback heuristic evaluation when AI is not available - STRICT"""
        logger.info("Using fallback heuristic evaluation")
        
        metrics = design_data.get("metrics", {})
        total_shapes = metrics.get("total_shapes", 0)
        page_count = metrics.get("page_count", 0)
        
        # VERY STRICT heuristic scoring based on completeness
        if total_shapes < 5:
            # Very incomplete - FAIL (10-15 points total)
            aesthetics = 3
            ux_clarity = 2
            creativity = 2
            accessibility = 2
            balance = 1
        elif total_shapes < 10:
            # Incomplete - POOR (15-25 points total)
            aesthetics = 8
            ux_clarity = 6
            creativity = 4
            accessibility = 4
            balance = 2
        elif total_shapes < 20:
            # Basic - needs work (25-40 points total)
            aesthetics = 13
            ux_clarity = 10
            creativity = 7
            accessibility = 6
            balance = 4
        elif total_shapes < 30:
            # Acceptable (40-60 points total)
            aesthetics = 18
            ux_clarity = 15
            creativity = 10
            accessibility = 9
            balance = 6
        elif total_shapes < 50:
            # Good (60-80 points total)
            aesthetics = 24
            ux_clarity = 20
            creativity = 15
            accessibility = 12
            balance = 8
        else:
            # Excellent (80-95 points total)
            aesthetics = 28
            ux_clarity = 23
            creativity = 18
            accessibility = 14
            balance = 9
        
        scores = {
            "aesthetics": aesthetics,
            "ux_clarity": ux_clarity,
            "creativity": creativity,
            "accessibility": accessibility,
            "balance": balance
        }
        
        total_score = sum(scores.values())
        
        # Generate feedback based on score
        if total_score < 20:
            feedback_msg = "Design is extremely incomplete. This is a FAIL. Add many more elements and structure to meet requirements."
        elif total_score < 30:
            feedback_msg = "Design is very incomplete. Add significantly more elements and structure."
        elif total_score < 50:
            feedback_msg = "Design is incomplete. Expand the design with more elements and better structure."
        elif total_score < 70:
            feedback_msg = "Design is basic but functional. Add more detail and refinement."
        else:
            feedback_msg = "Design is well-developed with good structure and detail."
        
        return {
            "scores": {
                "breakdown": scores,
                "total": total_score,
                "feedback": {
                    "strengths": ["Design submitted"] if total_shapes > 20 else [],
                    "improvements": [
                        f"Add many more design elements (currently only {total_shapes})" if total_shapes < 20 else "Refine existing elements",
                        "Improve visual hierarchy",
                        "Enhance color and typography",
                        "Add more interactive components"
                    ],
                    "overall": feedback_msg
                }
            },
            "raw_feedback": f"Heuristic evaluation: {total_shapes} elements, {page_count} pages - STRICT SCORING",
            "model": "heuristic",
            "success": False
        }


# Singleton instance
ai_evaluator = AIDesignEvaluator()
