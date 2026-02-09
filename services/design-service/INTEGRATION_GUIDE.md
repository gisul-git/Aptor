# Design Service Integration Guide

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Start Dependencies
```bash
# From project root
cd ../../
docker-compose up -d mongo redis minio penpot-backend penpot-frontend penpot-exporter
```

### 3. Start Design Service
```bash
# Option 1: Docker (recommended)
docker-compose up design-service

# Option 2: Local development
cd services/design-service
pip install -r requirements.txt
python main.py
```

### 4. Verify Installation
```bash
# Health check
curl http://localhost:3006/health

# API documentation
open http://localhost:3006/docs
```

## 🔗 Frontend Integration

### React/Next.js Integration

```typescript
// types/design.ts
export interface DesignQuestion {
  id: string;
  role: 'ui_designer' | 'ux_designer' | 'product_designer' | 'visual_designer';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  task_type: 'landing_page' | 'mobile_app' | 'dashboard' | 'component';
  title: string;
  description: string;
  constraints: string[];
  deliverables: string[];
  time_limit_minutes: number;
}

export interface WorkspaceSession {
  session_id: string;
  workspace_url: string;
  session_token: string;
  question: DesignQuestion;
  time_limit_minutes: number;
}
```

```typescript
// services/designService.ts
class DesignService {
  private baseURL = 'http://localhost:3006/api/v1/design';

  async generateQuestion(params: {
    role: string;
    difficulty: string;
    task_type: string;
    topic?: string;
  }): Promise<DesignQuestion> {
    const response = await fetch(`${this.baseURL}/questions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async createWorkspace(params: {
    user_id: string;
    assessment_id: string;
    question_id: string;
  }): Promise<WorkspaceSession> {
    const response = await fetch(`${this.baseURL}/workspace/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async submitDesign(
    sessionId: string,
    userId: string,
    questionId: string,
    screenshot: File
  ) {
    const formData = new FormData();
    formData.append('screenshot', screenshot);
    
    const response = await fetch(`${this.baseURL}/submit`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Session-ID': sessionId,
        'X-User-ID': userId,
        'X-Question-ID': questionId
      }
    });
    return response.json();
  }
}

export const designService = new DesignService();
```

```tsx
// components/DesignAssessment.tsx
import React, { useState, useEffect } from 'react';
import { designService } from '../services/designService';

export const DesignAssessment: React.FC = () => {
  const [question, setQuestion] = useState<DesignQuestion | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const startAssessment = async () => {
    // Generate question
    const newQuestion = await designService.generateQuestion({
      role: 'ui_designer',
      difficulty: 'intermediate',
      task_type: 'landing_page'
    });
    setQuestion(newQuestion);

    // Create workspace
    const workspaceSession = await designService.createWorkspace({
      user_id: 'current_user_id',
      assessment_id: 'assessment_123',
      question_id: newQuestion.id
    });
    setWorkspace(workspaceSession);
    setTimeLeft(workspaceSession.time_limit_minutes * 60);
  };

  const submitDesign = async () => {
    if (!workspace) return;

    // Capture screenshot (implementation depends on your setup)
    const screenshot = await captureScreenshot();
    
    await designService.submitDesign(
      workspace.session_id,
      'current_user_id',
      workspace.question.id,
      screenshot
    );
  };

  return (
    <div className="design-assessment">
      {!question ? (
        <button onClick={startAssessment}>Start Design Assessment</button>
      ) : (
        <div>
          <div className="question-panel">
            <h2>{question.title}</h2>
            <p>{question.description}</p>
            <div className="constraints">
              <h3>Constraints:</h3>
              <ul>
                {question.constraints.map((constraint, i) => (
                  <li key={i}>{constraint}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {workspace && (
            <div className="workspace-panel">
              <iframe
                src={workspace.workspace_url}
                width="100%"
                height="600px"
                frameBorder="0"
              />
              <div className="controls">
                <div className="timer">Time left: {Math.floor(timeLeft / 60)}:{timeLeft % 60}</div>
                <button onClick={submitDesign}>Submit Design</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

## 🔌 API Gateway Integration

### Route Configuration
```javascript
// In API Gateway (services/api-gateway/src/index.js)
app.use('/api/design', createProxyMiddleware({
  target: 'http://design-service:3006',
  changeOrigin: true,
  pathRewrite: {
    '^/api/design': '/api/v1/design'
  }
}));
```

### Authentication Middleware
```javascript
// Add JWT validation for design endpoints
app.use('/api/design', authenticateToken);
app.use('/api/design/admin', requireRole('admin'));
```

## 🎯 Proctoring Integration

### Event Logging
```typescript
// In proctoring service
interface DesignEvent {
  session_id: string;
  event_type: 'workspace_created' | 'design_submitted' | 'evaluation_completed';
  timestamp: string;
  data: any;
}

// Log design events
await proctorService.logEvent({
  session_id: workspace.session_id,
  event_type: 'workspace_created',
  timestamp: new Date().toISOString(),
  data: { question_id: question.id, workspace_url: workspace.workspace_url }
});
```

### Real-time Monitoring
```typescript
// Monitor design session activity
const monitorDesignSession = (sessionId: string) => {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/v1/design/workspace/${sessionId}/status`);
    const data = await status.json();
    
    // Check for violations or suspicious activity
    if (data.workspace_status.last_activity) {
      // Update proctoring dashboard
    }
  }, 5000);
  
  return () => clearInterval(interval);
};
```

## 📊 Analytics Integration

### Performance Tracking
```typescript
// Track design assessment metrics
interface DesignMetrics {
  question_generation_time: number;
  workspace_creation_time: number;
  evaluation_processing_time: number;
  user_completion_rate: number;
}

// In analytics service
const trackDesignMetrics = async (metrics: DesignMetrics) => {
  await analyticsService.track('design_assessment_metrics', metrics);
};
```

### Dashboard Integration
```tsx
// Admin dashboard component
const DesignAnalyticsDashboard: React.FC = () => {
  const [questionStats, setQuestionStats] = useState([]);
  const [userPerformance, setUserPerformance] = useState([]);

  useEffect(() => {
    // Load analytics data
    loadQuestionAnalytics();
    loadUserPerformance();
  }, []);

  return (
    <div className="analytics-dashboard">
      <QuestionStatsChart data={questionStats} />
      <UserPerformanceChart data={userPerformance} />
      <EvaluationAccuracyMetrics />
    </div>
  );
};
```

## 🔧 Development Workflow

### Local Development Setup
```bash
# 1. Start infrastructure
docker-compose up -d mongo redis minio

# 2. Start Penpot (optional for development)
docker-compose up -d penpot-backend penpot-frontend

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set environment variables
export MONGODB_URL=mongodb://localhost:27017
export AI_PROVIDER=openai
export OPENAI_API_KEY=your_key

# 5. Run in development mode
python main.py
```

### Testing
```bash
# Unit tests
pytest tests/unit/

# Integration tests (requires running services)
pytest tests/integration/

# Load testing
pytest tests/load/
```

### Debugging
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Use debug endpoints
GET /api/v1/design/debug/question/{id}
GET /api/v1/design/debug/evaluation/{id}
```

## 🚀 Production Deployment

### Environment Configuration
```bash
# Production environment variables
AI_PROVIDER=openai
OPENAI_API_KEY=prod_key_here
MONGODB_URL=mongodb://prod-mongo:27017
REDIS_HOST=prod-redis
MINIO_ENDPOINT=prod-minio:9000
JWT_SECRET_KEY=secure_production_key
DEBUG=false
```

### Health Monitoring
```yaml
# docker-compose.prod.yml
services:
  design-service:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3006/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Scaling Considerations
```yaml
# For high load scenarios
services:
  design-service:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

## 🔒 Security Considerations

### API Security
```python
# Rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/design/questions/generate")
@limiter.limit("10/minute")
async def generate_question():
    pass
```

### Data Protection
```python
# Encrypt sensitive data
from cryptography.fernet import Fernet

def encrypt_design_data(data: dict) -> str:
    key = settings.ENCRYPTION_KEY
    f = Fernet(key)
    return f.encrypt(json.dumps(data).encode()).decode()
```

## 📝 Troubleshooting

### Common Issues

1. **Penpot Connection Failed**
   ```bash
   # Check Penpot service status
   docker-compose logs penpot-backend
   
   # Verify network connectivity
   curl http://penpot-backend:6060/api/rpc/command/ping
   ```

2. **AI API Quota Exceeded**
   ```python
   # Implement fallback to template generation
   # Check API usage in logs
   ```

3. **MongoDB Connection Issues**
   ```bash
   # Check MongoDB status
   docker-compose logs mongo
   
   # Test connection
   mongosh mongodb://localhost:27017/aptor_design
   ```

4. **Evaluation Processing Slow**
   ```python
   # Monitor evaluation queue
   # Consider adding Redis queue for background processing
   ```

### Performance Optimization

1. **Caching Strategy**
   ```python
   # Cache generated questions
   @lru_cache(maxsize=100)
   async def get_cached_question(question_id: str):
       return await repository.get_question(question_id)
   ```

2. **Background Processing**
   ```python
   # Use Celery for heavy evaluation tasks
   from celery import Celery
   
   @celery.task
   def process_evaluation(submission_id: str):
       # Heavy evaluation logic
   ```

This integration guide provides comprehensive instructions for integrating the Design Service into your APTOR platform. The service is now ready for production use with proper monitoring, security, and scalability considerations.