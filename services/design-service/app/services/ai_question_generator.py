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
        """Generate 5 relevant topic suggestions with MIXED task types based on role, difficulty, and experience"""
        
        # Map enums to readable strings
        role_mapping = {
            DesignRole.UI_DESIGNER: "UI Designer",
            DesignRole.UX_DESIGNER: "UX Designer",
            DesignRole.PRODUCT_DESIGNER: "Product Designer",
            DesignRole.VISUAL_DESIGNER: "Visual Designer",
            DesignRole.INTERACTION_DESIGNER: "Interaction Designer"
        }
        
        difficulty_mapping = {
            DifficultyLevel.BEGINNER: "Beginner",
            DifficultyLevel.INTERMEDIATE: "Intermediate",
            DifficultyLevel.ADVANCED: "Advanced"
        }
        
        role_str = role_mapping.get(role, "UI Designer")
        difficulty_str = difficulty_mapping.get(difficulty, "Intermediate")
        
        prompt = f"""You are an AI system that generates professional design challenge topics for hiring assessments.

Generate 5 DIVERSE design challenge topics based on:

Role: {role_str}
Experience Level: {experience_level}
Difficulty: {difficulty_str}

CRITICAL RULES:
• Generate topics across DIFFERENT types: mobile UI, dashboard design, onboarding flow, wireframes, design systems, landing pages, components, etc.
• DO NOT generate all topics for the same type
• Mix it up based on the role:
  - UI Designer: mobile UI, dashboard, components, design systems, web interfaces
  - UX Designer: onboarding flow, user research, wireframes, accessibility, user journeys
  - Product Designer: product strategy, user flows, prototypes, dashboards, end-to-end experiences
  - Visual Designer: visual design, illustrations, graphics, layouts, brand visuals
  - Interaction Designer: micro-interactions, animations, prototypes, user flows, interactive elements
• Topics must be realistic hiring tasks used in professional design interviews
• Keep topics short and specific (3-6 words maximum)
• Focus on real product scenarios and business domains
• Avoid generic names like "Modern Dashboard" or "Beautiful App"
• Use specific domains: fintech, healthcare, e-commerce, fitness, education, travel, food delivery, project management, analytics, social media, etc.
• Make topics appropriate for the difficulty level and experience

EXAMPLES OF GOOD DIVERSE TOPICS BY ROLE:

UI Designer:
["Fitness tracking dashboard", "Recipe discovery mobile app", "E-commerce checkout flow", "Design system components", "Banking app interface"]

UX Designer:
["Healthcare onboarding flow", "User research for fintech", "Accessibility audit wireframes", "Travel booking user journey", "Dashboard information architecture"]

Interaction Designer:
["E-commerce micro-interactions", "Healthcare app animations", "Travel app user flows", "Fintech onboarding prototype", "Social media interaction design"]

RESPONSE FORMAT:
Return ONLY a valid JSON array of exactly 5 strings. No explanations, no markdown code blocks, no extra text.
Just the raw JSON array like this:
["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]

Generate 5 DIVERSE topics for {role_str} now:"""
        
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
            
            # Log the raw response for debugging
            logger.info(f"AI raw response: {response[:200]}...")
            
            # Remove markdown code blocks if present
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            response = response.strip()
            
            # Try to parse JSON
            try:
                parsed = json.loads(response)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}")
                logger.error(f"Response content: {response}")
                raise ValueError(f"Failed to parse AI response as JSON: {e}")
            
            # Handle both array and object responses
            if isinstance(parsed, list):
                topics = parsed
            elif isinstance(parsed, dict):
                # Try to extract array from common keys
                for key in ['topics', 'suggestions', 'recommendations', 'items', 'data']:
                    if key in parsed and isinstance(parsed[key], list):
                        topics = parsed[key]
                        logger.info(f"Extracted topics from key '{key}'")
                        break
                else:
                    # If no known key found, try to get the first list value
                    for value in parsed.values():
                        if isinstance(value, list):
                            topics = value
                            logger.info(f"Extracted topics from first list value")
                            break
                    else:
                        logger.error(f"AI returned dict without list: {parsed}")
                        raise ValueError(f"AI returned dict without a list of topics")
            else:
                logger.error(f"AI returned unexpected type: {type(parsed)}")
                raise ValueError(f"AI returned {type(parsed).__name__} instead of list or dict")
            
            # If we got fewer or more than 5, log warning but continue
            if len(topics) != 5:
                logger.warning(f"AI returned {len(topics)} topics instead of 5")
                # Trim or pad to 5
                if len(topics) > 5:
                    topics = topics[:5]
                elif len(topics) < 5:
                    # Pad with fallback topics
                    fallback = [
                        "Fitness tracking dashboard",
                        "E-commerce analytics dashboard",
                        "Healthcare patient dashboard",
                        "Financial portfolio dashboard",
                        "Project management dashboard"
                    ]
                    while len(topics) < 5:
                        topics.append(fallback[len(topics)])
            
            logger.info(f"Successfully parsed {len(topics)} topics: {topics}")
            return topics
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Topic suggestion generation failed: {error_msg}")
            
            # Return fallback DIVERSE topics based on experience level
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

Use neutral professional language. Avoid using: "You" "Your" "You should"

Use phrasing like: "The task is to design" "The interface should" "The layout must" "The goal is to"

--------------------------------------------------

INPUT PARAMETERS

Role: {role_str}
Difficulty: {difficulty_str}
Experience Level: {experience_str}
Task Type: {task_str}
Topic: {topic_str}

--------------------------------------------------

TASK TYPE ENFORCEMENT (CRITICAL)

The generated design challenge MUST strictly follow the selected topic and task type.

DO NOT change the interface type. DO NOT reinterpret the topic.

INTERFACE TYPE MAPPING:

If topic contains "prototype" OR "app" OR "mobile":
→ Generate mobile app (Canvas: 375px, Grid: 8-column)
→ Multi-screen flow (5-8 screens for Advanced)

If topic contains "dashboard" OR "analytics" OR "admin":
→ Generate desktop dashboard (Canvas: 1440px, Grid: 12-column)
→ Data visualization interface

If topic contains "landing" OR "website" OR "marketing":
→ Generate landing page (Canvas: 1440px, Grid: 12-column)
→ Marketing web page

If topic contains "component" OR "library" OR "system":
→ Generate component design (Canvas: 1440px, Grid: 12-column)
→ UI component or design system

If topic contains "flow" OR "journey" OR "onboarding":
→ Generate user flow (Canvas: 375px mobile, Grid: 8-column)
→ Multi-step UX workflow

If topic contains "booking" OR "checkout" OR "purchase":
→ Generate mobile flow (Canvas: 375px, Grid: 8-column)
→ Transaction flow

CRITICAL RULES:
• If user selected "Travel booking prototype" → Generate MOBILE APP, NOT dashboard
• If user selected "Healthcare dashboard" → Generate DESKTOP DASHBOARD, NOT mobile
• If user selected "E-commerce landing page" → Generate LANDING PAGE, NOT app
• NEVER change the interface type from what the topic implies
• Canvas width MUST match the interface type (375px mobile OR 1440px desktop)

--------------------------------------------------

CRITICAL DIFFICULTY RULES

BEGINNER DIFFICULTY MUST:
• Focus on a SINGLE screen or simple 2-screen interface
• NO personas, NO user research, NO journey maps, NO strategy documents
• NO business metrics or KPIs
• Limit deliverables to 2-3 items ONLY
• Focus on: layout, visual hierarchy, basic usability
• Constraints: 6 constraints ONLY
• Description: 3-4 sentences maximum, focus on the design task

INTERMEDIATE DIFFICULTY MUST:
• Focus on 3-5 connected screens OR a dashboard with multiple sections
• May include basic user flows (simple diagrams)
• NO deep research, NO personas, NO strategy
• Limit deliverables to 3-4 items
• Focus on: component design, interaction states, usability
• Constraints: 8 constraints
• Description: 4-5 sentences, include user context and goals

ADVANCED DIFFICULTY MUST:
• Focus on 5-8 screens with complex interactions
• May include user flows, interaction specifications
• May include light personas (1 persona max)
• Limit deliverables to 4-5 items
• Focus on: system thinking, scalability, advanced interactions
• Constraints: 10 constraints
• Description: 5-6 sentences, include user context, business goals, success criteria

--------------------------------------------------

ROLE-SPECIFIC TASK ALIGNMENT

UI Designer:
• Beginner: Single screen UI (home screen, dashboard view, profile page)
• Intermediate: Multi-section interface (dashboard, settings flow, component library)
• Advanced: Complete UI system (multi-screen app, design system, responsive layouts)

UX Designer:
• Beginner: Simple wireframe (single screen wireframe, basic user flow)
• Intermediate: User flow with wireframes (3-5 screen flow, interaction specs)
• Advanced: Complete UX system (user journey, multiple flows, accessibility specs)

Product Designer:
• Beginner: Simple product feature screen (single feature interface, basic product screen)
• Intermediate: Feature workflow (3-5 screen feature flow, basic user journey)
• Advanced: Product system (end-to-end product flow, feature prioritization, metrics)

Visual Designer:
• Beginner: Single visual design (hero section, landing section, visual mockup)
• Intermediate: Visual system (multiple sections, visual style guide, icon set)
• Advanced: Complete visual identity (full page designs, custom illustrations, brand visuals)

Interaction Designer:
• Beginner: Simple interaction (button states, hover effects, basic animation)
• Intermediate: Interaction flow (micro-interactions, transition specs, animated prototype)
• Advanced: Complex interaction system (gesture controls, advanced animations, interaction patterns)

--------------------------------------------------

DESCRIPTION REQUIREMENTS BY DIFFICULTY

BEGINNER (3-4 sentences):
1. What to design (the interface/screen)
2. Target user (age, basic context)
3. Main goal (what the design should achieve)
4. Keep it simple and focused on the design task

INTERMEDIATE (4-5 sentences):
1. What to design (the interface/feature)
2. Target user (age, profession, context)
3. User needs (2-3 key needs)
4. Main goal (what the design should achieve)
5. Expected outcome (simple metric or goal)

ADVANCED (6-8 sentences):
1. Product/service context (what is it, why it exists)
2. Target user persona (detailed: age, profession, behavior, pain points)
3. Business goals (what the company wants to achieve)
4. User needs and pain points (3-4 specific needs)
5. Key features or functionality required
6. Expected outcome with metrics (e.g., "increase engagement by 30%")
7. Success criteria (how to measure success)
8. Additional context (market, competitors, constraints)

--------------------------------------------------

CONSTRAINT RULES

ALL constraints MUST be measurable and align with evaluation engine.

REQUIRED constraints (all levels):
• Canvas width: 375px mobile OR 1440px desktop (based on task type)
• Grid system: 8-column (mobile) OR 12-column (desktop)
• Spacing system: 8px baseline grid (ALWAYS use 8px, not 4px)
• Maximum primary colors: 3-4 colors
• Minimum contrast ratio: 4.5:1
• Minimum button/touch target height: 44px

BEGINNER (6 constraints total):
Use ONLY the 6 required constraints above. NO additional constraints.

INTERMEDIATE (8 constraints total):
Required 6 + Choose 2 from:
• Typography hierarchy: minimum 3 levels
• Border radius: consistent rounding (8px or 16px)
• Icon size: 20px or 24px
• Component spacing: consistent padding (8px, 16px, 24px)

ADVANCED (10 constraints total):
Required 6 + Choose 4 from:
• Typography hierarchy: minimum 4 levels
• Shadow system: 3 elevation levels
• Animation timing: 200-300ms transitions
• Responsive breakpoints: mobile, tablet, desktop
• Accessibility: WCAG AA compliance
• Loading states: skeleton screens or spinners

--------------------------------------------------

DELIVERABLE RULES BY DIFFICULTY

BEGINNER (2-3 deliverables ONLY):

UI Designer:
• 1-2 high-fidelity screens
• Component list (buttons, cards, inputs used)

UX Designer:
• 1-2 wireframe screens
• Simple user flow diagram (optional)

Product Designer:
• 1-2 product feature screens
• Component list

Visual Designer:
• 1-2 visual design mockups
• Color palette

Interaction Designer:
• 1-2 screens with interaction states
• Interaction specification (hover, active, disabled)

INTERMEDIATE (3-4 deliverables):

UI Designer:
• 3-5 high-fidelity screens
• Component library
• Style guide
• Responsive layouts (optional)

UX Designer:
• 3-5 wireframe screens
• User flow diagram
• Interaction specifications
• Basic usability notes (optional)

Product Designer:
• 3-5 product screens
• User flow diagram
• Feature specifications
• Success metrics (optional)

Visual Designer:
• 3-5 visual mockups
• Visual style guide
• Icon set
• Custom visual assets (optional)

Interaction Designer:
• 3-5 screens with interactions
• Micro-interaction specifications
• Animation timing guide
• Interactive prototype (optional)

ADVANCED (4-5 deliverables):

UI Designer:
• 5-8 high-fidelity screens
• Complete design system
• Responsive layouts
• Component documentation
• Accessibility specifications (optional)

UX Designer:
• 5-8 wireframe screens
• Complete user flow
• Interaction specifications
• Light persona (1 persona)
• Usability test plan (optional)

Product Designer:
• 5-8 high-fidelity product screens
• Complete user journey flow
• Feature prioritization list
• Brief explanation of product decisions
• NO product strategy documents
• NO success metrics definition (that's Expert level)

Visual Designer:
• 5-8 visual mockups
• Complete visual system
• Custom illustrations
• Brand guidelines
• Visual specifications (optional)

Interaction Designer:
• 5-8 screens with interactions
• Complete interaction system
• Advanced animation specs
• Gesture/input specifications
• Interaction patterns library (optional)

--------------------------------------------------

EVALUATION CRITERIA

MUST include exactly 5 criteria with weights totaling 100%.

ROLE-SPECIFIC EVALUATION:

UI Designer:
• Layout consistency — 20%
• Visual hierarchy — 20%
• Component quality — 20%
• Constraint compliance — 20%
• Visual quality — 20%

UX Designer:
• Layout consistency — 20%
• Navigation clarity — 20%
• Usability — 20%
• Constraint compliance — 20%
• User flow quality — 20%

Product Designer:
• Layout consistency — 20%
• Visual hierarchy — 20%
• User flow clarity — 20%
• Constraint compliance — 20%
• Product thinking — 20%

Visual Designer:
• Layout consistency — 20%
• Visual hierarchy — 20%
• Visual creativity — 20%
• Constraint compliance — 20%
• Brand consistency — 20%

Interaction Designer:
• Layout consistency — 20%
• Visual hierarchy — 20%
• Interaction quality — 20%
• Constraint compliance — 20%
• Animation smoothness — 20%

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

1. Topic "{topic_str}" MUST be the main subject - DO NOT CHANGE IT
2. Task type "{task_str}" MUST match the output - DO NOT CHANGE IT
3. STRICTLY enforce interface type based on topic keywords:
   - "prototype"/"app"/"mobile" → 375px mobile, 8-column grid
   - "dashboard"/"analytics" → 1440px desktop, 12-column grid
   - "landing"/"website" → 1440px desktop, 12-column grid
   - "flow"/"journey"/"booking" → 375px mobile, 8-column grid
4. STRICTLY follow difficulty rules:
   - Beginner: 2-3 deliverables, 6 constraints, 3-4 sentence description, NO personas/research
   - Intermediate: 3-4 deliverables, 8 constraints, 4-5 sentence description
   - Advanced: 4-5 deliverables, 10 constraints, 6-8 sentence DETAILED description with full context
5. STRICTLY follow role-specific task alignment
6. STRICTLY follow role-specific evaluation criteria
7. Title format: "{topic_str} - {role_str} Challenge"
8. Do NOT use "you", "your", "you should"
9. Constraints MUST be measurable
10. ALWAYS use 8px baseline grid (NOT 4px)
11. Deliverables MUST match role and difficulty
12. For Advanced: Description MUST be 6-8 sentences with complete product context, user persona, business goals, pain points, features, metrics, and success criteria
13. Canvas width MUST match interface type (375px for mobile, 1440px for desktop)
14. Return ONLY valid JSON

Generate ONE design challenge following ALL rules above. Return ONLY the JSON object."""
        
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
        
        # Check if this is a topic suggestion request (shorter prompt)
        is_topic_suggestion = "Generate 5 DIVERSE design challenge topics" in prompt
        
        if is_topic_suggestion:
            # For topic suggestions, use simpler system message and don't force JSON object
            response = await client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a design assessment topic generator. Return ONLY a JSON array of topic strings, nothing else."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
        else:
            # For full question generation, use structured JSON object
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
            
            # Handle evaluation criteria - can be strings or objects with criteria/weight
            raw_criteria = data.get("evaluation_criteria", [])
            evaluation_criteria = []
            for e in raw_criteria:
                if isinstance(e, str):
                    evaluation_criteria.append(self._neutralize_language(e))
                elif isinstance(e, dict):
                    # Convert {"criteria": "...", "weight": "..."} to "criteria - weight"
                    criteria_text = e.get("criteria", "")
                    weight = e.get("weight", "")
                    if criteria_text and weight:
                        evaluation_criteria.append(f"{self._neutralize_language(criteria_text)} - {weight}")
                    elif criteria_text:
                        evaluation_criteria.append(self._neutralize_language(criteria_text))
                else:
                    evaluation_criteria.append(str(e))
            
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
