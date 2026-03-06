# Fix: Page Reloading Issue on Signin Page

## Problem
The signin page (http://localhost:3002/auth/signin) is reloading continuously.

## Likely Causes
1. **Session Check Loop**: NextAuth is checking session and redirecting
2. **Browser Cache**: Old session data causing conflicts
3. **Environment Variables**: Missing or incorrect NEXTAUTH_URL

## Quick Fixes

### Fix 1: Clear Browser Cache (RECOMMENDED)
1. Open browser DevTools (F12)
2. Go to Application tab
3. Clear Storage:
   - Cookies for localhost:3002
   - Local Storage
   - Session Storage
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Fix 2: Check Environment Variables
Verify `Aptor/frontend/.env.local` has:
```
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=453af44e3b72458eee6d5d9e1faf306654e24b6252960543244366fd98796f89
```

### Fix 3: Restart Frontend
```bash
# Stop frontend
# In terminal, press Ctrl+C

# Clear Next.js cache
cd Aptor/frontend
rm -rf .next

# Restart
npm run dev
```

### Fix 4: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors like:
   - "Failed to fetch"
   - "Network error"
   - "Redirect loop detected"
4. Share the error message for specific fix

## Temporary Workaround

If the issue persists, try accessing directly:
1. Go to: http://localhost:3002/dashboard
2. If it redirects to signin, that's normal
3. Try logging in with your credentials

## Check Services

Verify all services are running:
```bash
# Check frontend
curl http://localhost:3002

# Check backend
curl http://localhost:3007/health

# Should return 200 OK
```

## If Still Not Working

1. **Stop all services**
2. **Clear all caches**:
   ```bash
   cd Aptor/frontend
   rm -rf .next node_modules/.cache
   ```
3. **Restart services**
4. **Use incognito/private browsing mode**

## Common Error Messages

### "Failed to fetch session"
- Backend is not running
- Check: http://localhost:3007/health

### "Redirect loop detected"
- Clear cookies and cache
- Check NEXTAUTH_URL in .env.local

### "Network request failed"
- Frontend can't reach backend
- Verify ports 3002 and 3007 are not blocked

## Need Help?

Share the browser console errors and I can provide a specific fix.
