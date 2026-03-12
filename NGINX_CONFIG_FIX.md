# Nginx Configuration Fix for QA Deployment

## Issue
The `/api/config/api-gateway-url` endpoint (Next.js API route) is being routed to API Gateway instead of Next.js, causing 401 errors.

## Solution
Add this location block to `/etc/nginx/sites-enabled/qa.aaptor.com` BEFORE the general `/api/` block:

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name qa.aaptor.com;
    
    ssl_certificate     /opt/aaptor/ssl/qa.aaptor.com.pem;
    ssl_certificate_key /opt/aaptor/ssl/qa.aaptor.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Next.js config API routes (MUST come before /api/)
    location /api/config/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # NextAuth routes must go to Next.js
    location /api/auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # All other APIs → API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## Steps to Apply

1. Edit the nginx config:
   ```bash
   sudo nano /etc/nginx/sites-enabled/qa.aaptor.com
   ```

2. Add the `/api/config/` location block as shown above

3. Test the configuration:
   ```bash
   sudo nginx -t
   ```

4. Reload nginx:
   ```bash
   sudo nginx -s reload
   ```

## What This Fixes

- DSA question generation will work
- Any other feature using `getApiGatewayUrl()` will work
- The `/api/config/api-gateway-url` endpoint will return the correct URL
- Works across all environments (QA, Azure, production) with just environment variable changes
