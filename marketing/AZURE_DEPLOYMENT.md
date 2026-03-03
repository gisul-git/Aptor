# Marketing Site - Azure Deployment Guide

## Files Created

### 1. Docker Configuration
- ✅ `marketing/Dockerfile` - Multi-stage Docker build for production
- ✅ `marketing/.dockerignore` - Excludes unnecessary files from Docker build

### 2. CI/CD Workflows
- ✅ `.github/workflows/deploy-marketing.yml` - Production deployment (dev branch → Azure)
- ✅ `.github/workflows/deploy-qa-marketing.yml` - QA deployment (QA branch → Debian VM)

## Deployment Setup

### Prerequisites

You need to configure these GitHub Secrets (same as frontend):

#### Azure Container Registry (ACR)
- `ACR_LOGIN_SERVER` - Your ACR login server (e.g., `aaptorregistry.azurecr.io`)
- `ACR_USERNAME` - ACR username
- `ACR_PASSWORD` - ACR password

#### Azure Credentials
- `AZURE_CREDENTIALS` - Azure service principal credentials (JSON format)

#### Environment Variables
- `NEXT_PUBLIC_API_URL` - API Gateway URL (e.g., `https://api.aaptor.com`)
- `DEMO_SERVICE_URL` - Demo service URL (e.g., `https://api.aaptor.com`)

#### QA VM (Debian)
- `QA_VM_HOST` - QA VM hostname/IP
- `QA_VM_USER` - SSH username
- `QA_VM_SSH_KEY` - SSH private key
- `QA_VM_DEPLOY_PATH` - Deployment path (e.g., `/opt/aptor`)

## Azure Container App Setup

### Step 1: Create Container App

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="Aaptor"
LOCATION="eastus"
CONTAINER_APP_ENV="aptor-env"
CONTAINER_APP_NAME="aptor-marketing-env"
ACR_NAME="aaptorregistry"

# Create Container App
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $ACR_NAME.azurecr.io/marketing:latest \
  --target-port 3001 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    NEXT_PUBLIC_API_URL=https://api.aaptor.com \
    DEMO_SERVICE_URL=https://api.aaptor.com
```

### Step 2: Configure Custom Domain

```bash
# Add custom domain (aaptor.com)
az containerapp hostname add \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname aaptor.com

# Bind SSL certificate
az containerapp hostname bind \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname aaptor.com \
  --certificate <certificate-id>
```

### Step 3: Configure DNS

Add these DNS records to your domain registrar:

**For aaptor.com:**
```
Type: CNAME
Name: @
Value: <container-app-fqdn>
```

**For www.aaptor.com:**
```
Type: CNAME
Name: www
Value: <container-app-fqdn>
```

## Deployment Workflows

### Production Deployment (Azure)

**Trigger**: Push to `dev` branch or manual dispatch

**Process**:
1. Checkout code
2. Install Node.js dependencies
3. Build Next.js application
4. Build Docker image
5. Push to Azure Container Registry
6. Deploy to Azure Container Apps
7. Update environment variables

**URL**: `https://aaptor.com` (after custom domain setup)

### QA Deployment (Debian VM)

**Trigger**: Push to `QA` branch or manual dispatch

**Process**:
1. SSH to QA VM
2. Pull latest code
3. Build Docker image
4. Stop old container
5. Start new container on port 3001

**URL**: `http://<qa-vm-host>:3001`

## Port Configuration

- **Marketing Site**: Port 3001
- **Main App (Frontend)**: Port 3000

This allows both to run on the same VM without conflicts.

## Environment Variables

### Production (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.aaptor.com
DEMO_SERVICE_URL=https://api.aaptor.com
```

### QA (.env.qa)
```env
NEXT_PUBLIC_API_URL=http://<qa-vm-host>:80
DEMO_SERVICE_URL=http://<qa-vm-host>:3008
```

## Monitoring

### Check Container Status (Azure)
```bash
az containerapp show \
  --name aptor-marketing-env \
  --resource-group Aaptor \
  --query "properties.runningStatus"
```

### View Logs (Azure)
```bash
az containerapp logs show \
  --name aptor-marketing-env \
  --resource-group Aaptor \
  --follow
```

### Check Container Status (QA VM)
```bash
ssh user@qa-vm-host
docker ps | grep aptor-marketing
docker logs aptor-marketing
```

## Troubleshooting

### Build Fails
- Check Node.js version (should be 18)
- Verify all dependencies are in package.json
- Check for TypeScript errors

### Deployment Fails
- Verify Azure credentials are correct
- Check if Container App exists
- Verify ACR credentials

### Container Won't Start
- Check environment variables
- View container logs
- Verify port 3001 is not in use

## Rollback

### Azure
```bash
# List revisions
az containerapp revision list \
  --name aptor-marketing-env \
  --resource-group Aaptor

# Activate previous revision
az containerapp revision activate \
  --name aptor-marketing-env \
  --resource-group Aaptor \
  --revision <previous-revision-name>
```

### QA VM
```bash
# SSH to VM
ssh user@qa-vm-host

# Pull previous commit
cd /opt/aptor
git checkout <previous-commit-hash>

# Rebuild and restart
cd marketing
docker build -t aptor-marketing:qa .
docker stop aptor-marketing
docker rm aptor-marketing
docker run -d --name aptor-marketing -p 3001:3001 aptor-marketing:qa
```

## Next Steps

1. ✅ Files created - Dockerfile, workflows, .dockerignore
2. ⏳ **Create Azure Container App** (see Step 1 above)
3. ⏳ **Configure GitHub Secrets** (if not already done)
4. ⏳ **Test deployment** by pushing to dev or QA branch
5. ⏳ **Configure custom domain** (aaptor.com)
6. ⏳ **Update DNS records**
7. ⏳ **Test production URL**

## Summary

- Marketing site will deploy to Azure Container Apps (production)
- Runs on port 3001 (different from main app on 3000)
- Accessible at `aaptor.com` after domain configuration
- QA deployments go to Debian VM on port 3001
- Automatic CI/CD on push to dev/QA branches
