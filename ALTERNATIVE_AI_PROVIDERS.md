# Alternative AI Providers Setup

## Current Issue

The OpenAI API key is returning `401 Unauthorized - invalid_api_key` error. This means:
- The key is expired, revoked, or invalid
- The OpenAI account may not have billing enabled
- The key format might be incorrect

## Solution: Use Alternative AI Providers

Since OpenAI is not working, you can use **Gemini** (Google) or **Claude** (Anthropic) instead.

---

## Option 1: Google Gemini (Recommended - Free Tier Available)

### Step 1: Get Gemini API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key

### Step 2: Update .env File
Edit `Aptor/services/design-service/.env`:

```env
# Change AI provider from openai to gemini
AI_PROVIDER=gemini

# Add your Gemini API key
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Keep OpenAI key as is (not used when provider is gemini)
OPENAI_API_KEY=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
```

### Step 3: Service Auto-Reloads
The design service will automatically reload when you save the `.env` file.

### Step 4: Test
Run the question generation test again - it should work with Gemini!

---

## Option 2: Anthropic Claude

### Step 1: Get Claude API Key
1. Go to: https://console.anthropic.com/
2. Sign up/Sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key

### Step 2: Update .env File
Edit `Aptor/services/design-service/.env`:

```env
# Change AI provider to claude
AI_PROVIDER=claude

# Add your Claude API key
CLAUDE_API_KEY=YOUR_CLAUDE_API_KEY_HERE

# Keep OpenAI key as is (not used when provider is claude)
OPENAI_API_KEY=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
```

### Step 3: Service Auto-Reloads
The design service will automatically reload when you save the `.env` file.

### Step 4: Test
Run the question generation test again - it should work with Claude!

---

## Option 3: Fix OpenAI (If You Have Access)

If you want to continue using OpenAI:

### Check Your OpenAI Account:
1. Go to: https://platform.openai.com/account/billing
2. Make sure you have:
   - ✅ Payment method added
   - ✅ Credits available or auto-recharge enabled
   - ✅ Usage limits not exceeded

### Create New API Key:
1. Go to: https://platform.openai.com/api-keys
2. Delete the old key (if it exists)
3. Click "Create new secret key"
4. Give it a name (e.g., "Aaptor Design Service")
5. Copy the new key (starts with `sk-proj-...`)
6. Update `.env` file with the new key

---

## Comparison

| Provider | Free Tier | Speed | Quality | Setup Difficulty |
|----------|-----------|-------|---------|------------------|
| **Gemini** | ✅ Yes | Fast | Good | Easy |
| **Claude** | ⚠️ Limited | Fast | Excellent | Easy |
| **OpenAI** | ❌ No | Fast | Excellent | Medium (requires billing) |

---

## Recommendation

**Use Gemini** - It's free, fast, and works well for question generation. You can always switch back to OpenAI later if needed.

---

## Testing After Setup

Once you've updated the `.env` file with a new provider, test with:

```bash
curl -X POST http://localhost:3007/api/v1/design/questions/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "role": "ux_designer",
    "difficulty": "advanced",
    "task_type": "dashboard",
    "topic": "Agriculture dashboard",
    "experience_level": "3-5 years"
  }'
```

You should get a proper agriculture-specific dashboard question!

---

## Need Help?

If you need help getting API keys or setting up alternative providers, let me know which provider you'd like to use and I can guide you through the process.
