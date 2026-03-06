# Marketing Site Port Configuration

## Port Change Summary

The marketing site has been configured to run on **port 3009** to avoid conflicts with existing services.

## Port Allocation

| Service | Port | Status |
|---------|------|--------|
| Main Frontend App | 3000 | ✅ In use |
| AI Assessment Service | 3001 | ✅ In use |
| Custom MCQ Service | 3002 | ✅ In use |
| AIML Service | 3003 | ✅ In use |
| DSA Service | 3004 | ✅ In use |
| Proctoring Service | 3005 | ✅ In use |
| User Service | 3006 | ✅ In use |
| Super Admin Service | 3006 | ✅ In use |
| Demo Service | 3008 | ✅ In use |
| **Marketing Site** | **3009** | ✅ **Configured** |

## Files Updated

### 1. Package.json
- **File**: `marketing/package.json`
- **Changes**: Updated dev and start scripts to use port 3009
```json
"scripts": {
  "dev": "next dev -p 3009",
  "start": "next start -p 3009"
}
```

### 2. Dockerfile
- **File**: `marketing/Dockerfile`
- **Changes**: Updated EXPOSE and PORT environment variable
```dockerfile
EXPOSE 3009
ENV PORT 3009
```

### 3. Azure Deployment Documentation
- **File**: `marketing/AZURE_DEPLOYMENT.md`
- **Changes**: Updated all port references from 3001 to 3009

### 4. CI/CD Workflows

#### Production Workflow
- **File**: `.github/workflows/deploy-marketing.yml`
- **Target**: Azure Container Apps
- **Port**: 3009 (configured in Dockerfile)

#### QA Workflow
- **File**: `.github/workflows/deploy-qa-marketing.yml`
- **Target**: Debian VM
- **Changes**: Updated Docker run command to map port 3009
```bash
docker run -d \
  --name aptor-marketing \
  -p 3009:3009 \
  aptor-marketing:qa
```

## Local Development

To run the marketing site locally:

```bash
cd marketing
npm install
npm run dev
```

The site will be available at: `http://localhost:3009`

## Production URLs

- **Production (Azure)**: `https://aaptor.com` (after domain configuration)
- **QA (Debian VM)**: `http://<qa-vm-host>:3009`

## Notes

- The port change ensures no conflicts with the AI Assessment service (port 3001)
- All deployment configurations have been updated
- The marketing site is completely isolated from the main application
- Both sites can run simultaneously on the same machine without port conflicts
