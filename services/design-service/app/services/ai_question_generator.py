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
        open_requirements: str = None,
        created_by: str = "system"
    ) -> DesignQuestionModel:
        """Generate a design question using AI"""
        
        prompt = self._build_generation_prompt(role, difficulty, task_type, topic, experience_level, open_requirements)
        
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
        experience_level: str = None,
        open_requirements: str = None
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
        
        # Build additional requirements section if provided
        additional_requirements_section = ""
        if open_requirements and open_requirements.strip():
            additional_requirements_section = f"""

--------------------------------------------------

ADDITIONAL REQUIREMENTS (CRITICAL)

The user has provided specific additional requirements that MUST be incorporated into the design challenge:

{open_requirements.strip()}

IMPORTANT:
• These requirements are MANDATORY and must be reflected in the challenge
• Incorporate them into the description, constraints, or deliverables as appropriate
• Do NOT ignore or override these requirements
• If they conflict with standard rules, prioritize these user requirements

--------------------------------------------------
"""
        
        base_prompt = f"""SYSTEM ROLE

You are an AI Design Assessment Generator used in a professional hiring platform.

The system generates structured design challenges used in automated design interviews with hybrid evaluation (rule-based + AI visual scoring).

The goal is to produce clear, realistic, and evaluatable design tasks that simulate real product design problems.

⚠️ EVALUATION-READY REQUIREMENT:
Constraints must be MEASURABLE and VERIFIABLE so that automated evaluation can assess them.
The evaluation engine checks: alignment, spacing consistency, typography hierarchy, color contrast, visual hierarchy, and component consistency.
Therefore, constraints must define SPECIFIC VALUES (exact pixels, ratios, counts) that map directly to these scoring rules.

Each challenge must:
• clearly describe the design problem
• specify what the candidate must design
• define measurable constraints that map to evaluation scoring
• specify concrete deliverables
• define how the submission will be evaluated

Use professional and neutral language.

Do NOT use conversational phrases such as: "You", "Your", "You should", "Try to".

Instead use neutral instructions like:
"The task is to design"
"The candidate must create"
"The interface should include"

--------------------------------------------------

STRUCTURE RULE (CRITICAL - MANDATORY - ABSOLUTE REQUIREMENT)

Every generated design challenge MUST include the following sections in this exact order:

1. Description
2. Task Requirements ⚠️ MANDATORY - DO NOT SKIP THIS SECTION
3. Constraints
4. Deliverables
5. Evaluation Criteria

⚠️ CRITICAL: The "Task Requirements" section is ABSOLUTELY MANDATORY for ALL difficulty levels.

WITHOUT "Task Requirements", the challenge is INCOMPLETE and UNUSABLE.

The AI MUST NOT generate a challenge without explicitly listing what screens/components to design.

If you skip "Task Requirements", the output will be REJECTED.

MANDATORY TASK SECTION RULE:
• Every generated challenge MUST include a section titled "Task Requirements"
• This section must list the specific screens, flows, or artifacts the candidate must design
• Do NOT generate a challenge without this section
• This is NOT optional - it is REQUIRED

--------------------------------------------------

INPUT PARAMETERS

Role: {role_str}
Difficulty: {difficulty_str}
Experience Level: {experience_str}
Task Type: {task_str}
Topic: {topic_str}
{additional_requirements_section}
--------------------------------------------------

EXPERIENCE LEVEL ADJUSTMENTS (CRITICAL FOR SENIOR CANDIDATES)

The experience level significantly impacts question complexity and expectations:

**FRESHER (0 years):**
- Focus on basic design principles and simple layouts
- Clear, straightforward requirements
- Minimal complexity, single-user scenarios
- Basic deliverables (screens + simple documentation)

**1-3 YEARS:**
- Standard design challenges with moderate complexity
- Multi-screen flows with clear user journeys
- Basic interaction states
- Standard deliverables (screens + component library + style guide)

**3-5 YEARS:**
- More sophisticated design problems
- Consider edge cases and error states
- System thinking starts to emerge
- Enhanced deliverables (+ interaction specs, user flows)

**SENIOR (5+ years):**
⚠️ CRITICAL: Senior-level questions MUST be significantly more sophisticated:

1. **Complex Problem Spaces:**
   - Multi-stakeholder scenarios (users, admins, moderators)
   - Cross-platform considerations (mobile + web + tablet)
   - Real-world constraints (legacy system integration, technical debt, migration paths)
   - Business constraints (budget limits, timeline pressures, team size)

2. **Strategic Thinking Required:**
   - Must explain design decisions and trade-offs
   - Must consider scalability and future growth
   - Must address technical feasibility
   - Must balance user needs with business goals

3. **Advanced Deliverables:**
   - Design system thinking (not just components)
   - Migration strategies (from old to new design)
   - Accessibility compliance documentation
   - Performance considerations
   - Responsive design specifications
   - Design tokens and theming systems

4. **Real-World Complexity:**
   - Incomplete or conflicting requirements (candidate must make decisions)
   - Multiple user personas with different needs
   - Integration with existing systems
   - Data privacy and security considerations
   - Internationalization and localization needs

5. **Leadership & Communication:**
   - Deliverables must include rationale for key decisions
   - Must demonstrate ability to communicate design choices
   - Must show understanding of developer handoff
   - Must consider team collaboration and design system governance

**SENIOR QUESTION CHARACTERISTICS:**
- Description should mention business context and constraints
- Task Requirements should include ambiguity that requires decision-making
- Constraints should include real-world technical limitations
- Deliverables MUST include "Design decision documentation" or "Trade-off analysis"
- Evaluation criteria should emphasize strategic thinking (30% weight minimum)

**EXAMPLE SENIOR-LEVEL ADDITIONS:**
- "The existing system uses a legacy design that cannot be changed immediately. Design a migration path."
- "The development team has limited resources. Prioritize features for MVP vs future releases."
- "The product serves both B2B and B2C users with different needs. Design for both."
- "The design must work across web, iOS, and Android with a single design system."
- "Consider accessibility compliance (WCAG 2.1 AA) and document your approach."

--------------------------------------------------

ROLE EXPECTATIONS

UI Designer
Focus on layout design, visual hierarchy, component design, spacing systems, and typography.
⚠️ MUST include Task Requirements listing specific UI screens to design.

UX Designer
Focus on user flows, usability improvements, navigation structure, and interaction patterns.
⚠️ MUST include Task Requirements listing specific wireframes/flows to design.

Product Designer
Focus on end-to-end product experiences, feature prioritization, user journeys, and product decisions.
⚠️ MUST include Task Requirements listing specific product screens/flows to design.

Visual Designer
Focus on visual identity, iconography, color systems, and aesthetic execution.
⚠️ MUST include Task Requirements listing specific visual mockups to design.

Interaction Designer
Focus on micro-interactions, animations, gesture controls, and interactive patterns.
⚠️ MUST include Task Requirements listing specific interaction screens to design.

UI DESIGN TASK RULE:
For UI Designer challenges:
• Beginner → 2-3 screens with simple descriptions
• Intermediate → 3-4 screens with moderate descriptions
• Advanced → 4-6 screens with detailed descriptions
Each screen must include a short description of what UI elements should appear.

--------------------------------------------------

DIFFICULTY SCALING

Beginner
• Single screen or simple UI task
• Minimal product decisions
• 2–3 deliverables

Intermediate
• Multi-section screen or dashboard
• Moderate constraints
• 3–4 deliverables

Advanced
• Multi-screen flows or full product feature
• UX decision-making required
• 4–5 deliverables

--------------------------------------------------

TASK CLARITY RULE (CRITICAL)

The challenge must clearly describe what the candidate must design.

Avoid vague instructions such as: "Design an app"

Instead explicitly specify:
• required screens
• required flow steps
• required components
• required interactions

Example:

Design the onboarding flow including the following screens:
1. Welcome screen
2. Account setup
3. Preference selection
4. Confirmation screen

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
• Focus on a SINGLE screen or simple 2-3 screen interface
• Task Requirements MUST list 2-3 simple screens with clear descriptions
• Each screen description should explain what elements to include
• NO personas, NO user research, NO journey maps, NO strategy documents
• NO business metrics or KPIs
• Limit deliverables to 2-3 items ONLY
• Focus on: layout, visual hierarchy, basic usability, simple navigation
• Constraints: 6 constraints ONLY
• Description: 3-4 sentences maximum, focus on the design task

BEGINNER TASK REQUIREMENTS RULE:
For beginner challenges, Task Requirements must include 2-3 simple screens or flows.
Clearly describe what should appear on each screen.
Focus on basic navigation and usability problems.

Example Beginner Task Requirements:
```
Task Requirements

Design the following screens:

1️⃣ Course discovery screen
This screen should help users browse available courses.
Include:
• search bar for courses
• category filters
• featured courses section
• course cards with title and rating

2️⃣ Course details screen
This screen provides information about a selected course.
Include:
• course title
• instructor information
• course description
• course modules preview
• enrollment button
```

INTERMEDIATE DIFFICULTY MUST:
• Focus on 3-5 connected screens OR a dashboard with multiple sections
• Task Requirements MUST list 3-5 screens with moderate descriptions
• May include basic user flows (simple diagrams)
• NO deep research, NO personas, NO strategy
• Limit deliverables to 3-4 items
• Focus on: component design, interaction states, usability
• Constraints: 8 constraints
• Description: 4-5 sentences, include user context and goals

ADVANCED DIFFICULTY MUST:
• Focus on 5-8 screens with complex interactions and end-to-end workflows
• Task Requirements MUST list 4-6 screens with DETAILED descriptions using "Include:" format
• Include collaboration features, edge cases, or system complexity
• Require product thinking and decision explanation in deliverables
• Focus on system thinking, not just isolated screens
• May include user flows, interaction specifications
• May include light personas (1 persona max)
• Limit deliverables to 4-5 items (MUST include decision explanation)
• Focus on: system thinking, scalability, collaboration, edge cases, product decisions
• Constraints: 10 constraints
• Description: 5-6 sentences, include user context, business goals, success criteria

CRITICAL ADVANCED RULES:
• Task Requirements MUST specify 4-6 detailed screens with specific features
• Each screen description must include what features/interactions it contains
• Must introduce complexity: collaboration, multi-user scenarios, edge cases, or system workflows
• Deliverables MUST include "Short explanation of key product decisions"
• Evaluation criteria MUST emphasize product thinking (25% weight for Product Designer)

⚠️ SENIOR EXPERIENCE LEVEL (5+ years) ADVANCED QUESTIONS MUST ALSO INCLUDE:

**Additional Complexity for Senior Candidates:**
1. **Strategic Context:**
   - Mention business constraints (budget, timeline, technical limitations)
   - Include stakeholder considerations (multiple user types, conflicting needs)
   - Reference existing systems or legacy constraints

2. **Decision-Making Requirements:**
   - Task Requirements should include scenarios requiring trade-off decisions
   - Example: "Design for both power users and beginners" (candidate must decide approach)
   - Example: "Balance feature richness with development timeline" (prioritization required)

3. **Enhanced Deliverables (Senior only):**
   - Add "Design decision documentation explaining key trade-offs"
   - Add "Migration strategy from current to new design" (if applicable)
   - Add "Accessibility compliance approach (WCAG 2.1 AA)"
   - Add "Responsive design specifications (mobile, tablet, desktop)"

4. **Real-World Constraints:**
   - Mention technical constraints: "Must integrate with existing authentication system"
   - Mention resource constraints: "Development team of 3 engineers, 2-month timeline"
   - Mention scale considerations: "System must support 100K+ daily active users"

5. **Evaluation Emphasis:**
   - Strategic thinking: 30% (increased from 25%)
   - Decision rationale: Must be explicitly evaluated
   - System thinking: Must consider long-term maintainability

**Example Senior-Level Description Addition:**
"The company has an existing legacy system that serves 50K users but has poor usability. The development team consists of 3 engineers with a 3-month timeline. The design must provide a migration path that doesn't disrupt current users while improving the experience for new users. The solution should consider both immediate MVP needs and future scalability."

**Example Senior-Level Task Requirement:**
"Design a permission system that works for both individual users and team administrators, considering that some organizations have complex hierarchies while others are flat. Document your approach to handling these different organizational structures."

--------------------------------------------------

ROLE-SPECIFIC TASK RULE (CRITICAL)

The type of artifacts and deliverables must match the role:

UX Designer → wireframes, user flows, research tasks, information architecture
UI Designer → high-fidelity UI screens, component libraries, visual hierarchy
Product Designer → end-to-end product flows, feature prioritization, product decisions
Visual Designer → visual layouts, brand assets, iconography, visual systems

This ensures the challenge tests the right skills for each role.

--------------------------------------------------

ROLE-SPECIFIC TASK ALIGNMENT

UI Designer:
• Beginner: Single screen UI (home screen, dashboard view, profile page)
• Intermediate: Multi-section interface (dashboard, settings flow, component library)
• Advanced: Complete UI system (multi-screen app, design system, responsive layouts with system thinking)

UX Designer:
• Beginner: Simple wireframe (single screen wireframe, basic user flow)
• Intermediate: User flow with wireframes (3-5 screen flow, interaction specs)
• Advanced: Complete UX system (user journey, multiple flows, accessibility specs, edge cases)

Product Designer:
• Beginner: Simple product feature screen (single feature interface, basic product screen)
• Intermediate: Feature workflow (3-5 screen feature flow, basic user journey)
• Advanced: End-to-end product experience (5-8 screens, collaboration features, product decisions, feature prioritization)

Visual Designer:
• Beginner: Single visual design (hero section, landing section, visual mockup)
• Intermediate: Visual system (multiple sections, visual style guide, icon set)
• Advanced: Complete visual identity (full page designs, custom illustrations, brand visuals, system thinking)

Interaction Designer:
• Beginner: Simple interaction (button states, hover effects, basic animation)
• Intermediate: Interaction flow (micro-interactions, transition specs, animated prototype)
• Advanced: Complex interaction system (gesture controls, advanced animations, interaction patterns, edge cases)

--------------------------------------------------

REAL-WORLD SCENARIO RULE (CRITICAL)

Every design challenge must begin with a short realistic scenario that describes the product context and the problem users face.

The scenario should explain:
• What the product does
• Who the primary users are
• What problem they are facing

This makes the challenge feel like a real product design problem, not just a UI exercise.

--------------------------------------------------

AGE USAGE RULE (CRITICAL)

Do NOT mention age ranges unless they significantly influence design decisions.

Use age ONLY when relevant to:
• Healthcare applications (e.g., "adults aged 60+ tracking medication")
• Children's applications (e.g., "children aged 5-8 learning to read")
• Elderly accessibility scenarios (e.g., "seniors with limited tech experience")

For most applications (dashboards, analytics tools, campaign tools, developer tools), age is NOT relevant.

--------------------------------------------------

PROBLEM-FIRST RULE (CRITICAL)

The design challenge must start by describing the user problem BEFORE asking the candidate to design the interface.

Format:

[Product context] allows users to [main functionality]. However, [current problem users face].

The design goal is to create [interface type] that allows users to:
• [solve problem 1]
• [solve problem 2]
• [solve problem 3]

--------------------------------------------------

DESCRIPTION REQUIREMENTS BY DIFFICULTY

BEGINNER (3-4 sentences):
1. Product context (what the product does)
2. User problem (what users struggle with)
3. Design goal (what the interface should achieve)
4. Keep it simple and problem-focused

Example:
"A task management application allows users to organize their daily tasks. However, users struggle to quickly see their most important tasks for the day. The design goal is to create a simple dashboard that highlights priority tasks and upcoming deadlines."

INTERMEDIATE (4-5 sentences):
1. Product context (what the product does)
2. User problem (specific pain points users face)
3. User needs (2-3 key needs)
4. Design goal (what the interface should achieve)
5. Expected outcome (simple goal)

Example:
"A food delivery application allows users to browse restaurants and order meals online. However, frequent users struggle to quickly track active orders or reorder meals they previously purchased. Users need to quickly track ongoing orders, reorder favorite meals, and access order history easily. The design goal is to create a mobile interface that streamlines the ordering and tracking experience."

ADVANCED (6-8 sentences):
1. Product/service context (what it is, why it exists)
2. User problem (detailed pain points)
3. Business goals (what the company wants to achieve)
4. User needs (3-4 specific needs)
5. Key features or functionality required
6. Design goal (what the interface should achieve)
7. Expected outcome (with context)
8. Additional context (market, competitors, constraints)

Example:
"A healthcare application helps adults aged 60+ track their medication schedules and health metrics. However, current solutions are complex and difficult for elderly users to navigate, leading to missed medications and poor health outcomes. The company aims to improve medication adherence and reduce hospital readmissions. Users need to easily view daily medication schedules, receive clear reminders, log health metrics, and share data with caregivers. The design goal is to create a simple, accessible mobile interface that prioritizes clarity and ease of use for elderly users with limited tech experience. The interface should reduce cognitive load and support users with visual or motor impairments."

⚠️ SENIOR EXPERIENCE LEVEL (5+ years) - ADVANCED DESCRIPTION MUST ALSO INCLUDE:

**Additional Context for Senior Candidates (add 2-3 more sentences):**
9. Business/technical constraints (budget, timeline, team size, technical limitations)
10. Existing system context (legacy systems, migration needs, current user base)
11. Strategic considerations (scalability, future growth, market positioning)

**Example Senior-Level Advanced Description:**
"A healthcare application helps adults aged 60+ track their medication schedules and health metrics. However, current solutions are complex and difficult for elderly users to navigate, leading to missed medications and poor health outcomes. The company aims to improve medication adherence and reduce hospital readmissions. Users need to easily view daily medication schedules, receive clear reminders, log health metrics, and share data with caregivers. The design goal is to create a simple, accessible mobile interface that prioritizes clarity and ease of use for elderly users with limited tech experience. The interface should reduce cognitive load and support users with visual or motor impairments. **The company has an existing web platform with 50K active users that cannot be immediately deprecated. The development team consists of 4 engineers with a 4-month timeline. The design must provide a migration path from the legacy system while meeting WCAG 2.1 AA accessibility standards. The solution should consider both immediate MVP needs for mobile and future expansion to tablet and web platforms.**"

--------------------------------------------------

TASK REQUIREMENTS SECTION (MANDATORY - CRITICAL)

Every design challenge MUST include a "Task Requirements" section that explicitly lists the exact screens, flows, or components the candidate must design.

Without this section, candidates won't know what to submit.

Format:

**Task Requirements**

Design [an end-to-end experience / the following screens / components]:

1️⃣ [Screen/Component name]
   [Detailed description of what this includes - list specific features]

2️⃣ [Screen/Component name]
   [Detailed description of what this includes - list specific features]

3️⃣ [Screen/Component name]
   [Detailed description of what this includes - list specific features]

4️⃣ [Screen/Component name] (if applicable)
   [Detailed description of what this includes - list specific features]

CRITICAL RULES BY DIFFICULTY:

**BEGINNER (2-3 screens)**:
• Simple descriptions (one sentence)
• Focus on basic features

**INTERMEDIATE (3-5 screens)**:
• Moderate descriptions (1-2 sentences)
• Include key features

**ADVANCED (4-6 screens)**:
• DETAILED descriptions (2-4 sentences with bullet points)
• Include specific features, interactions, and edge cases
• Introduce complexity: collaboration, multi-user, system workflows
• Each screen must list 3-5 specific features using "Include:" format

Examples by Difficulty:

**BEGINNER Mobile App:**
1️⃣ Home dashboard - Display active orders and quick actions
2️⃣ Order tracking screen - Show delivery status

**INTERMEDIATE Mobile App:**
1️⃣ Home dashboard - Display active orders, recommended items, and quick reorder section
2️⃣ Order tracking screen - Show real-time delivery status and driver progress
3️⃣ Order history screen - Display past orders with quick reorder option

**ADVANCED Mobile App (Product Designer):**
Design an end-to-end itinerary planning experience that includes:

1️⃣ Trip Overview Screen
This screen provides a summary of an upcoming trip.
Include:
• destination information
• travel dates
• trip participants
• quick summary of booked items (flights, hotels, activities)
• button to add new itinerary items

2️⃣ Daily Itinerary Screen
This screen shows a day-by-day timeline of planned activities.
Include:
• timeline layout of activities
• time slots for events
• transportation details
• location previews or map references
• option to edit or reorder activities

3️⃣ Add Activity / Booking Screen
This screen allows users to add new itinerary items.
Include:
• activity title
• date and time
• location selection
• notes or attachments
• category (flight, hotel, activity, transport)

4️⃣ Trip Collaboration Screen
This screen allows users to collaborate with others.
Include:
• list of trip participants
• shared editing permissions
• comments or suggestions for activities
• notifications for itinerary changes

5️⃣ Travel Resource Screen
This screen provides helpful travel information.
Include:
• booking confirmations
• travel documents
• emergency contacts
• weather or travel updates

CRITICAL RULES:
• This section is MANDATORY for all questions
• Beginner: 2-3 screens with simple descriptions
• Intermediate: 3-5 screens with moderate descriptions
• Advanced: 4-6 screens with DETAILED descriptions and specific features
• Use numbered emoji format (1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣)
• Advanced MUST use "Include:" format with bullet points

--------------------------------------------------

PLATFORM DETECTION RULE (CRITICAL)

The canvas width and grid system MUST match the interface type:

**Mobile Interface** (use when topic contains: "mobile", "mobile UI", "app", "prototype", "checkout", "booking", "delivery app"):
• Canvas width: 375px mobile layout
• Grid system: 8-column grid

**Desktop Interface** (use when topic contains: "dashboard", "analytics", "admin panel", "landing page", "website"):
• Canvas width: 1440px desktop layout
• Grid system: 12-column grid

CRITICAL: If the topic says "mobile" anywhere, you MUST use 375px canvas width.

--------------------------------------------------

CONSTRAINT FORMAT RULE (CRITICAL)

Constraints MUST be short and concise. Each constraint should be ONE LINE without long explanations.

Format: "[Constraint name]: [Value/Rule]"

✅ GOOD (Concise):
"Canvas width: 375px mobile layout"
"Grid system: 8-column grid"
"Spacing system: 8px baseline grid"
"Maximum primary colors: 4"
"Minimum contrast ratio: 4.5:1"
"Minimum touch target height: 44px"

❌ BAD (Too long):
"Canvas width: 375px mobile layout - This ensures the design is optimized for mobile devices. All elements must fit..."

--------------------------------------------------

CONSTRAINT RULES (EVALUATION-READY)

⚠️ CRITICAL: Constraints must be MEASURABLE and VERIFIABLE so that automated evaluation can assess them.

Each constraint should define SPECIFIC VALUES that the evaluation engine can check:
• spacing scale (exact pixel values)
• grid margins and gutters (exact measurements)
• minimum touch target sizes (exact dimensions)
• typography levels (exact count)
• accessibility ratios (exact numbers)

Constraints directly map to evaluation scoring:
• Layout constraints → alignment scoring
• Spacing constraints → spacing consistency scoring
• Typography constraints → hierarchy scoring
• Accessibility constraints → contrast scoring
• Component constraints → component consistency scoring

**REQUIRED LAYOUT & GRID CONSTRAINTS (all difficulty levels):**

1. Canvas width: [375px mobile layout OR 1440px desktop layout based on platform detection]
2. Grid system: [8-column grid with 16px margins and 16px gutters for mobile OR 12-column grid with 24px margins and 24px gutters for desktop]
   All major UI elements must align to grid columns
3. Spacing system: 8px baseline grid
   Allowed spacing values: 8px, 16px, 24px, 32px, 40px, 48px
   All margins and padding must follow this spacing scale

**REQUIRED ACCESSIBILITY CONSTRAINTS (all difficulty levels):**

4. Minimum contrast ratio: 4.5:1 (WCAG AA)
   All text elements must meet accessibility contrast standards
5. Minimum touch target size: 44px × 44px
   All buttons and interactive elements must follow this rule

**REQUIRED TYPOGRAPHY CONSTRAINT (all difficulty levels):**

6. Typography hierarchy: minimum [3 levels for BEGINNER/INTERMEDIATE, 4 levels for ADVANCED]
   Each level must have distinct size and weight differences
   Example: Heading, Section title, Body text

BEGINNER (8 constraints total):
Required 6 + Choose 2 from:
• Maximum primary colors: 3-4
• Icon size: 20px or 24px
• Border radius: 8px or 16px
• Component spacing: 8px, 16px, or 24px padding

INTERMEDIATE (10 constraints total):
Required 6 + Choose 4 from:
• Maximum primary colors: 3-4
• Icon size: 20px or 24px
• Border radius: 8px or 16px
• Component spacing: 8px, 16px, or 24px padding
• Information hierarchy must clearly separate primary, secondary, and supporting content
  Primary content must be visually dominant using size, weight, or spacing
• Reusable UI components must be used for repeated elements (cards, buttons, inputs)
• Shadow system: 3 elevation levels (subtle, medium, prominent)

ADVANCED (12 constraints total):
Required 6 + Choose 6 from:
• Maximum primary colors: 3-4
• Icon size: 20px or 24px
• Border radius: 8px or 16px
• Component spacing: 8px, 16px, or 24px padding
• Information hierarchy must clearly separate primary, secondary, and supporting content
  Primary content must be visually dominant using size, weight, or spacing
• Each screen should contain no more than 5-7 primary UI components above the fold to maintain readability
• Reusable UI components must be used for repeated elements (cards, buttons, inputs, navigation)
• At least one interaction state must be included (loading, empty, or error state)
• Shadow system: 3 elevation levels (subtle, medium, prominent)
• Animation timing: 200-300ms transitions for micro-interactions
• Accessibility: WCAG AA compliance for all interactive elements
• Loading states: skeleton screens or spinners for async operations

--------------------------------------------------

DELIVERABLE RULES BY DIFFICULTY

DELIVERABLE FORMAT RULE:

Deliverables must be clear and concise. Use bullet points.

Format:
"Candidates must submit:"
• [Number] high-fidelity [screens/components]
• [Specific artifact] (e.g., component library, style guide)
• [Optional artifact if applicable]

BEGINNER (2-3 deliverables ONLY):

UI Designer:
• 1-2 high-fidelity screens
• Component list

UX Designer:
• 1-2 wireframe screens
• Simple user flow diagram

Product Designer:
• 1-2 product feature screens
• Component list

Visual Designer:
• 1-2 visual design mockups
• Color palette

Interaction Designer:
• 1-2 screens with interaction states
• Interaction specification

INTERMEDIATE (3-4 deliverables):

UI Designer:
• 3-5 high-fidelity screens
• Component library
• Style guide

UX Designer:
• 3-5 wireframe screens
• User flow diagram
• Interaction specifications

Product Designer:
• 3-5 product screens
• User flow diagram
• Feature specifications

Visual Designer:
• 3-5 visual mockups
• Visual style guide
• Icon set

Interaction Designer:
• 3-5 screens with interactions
• Micro-interaction specifications
• Animation timing guide
• Interactive prototype

ADVANCED (4-5 deliverables):

UI Designer:
• 5-8 high-fidelity screens
• Complete design system
• Responsive layouts
• Component documentation

UX Designer:
• 5-8 wireframe screens
• Complete user flow
• Interaction specifications
• Light persona (1 persona)

Product Designer:
• 5-8 high-fidelity product screens
• User journey flow diagram
• Feature prioritization rationale
• Short explanation of key product decisions

Visual Designer:
• 5-8 visual mockups
• Complete visual system
• Custom illustrations
• Brand guidelines

Interaction Designer:
• 5-8 screens with interactions
• Complete interaction system
• Advanced animation specs
• Gesture/input specifications

--------------------------------------------------

EVALUATION CRITERIA

EVALUATION FORMAT RULE:

Evaluation criteria must be concise with short explanations.

Format:
"Submissions will be evaluated based on:"

[Criteria name] — [weight]%
[One sentence explaining what is evaluated]

MUST include exactly 5 criteria with weights totaling 100%.

ROLE-SPECIFIC EVALUATION:

UI Designer:
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Visual hierarchy — 20%
  Clear prioritization using typography, spacing, and color
• Component quality — 20%
  Reusable components with proper states
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• Visual quality — 20%
  Overall aesthetics and attention to detail

UX Designer:
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Navigation clarity — 20%
  Clear and intuitive navigation structure
• Usability — 20%
  Ease of use and user-friendly interactions
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• User flow quality — 20%
  Logical flow with minimal friction

Product Designer (ADVANCED MUST USE THIS):
• Product thinking — 25%
  Ability to simplify complex problems and explain design decisions
• User flow clarity — 20%
  Logical sequence with clear user journeys
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Constraint compliance — 15%
  Adherence to grid, spacing, and accessibility rules
• Interaction & usability — 20%
  Clarity of actions, editing flows, and collaboration features

Product Designer (BEGINNER/INTERMEDIATE):
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Visual hierarchy — 20%
  Clear prioritization using typography, spacing, and color
• User flow clarity — 20%
  Logical sequence with clear user journeys
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• Product thinking — 20%
  Quality of feature decisions and product experienceUX Designer:
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Navigation clarity — 20%
  Clear and intuitive navigation structure
• Usability — 20%
  Ease of use and user-friendly interactions
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• User flow quality — 20%
  Logical flow with minimal friction

Visual Designer:
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Visual hierarchy — 20%
  Clear prioritization using typography, spacing, and color
• Visual creativity — 20%
  Original and aesthetically pleasing solutions
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• Brand consistency — 20%
  Cohesive visual language and brand expression

Interaction Designer:
• Layout consistency — 20%
  Alignment, spacing consistency, and grid usage
• Visual hierarchy — 20%
  Clear prioritization using typography, spacing, and color
• Interaction quality — 20%
  Well-designed micro-interactions and transitions
• Constraint compliance — 20%
  Adherence to grid, spacing, and accessibility rules
• Animation smoothness — 20%
  Smooth and purposeful animations that enhance UX

--------------------------------------------------

OUTPUT FORMAT

Return ONLY JSON in this exact structure:

{{
    "title": "[Topic] - [Role] Challenge",
    "description": "[2-8 sentences based on difficulty - product context, users, goals]",
    "task_requirements": "Design the following screens:\n\n1️⃣ [Screen name]\n[Description of what this screen includes]\n\n2️⃣ [Screen name]\n[Description of what this screen includes]\n\n3️⃣ [Screen name]\n[Description of what this screen includes]",
    "constraints": ["[Measurable constraint 1]", "[Measurable constraint 2]", ...],
    "deliverables": ["[Specific deliverable 1 with quantity]", "[Specific deliverable 2]", ...],
    "evaluation_criteria": [
        {{
            "criteria": "[Criteria name]",
            "weight": "[percentage]",
            "description": "[Short explanation of what is evaluated]"
        }}
    ],
    "time_limit_minutes": {time_limit}
}}

⚠️ CRITICAL: The "task_requirements" field MUST contain a numbered list of screens/components.
⚠️ DO NOT leave "task_requirements" empty or null.
⚠️ DO NOT skip the "task_requirements" field.
⚠️ DO NOT include warning text like "MANDATORY FIELD" in the actual output - that's for your reference only.

--------------------------------------------------

QUALITY CHECK (EVALUATION-READY VERIFICATION)

Before generating the final output verify:

• The task is role-specific
• Difficulty level is correctly reflected
• The interface type matches the topic
• ⚠️ CRITICAL: Task requirements explicitly list what to design (MANDATORY - NOT OPTIONAL)
• ⚠️ CRITICAL: "task_requirements" field is NOT empty or null
• ⚠️ CRITICAL: Task requirements include numbered list of screens (1️⃣ 2️⃣ 3️⃣)
• ⚠️ EVALUATION-READY: Constraints are MEASURABLE and VERIFIABLE (exact values, not vague rules)
• ⚠️ EVALUATION-READY: Constraints map to evaluation scoring (alignment, spacing, hierarchy, contrast, components)
• ⚠️ EVALUATION-READY: Grid constraints include margins and gutters (e.g., "8-column grid with 16px margins and 16px gutters")
• ⚠️ EVALUATION-READY: Spacing constraints list allowed values (e.g., "8px, 16px, 24px, 32px, 40px, 48px")
• ⚠️ EVALUATION-READY: Typography constraint specifies exact level count (e.g., "minimum 3 levels")
• Deliverables are clear and realistic with quantities
• Evaluation criteria explain how submissions will be graded

CONSTRAINT VERIFICATION CHECKLIST:
✅ Does grid constraint specify margins and gutters?
✅ Does spacing constraint list exact allowed values?
✅ Does typography constraint specify minimum level count?
✅ Does contrast constraint specify exact ratio (4.5:1)?
✅ Does touch target constraint specify exact dimensions (44px × 44px)?
✅ Are all constraints measurable by automated evaluation?

TASK REQUIREMENTS VERIFICATION:
✅ Does the output include "task_requirements" field?
✅ Does "task_requirements" list specific screens to design?
✅ Are the screens numbered with emoji (1️⃣ 2️⃣ 3️⃣)?

If ANY of these are NO, the output is INVALID and must be regenerated.

--------------------------------------------------

QUALITY RULE (CRITICAL)

Ensure the challenge clearly explains what the candidate must design.

Avoid vague instructions like:
❌ "Design an app"
❌ "Create a dashboard"
❌ "Improve the user experience"

Instead use specific instructions like:
✅ "Design the following screens: Home dashboard, Order tracking, Order history"
✅ "Create a course discovery interface with search, filters, and course cards"
✅ "Design an end-to-end itinerary planning experience with 5 screens"

Every question must pass this test: "Can a candidate read this and know exactly what to design?"

--------------------------------------------------

CRITICAL INSTRUCTIONS:

1. Topic "{topic_str}" MUST be the main subject - DO NOT CHANGE IT
2. STRUCTURE (CRITICAL): MUST include all 5 sections: Description, Task Requirements, Constraints, Deliverables, Evaluation Criteria
3. ⚠️ TASK REQUIREMENTS (ABSOLUTELY MANDATORY - TOP PRIORITY):
   • The "task_requirements" field is REQUIRED and MUST NOT be empty
   • Must list specific screens/components for ALL difficulty levels (Beginner, Intermediate, Advanced)
   • Must use numbered emoji format (1️⃣ 2️⃣ 3️⃣ 4️⃣)
   • Each screen must have a description of what it includes
   • WITHOUT this section, the challenge is INCOMPLETE and UNUSABLE
   • This is the MOST IMPORTANT field - DO NOT SKIP IT
4. PLATFORM DETECTION (CRITICAL):
   - If topic contains "mobile", "mobile UI", "app", "prototype", "checkout", "booking" → Canvas: 375px mobile layout, Grid: 8-column
   - If topic contains "dashboard", "analytics", "admin", "landing", "website" → Canvas: 1440px desktop layout, Grid: 12-column
5. PROBLEM-FIRST (CRITICAL): Description must start with product context and user problem BEFORE design goal
6. AGE USAGE (CRITICAL): Do NOT mention age unless it affects design decisions (healthcare, children, elderly apps only)
7. BEGINNER TASK REQUIREMENTS: Must list 2-3 simple screens with clear descriptions of what elements to include
8. INTERMEDIATE TASK REQUIREMENTS: Must list 3-5 screens with moderate descriptions
9. ADVANCED TASK REQUIREMENTS: Must list 4-6 screens with DETAILED descriptions using "Include:" format with bullet points
10. ADVANCED COMPLEXITY (CRITICAL for Advanced difficulty):
   - Must include collaboration features, edge cases, or system workflows
   - Task Requirements must specify detailed features for each screen
   - Deliverables MUST include "Short explanation of key product decisions"
   - For Product Designer Advanced: Use Product thinking — 25% in evaluation
11. CONSTRAINTS must be concise - ONE LINE per constraint, NO long explanations
12. STRICTLY follow difficulty rules:
   - Beginner: 2-3 deliverables, 6 constraints, 3-4 sentence description, 2-3 screens in Task Requirements
   - Intermediate: 3-4 deliverables, 8 constraints, 4-5 sentence description, 3-5 screens in Task Requirements
   - Advanced: 4-5 deliverables, 10 constraints, 6-8 sentence description, 4-6 screens in Task Requirements
13. Title format: "{topic_str} — {role_str} Challenge"
14. Do NOT use "you", "your", "you should" - Use neutral language
15. ALWAYS use 8px baseline grid (NOT 4px)
16. Evaluation criteria must include short one-sentence descriptions
17. Return ONLY valid JSON
18. ⚠️ FINAL CHECK: Verify "task_requirements" field is NOT empty before returning

⚠️⚠️⚠️ ABSOLUTE REQUIREMENT ⚠️⚠️⚠️
Before returning the JSON, verify that "task_requirements" contains a numbered list of screens.
If "task_requirements" is empty or missing, the output is INVALID.
DO NOT return a challenge without Task Requirements.

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
            
            # Get task requirements (new field) - MANDATORY
            task_requirements = data.get("task_requirements", "")
            
            # LOG WHAT WE GOT FROM AI
            logger.info(f"🔍 AI Response - task_requirements field: {repr(task_requirements)[:200]}")
            logger.info(f"🔍 AI Response - task_requirements type: {type(task_requirements)}")
            logger.info(f"🔍 AI Response - task_requirements length: {len(task_requirements) if task_requirements else 0}")
            
            if task_requirements:
                task_requirements = self._neutralize_language(task_requirements)
            
            # CRITICAL VALIDATION: Task Requirements MUST NOT be empty
            if not task_requirements or not task_requirements.strip():
                logger.error("❌ AI generated question WITHOUT Task Requirements - INVALID")
                logger.error(f"❌ task_requirements value: {repr(task_requirements)}")
                raise ValueError(
                    "AI generated an incomplete question. The 'Task Requirements' section is missing. "
                    "This section is MANDATORY and must list the specific screens/components to design. "
                    "Please regenerate the question."
                )
            
            logger.info(f"✅ Task Requirements validation PASSED - Length: {len(task_requirements)}")
            
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
                task_requirements=task_requirements if task_requirements else None,
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
