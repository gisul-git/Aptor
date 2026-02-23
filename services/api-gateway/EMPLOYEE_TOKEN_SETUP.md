# Employee Token Configuration

## Problem
If you're getting "Invalid token type. Employee token required" error, it means the JWT secret doesn't match between employee-service and API Gateway.

## Solution

### Step 1: Check Employee Service JWT Secret

The employee-service uses `JWT_SECRET` from its `.env` file:
- Location: `services/employee-service/.env`
- Must be at least 32 characters long
- Cannot be "change-me"

### Step 2: Set Same Secret in API Gateway

Add the **same** JWT_SECRET to API Gateway's `.env` file:
- Location: `services/api-gateway/.env`
- Add: `JWT_SECRET=<same-secret-as-employee-service>`
- OR: `EMPLOYEE_JWT_SECRET=<same-secret-as-employee-service>`

### Step 3: Restart Both Services

After setting the secret, restart:
1. Employee Service
2. API Gateway

## Example .env Configuration

**services/employee-service/.env:**
```env
JWT_SECRET=your-32-character-or-longer-secret-here
```

**services/api-gateway/.env:**
```env
JWT_SECRET=your-32-character-or-longer-secret-here
# OR use this if you want a separate variable name:
EMPLOYEE_JWT_SECRET=your-32-character-or-longer-secret-here
```

## Generate a Secure Secret

If you need to generate a new secret:

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**OpenSSL:**
```bash
openssl rand -base64 32
```

**PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Verify Configuration

After setting up, the API Gateway logs will show:
- ✅ `Employee token verified` - if successful
- 🔴 `Token verification failed` - if secret doesn't match
- 🔴 `Invalid token type` - if token structure is wrong

