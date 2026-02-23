# Frontend Environment Variables Setup for Azure Container Apps

## Issue
The frontend is calling `localhost:80` because `NEXT_PUBLIC_API_URL` isn't set in Azure, causing `ERR_CONNECTION_REFUSED` errors.

## Solution: Set Environment Variables

### Step 1: Find Your API Gateway's External URL

First, determine your API Gateway's external URL. You can find it by:

1. **Azure Portal Method:**
   - Go to Azure Portal → Container Apps
   - Find your `api-gateway` container app
   - Check the **Application Url** (it should be something like `https://api-gateway-xxxxx.azurecontainerapps.io`)

2. **Azure CLI Method:**
   ```bash
   az containerapp show \
     --name api-gateway \
     --resource-group Aaptor \
     --query "properties.configuration.ingress.fqdn" \
     -o tsv
   ```

### Step 2: Set Environment Variables in Frontend Container App

Go to **Azure Portal** → **Container Apps** → **aptor-env** (or your frontend container app name)

1. Navigate to **Configuration** → **Environment variables**
2. Add/Update the following variables:

#### Option A: If API Gateway has External URL (Recommended)
```
Name: API_GATEWAY_URL
Value: http://api-gateway:80
(For server-side rewrites - internal communication)

Name: NEXT_PUBLIC_API_URL  
Value: https://api-gateway-xxxxx.azurecontainerapps.io
(Replace with your actual API Gateway external URL)
```

#### Option B: If API Gateway doesn't have External URL (Use Frontend as Proxy)
```
Name: API_GATEWAY_URL
Value: http://api-gateway:80
(For server-side rewrites - internal communication)

Name: NEXT_PUBLIC_API_URL
Value: https://aptor-env.delightfulpebble-b20f7903.centralindia.azurecontainerapps.io
(Use frontend URL - requests will go through Next.js rewrites)
```

**Note:** Option B works because Next.js rewrites will proxy `/api/v1/*` requests to the internal `api-gateway:80` service.

### Step 3: Save and Restart

1. Click **Save** (the container app will automatically restart)
2. Wait for the restart to complete
3. Test the application

## How It Works

### Server-Side (Next.js Rewrites)
- `next.config.js` uses `API_GATEWAY_URL` or defaults to `http://api-gateway:80`
- This works for server-side API routes and rewrites
- Uses internal Azure Container Apps DNS

### Client-Side (Browser)
- Client-side code uses `NEXT_PUBLIC_API_URL` for direct API calls
- If not set, falls back to `http://localhost:80` (which fails in Azure)
- Should be set to either:
  - API Gateway's external URL (if it has one)
  - Frontend's URL (if using Next.js rewrites as proxy)

## Verification

After setting the variables, check:

1. **Browser Console:**
   - Open browser DevTools → Console
   - Look for API calls - they should NOT be calling `localhost:80`
   - Should see calls to your configured URL

2. **Network Tab:**
   - Open browser DevTools → Network
   - Check API requests - verify they're going to the correct URL

3. **Test a Test Link:**
   - Try accessing a test link
   - Should work without `ERR_CONNECTION_REFUSED` errors

## Important Notes

1. **Next.js Build-Time Variables:**
   - `NEXT_PUBLIC_*` variables are embedded at **build time**
   - If you set it after building, you may need to **rebuild and redeploy**
   - OR use the runtime config API route (`/api/config/api-gateway-url`)

2. **Runtime Configuration:**
   - Some parts of the frontend use `getApiGatewayUrl()` which fetches from `/api/config/api-gateway-url`
   - This API route reads `API_GATEWAY_URL` or `NEXT_PUBLIC_API_URL` at runtime
   - This allows changing the URL without rebuilding

3. **Best Practice:**
   - Set both `API_GATEWAY_URL` (server-side) and `NEXT_PUBLIC_API_URL` (client-side)
   - Use internal service names for server-side (`http://api-gateway:80`)
   - Use external URLs for client-side (or frontend URL if proxying)

## Troubleshooting

### Still seeing localhost:80?
1. Check if variables are set correctly in Azure Portal
2. Verify the container app restarted after saving
3. Clear browser cache and hard refresh (Ctrl+Shift+R)
4. Check browser console for actual API calls being made

### API calls failing?
1. Verify API Gateway is running and accessible
2. Check CORS settings in API Gateway
3. Verify the URL format (http vs https)
4. Check network tab for actual error messages

### Need to rebuild?
If `NEXT_PUBLIC_API_URL` was set after the build, you may need to rebuild:
```bash
# In your CI/CD pipeline or locally
cd frontend
npm run build
# Then redeploy
```

