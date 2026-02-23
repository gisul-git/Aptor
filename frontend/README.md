# Next.js Frontend

This directory hosts the new Next.js client for the AI Assessment Platform. It
implements authentication with NextAuth, supporting:

- Two-step OTP login that reuses the FastAPI authentication endpoints
- Google OAuth 2.0 via NextAuth
- Microsoft/Azure AD SSO via NextAuth
- Dedicated portals for organization users (`/auth/signin`) and super admins
  (`/super-admin`)

## Getting Started

1. Install Node.js 18 or later.
2. Create an `.env` file based on `.env.example`.
3. Install dependencies and start the dev server:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The app runs on `http://localhost:3000`.

## Environment Variables

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secure-random-string
FASTAPI_BASE_URL=http://localhost:8000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=common
```

## Auth Flow Overview

1. **Email/Password Login**
   - Users sign in through the organization portal (`/auth/signin`).
   - NextAuth credentials provider calls FastAPI `/api/auth/login`.
   - The returned JWT is stored in the session for subsequent API calls.
   - Super admin users are automatically redirected to `/super-admin` dashboard.

2. **Google & Microsoft SSO**
   - Configure the provider credentials in the `.env` file.
   - NextAuth handles the OAuth flow; resulting sessions include provider
     metadata so the UI can tailor the experience.

## Project Layout

```
frontend/
  public/              # Static assets (logo, etc.)
  src/
    components/auth/   # OTP login UI components
    lib/               # FastAPI Axios client
    pages/             # Next.js pages and API routes (NextAuth, OTP proxy)
    styles/            # Global CSS
    types/             # Shared TypeScript declarations & NextAuth augmentation
```

## Connecting to FastAPI

Ensure the FastAPI backend is running (see `backend/README.md`). The
`FASTAPI_BASE_URL` must point to the backend host so the credentials provider
and OTP proxy routes can reach `/api/auth/*` endpoints.
