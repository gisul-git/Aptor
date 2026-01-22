# Generating Service-to-Service Secret

## Quick Generate (Node.js)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Quick Generate (OpenSSL)
```bash
openssl rand -base64 32
```

## Quick Generate (PowerShell - Windows)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Quick Generate (Python)
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Where to Set It

Add to `services/api-gateway/.env`:
```env
SERVICE_TO_SERVICE_SECRET=<your-generated-secret-here>
```

**Note:** If you don't set this, it will fall back to `JWT_SECRET` automatically.

