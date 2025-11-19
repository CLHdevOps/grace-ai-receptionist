# Grace AI Receptionist

> MVP for an AI receptionist for small businesses.

## Overview

**Grace AI Receptionist** is a realtime voice assistant powered by Twilio + OpenAI Realtime API + Azure App Service for after-hours calls.

Grace is a warm, human-sounding AI receptionist designed for nonprofits, ministries, and service organizations. She answers after-hours calls, speaks naturally (with human-like pauses and fillers), captures caller information, and stores call recordings and transcripts in Azure Blob Storage.

### Built With

- **Twilio Voice** (Media Streams)
- **OpenAI GPT-4o Realtime API**
- **Node.js + WebSockets**
- **Azure App Service** (Linux)
- **Azure Blob Storage**

---

## Features

### ✅ Real-Time Voice AI
Grace holds natural phone conversations using OpenAI's realtime speech-to-speech API.

### ✅ Mercy House Website Integration
Grace automatically fetches and uses real content from the Mercy House Adult & Teen Challenge website to answer questions accurately about:
- Programs and services
- Admission process
- Contact information
- Mission and values

### ✅ Structured Intake Data Collection
Grace intelligently collects caller information in a structured JSON format:
- Name
- Phone number (auto-captured from Twilio caller ID)
- City/State
- Reason for calling

Uses a special "INTAKE:" format to ensure reliable data extraction.

### ✅ After-Hours Routing
- **Business hours** → forward calls to the real phone number
- **After hours** → Grace answers the call

### ✅ Call Recording & Transcript Storage
All calls generate three files in Azure Blob Storage:
- `transcript.json` - Complete conversation transcript
- `intake.json` - Structured caller information
- `recording.json` - Call metadata (duration, timestamp)

### ✅ Faith-Aligned Personality
Grace is designed specifically for faith-based organizations with:
- Warm, compassionate responses
- Appropriate mentions of hope, prayer, and restoration
- Emergency crisis protocols
- Professional boundaries (no medical/legal advice)

### ✅ Optional Alerts
Email/SMS alerts can be sent after every call with Blob links.

---

## Architecture Overview

```
Caller
   ↓
Twilio Voice Number
   ↓ (Webhook /voice)
Azure App Service (Node.js)
   • Generates TwiML
   • Starts Media Stream
   ↓ (WebSocket)
OpenAI GPT-4o Realtime
   • Natural conversation with caller
   • Text + audio events
   ↓
Azure Blob Storage
   • recording.wav
   • recording.json
   • transcript.json
   • intake.json
```

---

## Requirements

- **Node.js 20+**
- **Azure Subscription** (for App Service + Blob)
- **Twilio Account** (for phone number)
- **OpenAI API Key** (for realtime model)

---

## Setup Guide

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd grace-receptionist
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create `.env` (Local Development Only)

```bash
OPENAI_API_KEY=<your key>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
AZURE_STORAGE_CONNECTION_STRING=<connection string>
BLOB_CONTAINER=calls
PORT=8080
```

### 4. Provision Azure Resources

#### Step 1: Login to Azure
```bash
# Login with device code (recommended)
az login --use-device-code

# Follow the prompts to authenticate
```

#### Step 2: Register Required Resource Providers
**Important**: New Azure subscriptions need resource providers registered before creating resources.

```bash
# Register all required providers
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.Insights

# Check registration status (wait until all show "Registered")
az provider list --query "[?namespace=='Microsoft.Storage' || namespace=='Microsoft.Web' || namespace=='Microsoft.Insights'].{Namespace:namespace, State:registrationState}" -o table
```

**Note**: Provider registration can take 2-5 minutes. Wait until all show `Registered` before proceeding.

#### Step 3: Create Resource Group
```bash
az group create -n rg-grace -l eastus
```

#### Step 4: Create Storage Account + Container
```bash
# Create storage account (name must be globally unique, lowercase, 3-24 characters)
az storage account create -n mercyhouse -g rg-grace --sku Standard_LRS -l eastus

# Get connection string (save this for later)
az storage account show-connection-string -g rg-grace -n mercyhouse --output tsv

# Create blob container
az storage container create --account-name mercyhouse --name calls
```

#### Step 5: Create App Service Plan + Web App
```bash
# Create App Service Plan (use F1 for free tier or B1 for basic)
az appservice plan create -n asp-grace -g rg-grace --sku B1 --is-linux

# Create Web App with Node.js 20 runtime
az webapp create -n grace-receptionist-app -g rg-grace --plan asp-grace --runtime "NODE:20-lts"
```

**Note**: If you get quota errors, try:
- Different SKU: `--sku F1` (Free tier)
- Different region: `-l westus2` or `-l centralus`
- Request quota increase in Azure Portal

#### Step 6: Configure App Settings in Azure
```bash
# Get your storage connection string
STORAGE_CONN=$(az storage account show-connection-string -g rg-grace -n mercyhouse --output tsv)

# Set all application settings at once
az webapp config appsettings set \
  -g rg-grace \
  -n grace-receptionist-app \
  --settings \
    WEBSITES_PORT=8080 \
    OPENAI_API_KEY="<your-openai-key>" \
    TWILIO_ACCOUNT_SID="<your-twilio-sid>" \
    TWILIO_AUTH_TOKEN="<your-twilio-token>" \
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN" \
    BLOB_CONTAINER=calls
```

**Alternative**: Set these manually in Azure Portal → App Service → Configuration → Application Settings

### 5. Setup ngrok for Local Testing

**Note**: ngrok allows you to expose your local server to the internet so Twilio can reach it during development.

#### Step 1: Download ngrok
```bash
# Download ngrok (will extract to current directory)
curl -L https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip -o ngrok.zip
unzip ngrok.zip
rm ngrok.zip
```

#### Step 2: Sign up and authenticate
1. Create free account at https://dashboard.ngrok.com/signup
2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok:
```bash
./ngrok config add-authtoken <your-auth-token>
```

#### Step 3: Start ngrok tunnel
```bash
./ngrok http 8080
```

Copy the `https://` forwarding URL (e.g., `https://abc123.ngrok.io`) - you'll need this for Twilio.

**Important**: Keep this terminal window open while testing!

### 6. Provision Twilio

#### Step 1: Buy a Phone Number
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Buy a number**
3. Search for a voice-enabled number in your area
4. Purchase the number

#### Step 2: Configure Voice Webhook
1. Go to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on your purchased phone number
3. Scroll to **Voice Configuration** section
4. Under **A CALL COMES IN**:
   - **Webhook**: `https://your-ngrok-url.ngrok.io/voice` (use your ngrok URL)
   - **HTTP Method**: `POST`
5. Click **Save**

**For Production**: Replace ngrok URL with your Azure URL:
```
https://grace-receptionist-app.azurewebsites.net/voice
```

### 7. Run Locally

```bash
node server.js
```

**Check health:**
```bash
curl http://localhost:8080/healthz
```

**Note**: Make sure ngrok is running in a separate terminal so Twilio can reach your local server!

### 8. Deploy to Azure

#### Zip Deploy
```bash
zip -r app.zip .
az webapp deployment source config-zip \
  -g rg-grace \
  -n grace-receptionist \
  --src app.zip
```

#### Point Twilio to Production
```
https://grace-receptionist.azurewebsites.net/voice
```

---

## Business Hours Routing (Optional)

Modify `/voice` route in `server.js`:

```javascript
if (isBusinessHours()) {
  return res.type("text/xml").send(`
    <Response>
      <Dial>+1601XXXXXXX</Dial>
    </Response>
  `);
}
```

**After hours:**
Return `<Start><Stream>` TwiML (Grace answers)

---

## Blob Storage Structure

```
/calls/<CallSid>/
  recording.json
  recording.wav
  transcript.json
  intake.json
```

---

## Optional: Client Notifications

Add SMS/email notification in `closeAndPersist()`:

1. Compose summary with links to:
   - `transcript.json`
   - `recording.wav`

2. Send to staff (Twilio SMS or SMTP via SendGrid)

---

## Scaling to Multi-Tenant

Modify project config:

```javascript
const clients = {
  mercyhouse: {
    phone: "+1601XXX",
    timezone: "America/Chicago",
    businessNumber: "+1601YYY",
    blobPrefix: "mercyhouse/"
  }
};
```

Route by Twilio number ("To" field).

---

## Testing Checklist

| Test | Expected |
|------|----------|
| Call during business hours | Forward to real phone |
| Call after hours | Grace answers |
| Grace speaks greeting | "Hi, this is Grace…" |
| Conversation works | Real-time voice both ways |
| Hang up | recording + transcript saved |
| Blob Storage | has folder `/calls/<CallSid>` |
| Optional alert | SMS/email received |

---

## Grace System Prompt & Website Integration

Grace's personality, tone, safety rules, and instructions are stored in code under `GRACE_PROMPT` (lines 69-121 in [server.js](server.js)).

**Key Features:**

### Mercy House Website Scraping
Grace automatically fetches content from these pages on each call:
- https://mercyhouseatc.com/
- https://mercyhouseatc.com/about/
- https://mercyhouseatc.com/program/
- https://mercyhouseatc.com/contact/

This gives Grace real, up-to-date information to answer caller questions accurately.

### Personality Traits
- ✅ Warm, kind, and genuinely caring
- ✅ Professional but conversational (never stiff)
- ✅ Faith-aligned - appropriately mentions hope, prayer, and restoration
- ✅ Human-like speech patterns ("hmm", "okay, I hear you", natural pauses)
- ✅ Varied phrasing to avoid repetition

### Structured Data Collection
Grace uses a special **INTAKE:** format to output structured JSON:
```
INTAKE: {"name":"John Doe","phone":"+1601XXXXXXX","city":"Brandon","state":"MS","reason":"Asking about admission for a family member"}
```

This ensures reliable extraction of:
- Caller's name
- Phone number (auto-captured from Twilio + confirmed)
- City and state
- Short reason for calling

### Safety Rules
- ❌ No medical, legal, or professional counseling advice
- 🚨 **Emergency protocol**: "This sounds like an emergency. Please hang up and call 911 right away."
- ✅ Stays in lane as a receptionist
- ✅ Never makes up information - says "let me have someone call you back" when uncertain

---

## DONE — Grace Is Live

You now have:

- ✅ A real, talking, human-sounding AI receptionist
- ✅ Deployed on Azure
- ✅ Answering Twilio calls
- ✅ Storing recordings + transcripts to Blob
- ✅ Ready for multiple clients

---

## Support / Next Steps

If you'd like, I can help you:

- ✅ Generate full `server.js` with business hours routing + alerts
- ✅ Build a simple web dashboard to view calls
- ✅ Package this as a SaaS for clients (Grace.ai or your brand)