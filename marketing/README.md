# Aaptor Marketing Site

This is the marketing/landing page site for Aaptor, separate from the main application.

## Domain Mapping

- **Production**: `aaptor.com` → This marketing site
- **App**: `web.aaptor.com` or `app.aaptor.com` → Main application (frontend/)

## Development

```bash
# Install dependencies
npm install

# Run development server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Pages

- `/` - Landing page
- `/schedule-demo` - Schedule demo form
- `/thank-you` - Thank you page after demo request

## Features

- Lightweight Next.js site
- Only marketing pages (no auth, no dashboard)
- Redirects `/auth/*` and `/dashboard/*` to main app
- Minimal dependencies

## Environment Variables

See `.env.local` for development and `.env.production` for production settings.

Key variables:
- `NEXT_PUBLIC_API_URL` - API Gateway URL
- `NEXT_PUBLIC_APP_URL` - Main application URL (for redirects)
