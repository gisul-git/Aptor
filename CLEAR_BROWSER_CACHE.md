# Clear Browser Cache - Step by Step

## The Issue
The signin page works in incognito but keeps reloading in normal browser. This means there's cached data causing conflicts.

## Solution: Complete Cache Clear

### Step 1: Clear All Site Data
1. Open your browser at http://localhost:3002/auth/signin
2. Press `F12` to open DevTools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. In the left sidebar, find **Storage** section
5. Click **"Clear site data"** button
6. Confirm the action

### Step 2: Clear Specific Items
If Step 1 doesn't work, manually clear these:

#### In Chrome DevTools (F12):
1. **Application** tab → **Cookies** → `http://localhost:3002`
   - Delete ALL cookies (right-click → Clear)
   
2. **Application** tab → **Local Storage** → `http://localhost:3002`
   - Delete ALL items (right-click → Clear)
   
3. **Application** tab → **Session Storage** → `http://localhost:3002`
   - Delete ALL items (right-click → Clear)
   
4. **Application** tab → **Cache Storage**
   - Delete ALL caches

### Step 3: Hard Refresh
After clearing, do a hard refresh:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Step 4: Close and Reopen Browser
1. Close ALL browser windows
2. Reopen browser
3. Go to http://localhost:3002/auth/signin

## Alternative: Use Browser Settings

### Chrome:
1. Click the three dots (⋮) in top right
2. Settings → Privacy and security → Clear browsing data
3. Select:
   - ✅ Cookies and other site data
   - ✅ Cached images and files
4. Time range: **All time**
5. Click "Clear data"

### Firefox:
1. Click the three lines (≡) in top right
2. Settings → Privacy & Security
3. Cookies and Site Data → Clear Data
4. Select both checkboxes
5. Click "Clear"

## Still Not Working?

Try this command to reset Next.js completely:
```bash
# Stop the frontend (Ctrl+C)
cd Aptor/frontend
rm -rf .next node_modules/.cache
npm run dev
```

Then clear browser cache again and refresh.
