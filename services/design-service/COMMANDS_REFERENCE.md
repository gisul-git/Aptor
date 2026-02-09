# 🎯 Design Service - Commands Reference

## 📁 Navigation Commands

```bash
# Go to project root
cd C:\gisul\Aptor

# Go to design service
cd C:\gisul\Aptor\services\design-service

# Go back to root from service
cd ..\..
```

---

## 🐳 Docker Commands

### Starting Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d design-service

# Start infrastructure only
docker-compose up -d mongo redis minio

# Start Penpot only
docker-compose up -d penpot-backend penpot-frontend penpot-exporter

# Start with logs visible
docker-compose up design-service
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop specific service
docker-compose stop design-service

# Stop and remove volumes (deletes data!)
docker-compose down -v

# Stop without removing containers
docker-compose stop
```

### Restarting Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart design-service

# Restart infrastructure
docker-compose restart mongo redis minio
```

### Building Services

```bash
# Build design service
docker-compose build design-service

# Build without cache (clean build)
docker-compose build --no-cache design-service

# Build and start
docker-compose up -d --build design-service
```

---

## 📊 Monitoring Commands

### View Logs

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs design-service

# Follow specific service logs
docker-compose logs -f design-service

# View last 100 lines
docker-compose logs --tail=100 design-service

# View logs since timestamp
docker-compose logs --since 2024-01-01T00:00:00 design-service
```

### Check Status

```bash
# List all containers
docker-compose ps

# Check specific service
docker-compose ps design-service

# View resource usage
docker stats

# View detailed container info
docker inspect aptor-design-service-1
```

### Health Checks

```bash
# Check design service health
curl http://localhost:3006/health

# Check with verbose output
curl -v http://localhost:3006/health

# Check API documentation
curl http://localhost:3006/docs

# Check OpenAPI spec
curl http://localhost:3006/openapi.json
```

---

## 🗄️ Database Commands

### MongoDB

```bash
# Connect to MongoDB
docker exec -it aptor-mongo-1 mongosh

# Connect to specific database
docker exec -it aptor-mongo-1 mongosh aptor_design

# Run MongoDB command
docker exec -it aptor-mongo-1 mongosh --eval "db.adminCommand('ping')"

# Backup database
docker exec aptor-mongo-1 mongodump --out /backup

# Restore database
docker exec aptor-mongo-1 mongorestore /backup
```

**Inside MongoDB shell:**
```javascript
// Switch to design database
use aptor_design

// List collections
show collections

// View questions
db.design_questions.find().pretty()

// Count questions
db.design_questions.countDocuments()

// View sessions
db.penpot_sessions.find().pretty()

// View submissions
db.design_submissions.find().pretty()

// Delete all questions (careful!)
db.design_questions.deleteMany({})

// Exit
exit
```

### Redis

```bash
# Connect to Redis
docker exec -it aptor-redis-1 redis-cli

# Check Redis status
docker exec -it aptor-redis-1 redis-cli ping

# View all keys
docker exec -it aptor-redis-1 redis-cli KEYS "*"

# Clear all data (careful!)
docker exec -it aptor-redis-1 redis-cli FLUSHALL
```

---

## 🧪 Testing Commands

### API Testing with curl

```bash
# Health check
curl http://localhost:3006/health

# Generate question
curl -X POST http://localhost:3006/api/v1/design/questions/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"role\":\"ui_designer\",\"difficulty\":\"intermediate\",\"task_type\":\"landing_page\",\"created_by\":\"admin\"}"

# List questions
curl http://localhost:3006/api/v1/design/questions

# Get specific question (replace QUESTION_ID)
curl http://localhost:3006/api/v1/design/questions/QUESTION_ID

# Create workspace
curl -X POST http://localhost:3006/api/v1/design/workspace/create ^
  -H "Content-Type: application/json" ^
  -d "{\"user_id\":\"test_user\",\"assessment_id\":\"test_123\",\"question_id\":\"QUESTION_ID\"}"

# Get workspace status (replace SESSION_ID)
curl http://localhost:3006/api/v1/design/workspace/SESSION_ID/status
```

### Python Testing

```bash
# Navigate to service directory
cd C:\gisul\Aptor\services\design-service

# Run validation script
python validate_setup.py

# Run test script
python test_service.py

# Run development server
python start_dev.py
```

---

## 🔧 Maintenance Commands

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything (careful!)
docker system prune -a

# Clean design service only
docker-compose rm -f design-service
docker rmi aptor-design-service
```

### Updates

```bash
# Pull latest images
docker-compose pull

# Rebuild after code changes
docker-compose build design-service

# Update and restart
docker-compose up -d --build design-service
```

### Backup

```bash
# Backup MongoDB data
docker exec aptor-mongo-1 mongodump --out /backup
docker cp aptor-mongo-1:/backup ./mongodb-backup

# Backup volumes
docker run --rm -v aptor_mongo_data:/data -v %cd%:/backup ubuntu tar czf /backup/mongo-backup.tar.gz /data

# Backup .env file
copy .env .env.backup
```

---

## 🐛 Debugging Commands

### View Container Details

```bash
# Inspect container
docker inspect aptor-design-service-1

# View container processes
docker top aptor-design-service-1

# View container stats
docker stats aptor-design-service-1

# View container logs with timestamps
docker-compose logs -t design-service
```

### Execute Commands in Container

```bash
# Open bash shell in container
docker exec -it aptor-design-service-1 bash

# Run Python in container
docker exec -it aptor-design-service-1 python

# Check Python version
docker exec aptor-design-service-1 python --version

# List files in container
docker exec aptor-design-service-1 ls -la /app

# Check environment variables
docker exec aptor-design-service-1 env
```

### Network Debugging

```bash
# List networks
docker network ls

# Inspect network
docker network inspect aptor_microservices-network

# Test connectivity between containers
docker exec aptor-design-service-1 ping mongo

# Check open ports
netstat -ano | findstr :3006

# Kill process on port
taskkill /PID <PID> /F
```

---

## 📝 Configuration Commands

### Environment Variables

```bash
# View current environment
docker exec aptor-design-service-1 env

# Edit .env file
notepad services\design-service\.env

# Reload environment (restart service)
docker-compose restart design-service

# Set environment variable temporarily
set OPENAI_API_KEY=sk-your-key
docker-compose up -d design-service
```

### File Operations

```bash
# Copy file to container
docker cp local-file.txt aptor-design-service-1:/app/

# Copy file from container
docker cp aptor-design-service-1:/app/file.txt ./

# View file in container
docker exec aptor-design-service-1 cat /app/main.py

# Edit file in container
docker exec -it aptor-design-service-1 nano /app/main.py
```

---

## 🚀 Production Commands

### Deployment

```bash
# Build for production
docker-compose -f docker-compose.prod.yml build

# Start in production mode
docker-compose -f docker-compose.prod.yml up -d

# Scale service
docker-compose up -d --scale design-service=3

# Update service with zero downtime
docker-compose up -d --no-deps --build design-service
```

### Monitoring

```bash
# View resource usage
docker stats --no-stream

# Export logs
docker-compose logs design-service > design-service.log

# Monitor health endpoint
while true; do curl -s http://localhost:3006/health; sleep 5; done

# Check service uptime
docker inspect -f '{{.State.StartedAt}}' aptor-design-service-1
```

---

## 🔑 Quick Access URLs

```bash
# Open in browser (Windows)
start http://localhost:3006/health
start http://localhost:3006/docs
start http://localhost:9001
start http://localhost:9090

# Open in browser (Linux/Mac)
xdg-open http://localhost:3006/docs
```

---

## 💡 Useful Aliases (Optional)

Add these to your shell profile for quick access:

```bash
# PowerShell aliases (add to $PROFILE)
function dps { docker-compose ps }
function dlogs { docker-compose logs -f design-service }
function drestart { docker-compose restart design-service }
function dhealth { curl http://localhost:3006/health }

# Bash aliases (add to ~/.bashrc)
alias dps='docker-compose ps'
alias dlogs='docker-compose logs -f design-service'
alias drestart='docker-compose restart design-service'
alias dhealth='curl http://localhost:3006/health'
```

---

## 📞 Emergency Commands

### Service Not Responding

```bash
# Force restart
docker-compose kill design-service
docker-compose up -d design-service

# Complete reset
docker-compose down
docker-compose up -d
```

### Database Issues

```bash
# Restart MongoDB
docker-compose restart mongo

# Reset MongoDB (deletes data!)
docker-compose down -v
docker-compose up -d mongo
```

### Port Conflicts

```bash
# Find process using port
netstat -ano | findstr :3006

# Kill process
taskkill /PID <PID> /F

# Change port in .env
echo PORT=3007 >> .env
docker-compose restart design-service
```

---

**💡 Tip**: Bookmark this page for quick reference during development!