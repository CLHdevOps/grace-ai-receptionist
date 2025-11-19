# Grace AI Receptionist - Complete Setup Guide

This guide will help you complete the setup and get Grace running.

## ✅ What's Already Done

- ✅ Azure Resource Group created (`rg-grace`)
- ✅ Azure Storage Account created (`mercyhouse`)
- ✅ Blob Container created (`calls`)
- ✅ Azure App Service created (`grace-receptionist`)
- ✅ Azure Resource Providers registered
- ✅ ngrok downloaded
- ✅ Twilio phone number purchased
- ✅ server.js implemented with full OpenAI + Twilio integration
- ✅ **NEW:** Mercy House website integration (automatic content scraping)
- ✅ **NEW:** Structured intake data collection with JSON output
- ✅ **NEW:** Auto-capture of caller phone number from Twilio
- ✅ **NEW:** Faith-aligned personality customized for Mercy House

## 🔧 What You Need to Complete

### 1. Install Node.js Dependencies

```bash
npm install
```

This will install:
- express & express-ws (web server & WebSocket support)
- @azure/storage-blob (Azure Blob Storage)
- openai (OpenAI SDK)
- ws (WebSocket client for OpenAI)
- dotenv (environment variables)

### 2. Create Your Local `.env` File

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and fill in your actual credentials:

```bash
# Get your OpenAI key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxx

# Get these from: https://console.twilio.com/
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx

# Get this with: az storage account show-connection-string -g rg-grace -n mercyhouse --output tsv
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
```

### 3. Configure Azure App Service Settings

Set the same environment variables in Azure:

```bash
# Get storage connection string
STORAGE_CONN=$(az storage account show-connection-string -g rg-grace -n mercyhouse --output tsv)

# Set all app settings
az webapp config appsettings set \
  -g rg-grace \
  -n grace-receptionist \
  --settings \
    WEBSITES_PORT=8080 \
    OPENAI_API_KEY="<your-openai-key>" \
    TWILIO_ACCOUNT_SID="<your-twilio-sid>" \
    TWILIO_AUTH_TOKEN="<your-twilio-token>" \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN" \
    BLOB_CONTAINER=calls
```

### 4. Setup ngrok for Local Testing

```bash
# Authenticate ngrok (get token from https://dashboard.ngrok.com/get-started/your-authtoken)
./ngrok config add-authtoken <your-ngrok-auth-token>

# Start ngrok in a separate terminal
./ngrok http 8080
```

**Copy the https:// URL** (e.g., `https://abc123.ngrok.io`) - you'll need this for Twilio!

**Important**: Keep this terminal window open while testing!

### 5. Configure Twilio Webhook

1. Go to [Twilio Console → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click on your purchased phone number
3. Scroll to **Voice Configuration**
4. Under **A CALL COMES IN**:
   - **Webhook**: `https://your-ngrok-url.ngrok.io/voice` (use your actual ngrok URL)
   - **HTTP Method**: `POST`
5. Click **Save**

### 6. Start the Server Locally

Open a new terminal and run:

```bash
node server.js
```

You should see:
```
Grace AI Receptionist server running on port 8080
Health check: http://localhost:8080/healthz
```

### 7. Test the System

**Test 1: Health Check**
```bash
curl http://localhost:8080/healthz
```

Expected response:
```json
{"status":"healthy","timestamp":"2025-11-19T..."}
```

**Test 2: Call Your Twilio Number**
- Call the Twilio phone number you purchased
- Grace should answer and greet you
- Have a conversation with Grace
- Hang up

**Test 3: Check Azure Blob Storage**
```bash
# List calls in storage
az storage blob list \
  --account-name mercyhouse \
  --container-name calls \
  --output table
```

You should see:
```
calls/<CallSid>/transcript.json
calls/<CallSid>/intake.json
calls/<CallSid>/recording.json
```

## 🚀 Deploy to Production (Azure)

Once local testing works, deploy to Azure:

### 1. Create Deployment Package

```bash
# Create zip file (exclude node_modules, .env, etc.)
zip -r app.zip . -x "node_modules/*" ".env" ".git/*" "*.log" "ngrok*"
```

### 2. Deploy to Azure

```bash
az webapp deployment source config-zip \
  -g rg-grace \
  -n grace-receptionist \
  --src app.zip
```

### 3. Update Twilio Webhook to Production URL

1. Go back to [Twilio Console → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Update the webhook URL to:
   ```
   https://grace-receptionist-ghc6gmducyh2dqe2.eastus-01.azurewebsites.net/voice
   ```
3. Save

### 4. Test Production

Call your Twilio number and verify Grace answers!

## 📊 Monitoring & Debugging

### View Azure App Service Logs

```bash
# Stream live logs
az webapp log tail -g rg-grace -n grace-receptionist

# Download logs
az webapp log download -g rg-grace -n grace-receptionist
```

### View Call Data in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Storage Account → `mercyhouse` → Containers → `calls`
3. Browse call recordings and transcripts

### Check Server Health

```bash
# Local
curl http://localhost:8080/healthz

# Production
curl https://grace-receptionist-ghc6gmducyh2dqe2.eastus-01.azurewebsites.net/healthz
```

## 🎯 Next Steps

### Optional Enhancements

1. **Business Hours Routing**: Uncomment lines 77-85 in `server.js` to forward calls during business hours
2. **Email/SMS Notifications**: Implement the `sendNotification()` function in `server.js`
3. **Dashboard**: Build a web UI to view call logs and transcripts
4. **Multi-Tenant**: Configure different Grace instances for different clients

### Customize Grace's Personality

Edit the `GRACE_PROMPT` in [server.js](server.js) (lines 69-121) to adjust:
- Greeting style
- Information to collect
- Tone and personality
- Safety rules
- Organization-specific context

### Customize Website Integration

To change which website pages Grace scrapes for information, edit the `MERCY_URLS` array in [server.js](server.js) (lines 18-23):

```javascript
const MERCY_URLS = [
  'https://mercyhouseatc.com/',
  'https://mercyhouseatc.com/about/',
  'https://mercyhouseatc.com/program/',
  'https://mercyhouseatc.com/contact/',
];
```

**How it works:**
- On each call, Grace fetches content from these URLs
- HTML is stripped and cleaned (removes scripts, styles, tags)
- Up to 2000 characters per page are used as context
- This gives Grace real, up-to-date information to answer questions

**To adapt for another organization:**
1. Update the URLs to your organization's website
2. Update the `GRACE_PROMPT` with your organization's name and mission
3. Adjust the intake fields if needed (e.g., add/remove questions)

### Understanding the INTAKE Format

Grace outputs caller information in a structured JSON format that's automatically parsed:

```
INTAKE: {"name":"John Doe","phone":"+1601XXXXXXX","city":"Brandon","state":"MS","reason":"Asking about admission"}
```

This happens in the conversation transcript and is extracted by the `updateIntakeFromText()` function (lines 105-126 in [server.js](server.js)).

**Key features:**
- Phone number is pre-filled from Twilio caller ID
- Grace confirms/updates information during conversation
- Data is saved to `intake.json` in Azure Blob Storage
- Reliable structured data extraction without complex parsing

## 🆘 Troubleshooting

### Server won't start
- Check that all environment variables are set in `.env`
- Verify port 8080 is not already in use
- Run `npm install` to ensure dependencies are installed

### Twilio can't reach webhook
- Make sure ngrok is running
- Verify the ngrok URL is correct in Twilio console
- Check that your local server is running on port 8080

### No audio in call
- Verify OpenAI API key is valid and has access to Realtime API
- Check server logs for WebSocket connection errors
- Ensure audio formats match (g711_ulaw)

### Call data not saving to Azure
- Verify Azure Storage connection string is correct
- Check that the `calls` container exists
- Review server logs for upload errors

## 📞 Support

- **Twilio Issues**: https://console.twilio.com/support
- **Azure Issues**: https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade
- **OpenAI Issues**: https://platform.openai.com/docs

---

**You're all set!** Grace is ready to answer calls and help your callers. 🎉
