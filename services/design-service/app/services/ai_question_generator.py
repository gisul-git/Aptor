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
    
    async def generate_topic_suggestions(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        experience_level: str,
        task_type: TaskType
    ) -> List[str]:
        """Generate 5 relevant topic suggestions based on role, difficulty, experience, and task type"""
        
        # Map enums to readable strings
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
            TaskType.LANDING_PAGE: "Landing Page",
            TaskType.MOBILE_APP: "Mobile App",
            TaskType.DASHBOARD: "Dashboard",
            TaskType.COMPONENT: "Component"
        }
        
        role_str = role_mapping.get(role, "UI Designer")
        difficulty_str = difficulty_mapping.get(difficulty, "Intermediate")
        task_str = task_type_mapping.get(task_type, "Dashboard")
        
        prompt = f"""You are an AI system that generates professional design challenge topics for hiring assessments.

Generate 5 relevant and realistic design challenge topics based on:

Role: {role_str}
Experience Level: {experience_level}
Difficulty: {difficulty_str}
Task Type: {task_str}

RULES:
• Topics must be realistic hiring tasks used in professional design interviews
• Keep topics short and specific (3-6 words maximum)
• Focus on real product scenarios and business domains
• Avoid generic names like "Modern Dashboard" or "Beautiful App"
• Use specific domains: fintech, healthcare, e-commerce, fitness, education, travel, food delivery, project management, analytics, social media, etc.
• Make topics appropriate for the difficulty level and experience

EXAMPLES OF GOOD TOPICS:
For Dashboard:
- Fitness tracking dashboard
- Crypto portfolio dashboard
- E-commerce sales analytics
- Project management dashboard
- Healthcare patient monitoring

For Landing Page:
- SaaS product landing page
- Fintech app landing page
- Online course platform landing
- Travel booking landing page
- Food delivery service landing

For Mobile App:
- Meditation and wellness app
- Expense tracking app
- Recipe discovery app
- Workout planning app
- Language learning app

For Component:
- Data visualization chart library
- Navigation menu system
- Form input components
- Card layout system
- Modal dialog system

Return ONLY a JSON array of 5 topic strings. No explanations, no markdown, just the JSON array.

Example format:
["Fitness tracking dashboard", "Crypto portfolio dashboard", "E-commerce analytics dashboard", "Healthcare patient dashboard", "Project management dashboard"]

Generate 5 topics now:"""
        
        try:
            if self.provider == "openai":
                response = await self._generate_with_openai(prompt)
            elif self.provider == "gemini":
                response = await self._generate_with_gemini(prompt)
            elif self.provider == "claude":
                response = await self._generate_with_claude(prompt)
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
            
            # Parse JSON response
            import json
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            
            topics = json.loads(response)
            
            # Validate we got a list of strings
            if not isinstance(topics, list) or len(topics) != 5:
                raise ValueError("AI did not return exactly 5 topics")
            
            return topics
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Topic suggestion generation failed: {error_msg}")
            
            # Return fallback topics based on task type
            fallback_topics = {
                TaskType.DASHBOARD: [
                    "Fitness tracking dashboard",
                    "E-commerce analytics dashboard",
                    "Project management dashboard",
                    "Healthcare patient dashboard",
                    "Financial portfolio dashboard"
                ],
                TaskType.LANDING_PAGE: [
                    "SaaS product landing page",
                    "Fintech app landing page",
                    "Online course platform landing",
                    "Travel booking landing page",
                    "Food delivery service landing"
                ],
                TaskType.MOBILE_APP: [
                    "Meditation and wellness app",
                    "Expense tracking app",
                    "Recipe discovery app",
                    "Workout planning app",
                    "Language learning app"
                ],
                TaskType.COMPONENT: [
                    "Data visualization chart library",
                    "Navigation menu system",
                    "Form input components",
                    "Card layout system",
                    "Modal dialog system"
                ]
            }
            
            return fallback_topics.get(task_type, fallback_topics[TaskType.DASHBOARD])
    
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
            TaskType.LANDING_PAGE: "Landing Page",
            TaskType.MOBILE_APP: "Mobile App",
            TaskType.DASHBOARD: "Dashboard",
            TaskType.COMPONENT: "Component"
        }
        
        role_str = role_mapping.get(role, "UI Designer")
        difficulty_str = difficulty_mapping.get(difficulty, "Intermediate")
        task_str = task_type_mapping.get(task_type, "Dashboard")
        topic_str = topic if topic else task_str
        experience_str = experience_level if experience_level else "1-3 years"
        time_limit = 45 if difficulty == DifficultyLevel.BEGINNER else 60 if difficulty == DifficultyLevel.INTERMEDIATE else 90
        
        base_prompt = f"""SYSTEM ROLE
Act as a professional Design Assessment Generator used in hiring platforms.

Generate structured UI/UX design challenges used in timed interviews.

The challenge must:
• Simulate real hiring assessments
• Include measurable design constraints
• Allow objective evaluation
• Scale difficulty based on experience and difficulty level

Use neutral professional language.

Avoid using: "You" "Your" "You should"

Use phrasing like: "The task is to design" "The interface should" "The layout must"

--------------------------------------------------

INPUT PARAMETERS

Role: {role_str}
Difficulty: {difficulty_str}
Experience Level: {experience_str}
Task Type: {task_str}
Topic: {topic_str}

--------------------------------------------------

DIFFICULTY STRUCTURE

Beginner
• Single screen layout
• Basic components

Intermediate
• Multi-section layout
• Dashboard or landing page
• Component hierarchy

Advanced
• Multiple screens
• Interaction states
• Complex flows

--------------------------------------------------

EXPERIENCE EXPECTATIONS

0-1 years
Focus on visual layout and hierarchy.

1-3 years
Focus on component design, data presentation, and UI clarity.

3-5 years
Focus on usability decisions and interaction design.

5+ years
Focus on product thinking and scalable design systems.

--------------------------------------------------

CONSTRAINT RULES

Constraints MUST be measurable.

Examples:

Canvas width: 1440px desktop layout
Grid system: 12 column grid
Spacing system: 8px baseline grid
Maximum colors: 4 primary colors
Minimum contrast ratio: 4.5:1
Minimum button height: 44px
Minimum card width: 200px

Avoid vague rules.

--------------------------------------------------

DELIVERABLE RULES

Deliverables must be concrete outputs.

Examples:

Visual Designer
• High fidelity mockups
• Icon set
• Color palette
• Typography scale

UI Designer
• UI screens
• Component states
• Style guide

UX Designer
• User flow
• Wireframes
• Interaction states

--------------------------------------------------

EVALUATION RULES

Each evaluation must include scoring weight.

Example:

Layout consistency — 20%
Visual hierarchy — 20%
Usability — 20%
Constraint compliance — 20%
Visual quality — 20%

--------------------------------------------------

OUTPUT FORMAT

Return ONLY JSON.

{{
    "title": "",
    "description": "",
    "constraints": [],
    "deliverables": [],
    "evaluation_criteria": [
        {{
            "criteria": "",
            "weight": ""
        }}
    ],
    "time_limit_minutes": {time_limit}
}}

--------------------------------------------------

CRITICAL INSTRUCTIONS:

1. The topic "{topic_str}" MUST be used as the main subject of the design challenge
2. The task type "{task_str}" MUST match the design output (dashboard generates dashboard, not landing page)
3. Use EXACT topic provided - do NOT change it to something generic
4. Description must reference the specific topic "{topic_str}"
5. Title format: "{topic_str} - {role_str} Challenge"
6. Do NOT use "you", "your", "you should"
7. Use neutral professional language
8. Include 6-8 measurable constraints
9. Constraints must enable automated evaluation
10. Return ONLY valid JSON

Generate ONE design challenge following all rules above. Return ONLY the JSON object."""
        
        return base_prompt.strip()
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        from openai import AsyncOpenAI
        
        # Debug: Log API key info
        api_key = settings.OPENAI_API_KEY
        logger.info(f"OpenAI API Key length: {len(api_key)}")
        logger.info(f"OpenAI API Key first 20 chars: {api_key[:20]}")
        logger.info(f"OpenAI API Key last 10 chars: {api_key[-10:]}")
        
        client = AsyncOpenAI(api_key=api_key)
        
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
