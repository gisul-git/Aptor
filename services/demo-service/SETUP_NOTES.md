# Demo Service Setup Notes

## Quick Setup Checklist

1. ✅ **Service Created** - All files are in place
2. ⏳ **Install Dependencies** - Run `npm install` in `services/demo-service`
3. ⏳ **Configure .env** - Copy `.env.example` to `.env` and fill in values
4. ⏳ **Get SendGrid API Key** - Sign up at sendgrid.com and get API key
5. ⏳ **Start MongoDB** - Ensure MongoDB is running
6. ⏳ **Start Service** - Run `npm run dev` to start the service
7. ⏳ **Update API Gateway** - Add demo-service route to API gateway
8. ⏳ **Test** - Submit a demo request from the frontend

## API Gateway Configuration

Add this route to `services/api-gateway/src/index.js`:

```javascript
// Add to SERVICES object
demo: process.env.DEMO_SERVICE_URL || 'http://localhost:3008',

// Add route proxy
app.use(
  '/api/v1/demo',
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.demo,
  })
);
```

Also add `/api/v1/demo` to the public routes in the `verifyToken` middleware if you want it to be public (which you do for the schedule endpoint).

## Environment Variables Needed

```env
# In demo-service/.env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
NOTIFICATION_EMAIL=info@aaptor.com

# In api-gateway/.env (optional)
DEMO_SERVICE_URL=http://localhost:3008
```

## Testing

1. Start the demo-service: `cd services/demo-service && npm run dev`
2. Submit a form from the frontend
3. Check MongoDB for the saved document
4. Check email inboxes (info@aaptor.com and user email)

## Port

Default port: **3008**

Make sure this port is available and not conflicting with other services.

