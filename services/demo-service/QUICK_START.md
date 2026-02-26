# Quick Start Guide - Demo Service

## Immediate Steps to Fix the Connection Error

The error `ECONNREFUSED` means the demo-service is not running. Follow these steps:

### 1. Install Dependencies
```bash
cd services/demo-service
npm install
```

### 2. Create .env File
Create a `.env` file in `services/demo-service/` with:

```env
PORT=3008
NODE_ENV=development

# MongoDB (use your existing MongoDB URI)
MONGO_URI=mongodb://localhost:27017
MONGO_DB=demo_db

# SendGrid (get API key from sendgrid.com)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@aaptor.com
SENDGRID_FROM_NAME=Aaptor Platform

# Notification email
NOTIFICATION_EMAIL=info@aaptor.com

# CORS
CORS_ORIGINS=http://localhost:3000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

### 3. Start the Service
```bash
npm run dev
```

You should see:
```
🚀 Demo Service running on port 3008
📧 SendGrid initialized: Yes/No
📬 Notification email: info@aaptor.com
🌍 Environment: development
```

### 4. Verify It's Working
- Check http://localhost:3008/health - should return `{"status":"healthy"}`
- Try submitting the form from the frontend

## Troubleshooting

**If MongoDB connection fails:**
- Make sure MongoDB is running
- Check MONGO_URI is correct
- The database will be created automatically

**If SendGrid fails:**
- Get API key from https://sendgrid.com
- Verify your sender email in SendGrid dashboard
- Emails will fail but the form will still save to database

**If port 3008 is in use:**
- Change PORT in .env file
- Update API Gateway SERVICES.demo URL accordingly

## Next Steps After Service Starts

1. ✅ API Gateway is already configured (route added)
2. ✅ Frontend API route is already configured
3. ⏳ Start the demo-service (step 3 above)
4. ⏳ Test form submission

