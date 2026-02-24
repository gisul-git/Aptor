# Demo Service

Service for handling demo request form submissions from the Schedule Demo page.

## Features

- ✅ Store demo requests in MongoDB
- ✅ Send notification emails to info@aaptor.com via SendGrid
- ✅ Send confirmation emails to users
- ✅ Rate limiting to prevent spam
- ✅ Input validation
- ✅ Professional email templates

## Setup

### 1. Install Dependencies

```bash
cd services/demo-service
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `services/demo-service` directory:

```env
# Server Configuration
PORT=3008
NODE_ENV=development

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGO_DB=demo_db

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@aaptor.com
SENDGRID_FROM_NAME=Aaptor Platform

# Notification Email (where demo requests are sent)
NOTIFICATION_EMAIL=info@aaptor.com

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

### 3. Get SendGrid API Key

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Go to Settings > API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the API key to your `.env` file

### 4. Run the Service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## API Endpoints

### POST `/api/v1/demo/schedule`
Submit a new demo request.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@company.com",
  "company": "Acme Corp",
  "phone": "+1 (555) 123-4567",
  "country": "US",
  "jobTitle": "hr",
  "companySize": "51-200",
  "competencies": ["general", "aiml"],
  "whatsapp": false,
  "privacyAgreed": true,
  "marketingConsent": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Demo request submitted successfully",
  "data": {
    "id": "...",
    "email": "john@company.com",
    "company": "Acme Corp",
    "status": "pending"
  }
}
```

### GET `/api/v1/demo/requests`
Get all demo requests (admin only - should add auth).

### GET `/api/v1/demo/requests/:id`
Get a specific demo request by ID.

### PATCH `/api/v1/demo/requests/:id/status`
Update demo request status (admin only - should add auth).

## Database Schema

The `DemoRequest` model stores:
- Contact information (name, email, phone, company, country)
- Role information (jobTitle, companySize)
- Interests (competencies array)
- Preferences (whatsapp, marketingConsent)
- Status (pending, contacted, completed, cancelled)
- Timestamps (createdAt, updatedAt)

## Email Templates

- **Notification Email**: Sent to info@aaptor.com with all form details
- **Confirmation Email**: Sent to the user confirming their request

Both emails use professional HTML templates with Aaptor branding.

## Rate Limiting

Default: 5 requests per 15 minutes per IP address.

Configure via environment variables:
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window

## Next Steps

1. **Add Authentication**: Protect admin routes with JWT authentication
2. **Add API Gateway Route**: Update API gateway to proxy `/api/v1/demo` to this service
3. **Update Frontend**: Point frontend API endpoint to `/api/v1/demo/schedule`
4. **Add Admin Dashboard**: Create UI to view and manage demo requests

## Troubleshooting

**Emails not sending?**
- Check SendGrid API key is correct
- Verify SendGrid account is verified
- Check SendGrid sender email is verified

**Database connection issues?**
- Verify MongoDB is running
- Check MONGO_URI is correct
- Ensure database exists (will be created automatically)

