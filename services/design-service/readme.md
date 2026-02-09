# Design Competency Assessment Service

## AI Design Question Generator + Penpot Integrated Candidate Workspace + Automated Evaluation Engine

A comprehensive design interview and assessment system that generates role-based design challenges, provides a live embedded design workspace using Penpot, ensures secure proctored testing, and performs automated hybrid evaluation using rule-based and AI-based scoring.

## 🚀 Features

### Core Capabilities
- **AI-Powered Question Generation**: Dynamic creation of role-specific design challenges
- **Embedded Penpot Workspace**: Live design environment with isolated candidate sessions
- **Hybrid Evaluation Engine**: Combines rule-based (60%) and AI-based (40%) scoring
- **Real-time Proctoring Integration**: Secure testing environment
- **Comprehensive Analytics**: Performance tracking and insights

### Supported Design Roles
- UI Designer
- UX Designer  
- Product Designer
- Visual Designer

### Assessment Types
- Landing Page Design
- Mobile App Interface
- Dashboard Design
- Component Design

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Design Service │    │   Penpot        │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (Self-hosted) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    MongoDB      │
                    │   (Database)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  AI Services    │
                    │ (OpenAI/Gemini) │
                    └─────────────────┘
```

## 📋 API Endpoints

### Question Management
```http
POST   /api/v1/design/questions/generate     # Generate AI question
GET    /api/v1/design/questions              # List questions
GET    /api/v1/design/questions/{id}         # Get specific question
```

### Workspace Management
```http
POST   /api/v1/design/workspace/create       # Create Penpot workspace
GET    /api/v1/design/workspace/{id}/status  # Get workspace status
POST   /api/v1/design/workspace/{id}/end     # End workspace session
```

### Submission & Evaluation
```http
POST   /api/v1/design/submit                 # Submit design for evaluation
GET    /api/v1/design/submissions/{id}/evaluation  # Get evaluation results
GET    /api/v1/design/submissions/user/{id}  # Get user submissions
```

### Analytics
```http
GET    /api/v1/design/analytics/question/{id}  # Question analytics
GET    /api/v1/design/analytics/user/{id}      # User performance
```

## 🛠️ Installation & Setup

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- MongoDB
- Redis
- MinIO
- Penpot (self-hosted)

### Environment Variables
```bash
# AI Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
CLAUDE_API_KEY=your_claude_key

# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=aptor_design

# Penpot Integration
PENPOT_URL=http://localhost:9001
PENPOT_API_URL=http://penpot-backend:6060
PENPOT_ADMIN_EMAIL=admin@penpot.local
PENPOT_ADMIN_PASSWORD=admin123

# Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Security
JWT_SECRET_KEY=your-secret-key
```

### Quick Start
```bash
# 1. Clone and navigate to design service
cd Aptor/services/design-service

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start with Docker Compose (from root)
cd ../../
docker-compose up design-service

# 5. Service will be available at http://localhost:3006
```

## 🔄 End-to-End Flow

### 1. Question Generation
```python
# Generate AI-powered design question
POST /api/v1/design/questions/generate
{
    "role": "ui_designer",
    "difficulty": "intermediate", 
    "task_type": "landing_page",
    "topic": "e-commerce"
}
```

### 2. Workspace Creation
```python
# Create isolated Penpot workspace
POST /api/v1/design/workspace/create
{
    "user_id": "candidate_123",
    "assessment_id": "assessment_456", 
    "question_id": "question_789"
}
```

### 3. Design Submission
```python
# Submit design with screenshot
POST /api/v1/design/submit
- screenshot: file upload
- session_id: workspace session
- user_id: candidate ID
- question_id: question ID
```

### 4. Automated Evaluation
The system automatically:
- Analyzes screenshot using computer vision
- Evaluates design JSON from Penpot
- Applies rule-based scoring (alignment, spacing, typography, etc.)
- Uses AI vision models for aesthetic and UX evaluation
- Combines scores: `Final = 0.6 × Rule + 0.4 × AI`

## 🎯 Evaluation Criteria

### Rule-Based Evaluation (60%)
- **Alignment** (20 points): Element positioning and organization
- **Spacing** (15 points): Consistency in margins and padding
- **Typography** (15 points): Hierarchy and readability
- **Color Contrast** (15 points): Accessibility compliance
- **Visual Hierarchy** (20 points): Attention flow and focal points
- **Component Consistency** (15 points): Design system adherence

### AI-Based Evaluation (40%)
- **Visual Aesthetics** (25 points): Overall appeal and polish
- **UX Clarity** (25 points): User experience and usability
- **Creativity** (25 points): Innovation and problem-solving
- **Technical Execution** (25 points): Professional implementation

## 📊 Data Models

### Design Question
```python
{
    "id": "question_id",
    "role": "ui_designer",
    "difficulty": "intermediate",
    "task_type": "landing_page", 
    "title": "E-commerce Landing Page",
    "description": "Design a conversion-focused landing page...",
    "constraints": ["Mobile-first", "Accessibility compliant"],
    "deliverables": ["Wireframes", "High-fidelity mockups"],
    "evaluation_criteria": ["Visual hierarchy", "Conversion optimization"],
    "time_limit_minutes": 60
}
```

### Penpot Session
```python
{
    "id": "session_id",
    "user_id": "candidate_123",
    "assessment_id": "assessment_456",
    "question_id": "question_789", 
    "workspace_url": "http://localhost:9001/#/workspace/...",
    "session_token": "unique_token",
    "started_at": "2024-01-01T00:00:00Z",
    "ended_at": null
}
```

### Design Submission
```python
{
    "id": "submission_id",
    "session_id": "session_123",
    "user_id": "candidate_456",
    "question_id": "question_789",
    "screenshot_url": "/path/to/screenshot.png",
    "design_file_url": "/path/to/design.json",
    "rule_based_score": 75.0,
    "ai_based_score": 80.0, 
    "final_score": 77.0,
    "feedback": {...},
    "submitted_at": "2024-01-01T01:00:00Z"
}
```

## 🔧 Development

### Project Structure
```
app/
├── api/v1/design.py          # API endpoints
├── services/
│   ├── ai_question_generator.py  # AI question generation
│   ├── penpot_service.py         # Penpot integration
│   └── evaluation_engine.py      # Hybrid evaluation
├── repositories/
│   └── design_repository.py      # Database operations
├── models/design.py              # Data models
├── middleware/auth.py            # Authentication
├── core/config.py               # Configuration
└── db/mongo.py                  # Database connection
```

### Running Tests
```bash
# Unit tests
pytest tests/

# Integration tests
pytest tests/integration/

# Load tests
pytest tests/load/
```

### Adding New AI Providers
```python
# In ai_question_generator.py
async def _generate_with_new_provider(self, prompt: str) -> str:
    # Implement new AI provider integration
    pass
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t design-service .

# Run container
docker run -p 3006:3006 \
  -e MONGODB_URL=mongodb://mongo:27017 \
  -e OPENAI_API_KEY=your_key \
  design-service
```

### Production Considerations
- Use environment-specific configurations
- Set up proper logging and monitoring
- Configure SSL/TLS for secure communication
- Implement rate limiting and request validation
- Set up backup strategies for MongoDB
- Monitor AI API usage and costs

## 📈 Monitoring & Analytics

### Health Checks
```bash
# Service health
GET /health

# Detailed health with dependencies
GET /api/v1/design/health
```

### Metrics
- Question generation success rate
- Evaluation processing time
- Penpot workspace creation success
- User submission patterns
- Score distributions

## 🤝 Integration

### Frontend Integration
```javascript
// Create workspace
const response = await fetch('/api/v1/design/workspace/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: 'candidate_123',
        assessment_id: 'assessment_456',
        question_id: 'question_789'
    })
});

const { workspace_url } = await response.json();

// Embed Penpot workspace
<iframe src={workspace_url} width="100%" height="600px" />
```

### Proctoring Integration
The service integrates with the proctoring service for:
- Session monitoring
- Anti-cheat detection
- Event logging
- Violation reporting

## 📝 License

This project is part of the APTOR platform and follows the same licensing terms.

## 🆘 Support

For issues and questions:
1. Check the logs: `docker logs design-service`
2. Verify environment variables
3. Ensure all dependencies are running
4. Check Penpot connectivity
5. Validate AI API keys and quotas

## 🔄 Version History

- **v1.0.0**: Initial implementation with AI question generation, Penpot integration, and hybrid evaluation
- **v1.1.0**: Enhanced evaluation engine with computer vision
- **v1.2.0**: Added analytics and performance tracking
- **v1.3.0**: Improved Penpot workspace management