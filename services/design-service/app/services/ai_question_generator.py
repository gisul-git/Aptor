"""
AI Design Question Generator Service
Generates role-based design challenges using AI providers
"""

import logging
from typing import Dict, Any, List
from app.models.design import DesignRole, DifficultyLevel, TaskType, DesignQuestionModel
from app.core.config import settings
import openai
import google.generativeai as genai
from anthropic import Anthropic

logger = logging.getLogger(__name__)


class AIQuestionGenerator:
    """AI-powered design question generator"""
    
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self._setup_ai_client()
    
    def _setup_ai_client(self):
        """Setup AI client based on provider"""
        if self.provider == "openai":
            openai.api_key = settings.OPENAI_API_KEY
        elif self.provider == "gemini":
            genai.configure(api_key=settings.GEMINI_API_KEY)
        elif self.provider == "claude":
            self.anthropic_client = Anthropic(api_key=settings.CLAUDE_API_KEY)
    
    async def generate_question(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str = None,
        experience_level: str = None,
        created_by: str = "system"
    ) -> DesignQuestionModel:
        """Generate a design question using AI"""
        
        prompt = self._build_generation_prompt(role, difficulty, task_type, topic, experience_level)
        
        try:
            if self.provider == "openai":
                response = await self._generate_with_openai(prompt)
            elif self.provider == "gemini":
                response = await self._generate_with_gemini(prompt)
            elif self.provider == "claude":
                response = await self._generate_with_claude(prompt)
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
            
            return self._parse_ai_response(response, role, difficulty, task_type, created_by, topic, experience_level)
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"AI question generation failed: {error_msg}")
            
            # Check for specific API key errors
            if "401" in error_msg or "Unauthorized" in error_msg or "invalid_api_key" in error_msg:
                raise ValueError(
                    f"AI question generation failed: Invalid or expired API key for {self.provider}. "
                    f"Please update the {self.provider.upper()}_API_KEY in your .env file. "
                    f"Get a valid API key from: "
                    f"{'https://platform.openai.com/api-keys' if self.provider == 'openai' else 'the provider website'}"
                )
            elif "429" in error_msg or "rate_limit" in error_msg:
                raise ValueError(
                    f"AI question generation failed: Rate limit exceeded for {self.provider}. "
                    f"Please try again later or upgrade your API plan."
                )
            elif "quota" in error_msg.lower() or "insufficient" in error_msg.lower():
                raise ValueError(
                    f"AI question generation failed: API quota exceeded for {self.provider}. "
                    f"Please check your billing and usage limits."
                )
            else:
                raise ValueError(
                    f"AI question generation failed: {error_msg}. "
                    f"Please check your {self.provider.upper()} API configuration."
                )
    
    def _build_generation_prompt(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str = None,
        experience_level: str = None
    ) -> str:
        """Build the AI generation prompt using professional design assessment framework"""
        
        # Map internal enums to prompt format
        role_mapping = {
            DesignRole.UI_DESIGNER: "UI Designer",
            DesignRole.UX_DESIGNER: "UX Designer",
            DesignRole.PRODUCT_DESIGNER: "Product Designer",
            DesignRole.VISUAL_DESIGNER: "Visual Designer"
        }
        
        difficulty_mapping = {
            DifficultyLevel.BEGINNER: "Beginner",
            DifficultyLevel.INTERMEDIATE: "Intermediate",
            DifficultyLevel.ADVANCED: "Advanced"
        }
        
        task_type_mapping = {
            TaskType.LANDING_PAGE: "landing_page",
            TaskType.MOBILE_APP: "mobile_app",
            TaskType.DASHBOARD: "dashboard",
            TaskType.COMPONENT: "component"
        }
        
        role_str = role_mapping.get(role, "UI Designer")
        difficulty_str = difficulty_mapping.get(difficulty, "Intermediate")
        task_str = task_type_mapping.get(task_type, "landing_page")
        topic_str = topic if topic else task_str
        experience_str = experience_level if experience_level else "Not specified"
        time_limit = 45 if difficulty == DifficultyLevel.BEGINNER else 60 if difficulty == DifficultyLevel.INTERMEDIATE else 90
        
        base_prompt = f"""SYSTEM ROLE
Act as a Design Assessment Question Generator for a professional hiring platform.
Generate structured design challenges used in automated design interviews.
The challenge must be suitable for timed assessments and must support automated evaluation of layout, spacing, typography hierarchy, and color usage.
Use professional and neutral language. Avoid conversational phrases such as "you should", "try to", or "think about".

--------------------------------------------------
INPUT PARAMETERS
Role: {role_str}
Difficulty Level: {difficulty_str}
Experience Level: {experience_str}
Topic: {topic_str}
Time Limit: {time_limit} minutes

--------------------------------------------------
ROLE-SPECIFIC TASK GENERATION

UI Designer
Focus on layout design, component design, typography hierarchy, spacing systems, and visual hierarchy.

UX Designer
Focus on user flows, navigation patterns, information architecture, usability improvements, and interaction logic.

Product Designer
Focus on product workflows, business goals, user personas, and product strategy.

Visual Designer
Focus on visual identity, iconography, illustration systems, and visual storytelling.

Brand Designer
Focus on brand identity, logo systems, typography systems, and brand guidelines.

Graphic Designer
Focus on posters, marketing assets, social media creatives, and print layouts.

Interaction Designer
Focus on micro-interactions, transitions, motion states, and interaction feedback.

--------------------------------------------------
DIFFICULTY SCALING

Beginner
- Single screen or simple asset
- Basic layout constraints
- Simple user goal

Intermediate
- Multi-section layout or dashboard
- Component-based design
- Structured hierarchy

Advanced
- Multi-screen workflows
- Interaction states
- Edge case handling

Expert
- Product-level thinking
- Personas and business objectives
- System-level design
- Strategic decision making

--------------------------------------------------
CONSTRAINT RULES
Constraints must include measurable design rules.

Examples:
- Canvas width: 375px mobile layout
- Canvas width: 1440px desktop layout
- Grid system: 12-column grid
- Spacing system: 8px baseline grid
- Maximum 3-4 primary colors
- Minimum contrast ratio: 4.5:1
- Typography hierarchy: minimum 3 levels
- Minimum button height: 44px
- Component width constraints

These rules must enable automated evaluation.

--------------------------------------------------
OUTPUT FORMAT

Title:
Domain or Product - Role Challenge

Role:
Role name

Level:
Difficulty Level

Experience:
Experience Level

Topic:
Topic name

Time:
Time Limit

Design Challenge
Provide a concise description including:
- product or domain context
- design problem
- target users
- expected outcome

Constraints
List 6-8 measurable constraints.

Deliverables
Specify required outputs such as:
- wireframes
- high fidelity screens
- design assets
- component specifications
- design tokens or style guide

Evaluation Criteria
Define scoring factors such as:
- layout consistency
- visual hierarchy
- usability
- constraint compliance
- clarity of design solution

--------------------------------------------------
Return ONLY valid JSON in this exact structure:

{{
    "title": "{topic_str} - {role_str} Challenge",
    "description": "Provide a concise description including product or domain context, design problem, target users, and expected outcome. Write in neutral professional language. Do NOT use 'you', 'your', 'you should'. Use phrases like: 'Design a [product]', 'The interface should', 'The goal is to', 'The layout must'.",
    "constraints": [
        "List 6-8 measurable constraints based on difficulty level.",
        "Examples:",
        "- Canvas width: 375px mobile layout OR 1440px desktop layout",
        "- Grid system: 12-column grid",
        "- Spacing system: 8px baseline grid",
        "- Maximum 3-4 primary colors",
        "- Minimum contrast ratio: 4.5:1",
        "- Typography hierarchy: minimum 3 levels",
        "- Minimum button height: 44px",
        "- Component width constraints"
    ],
    "deliverables": [
        "Specify required outputs based on role and difficulty:",
        "For UI Designer: High-fidelity UI screens, Component specifications, Typography and color style guide",
        "For UX Designer: User flow diagrams, Wireframes, Information architecture",
        "For Visual Designer: Visual design mockups, Icon set or illustrations, Style guide",
        "Beginner: 2-3 deliverables",
        "Intermediate: 3-4 deliverables",
        "Advanced: 4-5 deliverables"
    ],
    "evaluation_criteria": [
        "Define scoring factors such as:",
        "- Layout consistency",
        "- Visual hierarchy",
        "- Usability",
        "- Constraint compliance",
        "- Clarity of design solution",
        "Role-specific criteria:",
        "- UI Designer: Pixel-perfect execution, grid implementation",
        "- UX Designer: User flow completeness, navigation clarity",
        "- Visual Designer: Creative execution, visual aesthetics",
        "- Product Designer: Strategic thinking, business alignment"
    ],
    "time_limit_minutes": {time_limit}
}}

--------------------------------------------------
CRITICAL REMINDERS

1. Do NOT use "you", "your", "you should", "you need to"
2. Use neutral professional language
3. Include measurable constraints for automated evaluation
4. Vary complexity based on difficulty level
5. Ensure role-specific focus
6. Make the challenge specific to the topic "{topic_str}"
7. Return ONLY valid JSON

Now generate ONE design challenge following all rules above. Return ONLY the JSON object."""
        
        return base_prompt.strip()
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "Act as a Design Assessment Question Generator for a professional hiring platform. Generate structured UI/UX design challenges used in automated design interviews. CRITICAL: Use ONLY neutral professional language - NEVER use 'you', 'your', 'you should', 'you need to', 'you must', or 'you will'. Use neutral instructional tone with phrases like: 'The design task', 'The interface should', 'The goal is to', 'The challenge involves', 'Design a [product]', 'The layout should'. Include measurable constraints (dimensions, spacing, colors, contrast ratios) that enable automated evaluation. Vary complexity based on difficulty level. Provide clear product context and user personas. Return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2500,
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content
    
    async def _generate_with_gemini(self, prompt: str) -> str:
        """Generate using Gemini"""
        model = genai.GenerativeModel('gemini-pro')
        response = await model.generate_content_async(prompt)
        return response.text
    
    async def _generate_with_claude(self, prompt: str) -> str:
        """Generate using Claude"""
        response = await self.anthropic_client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    
    def _limit_constraints(self, constraints: list, difficulty: DifficultyLevel) -> list:
        """Limit number of constraints based on difficulty level"""
        if not constraints:
            return constraints
        
        # Define max constraints for each difficulty
        max_constraints = {
            DifficultyLevel.BEGINNER: 6,
            DifficultyLevel.INTERMEDIATE: 8,
            DifficultyLevel.ADVANCED: 10
        }
        
        max_count = max_constraints.get(difficulty, 8)
        
        # If we have too many constraints, keep the most important ones
        if len(constraints) > max_count:
            # Always keep canvas width if present
            canvas_constraint = None
            other_constraints = []
            
            for c in constraints:
                if isinstance(c, str) and "canvas width" in c.lower():
                    canvas_constraint = c
                else:
                    other_constraints.append(c)
            
            # Keep canvas + (max_count - 1) other constraints
            result = []
            if canvas_constraint:
                result.append(canvas_constraint)
                result.extend(other_constraints[:max_count - 1])
            else:
                result = constraints[:max_count]
            
            return result
        
        return constraints
    
    def _fix_canvas_width(self, constraints: list, task_type: TaskType) -> list:
        """Fix canvas width based on task_type if AI generated wrong width"""
        if not constraints:
            return constraints
        
        # Define correct canvas widths for each task type
        correct_widths = {
            TaskType.MOBILE_APP: "Canvas width: 375px mobile layout",
            TaskType.DASHBOARD: "Canvas width: 1440px desktop layout",
            TaskType.LANDING_PAGE: "Canvas width: 1440px desktop layout",
            TaskType.COMPONENT: "Canvas width: 1440px desktop layout"
        }
        
        correct_width = correct_widths.get(task_type)
        if not correct_width:
            return constraints
        
        # Find and replace canvas width constraint
        fixed_constraints = []
        canvas_found = False
        
        for constraint in constraints:
            if isinstance(constraint, str) and "canvas width" in constraint.lower():
                fixed_constraints.append(correct_width)
                canvas_found = True
            else:
                fixed_constraints.append(constraint)
        
        # If no canvas width found, add it at the beginning
        if not canvas_found:
            fixed_constraints.insert(0, correct_width)
        
        return fixed_constraints
    
    def _neutralize_language(self, text: str) -> str:
        """Convert 'you/your' language to neutral professional language"""
        import re
        
        if not text:
            return text
        
        # Define replacement patterns (order matters - more specific first)
        replacements = [
            # Specific phrases
            (r'\bYou are tasked with designing\b', 'The task involves designing'),
            (r'\bYou are designing\b', 'The design task involves'),
            (r'\bYou are creating\b', 'The task is to create'),
            (r'\bYou are building\b', 'The task is to build'),
            (r'\bYou are developing\b', 'The task is to develop'),
            (r'\bYou need to design\b', 'The design must'),
            (r'\bYou need to create\b', 'The task requires creating'),
            (r'\bYou should design\b', 'The design should'),
            (r'\bYou should create\b', 'The designer should create'),
            (r'\bYou must design\b', 'The design must'),
            (r'\bYou must create\b', 'The task requires creating'),
            (r'\bYou will design\b', 'The design will'),
            (r'\bYou will create\b', 'The task involves creating'),
            
            # Your + noun patterns
            (r'\bYour task is to\b', 'The task is to'),
            (r'\bYour goal is to\b', 'The goal is to'),
            (r'\bYour objective is to\b', 'The objective is to'),
            (r'\bYour task\b', 'The task'),
            (r'\bYour goal\b', 'The goal'),
            (r'\bYour objective\b', 'The objective'),
            (r'\bYour design\b', 'The design'),
            (r'\bYour solution\b', 'The solution'),
            (r'\bYour work\b', 'The work'),
            (r'\bYour focus\b', 'The focus'),
            (r'\bYour approach\b', 'The approach'),
            
            # Generic you patterns (more general, so later in the list)
            (r'\bYou can\b', 'The designer can'),
            (r'\bYou may\b', 'The designer may'),
            (r'\bYou could\b', 'The designer could'),
            (r'\bYou might\b', 'The designer might'),
        ]
        
        # Apply all replacements
        result = text
        for pattern, replacement in replacements:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
        
        return result
    
    def _parse_ai_response(
        self,
        response: str,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        created_by: str,
        topic: str = None,
        experience_level: str = None
    ) -> DesignQuestionModel:
        """Parse AI response into DesignQuestionModel"""
        
        try:
            import json
            # Extract JSON from response (handle potential markdown formatting)
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            
            data = json.loads(response)
            
            # Apply neutral language post-processing to description
            description = self._neutralize_language(data.get("description", ""))
            
            # Also apply to constraints, deliverables, and evaluation criteria if they contain text
            constraints = [self._neutralize_language(c) if isinstance(c, str) else c for c in data.get("constraints", [])]
            
            # Fix canvas width based on task_type
            constraints = self._fix_canvas_width(constraints, task_type)
            
            # Limit constraints based on difficulty
            constraints = self._limit_constraints(constraints, difficulty)
            
            deliverables = [self._neutralize_language(d) if isinstance(d, str) else d for d in data.get("deliverables", [])]
            evaluation_criteria = [self._neutralize_language(e) if isinstance(e, str) else e for e in data.get("evaluation_criteria", [])]
            
            return DesignQuestionModel(
                role=role,
                difficulty=difficulty,
                experience_level=experience_level,
                task_type=task_type,
                title=data["title"],
                description=description,
                constraints=constraints,
                deliverables=deliverables,
                evaluation_criteria=evaluation_criteria,
                time_limit_minutes=data.get("time_limit_minutes", 60),
                created_by=created_by
            )
            
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            raise ValueError(f"Failed to parse AI response into question format: {e}")


# Singleton instance
ai_question_generator = AIQuestionGenerator()
