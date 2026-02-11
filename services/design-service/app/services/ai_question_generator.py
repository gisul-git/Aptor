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
        created_by: str = "system"
    ) -> DesignQuestionModel:
        """Generate a design question using AI"""
        
        prompt = self._build_generation_prompt(role, difficulty, task_type, topic)
        
        try:
            if self.provider == "openai":
                response = await self._generate_with_openai(prompt)
            elif self.provider == "gemini":
                response = await self._generate_with_gemini(prompt)
            elif self.provider == "claude":
                response = await self._generate_with_claude(prompt)
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
            
            return self._parse_ai_response(response, role, difficulty, task_type, created_by)
            
        except Exception as e:
            logger.error(f"AI question generation failed: {e}")
            # Fallback to template-based generation
            return self._generate_fallback_question(role, difficulty, task_type, topic, created_by)
    
    def _build_generation_prompt(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str = None
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
        
        base_prompt = f"""You are an intelligent Design Question Generation Engine for a professional hiring assessment platform. Your task is to generate high-quality, role-specific, difficulty-based, and practical design challenges that accurately evaluate real-world design skills.

### INPUT PARAMETERS:
Role: {role_str}
Difficulty Level: {difficulty_str}
Topic: {topic_str}
Question Type: UI design task

### QUESTION GENERATION RULES:
1. Role-Focused: Tailor the challenge strictly based on {role_str}. Match the thinking style, responsibilities, and workflow of that role.
2. Difficulty-Based Complexity Control:
   - Easy: Single screen or simple task, minimal constraints, basic layout
   - Medium: Multi-section screens or simple flows, moderate constraints
   - High: Complete user flows or complex UX scenarios, strong reasoning
   - Expert: Product-level or system-level thinking, multi-step workflows
3. Clear Deliverables: Explicitly define what the candidate must submit
4. Real-World Practicality: Questions must reflect real product and business scenarios
5. Constraint Design: Add realistic constraints based on difficulty level

### OUTPUT FORMAT (STRICT):
Generate a complete design challenge following this structure:

**Role:** {role_str}
**Level:** {difficulty_str}
**Topic:** {topic_str}

**Design Challenge:**
(Write a complete, real-world design problem statement including scenario, constraints, and expectations)

**Constraints:**
- List 4-8 structured constraints based on difficulty level

**Expected Deliverables:**
- Clear list of outputs the candidate must submit

### QUALITY CHECK:
- Is the task role-specific? ✓
- Is the difficulty level properly reflected? ✓
- Are the constraints realistic? ✓
- Are the deliverables clear and measurable? ✓

Now generate ONE complete, well-structured design question following the format above.

IMPORTANT: Return ONLY a JSON object with this structure:
{{
    "title": "Brief descriptive title (max 100 chars)",
    "description": "Complete design challenge text from the 'Design Challenge' section",
    "constraints": ["constraint1", "constraint2", "constraint3", "constraint4"],
    "deliverables": ["deliverable1", "deliverable2", "deliverable3"],
    "evaluation_criteria": ["Visual hierarchy and clarity", "User experience and usability", "Design consistency", "Technical feasibility"],
    "time_limit_minutes": 60
}}

Generate the question now."""
        
        return base_prompt.strip()
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate using OpenAI"""
        response = await openai.ChatCompletion.acreate(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert design interviewer creating assessment questions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
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
        created_by: str
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
            return self._generate_fallback_question(role, difficulty, task_type, topic, created_by)
    
    def _generate_topic_based_question(
        self,
        role: DesignRole,
        difficulty: DifficultyLevel,
        task_type: TaskType,
        topic: str,
        created_by: str
    ) -> DesignQuestionModel:
        """Generate question based on custom topic"""
        
        # Create role-specific, task-specific descriptions
        role_name = role.value.replace('_', ' ').title()
        task_name = task_type.value.replace('_', ' ')
        
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
        
        # Deliverables
        deliverables = [
            "High-fidelity design screens",
            "Design specifications and annotations",
            "Brief design rationale"
        ]
        
        # Evaluation criteria
        evaluation_criteria = [
            "Visual design quality",
            "User experience and usability",
            "Technical feasibility",
            "Design thinking and creativity"
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
            task_type=task_type,
            title=f"{topic} {task_name.title()} - {role_name} Challenge",
            description=full_description,
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
        created_by: str
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
                "title": f"{topic} {task_name.title()} - {role_name} Challenge",
                "description": full_description,
                "constraints": constraints,
                "constraints": [
                    "Follow modern design principles and best practices",
                    "Ensure responsive design for target platform",
                    "Maintain accessibility compliance (WCAG 2.1)",
                    "Use consistent visual language and design system thinking"
                ],
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