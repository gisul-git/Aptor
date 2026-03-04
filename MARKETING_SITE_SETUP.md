# Marketing Site Setup - Complete Guide

## Overview

Created a separate lightweight marketing site to handle the public-facing pages (landing, schedule demo, thank you), while keeping the main application separate for authenticated users.

## Project Structure

```
/
├── frontend/          → Main Application (web.aaptor.com)
│   ├── src/pages/
│   │   ├── auth/      → Signin, Signup, etc.
│   │   ├── dashboard/ → Dashboard pages
│   │   └── ...        → All app pages
│   └── ...
│
├── marketing/         → Marketing Site (aaptor.com) - NEW!
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx           → Landing page (copy from frontend)
│   │   │   ├── schedule-demo.tsx   → Demo form (copy from frontend)
│   │   │   ├── thank-you.tsx       → Thank you page (copy from frontend)
│   │   │   ├── _app.tsx
│   │   │   └── _document.tsx
│   │   ├── components/
│   │   │   └── landing/            → Landing components (copy from frontend)
│   │   └── styles/
│   │       └── globals.css         → Minimal styles
│   ├── public/                     → Copy images/assets from frontend
│   ├── package.json                → Minimal dependencies
│   ├── next.config.js              → With redirects to app
│   ├── .env.local                  → Development config
│   ├── .env.production             → Production config
│   └── README.md
│
└── services/          → Backend services (shared by both)
```

## What Was Created

### 1. Marketing Site Configuration Files

- `marketing/package.json` - Minimal dependencies (only what's needed for landing pages)
- `marketing/tsconfig.json` - TypeScript configuration
- `marketing/next.config.js` - With automatic redirects to main app
- `marketing/tailwind.config.js` - Tailwind configuration
- `marketing/postcss.config.js` - PostCSS configuration
- `marketing/.gitignore` - Git ignore rules

### 2. Environment Files

- `marketing/.env.local` - Development environment
  - API URL: `http://localhost:80`
  - App URL: `http://localhost:3000`
  
- `marketing/.env.production` - Production environment
  - API URL: `https://api.aaptor.com`
  - App URL: `https://web.aaptor.com`

### 3. Base Files

- `marketing/src/pages/_app.tsx` - Next.js app wrapper
- `marketing/src/pages/_document.tsx` - HTML document structure
- `marketing/src/styles/globals.css` - Minimal global styles

### 4. Documentation

- `marketing/README.md` - Development guide
- `marketing/DEPLOYMENT.md` - Deployment instructions

## Next Steps - What You Need to Do

### Step 1: Copy Pages from Frontend

Copy these pages from `frontend/src/pages/` to `marketing/src/pages/`:

```bash
# From the root directory
cp frontend/src/pages/index.tsx marketing/src/pages/
cp frontend/src/pages/schedule-demo.tsx marketing/src/pages/
cp frontend/src/pages/thank-you.tsx marketing/src/pages/
```

### Step 2: Copy Components

Copy the landing components:

```bash
# Create components directory
mkdir -p marketing/src/components/landing

# Copy landing components
cp -r frontend/src/components/landing/* marketing/src/components/landing/
```

### Step 3: Copy Public Assets

Copy images and assets:

```bash
# Copy public folder
cp -r frontend/public/* marketing/public/
```

### Step 4: Copy API Routes

Copy the schedule-demo API route:

```bash
# Create API directory
mkdir -p marketing/src/pages/api

# Copy API route
cp frontend/src/pages/api/schedule-demo.ts marketing/src/pages/api/
```

### Step 5: Install Dependencies

```bash
cd marketing
npm install
```

### Step 6: Test Locally

```bash
# Terminal 1: Run main app (port 3000)
cd frontend
npm run dev

# Terminal 2: Run marketing site (port 3001)
cd marketing
npm run dev
```

Test:
- `http://localhost:3001` → Landing page
- `http://localhost:3001/schedule-demo` → Demo form
- `http://localhost:3001/thank-you` → Thank you page
- `http://localhost:3001/auth/signin` → Should redirect to `localhost:3000/auth/signin`

## Domain Mapping

### Development
- Marketing: `localhost:3001` (this new site)
- App: `localhost:3000` (existing frontend)

### Production
- Marketing: `aaptor.com` → Deploy `marketing/`
- App: `web.aaptor.com` → Deploy `frontend/`

### QA
- Marketing: `qa.aaptor.com` → Deploy `marketing/`
- App: `qa-app.aaptor.com` → Deploy `frontend/`

## Key Features

### 1. Automatic Redirects

The marketing site automatically redirects auth and dashboard routes to the main app:

- `aaptor.com/auth/*` → `web.aaptor.com/auth/*`
- `aaptor.com/dashboard/*` → `web.aaptor.com/dashboard/*`

### 2. Minimal Dependencies

Marketing site only includes:
- Next.js, React
- Tailwind CSS
- Framer Motion (for animations)
- Lucide React (for icons)
- Axios (for API calls)

No heavy dependencies like:
- NextAuth
- Monaco Editor
- TensorFlow
- Three.js
- etc.

### 3. Shared Backend

Both sites use the same backend services:
- Demo Service
- Auth Service
- API Gateway

## Deployment

See `marketing/DEPLOYMENT.md` for detailed deployment instructions including:
- Nginx configuration
- PM2 setup
- Docker deployment
- Environment variables

## Benefits

1. **Clean Separation**: Marketing and app are completely separate
2. **Performance**: Marketing site is lightweight and fast
3. **Maintainability**: Marketing team can update landing pages without touching app code
4. **Security**: App domain can have stricter security policies
5. **Scalability**: Can deploy on different servers/CDNs
6. **SEO**: Marketing site optimized for search engines

## Troubleshooting

### Issue: Pages not found
- Make sure you copied all pages from frontend to marketing

### Issue: Components not found
- Make sure you copied all landing components

### Issue: Styles not working
- Check that globals.css is imported in _app.tsx
- Run `npm install` to install Tailwind

### Issue: API calls failing
- Check `.env.local` has correct API_URL
- Make sure demo-service is running

### Issue: Redirects not working
- Check `next.config.js` has correct NEXT_PUBLIC_APP_URL
- Restart the dev server after changing config

## Summary

You now have:
- ✅ Marketing site structure created (`marketing/` folder)
- ✅ Configuration files set up
- ✅ Environment variables configured
- ✅ Automatic redirects to main app
- ✅ Documentation for deployment

Next: Copy the pages, components, and assets from frontend to marketing, then test locally!
