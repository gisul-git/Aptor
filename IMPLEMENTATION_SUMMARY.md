# Demo Request Acceptance with Credentials Implementation

## Overview
Implemented a complete flow where super admin can accept demo requests, which automatically creates an organization and user account with temporary credentials that are emailed to the requester. The user must reset their password on first login.

## Changes Made

### 1. Backend - Super Admin Service

#### File: `services/super-admin-service/app/api/v1/super_admin/demo_requests.py`
- **Modified**: `accept_demo_request` endpoint
- **Changes**:
  - Generates unique organization ID (ORG001, ORG002, etc.)
  - Creates organization in `organization_db`
  - Generates secure 12-character temporary password
  - Creates user account with:
    - Email from demo request
    - Hashed temporary password
    - `requirePasswordReset: True` flag
    - `emailVerified: True` (pre-verified)
    - Role: `org_admin`
  - Sends email with credentials (org ID, email, temp password)

#### File: `services/super-admin-service/app/api/v1/super_admin/email_service.py`
- **Modified**: `send_acceptance_email` function signature
- **Changes**:
  - Now accepts `org_id` and `temp_password` parameters
  - Updated email template to include:
    - Organization ID (prominently displayed)
    - Email address
    - Temporary password
    - Warning about password reset requirement
    - Step-by-step instructions for first login

### 2. Backend - Auth Service

#### File: `services/auth-service/app/api/v1/auth/routers.py`
- **Modified**: `email_login` endpoint (POST `/api/v1/auth/login`)
- **Changes**:
  - Added check for `requirePasswordReset` flag after successful authentication
  - If flag is set:
    - Generates password reset token
    - Stores token in database
    - Returns response with `requirePasswordReset: true` and `resetToken`
    - Does NOT issue JWT tokens (prevents login until password is reset)

- **Modified**: `reset_password` endpoint (POST `/api/v1/auth/reset-password`)
- **Changes**:
  - Now clears `requirePasswordReset` flag when password is successfully reset
  - Allows user to login normally after password reset

### 3. Frontend

#### File: `frontend/src/pages/auth/signin.tsx`
- **Modified**: `handleSubmit` function
- **Changes**:
  - Added detection for `requirePasswordReset` response from login API
  - Extracts `resetToken` from response
  - Automatically redirects to `/auth/reset-password?token={resetToken}`
  - Prevents normal login flow when password reset is required

#### File: `frontend/src/pages/auth/reset-password.tsx`
- **No changes needed** - Already has complete password reset functionality with:
  - Token verification
  - Password strength validation
  - Confirmation password matching
  - Success redirect to signin page

## Flow Diagram

```
1. Super Admin accepts demo request
   ↓
2. System generates:
   - Organization ID (ORG001, ORG002, etc.)
   - Temporary password (12 chars, alphanumeric)
   ↓
3. System creates:
   - Organization in organization_db
   - User account with requirePasswordReset=true
   ↓
4. Email sent with:
   - Organization ID
   - Email
   - Temporary password
   ↓
5. User receives email and visits login page
   ↓
6. User enters: Org ID + Email + Temp Password
   ↓
7. Backend validates credentials
   ↓
8. Backend detects requirePasswordReset=true
   ↓
9. Backend generates reset token
   ↓
10. Frontend receives requirePasswordReset response
   ↓
11. Frontend redirects to /auth/reset-password?token={token}
   ↓
12. User sets new password
   ↓
13. Backend clears requirePasswordReset flag
   ↓
14. User can now login normally
```

## Security Features

1. **Temporary Password**: 12-character random alphanumeric string
2. **Password Hashing**: Temporary password is hashed before storage
3. **Reset Token**: Cryptographically secure token for password reset
4. **Token Expiration**: Reset token expires in 30 minutes
5. **Flag-based Control**: `requirePasswordReset` flag prevents login until password is changed
6. **Email Verification**: User account is pre-verified (email from demo request)

## Database Schema Changes

### Users Collection
Added new field:
- `requirePasswordReset` (boolean): Flag to force password reset on next login

## API Endpoints Modified

### POST `/api/v1/super-admin/demo-requests/{request_id}/accept`
**Response** (success):
```json
{
  "success": true,
  "message": "Demo request accepted successfully. Organization and user account created.",
  "data": {
    ...demo_request_data,
    "orgId": "ORG001",
    "userEmail": "user@example.com"
  }
}
```

### POST `/api/v1/auth/login`
**New Response** (when requirePasswordReset is true):
```json
{
  "success": true,
  "message": "Password reset required. Please use the provided token to reset your password.",
  "data": {
    "requirePasswordReset": true,
    "resetToken": "secure_token_here",
    "email": "user@example.com"
  }
}
```

### POST `/api/v1/auth/reset-password`
**Request**:
```json
{
  "token": "reset_token",
  "newPassword": "new_secure_password"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successful. You can now sign in with your new password.",
  "data": {}
}
```

## Testing Checklist

- [ ] Super admin can accept demo request
- [ ] Organization is created with unique ID
- [ ] User account is created with temporary password
- [ ] Email is sent with correct credentials
- [ ] User can login with temporary credentials
- [ ] User is redirected to password reset page
- [ ] User can set new password
- [ ] requirePasswordReset flag is cleared after reset
- [ ] User can login normally with new password
- [ ] Reset token expires after 30 minutes
- [ ] Invalid/expired tokens are rejected

## Notes

- The temporary password is only sent via email and is never displayed in the UI
- The reset token is automatically generated and passed via URL parameter
- The user cannot access the dashboard until they reset their password
- All passwords are hashed using bcrypt before storage
- The organization ID follows the format ORG001, ORG002, etc.
