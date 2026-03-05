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
            logger.error(f"AI question generation failed: {e}")
            # Fallback to template-based generation
            return self._generate_fallback_question(role, difficulty, task_type, topic, created_by, experience_level)
    
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
            DifficultyLevel.BEGINNER: "Easy",
            DifficultyLevel.INTERMEDIATE: "Medium",
            DifficultyLevel.ADVANCED: "High"
        }
        
        task_type_mapping = {
            TaskType.LANDING_PAGE: "landing page design",
            TaskType.MOBILE_APP: "mobile app design",
            TaskType.DASHBOARD: "dashboard design",
            TaskType.COMPONENT: "component design"
        }
        
        role_str = role_mapping.get(role, "UI Designer")
        difficulty_str = difficulty_mapping.get(difficulty, "Medium")
        task_str = task_type_mapping.get(task_type, "UI design")
        topic_str = topic if topic else task_str
        experience_str = experience_level if experience_level else "Not specified"
        
        base_prompt = f"""You are writing a professional design challenge brief for a hiring assessment. Write clearly and professionally, providing context and specific requirements.

--------------------------------------------------
### PROJECT DETAILS

Role: {role_str}
Difficulty: {difficulty_str}
Topic: {topic_str}
Time: {45 if difficulty == DifficultyLevel.BEGINNER else 60 if difficulty == DifficultyLevel.INTERMEDIATE else 90} minutes
Experience: {experience_str}

--------------------------------------------------
### WRITING STYLE RULES

Write professionally but clearly. Provide context about:
- What the product/project is
- Who the users are
- What problem needs to be solved
- What the designer needs to create

Be specific and detailed. Explain the scenario clearly so candidates understand the real-world context.

--------------------------------------------------
### SCOPE BY DIFFICULTY

**Easy**: One screen or simple task. Focus on basics.
**Medium**: A few connected screens or one complete feature. 
**High**: Full user journey with multiple screens.

--------------------------------------------------
### OUTPUT FORMAT (JSON)

{{
    "title": "Format: '[Topic] - [Role] Challenge' (e.g., 'BSFI Dashboard - UX Designer Challenge')",
    "description": "Write 250-400 words in this structure:
        
        Paragraph 1: Set the context
        - What is the product/platform?
        - Who are the users (be specific about roles/personas)?
        - What is the current situation or problem?
        
        Paragraph 2: Define the task
        - What should the designer create?
        - What are the main goals or objectives?
        - What should they focus on?
        
        Paragraph 3: Additional considerations
        - Mention user types or scenarios to consider
        - Any specific requirements or focus areas
        
        Use clear, professional language. Be specific about the scenario.",
    "constraints": [
        "List 5-7 specific, actionable constraints. Write professionally:",
        "• 'Define clear user flows showing how users navigate between key tasks'",
        "• 'Ensure the interface follows accessibility best practices'",
        "• 'Include error states and empty states where relevant'",
        "• 'Minimize cognitive load and keep the interface simple'",
        "• 'Address real problems faced by users in the [domain]'",
        "• 'Include interaction states such as loading, error, or success'",
        "• 'Ensure the design works well on the target platform (web/mobile)'",
        "Be specific and professional"
    ],
    "deliverables": [
        "List exactly what they need to submit:",
        "• 'User flow diagrams showing key journeys'",
        "• 'Low-to-mid fidelity wireframes for main screens'",
        "• 'A brief explanation of the design decisions'",
        "Be clear and specific"
    ],
    "evaluation_criteria": [
        "List 4-5 evaluation criteria professionally:",
        "• 'Clarity and logic of the user flows'",
        "• 'Usability and accessibility'",
        "• 'Effectiveness of the problem-solving approach'",
        "• 'Consideration of edge cases and error handling'",
        "Write as clear statements"
    ],
    "time_limit_minutes": {45 if difficulty == DifficultyLevel.BEGINNER else 60 if difficulty == DifficultyLevel.INTERMEDIATE else 90}
}}

--------------------------------------------------
### EXAMPLE OF GOOD DESCRIPTION

"You are designing a dashboard for a Banking, Financial Services, and Insurance (BSFI) platform used by different internal teams such as analysts, managers, and support staff.

The dashboard should allow users to quickly view important financial data, monitor key metrics, and perform daily tasks efficiently.

Your goal is to design a multi-screen dashboard experience that supports multiple workflows while keeping the interface clear, simple, and easy to learn.

Consider at least 2–3 different user roles and how their needs might differ when interacting with the dashboard."

--------------------------------------------------
### REMEMBER

- Provide clear context about the product and users
- Be specific about what needs to be designed
- Explain the goals and objectives clearly
- Use professional but accessible language
- Structure the description in clear paragraphs

Now generate ONE design challenge for {role_str} at {difficulty_str} level about {topic_str}. Return ONLY the JSON object."""
        
        return base_prompt.strip()
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert at writing professional design challenge briefs for hiring assessments. Write clear, structured briefs that provide context about the product, users, and problem. Be specific and professional. Provide enough detail so candidates understand the real-world scenario. Use clear paragraphs to structure the description: context, task definition, and considerations."},
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
            
            return DesignQuestionModel(
                role=role,
                difficulty=difficulty,
                experience_level=experience_level,
                task_type=task_type,
                title=data["title"],
                description=data["description"],
                constraints=data.get("constraints", []),
                deliverables=data.get("deliverables", []),
                evaluation_criteria=data.get("evaluation_criteria", []),
                time_limit_minutes=data.get("time_limit_minutes", 60),
                created_by=created_by
            )
            
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            return self._generate_fallback_question(role, difficulty, task_type, topic, created_by, experience_level)
    
    def _generate_topic_based_question(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str,
        created_by: str,
        experience_level: str = None
    ) -> DesignQuestionModel:
        """Generate question based on custom topic with role-specific variations"""
        
        # Create role-specific, task-specific descriptions
        role_name = role.value.replace('_', ' ').title()
        task_name = task_type.value.replace('_', ' ')
        
        # Build ROLE-SPECIFIC and DIFFICULTY-SPECIFIC descriptions
        # Each role gets a completely different question focus
        # Each difficulty level has different complexity and scope
        
        # Difficulty-specific scope modifiers - NATURAL LANGUAGE
        if difficulty == DifficultyLevel.BEGINNER:
            scope = "one simple screen"
            complexity = "Keep it simple - focus on making it look clean and easy to understand."
            user_scope = "one main type of user"
        elif difficulty == DifficultyLevel.INTERMEDIATE:
            scope = "a few connected screens"
            complexity = "Make it work well with different states and interactions."
            user_scope = "2-3 different types of users"
        else:  # ADVANCED
            scope = "a complete user journey with multiple screens"
            complexity = "Think through the whole experience and handle different scenarios."
            user_scope = "different types of users with different needs"
        
        if role == DesignRole.UI_DESIGNER:
            # UI Designer: Focus on visual design, interface aesthetics
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a landing page for a {topic}. The page needs to make a strong first impression and clearly communicate the value proposition to visitors.\n\nYour goal is to create a clean, visually appealing single-page design that establishes a solid visual foundation with proper typography hierarchy, a simple color palette, and consistent spacing.\n\nFocus on basic layout principles, clear visual hierarchy, and fundamental design elements. This is an entry-level task to demonstrate your understanding of visual design basics.",
                    TaskType.MOBILE_APP: f"You are designing a mobile app screen for a {topic}. The app needs a clean, simple interface that users can understand and navigate easily.\n\nYour goal is to create one well-designed screen with clear visual hierarchy, readable typography, and basic UI components like buttons, inputs, and cards.\n\nFocus on mobile design fundamentals, proper spacing, and creating an attractive, functional interface.",
                    TaskType.DASHBOARD: f"You are designing a dashboard interface for a {topic}. Users need to quickly view and understand key information at a glance.\n\nYour goal is to create a simple dashboard layout with 2-3 data cards or widgets, basic charts, and clear visual organization.\n\nFocus on presenting information clearly and attractively while maintaining good visual hierarchy.",
                    TaskType.COMPONENT: f"You are designing a UI component for a {topic}. This component will be used across the product and needs to be visually consistent.\n\nYour goal is to create one component (such as a button, card, or input field) with 2-3 different states (default, hover, active, etc.).\n\nFocus on visual detail, consistency, and creating a polished component design."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a landing page for a {topic} with multiple sections including hero, features, testimonials, and call-to-action areas.\n\nThe page needs to maintain visual consistency across all sections while implementing a cohesive design system that balances aesthetics with functionality.\n\nYour goal is to create a multi-section landing page that demonstrates your ability to handle moderate complexity while maintaining visual harmony throughout.",
                    TaskType.MOBILE_APP: f"You are designing a mobile app interface for a {topic} with 3-4 connected screens that form a cohesive user experience.\n\nThe app needs consistent visual styling across all screens with smooth transitions between states and well-implemented interactive elements.\n\nYour goal is to create a multi-screen mobile experience that demonstrates visual consistency and thoughtful interaction design.",
                    TaskType.DASHBOARD: f"You are designing a dashboard for a {topic} with 4-6 data visualization widgets, filtering options, and a responsive layout.\n\nThe dashboard needs to present complex data in an elegant, organized way with clear visual hierarchy and consistent styling throughout.\n\nYour goal is to create a functional dashboard that makes data easy to understand while maintaining visual appeal.",
                    TaskType.COMPONENT: f"You are creating a component library for a {topic} with 3-5 related components that work together as a system.\n\nThe components need multiple states and variations while maintaining visual consistency across the entire set.\n\nYour goal is to demonstrate your understanding of design systems and create scalable, reusable components."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a comprehensive landing page system for a {topic} with multiple page variations, responsive breakpoints, and advanced interactions.\n\nThe project requires creating a complete visual design system including typography scales, color systems, spacing tokens, and component libraries that work across different contexts.\n\nYour goal is to demonstrate mastery of visual design at scale by creating a robust, scalable design system.",
                    TaskType.MOBILE_APP: f"You are designing a complete mobile app for a {topic} covering full user flows with 8-10 screens across different device sizes.\n\nThe app needs custom illustrations or icons, complex interactions, and a unique visual identity that stands out while remaining functional.\n\nYour goal is to demonstrate expert-level visual design thinking by creating a comprehensive, polished mobile experience.",
                    TaskType.DASHBOARD: f"You are designing a dashboard platform for a {topic} with advanced data visualizations, customizable layouts, multiple user views, and sophisticated filtering capabilities.\n\nThe platform needs a complete design system that scales across different dashboard types while maintaining consistency and usability.\n\nYour goal is to demonstrate strategic visual design for complex products by creating an enterprise-grade dashboard system.",
                    TaskType.COMPONENT: f"You are creating an enterprise-grade component system for a {topic} with 10+ components, comprehensive documentation, accessibility considerations, and theming capabilities.\n\nThe system needs to be scalable, maintainable, and work across different contexts and use cases.\n\nYour goal is to demonstrate mastery of design systems and scalable visual architecture."
                }
        
        elif role == DesignRole.UX_DESIGNER:
            # UX Designer: Focus on user flows, research, usability, problem-solving
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing the user experience for a {topic} landing page. Visitors need to quickly understand the value proposition and know what action to take next.\n\nYour goal is to create a clear information hierarchy with simple navigation and one primary call-to-action that guides users effectively.\n\nConsider {user_scope} and their basic needs when arriving at the page.",
                    TaskType.MOBILE_APP: f"You are designing a user flow for a {topic} mobile app. Users need to complete a simple 2-3 step journey with clear navigation and minimal friction.\n\nYour goal is to create an intuitive flow that helps {user_scope} accomplish one primary task efficiently.\n\nFocus on clear navigation, basic error handling, and making the journey easy to follow.",
                    TaskType.DASHBOARD: f"You are designing the user experience for a {topic} dashboard. Users need to find and understand key information quickly without feeling overwhelmed.\n\nYour goal is to create a simple information architecture with 2-3 main sections and intuitive navigation.\n\nHelp {user_scope} locate what they need and understand it easily.",
                    TaskType.COMPONENT: f"You are designing the interaction pattern for a {topic} component. Users need to understand how to use it without confusion or errors.\n\nYour goal is to focus on the component's usability, basic accessibility, and clear user feedback.\n\nEnsure {user_scope} can interact with it intuitively."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design {scope} landing page experience for a {topic} with multiple paths users can take. Think about {user_scope} and how they might arrive at the page. {complexity} Make sure it works well for everyone.",
                    TaskType.MOBILE_APP: f"Create {scope} mobile app UX for a {topic} with 4-6 screens. Design the complete flow, handle errors, and make sure it's accessible. {complexity} Address {user_scope} and their different goals.",
                    TaskType.DASHBOARD: f"Design {scope} dashboard experience for a {topic} with multiple workflows. Think about {user_scope} and how they'll use it. {complexity} Make it efficient and easy to learn.",
                    TaskType.COMPONENT: f"Design {scope} component system UX for a {topic} with 3-5 components. Make sure they're accessible and easy to use. {complexity} Ensure it works well for {user_scope}."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design {scope} landing page strategy for a {topic} based on user research. Create detailed user personas and journey maps for {user_scope}. {complexity} Include testing plans and optimization strategies.",
                    TaskType.MOBILE_APP: f"Create {scope} mobile app UX strategy for a {topic} covering complete user journeys. Do user research, create personas, design 10+ screens, and make sure it's fully accessible. {complexity} Address {user_scope} and their diverse needs.",
                    TaskType.DASHBOARD: f"Design {scope} dashboard UX system for a {topic} with advanced workflows. Create comprehensive information architecture for {user_scope}. {complexity} Optimize for users with different skill levels.",
                    TaskType.COMPONENT: f"Design {scope} component system UX for a {topic} with full accessibility. Create 10+ components that work for {user_scope} including users with disabilities. {complexity} Show expert-level inclusive design."
                }
        
        elif role == DesignRole.PRODUCT_DESIGNER:
            # Product Designer: Focus on business goals, strategy, end-to-end experience
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a landing page for a {topic}. The business wants to achieve a specific goal (such as increasing sign-ups or conversions) while meeting user needs.\n\nYour goal is to define one clear business objective, identify {user_scope}, and create a simple value proposition that resonates with visitors.\n\nBalance basic business requirements with user experience to create an effective landing page.",
                    TaskType.MOBILE_APP: f"You are designing a mobile app concept for a {topic}. The product needs to solve a specific user problem while supporting business objectives.\n\nYour goal is to define the core problem, identify {user_scope}, and design one key feature that addresses both user and business needs.\n\nDemonstrate basic product thinking by aligning user value with business goals.",
                    TaskType.DASHBOARD: f"You are designing a dashboard for a {topic}. The business needs to track 1-2 key metrics while helping users accomplish their goals efficiently.\n\nYour goal is to identify {user_scope}, define success metrics, and create a simple dashboard that supports both business objectives and user tasks.\n\nShow basic product strategy by balancing measurement with usability.",
                    TaskType.COMPONENT: f"You are designing a component system strategy for a {topic}. The components need to support business goals while serving the needs of designers and developers.\n\nYour goal is to define how components support business objectives, consider {user_scope}, and create basic documentation.\n\nDemonstrate understanding of design systems as products that serve multiple stakeholders."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a landing page product strategy for a {topic}. The business has 2-3 key performance indicators (KPIs) to optimize while ensuring a great user experience.\n\nYour goal is to define business metrics, create user personas for {user_scope}, conduct basic competitive analysis, and design for conversion optimization.\n\nBalance business metrics with user satisfaction to create a data-driven landing page strategy.",
                    TaskType.MOBILE_APP: f"You are designing a mobile app product for a {topic}. The product needs a clear strategy that aligns business goals with user needs across 3-4 core features.\n\nYour goal is to define product strategy, create personas for {user_scope}, design key features, and establish success metrics.\n\nDemonstrate product thinking that effectively balances business objectives with user value.",
                    TaskType.DASHBOARD: f"You are designing a dashboard product for a {topic}. The business needs to track key metrics, engage users, and potentially monetize the platform.\n\nYour goal is to define business KPIs, identify {user_scope}, create an engagement strategy, and design features that drive both usage and business value.\n\nShow strategic product design for data products by aligning metrics with user goals.",
                    TaskType.COMPONENT: f"You are designing a component system product for a {topic}. The system needs adoption metrics, governance, and a rollout strategy to succeed across the organization.\n\nYour goal is to define adoption metrics, create a governance model, design for {user_scope} (designers and developers), and plan the rollout strategy.\n\nDemonstrate product thinking for design systems by treating them as internal products."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"You are designing a landing page product ecosystem for a {topic}. The project requires comprehensive market research, business strategy, and multi-variant testing approach.\n\nYour goal is to conduct market research, define comprehensive business strategy, create detailed personas for {user_scope}, perform competitive analysis, and design a testing strategy.\n\nDemonstrate strategic product leadership by creating a data-driven, scalable landing page system.",
                    TaskType.MOBILE_APP: f"You are leading a mobile app product strategy for a {topic}. The product needs complete vision, roadmap, go-to-market strategy, and clear success metrics.\n\nYour goal is to define complete product vision, conduct user research, create personas for {user_scope}, design 8-10 features with roadmap, establish OKRs, and plan go-to-market strategy.\n\nShow executive-level product thinking by creating a comprehensive product strategy.",
                    TaskType.DASHBOARD: f"You are designing a dashboard product platform for a {topic}. The platform needs a business model, pricing strategy, and scaling plan to succeed in the market.\n\nYour goal is to define the business model, create pricing strategy, design for {user_scope} with different subscription tiers, establish growth metrics, and plan scaling strategy.\n\nDemonstrate product leadership for complex platforms by creating a sustainable business strategy.",
                    TaskType.COMPONENT: f"You are designing an enterprise component system product for a {topic}. The system needs adoption strategy, governance framework, and multi-year roadmap to succeed at scale.\n\nYour goal is to define adoption strategy, create governance framework, design for {user_scope} across multiple teams, establish metrics, and plan a multi-year roadmap.\n\nShow strategic product thinking at organizational scale by creating a comprehensive design system strategy."
                }
        
        else:  # DesignRole.VISUAL_DESIGNER
            # Visual Designer: Focus on branding, visual storytelling, creative expression
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create {scope} landing page visual design for a {topic}. Pick a simple color palette (2-3 colors) and fonts that work well together. {complexity} Show your creative foundation.",
                    TaskType.MOBILE_APP: f"Design {scope} mobile app visual identity for a {topic}. Create a simple brand style with colors, fonts, and a few custom icons. {complexity} Show your visual creativity basics.",
                    TaskType.DASHBOARD: f"Create {scope} dashboard visual design for a {topic}. Design simple custom charts with consistent styling. {complexity} Show you can make data look good.",
                    TaskType.COMPONENT: f"Design {scope} component visual style for a {topic}. Create basic brand styling for one component. {complexity} Show attention to visual brand details."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create {scope} landing page brand experience for a {topic}. Design custom illustrations, unique colors, and branded visual elements. {complexity} Show your creative visual storytelling.",
                    TaskType.MOBILE_APP: f"Design {scope} mobile app brand identity for a {topic}. Create custom visual assets (illustrations, icons, graphics) and establish a unique visual language. {complexity} Show your creative visual design skills.",
                    TaskType.DASHBOARD: f"Create {scope} dashboard brand experience for a {topic}. Design custom data visualizations and make data beautiful. {complexity} Show your creative approach to data design.",
                    TaskType.COMPONENT: f"Design {scope} component brand system for a {topic}. Create branded components with custom visual treatments. {complexity} Show your brand design thinking."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create {scope} landing page brand system for a {topic}. Design complete brand identity with custom illustrations, motion design, and comprehensive brand guidelines. {complexity} Show mastery of brand visual design.",
                    TaskType.MOBILE_APP: f"Design {scope} mobile app brand experience for a {topic}. Create comprehensive visual identity with custom illustration system, motion design, and branded micro-interactions. {complexity} Show expert-level creative visual design.",
                    TaskType.DASHBOARD: f"Create {scope} dashboard brand platform for a {topic}. Design innovative data visualizations and push visual boundaries. {complexity} Show creative leadership in data visualization.",
                    TaskType.COMPONENT: f"Design {scope} enterprise brand system for a {topic}. Create comprehensive branded component library with custom visual treatments and complete brand guidelines. {complexity} Show mastery of brand systems at scale."
                }
        
        description = task_descriptions.get(
            task_type,
            f"Design a {scope} {task_name} for a {topic}. {complexity}"
        )
        
        # Generate ROLE-SPECIFIC constraints - PROFESSIONAL FORMAT
        if role == DesignRole.UI_DESIGNER:
            constraints = [
                "Ensure precise alignment and consistent spacing throughout the design",
                "Use a cohesive color palette with appropriate contrast ratios",
                "Demonstrate clear typography hierarchy and readability",
                "Maintain consistent visual styling across all elements",
                f"Follow industry-standard design patterns for {topic} products"
            ]
        elif role == DesignRole.UX_DESIGNER:
            constraints = [
                "Define clear user flows showing how users navigate between key tasks",
                "Ensure the interface follows accessibility best practices",
                "Include error states and empty states where relevant",
                "Minimize cognitive load and keep the interface simple",
                f"Address real problems faced by users in the {topic} domain"
            ]
        elif role == DesignRole.PRODUCT_DESIGNER:
            constraints = [
                "Define clear business goals and success metrics",
                "Create user personas based on target audience research",
                "Balance business objectives with user needs",
                "Consider technical feasibility and implementation constraints",
                f"Align design with {topic} market positioning and competitive landscape"
            ]
        else:  # VISUAL_DESIGNER
            constraints = [
                "Establish a unique and memorable visual identity",
                "Create custom visual elements (illustrations, icons, graphics)",
                "Use color and typography to express brand personality",
                "Ensure visual consistency and brand coherence throughout",
                f"Differentiate the design from competitors in the {topic} space"
            ]
        
        # Add difficulty-specific constraints - PROFESSIONAL FORMAT
        if difficulty == DifficultyLevel.ADVANCED:
            constraints.extend([
                "Design for multiple user personas and diverse use cases",
                "Demonstrate strategic thinking and comprehensive planning"
            ])
        elif difficulty == DifficultyLevel.INTERMEDIATE:
            constraints.extend([
                "Include different states and interactions",
                "Ensure the design works well on the target platform"
            ])
        else:  # BEGINNER
            constraints.append("Focus on core functionality and clear execution")
        
        # ROLE-SPECIFIC Deliverables - PROFESSIONAL FORMAT
        if role == DesignRole.UI_DESIGNER:
            deliverables = [
                "High-fidelity UI screens demonstrating visual design execution",
                "Design specifications documenting colors, typography, and spacing",
                "Component style guide or design tokens"
            ]
        elif role == DesignRole.UX_DESIGNER:
            deliverables = [
                "User flow diagrams showing the journey",
                "Low-to-mid fidelity wireframes for key screens",
                "Brief explanation of design decisions and rationale"
            ]
        elif role == DesignRole.PRODUCT_DESIGNER:
            deliverables = [
                "User personas and problem statements",
                "Complete product flow diagrams",
                "Design screens for core features",
                "Product strategy document explaining your thinking"
            ]
        else:  # VISUAL_DESIGNER
            deliverables = [
                "High-fidelity visual designs with unique brand identity",
                "Custom visual assets (illustrations, icons, graphics)",
                "Brand style guide documenting colors, typography, and visual language"
            ]
        
        # ROLE-SPECIFIC Evaluation criteria - PROFESSIONAL FORMAT
        if role == DesignRole.UI_DESIGNER:
            evaluation_criteria = [
                "Visual design quality and aesthetic appeal",
                "Attention to detail and execution precision",
                "Effective use of typography and color",
                "Consistency and clear visual hierarchy"
            ]
        elif role == DesignRole.UX_DESIGNER:
            evaluation_criteria = [
                "Clarity and logic of the user flows",
                "Usability and accessibility",
                "Effectiveness of the problem-solving approach",
                "Consideration of edge cases and error handling"
            ]
        elif role == DesignRole.PRODUCT_DESIGNER:
            evaluation_criteria = [
                "Alignment with business goals and strategy",
                "Accuracy and depth of user personas",
                "Quality of the end-to-end product experience",
                "Balance of business objectives and user needs"
            ]
        else:  # VISUAL_DESIGNER
            evaluation_criteria = [
                "Visual creativity and innovation",
                "Strength of brand identity and personality",
                "Effectiveness of visual storytelling",
                "Uniqueness and memorability of the aesthetic"
            ]
        
        # Time mapping
        time_mapping = {
            DifficultyLevel.BEGINNER: 45,
            DifficultyLevel.INTERMEDIATE: 60,
            DifficultyLevel.ADVANCED: 90
        }
        
        return DesignQuestionModel(
            role=role,
            difficulty=difficulty,
            experience_level=experience_level,
            task_type=task_type,
            title=f"{topic} {task_name.title()} - {role_name} Challenge",
            description=description,
            constraints=constraints,
            deliverables=deliverables,
            evaluation_criteria=evaluation_criteria,
            time_limit_minutes=time_mapping[difficulty],
            created_by=created_by
        )
    
    def _generate_fallback_question(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str,
        created_by: str,
        experience_level: str = None
    ) -> DesignQuestionModel:
        """Generate fallback question when AI fails - using high-quality templates"""
        
        # If custom topic is provided, skip hardcoded templates and generate topic-specific question
        if topic:
            logger.info(f"Custom topic '{topic}' provided, generating topic-specific question")
            return self._generate_topic_based_question(role, difficulty, task_type, topic, created_by)
        
        templates = {
            # UI Designer - Easy - Landing Page
            (DesignRole.UI_DESIGNER, DifficultyLevel.BEGINNER, TaskType.LANDING_PAGE): {
                "title": "Online Learning Platform Login Screen",
                "description": "You are designing a mobile app for a new online learning platform aimed at college students and fresh graduates. The app allows users to access video courses, track learning progress, and participate in live sessions. Your task is to design a clean, simple, and user-friendly login screen for first-time users. The design should make it easy for new users to understand how to log in and start learning quickly, while maintaining a modern and trustworthy visual style suitable for an educational product.",
                "constraints": [
                    "Design for mobile platform (Android / iOS) with a single-screen layout",
                    "Use clear visual hierarchy to highlight the primary login action",
                    "Limit the color palette to 2-3 primary colors with good contrast",
                    "Include email and password fields along with a primary login button",
                    "Add basic error and helper text placeholders (e.g., invalid email, forgot password)",
                    "Maintain minimum 44px touch target size for all interactive elements"
                ],
                "deliverables": [
                    "One high-fidelity mobile UI screen design for the login page",
                    "A simple color and typography style reference used in the screen"
                ],
                "evaluation_criteria": [
                    "Visual hierarchy and clarity",
                    "Touch target sizes and mobile usability",
                    "Color contrast and accessibility",
                    "Typography and readability",
                    "Overall visual appeal"
                ]
            },
            
            # UI Designer - Medium - Dashboard
            (DesignRole.UI_DESIGNER, DifficultyLevel.INTERMEDIATE, TaskType.DASHBOARD): {
                "title": "Food Delivery Dashboard",
                "description": "You are designing a mobile dashboard for a food delivery application that helps users quickly browse restaurants, track active orders, and discover new food options. The dashboard should provide a clear overview of ongoing orders, recommended restaurants, and popular food categories. Your task is to design a multi-section dashboard screen that balances usability, visual clarity, and modern UI aesthetics for daily active users.",
                "constraints": [
                    "Design for mobile platform (Android / iOS) with a scrollable multi-section layout",
                    "Include at least three sections: active order status, restaurant recommendations, and food categories",
                    "Maintain clear visual hierarchy using spacing, typography, and color",
                    "Use grid or card-based layout for restaurant listings",
                    "Limit the color palette to 3-4 complementary colors while maintaining accessibility contrast",
                    "Ensure consistent spacing, alignment, and component styling across all sections"
                ],
                "deliverables": [
                    "One high-fidelity dashboard UI screen showing all required sections",
                    "A short component list (cards, buttons, navigation elements) used in the design"
                ],
                "evaluation_criteria": [
                    "Visual hierarchy and information architecture",
                    "Component consistency and design system thinking",
                    "Spacing and alignment precision",
                    "Color usage and accessibility",
                    "Overall usability and user experience"
                ]
            },
            
            # UX Designer - Advanced - Mobile App
            (DesignRole.UX_DESIGNER, DifficultyLevel.ADVANCED, TaskType.MOBILE_APP): {
                "title": "Hospital Appointment Booking Flow",
                "description": "You are designing the end-to-end appointment booking experience for a multi-specialty hospital's mobile application. The app serves patients of different age groups, including elderly users and first-time smartphone users. Patients should be able to easily search for doctors, view availability, book appointments, upload medical history, and receive confirmations. Your task is to design a complete, user-friendly appointment booking flow that minimizes cognitive load, reduces errors, and ensures accessibility for diverse users.",
                "constraints": [
                    "Design a multi-step user flow covering doctor search, appointment selection, patient details, and confirmation",
                    "Include clear progress indicators to show booking steps",
                    "Ensure accessibility compliance (WCAG) with readable typography, color contrast, and large touch targets",
                    "Design for edge cases such as slot unavailability, incomplete forms, and network interruptions",
                    "Provide error prevention and recovery mechanisms throughout the flow",
                    "Ensure the flow is optimized for elderly users with simplified interactions and guidance"
                ],
                "deliverables": [
                    "Complete user flow diagram showing all key steps and decision points",
                    "Low-to-mid fidelity wireframes for each major screen in the booking flow",
                    "A brief UX rationale document explaining your design decisions"
                ],
                "evaluation_criteria": [
                    "User flow logic and completeness",
                    "Accessibility and inclusive design",
                    "Error prevention and recovery",
                    "Cognitive load management",
                    "Edge case handling"
                ]
            },
            
            # Product Designer - Advanced - Mobile App
            (DesignRole.PRODUCT_DESIGNER, DifficultyLevel.ADVANCED, TaskType.MOBILE_APP): {
                "title": "Fintech Mobile App Product Design",
                "description": "You are leading the product design for a new fintech mobile application aimed at young professionals and small business owners to manage savings, investments, payments, and personal finance insights in one platform. The business goal is to increase monthly active users, financial engagement, and long-term retention while ensuring high trust, security perception, and usability. Your task is to design an end-to-end product experience that covers onboarding, core financial workflows, and long-term engagement strategies.",
                "constraints": [
                    "Define at least two user personas (e.g., salaried employee, freelancer, small business owner)",
                    "Design a multi-step onboarding flow that builds trust and explains value clearly",
                    "Create core product workflows for payments, savings, and expense tracking",
                    "Ensure high security perception and compliance-friendly UX (OTP flows, KYC prompts)",
                    "Incorporate engagement mechanisms such as insights, alerts, and financial goals",
                    "Balance business goals (retention, upsell) with user trust and simplicity"
                ],
                "deliverables": [
                    "Detailed user personas and journey maps",
                    "Complete product flow diagrams covering onboarding, payments, and financial tracking",
                    "High-fidelity UI screens for key product flows",
                    "A product UX strategy document explaining design decisions and business alignment"
                ],
                "evaluation_criteria": [
                    "Strategic thinking and business alignment",
                    "User persona accuracy and insights",
                    "Product flow completeness",
                    "Trust and security perception",
                    "Engagement strategy effectiveness"
                ]
            }
        }
        
        # Get template or use generic default
        template_key = (role, difficulty, task_type)
        template = templates.get(template_key)
        
        # If no exact match, try to find closest match
        if not template:
            # Try with different difficulty
            for diff in [DifficultyLevel.INTERMEDIATE, DifficultyLevel.BEGINNER, DifficultyLevel.ADVANCED]:
                template = templates.get((role, diff, task_type))
                if template:
                    break
        
        # Final fallback - generate specific description based on role, task type, and topic
        if not template:
            # Create role-specific, task-specific descriptions
            role_name = role.value.replace('_', ' ').title()
            task_name = task_type.value.replace('_', ' ')
            
            # Use topic if provided, otherwise generate generic topic based on task type
            if not topic:
                topic_defaults = {
                    TaskType.LANDING_PAGE: "SaaS Product",
                    TaskType.MOBILE_APP: "Productivity App",
                    TaskType.DASHBOARD: "Analytics Platform",
                    TaskType.COMPONENT: "Design System"
                }
                topic = topic_defaults.get(task_type, "Digital Product")
            
            # Build specific description based on task type and topic
            task_descriptions = {
                TaskType.LANDING_PAGE: f"Design a landing page for a {topic} that effectively communicates value proposition, engages visitors, and drives conversions. Focus on visual hierarchy, compelling copy placement, clear call-to-actions, and responsive layout that works across devices.",
                TaskType.MOBILE_APP: f"Design a mobile application interface for a {topic} that provides intuitive navigation, clear information architecture, and seamless user experience. Consider mobile-specific patterns, touch interactions, screen sizes, and platform guidelines (iOS/Android).",
                TaskType.DASHBOARD: f"Design a data dashboard for a {topic} that presents complex information in a clear, scannable format. Focus on data visualization, widget organization, filtering capabilities, and helping users make informed decisions quickly.",
                TaskType.COMPONENT: f"Design a reusable UI component for a {topic} that maintains consistency, follows design system principles, and works across different contexts. Consider component states, accessibility, responsiveness, and integration with larger design systems."
            }
            
            description = task_descriptions.get(
                task_type,
                f"Design a {task_name} for a {topic} that demonstrates professional design skills, user-centered thinking, and attention to detail. Create a solution that balances aesthetics with functionality."
            )
            
            # Add role-specific focus
            role_focus = {
                DesignRole.UI_DESIGNER: " Pay special attention to visual design, typography, color theory, spacing, and pixel-perfect execution.",
                DesignRole.UX_DESIGNER: " Focus on user flows, information architecture, usability, accessibility, and solving user problems effectively.",
                DesignRole.PRODUCT_DESIGNER: " Consider business goals, user needs, technical constraints, and end-to-end product experience.",
                DesignRole.VISUAL_DESIGNER: " Emphasize visual storytelling, brand consistency, creative expression, and aesthetic excellence."
            }
            
            full_description = description + role_focus.get(role, "")
            
            # Generate topic-specific constraints
            constraints = [
                "Follow modern design principles and best practices",
                f"Ensure the design aligns with {topic} industry standards and user expectations",
                "Maintain accessibility compliance (WCAG 2.1 AA)",
                "Use consistent visual language and design system thinking"
            ]
            
            # Add difficulty-specific constraints
            if difficulty == DifficultyLevel.ADVANCED:
                constraints.extend([
                    "Design for multiple user personas and use cases",
                    "Consider edge cases and error states",
                    "Demonstrate strategic thinking and business alignment"
                ])
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                constraints.extend([
                    "Ensure responsive design for target platform",
                    "Include interactive states and micro-interactions"
                ])
            else:  # BEGINNER
                constraints.extend([
                    "Focus on core functionality and clear user flows",
                    "Maintain visual hierarchy and readability"
                ])
            
            template = {
                "title": f"{topic.title()} {task_name.title()} - {role_name} Challenge",
                "description": full_description,
                "constraints": constraints,
                "deliverables": [
                    "High-fidelity design screens",
                    "Design specifications and annotations",
                    "Brief design rationale"
                ],
                "evaluation_criteria": [
                    "Visual design quality",
                    "User experience and usability",
                    "Technical feasibility",
                    "Design thinking and creativity"
                ]
            }
        
        # Adjust time based on difficulty
        time_mapping = {
            DifficultyLevel.BEGINNER: 45,
            DifficultyLevel.INTERMEDIATE: 60,
            DifficultyLevel.ADVANCED: 90
        }
        
        return DesignQuestionModel(
            role=role,
            difficulty=difficulty,
            experience_level=experience_level,
            task_type=task_type,
            title=template["title"],
            description=template["description"],
            constraints=template["constraints"],
            deliverables=template["deliverables"],
            evaluation_criteria=template["evaluation_criteria"],
            time_limit_minutes=time_mapping[difficulty],
            created_by=created_by
        )


# Singleton instance
ai_question_generator = AIQuestionGenerator()