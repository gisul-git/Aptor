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
        
        base_prompt = f"""You are an expert design hiring manager creating assessment questions for candidates. Your goal is to write clear, professional, and easy-to-understand design challenges that feel like real project briefs.

--------------------------------------------------
### INPUT PARAMETERS:

Role: {role_str}
Difficulty Level: {difficulty_str}
Experience Level: {experience_str}
Topic: {topic_str}

--------------------------------------------------
### WRITING STYLE GUIDELINES:

1. **Write Like a Real Project Brief**:
   - Use natural, conversational language
   - Explain the context clearly (who, what, why)
   - Make it easy for candidates to understand what they need to do
   - Avoid technical jargon unless necessary
   - Write as if you're briefing a designer joining your team

2. **Structure Your Description**:
   - Start with the company/product context (1-2 sentences)
   - Explain the user problem or business need (2-3 sentences)
   - Describe what the candidate needs to design (2-3 sentences)
   - Mention the target users and their needs (1-2 sentences)
   - End with the expected outcome or goal (1 sentence)

3. **Make Constraints Clear and Actionable**:
   - Write constraints as simple instructions
   - Example: "Design for mobile screens (iOS or Android)" instead of "Platform constraint: mobile"
   - Example: "Use a maximum of 3 primary colors" instead of "Color palette limitation"
   - Example: "Make sure buttons are easy to tap (at least 44px)" instead of "Touch target compliance"

4. **Deliverables Should Be Crystal Clear**:
   - Tell candidates exactly what files/screens to submit
   - Use simple language: "Submit 1 high-quality screen design" instead of "High-fidelity UI mockup"
   - Be specific: "Include a color palette and font choices" instead of "Style guide"

--------------------------------------------------
### ROLE-SPECIFIC FOCUS:

**UI Designer**: Focus on visual design, colors, typography, spacing, layout, and making things look professional and polished.

**UX Designer**: Focus on user flows, how things work, making it easy to use, handling errors, and thinking about different user scenarios.

**Product Designer**: Focus on business goals, user research, complete user journeys, and balancing user needs with business objectives.

**Visual Designer**: Focus on creative visual style, brand identity, unique aesthetics, and visual storytelling.

--------------------------------------------------
### DIFFICULTY LEVELS:

**Easy** (45 minutes):
- Design 1 simple screen or component
- 4-5 clear, simple constraints
- Basic layout and visual design
- Perfect for beginners or quick assessments

**Medium** (60 minutes):
- Design 1 screen with multiple sections OR 2-3 related screens
- 5-7 constraints covering design and usability
- More attention to detail and user experience
- For designers with some experience

**High** (90 minutes):
- Design complete user flows with multiple screens
- 7-10 constraints covering design, usability, accessibility, and business goals
- Handle edge cases and complex scenarios
- For experienced designers

--------------------------------------------------
### EXAMPLE OF GOOD DESCRIPTION (College Landing Page):

"You're designing a landing page for a new online college that offers affordable degree programs for working professionals. The college wants to attract students aged 25-40 who are looking to advance their careers while working full-time.

The main problem is that potential students don't trust new online colleges and need to be convinced that the programs are legitimate, affordable, and flexible. The landing page needs to clearly communicate the college's value proposition, showcase program options, and make it easy for visitors to request more information or apply.

Your task is to design a clean, professional landing page that builds trust and encourages visitors to take action. The design should feel modern and credible, not flashy or gimmicky. Focus on clear information hierarchy, compelling visuals, and a strong call-to-action.

The target audience is working professionals who are busy and skeptical, so the page needs to quickly answer their questions: Is this legit? Can I afford it? Will it fit my schedule? Can I really get a degree online?"

--------------------------------------------------
### OUTPUT FORMAT (JSON):

{{
    "title": "Short, clear title (e.g., 'College Landing Page Design')",
    "description": "Write a natural, easy-to-understand project brief (250-400 words) following the structure above. Use simple language and explain clearly what the candidate needs to design and why.",
    "constraints": [
        "Write 4-8 clear, actionable constraints using simple language",
        "Example: 'Design for desktop/laptop screens (1440px width)'",
        "Example: 'Use a professional color scheme (2-3 main colors)'",
        "Example: 'Include a clear call-to-action button above the fold'",
        "Example: 'Make sure the design works for people aged 25-40'",
        "Example: 'Keep the layout clean and not too busy'",
        "Avoid technical jargon - write like you're talking to a designer"
    ],
    "deliverables": [
        "Write 2-4 clear deliverables using simple language",
        "Example: 'One complete landing page design (desktop version)'",
        "Example: 'Show your color palette and font choices'",
        "Example: 'Include at least 3 sections: hero, programs, and contact form'",
        "Be specific about what files or screens to submit"
    ],
    "evaluation_criteria": [
        "Write 4-6 evaluation criteria in simple terms",
        "Example: 'Visual design quality and professional appearance'",
        "Example: 'Clear information hierarchy and easy to scan'",
        "Example: 'Effective use of colors and typography'",
        "Example: 'Strong call-to-action that stands out'",
        "Focus on what makes a good design for this specific task"
    ],
    "time_limit_minutes": {45 if difficulty == DifficultyLevel.BEGINNER else 60 if difficulty == DifficultyLevel.INTERMEDIATE else 90}
}}

--------------------------------------------------
### QUALITY CHECKLIST:
✓ Is the description written in natural, easy-to-understand language?
✓ Would a candidate immediately understand what they need to design?
✓ Are the constraints written as simple, actionable instructions?
✓ Are the deliverables crystal clear?
✓ Does it feel like a real project brief, not an academic test?
✓ Is the business context and user problem clearly explained?

Now generate ONE complete design question for {role_str} at {difficulty_str} level about {topic_str}. Write it in natural, professional language that's easy for candidates to understand. Return ONLY the JSON object."""
        
        return base_prompt.strip()
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "You are an experienced design hiring manager who writes clear, professional project briefs for design candidates. You write in natural, easy-to-understand language that makes candidates feel comfortable and confident. Your questions feel like real work projects, not academic tests. You explain context clearly, give actionable instructions, and make sure candidates know exactly what they need to design."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=1500,
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
        
        # Difficulty-specific scope modifiers
        if difficulty == DifficultyLevel.BEGINNER:
            scope = "simple, single-screen"
            complexity = "Focus on basic layout, clear visual hierarchy, and fundamental design principles."
            user_scope = "a single primary user type"
        elif difficulty == DifficultyLevel.INTERMEDIATE:
            scope = "multi-section, moderately complex"
            complexity = "Include multiple sections, interactive states, and demonstrate intermediate design skills."
            user_scope = "2-3 different user scenarios"
        else:  # ADVANCED
            scope = "comprehensive, complex multi-flow"
            complexity = "Design complete user journeys, handle edge cases, and demonstrate strategic thinking."
            user_scope = "multiple user personas with diverse needs"
        
        if role == DesignRole.UI_DESIGNER:
            # UI Designer: Focus on visual design, interface aesthetics, pixel-perfect execution
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create a {scope} landing page design for a {topic}. Focus on establishing a clean visual foundation with proper typography hierarchy, a simple 2-3 color palette, and basic spacing principles. {complexity} This is an entry-level task to demonstrate your understanding of visual design fundamentals.",
                    TaskType.MOBILE_APP: f"Design a {scope} mobile app screen for a {topic}. Focus on creating a clean, simple interface with clear visual hierarchy, readable typography, and basic UI components (buttons, inputs, cards). {complexity} Demonstrate your grasp of mobile design basics.",
                    TaskType.DASHBOARD: f"Create a {scope} dashboard interface for a {topic}. Design a simple layout with 2-3 data cards or widgets, basic charts, and clear visual organization. {complexity} Show your ability to present information clearly and attractively.",
                    TaskType.COMPONENT: f"Design a {scope} UI component for a {topic}. Create a single component (button, card, or input field) with 2-3 states. {complexity} Demonstrate attention to visual detail and consistency."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page for a {topic} with multiple sections (hero, features, testimonials, CTA). Focus on creating visual consistency across sections, implementing a cohesive design system, and balancing aesthetics with functionality. {complexity} Demonstrate your ability to handle moderate complexity.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app interface for a {topic} with 3-4 connected screens. Focus on visual consistency, smooth transitions between states, and implementing interactive elements. {complexity} Show your skills in creating cohesive multi-screen experiences.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard for a {topic} with 4-6 data visualization widgets, filtering options, and responsive layout. Focus on creating visual hierarchy, consistent styling, and making complex data look elegant. {complexity} Demonstrate your ability to organize and beautify data.",
                    TaskType.COMPONENT: f"Create a {scope} component library for a {topic} with 3-5 related components. Design multiple states, variations, and ensure visual consistency. {complexity} Show your understanding of design systems and scalability."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page system for a {topic} with multiple page variations, responsive breakpoints, and advanced interactions. Create a complete visual design system with typography scales, color systems, spacing tokens, and component libraries. {complexity} Demonstrate mastery of visual design at scale.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app design for a {topic} covering complete user flows with 8-10 screens. Design for multiple device sizes, handle complex interactions, create custom illustrations or icons, and establish a unique visual identity. {complexity} Show expert-level visual design thinking.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard platform for a {topic} with advanced data visualizations, customizable layouts, multiple user views, and sophisticated filtering. Create a complete design system that scales across different dashboard types. {complexity} Demonstrate strategic visual design for complex products.",
                    TaskType.COMPONENT: f"Create a {scope} enterprise-grade component system for a {topic} with 10+ components, comprehensive documentation, accessibility considerations, and theming capabilities. {complexity} Show mastery of design systems and scalable visual architecture."
                }
        
        elif role == DesignRole.UX_DESIGNER:
            # UX Designer: Focus on user flows, research, usability, problem-solving
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page user experience for a {topic}. Focus on creating a clear information hierarchy, simple navigation, and one primary call-to-action. {complexity} Consider {user_scope} and their basic needs.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app user flow for a {topic}. Design a simple 2-3 step user journey with clear navigation and basic error handling. {complexity} Focus on {user_scope} completing one primary task.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard experience for a {topic}. Create a simple information architecture with 2-3 main sections and basic navigation. {complexity} Help {user_scope} find and understand key information easily.",
                    TaskType.COMPONENT: f"Design a {scope} component interaction pattern for a {topic}. Focus on one component's usability, accessibility basics, and clear user feedback. {complexity} Ensure {user_scope} can use it intuitively."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page experience for a {topic} with multiple conversion paths. Create user journey maps, consider {user_scope}, and optimize for different entry points. {complexity} Include A/B testing considerations and accessibility compliance.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app UX for a {topic} with 4-6 interconnected screens. Design complete user flows, handle error states, create onboarding, and ensure accessibility. {complexity} Address {user_scope} and their different goals.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard experience for a {topic} with multiple user workflows. Create task flows, information architecture, and navigation patterns for {user_scope}. {complexity} Reduce cognitive load and optimize for efficiency.",
                    TaskType.COMPONENT: f"Design a {scope} component system UX for a {topic} with 3-5 components. Focus on interaction patterns, accessibility (WCAG AA), keyboard navigation, and usability for {user_scope}. {complexity} Ensure intuitive and inclusive design."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page strategy for a {topic} based on user research. Create detailed user personas, journey maps, conduct competitive analysis, and design for {user_scope} with different motivations. {complexity} Include usability testing plans and optimization strategies.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app UX strategy for a {topic} covering complete user journeys. Conduct user research, create personas, design 10+ screens with complex flows, handle all edge cases, and ensure WCAG AAA compliance. {complexity} Address {user_scope} and their diverse needs comprehensively.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard UX system for a {topic} with advanced workflows. Create comprehensive information architecture, multiple user role experiences, complex filtering and search, and personalization options. {complexity} Optimize for {user_scope} with varying expertise levels.",
                    TaskType.COMPONENT: f"Design a {scope} component system UX for a {topic} with comprehensive accessibility. Create 10+ components with full WCAG AAA compliance, internationalization support, and usability for {user_scope} including users with disabilities. {complexity} Demonstrate expert-level inclusive design."
                }
        
        elif role == DesignRole.PRODUCT_DESIGNER:
            # Product Designer: Focus on business goals, strategy, end-to-end experience
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page product for a {topic}. Define one clear business goal (e.g., sign-ups), identify {user_scope}, and create a simple value proposition. {complexity} Balance basic business needs with user experience.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app product concept for a {topic}. Define the core problem, identify {user_scope}, and design one key feature. {complexity} Show basic product thinking and user-business alignment.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard product for a {topic}. Define 1-2 key metrics, identify {user_scope}, and create a simple dashboard that supports business goals. {complexity} Demonstrate basic product strategy.",
                    TaskType.COMPONENT: f"Design a {scope} component product strategy for a {topic}. Define how components support business goals, consider {user_scope}, and create basic documentation. {complexity} Show understanding of design systems as products."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page product strategy for a {topic}. Define 2-3 business KPIs, create user personas for {user_scope}, conduct basic competitive analysis, and design for conversion optimization. {complexity} Balance business metrics with user satisfaction.",
                    TaskType.MOBILE_APP: f"Create a {scope} mobile app product for a {topic}. Define product strategy, create personas for {user_scope}, design 3-4 core features, and establish success metrics. {complexity} Show product thinking that balances business and user needs.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard product for a {topic}. Define business KPIs, identify {user_scope}, create monetization strategy, and design engagement features. {complexity} Demonstrate strategic product design for data products.",
                    TaskType.COMPONENT: f"Design a {scope} component system product for a {topic}. Define adoption metrics, create governance model, design for {user_scope} (designers and developers), and plan rollout strategy. {complexity} Show product thinking for design systems."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Design a {scope} landing page product ecosystem for a {topic}. Conduct market research, define comprehensive business strategy, create detailed personas for {user_scope}, perform competitive analysis, and design multi-variant testing strategy. {complexity} Demonstrate strategic product leadership.",
                    TaskType.MOBILE_APP: f"Lead a {scope} mobile app product strategy for a {topic}. Define complete product vision, conduct user research, create personas for {user_scope}, design 8-10 features with roadmap, establish OKRs, and plan go-to-market strategy. {complexity} Show executive-level product thinking.",
                    TaskType.DASHBOARD: f"Design a {scope} dashboard product platform for a {topic}. Define business model, create pricing strategy, design for {user_scope} with different subscription tiers, establish growth metrics, and plan scaling strategy. {complexity} Demonstrate product leadership for complex platforms.",
                    TaskType.COMPONENT: f"Design a {scope} enterprise component system product for a {topic}. Define adoption strategy, create governance framework, design for {user_scope} across multiple teams, establish metrics, and plan multi-year roadmap. {complexity} Show strategic product thinking at organizational scale."
                }
        
        else:  # DesignRole.VISUAL_DESIGNER
            # Visual Designer: Focus on branding, visual storytelling, creative expression
            if difficulty == DifficultyLevel.BEGINNER:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create a {scope} landing page visual design for a {topic}. Focus on establishing a basic brand identity with a simple color palette (2-3 colors), one typography pairing, and basic visual elements. {complexity} Show your creative foundation.",
                    TaskType.MOBILE_APP: f"Design a {scope} mobile app visual identity for a {topic}. Create a simple brand style with basic color scheme, typography, and 2-3 custom icons. {complexity} Demonstrate your visual creativity basics.",
                    TaskType.DASHBOARD: f"Create a {scope} dashboard visual design for a {topic}. Design simple custom charts with basic brand styling and consistent visual language. {complexity} Show your ability to make data visually appealing.",
                    TaskType.COMPONENT: f"Design a {scope} component visual style for a {topic}. Create basic brand styling for one component with simple visual treatments. {complexity} Demonstrate attention to visual brand details."
                }
            elif difficulty == DifficultyLevel.INTERMEDIATE:
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create a {scope} landing page brand experience for a {topic}. Design a cohesive visual identity with custom illustrations, unique color system, typography pairings, and branded visual elements. {complexity} Show your creative visual storytelling.",
                    TaskType.MOBILE_APP: f"Design a {scope} mobile app brand identity for a {topic}. Create custom visual assets (illustrations, icons, graphics), establish unique visual language, and design branded interactions. {complexity} Demonstrate your creative visual design skills.",
                    TaskType.DASHBOARD: f"Create a {scope} dashboard brand experience for a {topic}. Design custom data visualizations, create unique visual style, use color and typography to express brand personality, and make data beautiful. {complexity} Show your creative approach to data design.",
                    TaskType.COMPONENT: f"Design a {scope} component brand system for a {topic}. Create branded components with custom visual treatments, unique styling, and cohesive visual language. {complexity} Demonstrate your brand design thinking."
                }
            else:  # ADVANCED
                task_descriptions = {
                    TaskType.LANDING_PAGE: f"Create a {scope} landing page brand system for a {topic}. Design complete brand identity with custom illustrations, motion design principles, unique visual language, and comprehensive brand guidelines. {complexity} Demonstrate mastery of brand visual design.",
                    TaskType.MOBILE_APP: f"Design a {scope} mobile app brand experience for a {topic}. Create comprehensive visual identity with custom illustration system, motion design, unique iconography, and branded micro-interactions. {complexity} Show expert-level creative visual design.",
                    TaskType.DASHBOARD: f"Create a {scope} dashboard brand platform for a {topic}. Design innovative data visualizations, create unique visual design system, establish brand personality through creative design, and push visual boundaries. {complexity} Demonstrate creative leadership in data visualization.",
                    TaskType.COMPONENT: f"Design a {scope} enterprise brand system for a {topic}. Create comprehensive branded component library with custom visual treatments, motion principles, illustration system, and complete brand guidelines. {complexity} Show mastery of brand systems at scale."
                }
        
        description = task_descriptions.get(
            task_type,
            f"Design a {scope} {task_name} for a {topic}. {complexity}"
        )
        
        # Generate ROLE-SPECIFIC constraints
        if role == DesignRole.UI_DESIGNER:
            constraints = [
                "Create pixel-perfect designs with precise alignment and spacing",
                "Use a cohesive color palette with proper contrast ratios (WCAG AA)",
                "Demonstrate mastery of typography hierarchy and readability",
                "Ensure consistent visual styling across all elements",
                f"Follow {topic} industry visual design standards"
            ]
        elif role == DesignRole.UX_DESIGNER:
            constraints = [
                "Create user flows and journey maps to support your design decisions",
                "Ensure accessibility compliance (WCAG 2.1 AA) for all users",
                "Design for edge cases, error states, and loading states",
                "Minimize cognitive load and optimize task completion",
                f"Address real user problems in the {topic} domain"
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
                "Ensure visual consistency and brand coherence",
                f"Differentiate from competitors in the {topic} space"
            ]
        
        # Add difficulty-specific constraints
        if difficulty == DifficultyLevel.ADVANCED:
            constraints.extend([
                "Design for multiple user personas and use cases",
                "Demonstrate strategic thinking and comprehensive planning"
            ])
        elif difficulty == DifficultyLevel.INTERMEDIATE:
            constraints.extend([
                "Include interactive states and transitions",
                "Ensure responsive design for target platform"
            ])
        else:  # BEGINNER
            constraints.append("Focus on core functionality and clear execution")
        
        # ROLE-SPECIFIC Deliverables
        if role == DesignRole.UI_DESIGNER:
            deliverables = [
                "High-fidelity UI screens with pixel-perfect execution",
                "Design specifications (spacing, colors, typography)",
                "Component style guide or design tokens"
            ]
        elif role == DesignRole.UX_DESIGNER:
            deliverables = [
                "User flow diagrams and journey maps",
                "Low-to-mid fidelity wireframes for key screens",
                "UX rationale document explaining design decisions"
            ]
        elif role == DesignRole.PRODUCT_DESIGNER:
            deliverables = [
                "User personas and problem statements",
                "Complete product flow diagrams",
                "High-fidelity screens for core features",
                "Product strategy document with business alignment"
            ]
        else:  # VISUAL_DESIGNER
            deliverables = [
                "High-fidelity visual designs with unique brand identity",
                "Custom visual assets (illustrations, icons, graphics)",
                "Brand style guide (colors, typography, visual language)"
            ]
        
        # ROLE-SPECIFIC Evaluation criteria
        if role == DesignRole.UI_DESIGNER:
            evaluation_criteria = [
                "Visual design quality and aesthetic appeal",
                "Pixel-perfect execution and attention to detail",
                "Typography and color usage",
                "Consistency and visual hierarchy"
            ]
        elif role == DesignRole.UX_DESIGNER:
            evaluation_criteria = [
                "User flow logic and completeness",
                "Usability and accessibility",
                "Problem-solving approach",
                "Edge case handling and error prevention"
            ]
        elif role == DesignRole.PRODUCT_DESIGNER:
            evaluation_criteria = [
                "Strategic thinking and business alignment",
                "User research and persona accuracy",
                "End-to-end product experience",
                "Balance of business goals and user needs"
            ]
        else:  # VISUAL_DESIGNER
            evaluation_criteria = [
                "Visual creativity and innovation",
                "Brand identity and personality",
                "Visual storytelling effectiveness",
                "Unique and memorable aesthetic"
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