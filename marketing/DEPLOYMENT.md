# Deployment Guide - Marketing Site

## Overview

This marketing site should be deployed separately from the main application.

## Domain Configuration

### Production
- **Marketing Site**: `aaptor.com` → Deploy this folder
- **Main App**: `web.aaptor.com` → Deploy `frontend/` folder

### QA/Staging
- **Marketing Site**: `qa.aaptor.com` → Deploy this folder
- **Main App**: `qa-app.aaptor.com` → Deploy `frontend/` folder

## Environment Variables

### Production (`.env.production`)
```env
NEXT_PUBLIC_API_URL=https://api.aaptor.com
NEXT_PUBLIC_APP_URL=https://web.aaptor.com
DEMO_SERVICE_URL=https://api.aaptor.com
```

### QA (`.env.qa`)
```env
NEXT_PUBLIC_API_URL=https://qa-api.aaptor.com
NEXT_PUBLIC_APP_URL=https://qa-app.aaptor.com
DEMO_SERVICE_URL=https://qa-api.aaptor.com
```

## Build & Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start
```

## Nginx Configuration

### Marketing Site (aaptor.com)
```nginx
server {
    listen 80;
    server_name aaptor.com www.aaptor.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Main App (web.aaptor.com)
```nginx
server {
    listen 80;
    server_name web.aaptor.com app.aaptor.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

## PM2 Configuration

```json
{
  "apps": [
    {
      "name": "aaptor-marketing",
      "script": "npm",
      "args": "start",
      "cwd": "/path/to/marketing",
      "env": {
        "NODE_ENV": "production",
        "PORT": "3001"
      }
    },
    {
      "name": "aaptor-app",
      "script": "npm",
      "args": "start",
      "cwd": "/path/to/frontend",
      "env": {
        "NODE_ENV": "production",
        "PORT": "3000"
      }
    }
  ]
}
```

## Verification

After deployment, verify:

1. `aaptor.com` → Shows landing page
2. `aaptor.com/schedule-demo` → Shows demo form
3. `aaptor.com/thank-you` → Shows thank you page
4. `aaptor.com/auth/signin` → Redirects to `web.aaptor.com/auth/signin`
5. `aaptor.com/dashboard` → Redirects to `web.aaptor.com/dashboard`
6. `web.aaptor.com` → Shows signin page (not landing page)
7. `web.aaptor.com/dashboard` → Shows dashboard (after login)
