# grace-ai-receptionist
MVP for an AI receptionist for small businesses.

Grace AI Receptionist — Realtime Voice Assistant

A Twilio + OpenAI Realtime + Azure App Service voice receptionist for after-hours calls.

Grace is a warm, human-sounding AI receptionist designed for nonprofits, ministries, and service organizations.
She answers after-hours calls, speaks naturally (with human-like pauses + fillers), captures caller info, and stores call recordings + transcripts in Azure Blob Storage.

Built on:

Twilio Voice (Media Streams)

OpenAI GPT-4o Realtime API

Node.js + WebSockets

Azure App Service (Linux)

Azure Blob Storage

🚀 Features
✅ Real-Time Voice AI

Grace holds natural phone conversations using OpenAI’s realtime speech-to-speech API.

✅ After-Hours Routing

Business hours → forward calls to the real phone number

After hours → Grace answers the call

✅ Call Recording

All calls are recorded (WAV) and uploaded to Azure Blob Storage.

✅ Transcript Storage

Grace’s conversation transcript (JSON) is saved to Blob under each CallSid.

✅ Intake Capture

Grace collects:

Name

Phone number

City/State

Reason for calling
and stores this metadata as intake.json.

✅ Optional Alerts

Email/SMS alerts can be sent after every call with Blob links.

🏗️ Architecture Overview

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

📦 Requirements

Node.js 20+

Azure Subscription (for App Service + Blob)

Twilio Account (for phone number)

OpenAI API Key (for realtime model)

🔧 Setup Guide
1. Clone Repo
git clone <your-repo-url>
cd grace-receptionist

2. Install Dependencies
npm install

3. Create .env (local dev only)
OPENAI_API_KEY=<your key>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
AZURE_STORAGE_CONNECTION_STRING=<connection string>
BLOB_CONTAINER=calls
PORT=8080

4. Provision Azure Resources
Resource Group
az group create -n rg-grace -l eastus

Storage Account + Container
az storage account create -n <storageacct> -g rg-grace --sku Standard_LRS
az storage container create --account-name <storageacct> --name calls

App Service Plan + Web App
az appservice plan create -n asp-grace -g rg-grace --sku B1 --is-linux
az webapp create -n grace-receptionist -g rg-grace --plan asp-grace --runtime "NODE:20-lts"

Add App Settings in Azure Portal

WEBSITES_PORT=8080

OPENAI_API_KEY

TWILIO_ACCOUNT_SID

TWILIO_AUTH_TOKEN

AZURE_STORAGE_CONNECTION_STRING

BLOB_CONTAINER=calls

5. Provision Twilio
Buy a voice-enabled phone number

Twilio Console → Phone Numbers → Buy Number

Set Voice Webhook (initially to localhost via ngrok)
https://<your-ngrok-url>/voice

6. Run Locally
node server.js


Check health:

http://localhost:8080/healthz


(Optional) test external access:

ngrok http 8080

7. Deploy to Azure
Zip deploy
zip -r app.zip .
az webapp deployment source config-zip \
  -g rg-grace \
  -n grace-receptionist \
  --src app.zip

Point Twilio to production
https://grace-receptionist.azurewebsites.net/voice

🕒 Business Hours Routing (Optional)

Modify /voice route in server.js:

if (isBusinessHours()) {
  return res.type("text/xml").send(`
    <Response>
      <Dial>+1601XXXXXXX</Dial>
    </Response>
  `);
}


After hours:

Return <Start><Stream> TwiML (Grace answers)

🗂 Blob Storage Structure
/calls/<CallSid>/
  recording.json
  recording.wav
  transcript.json
  intake.json

📣 Optional: Client Notifications

Add SMS/email notification in closeAndPersist():

Compose summary with links to:

transcript.json

recording.wav

Send to staff (Twilio SMS or SMTP via SendGrid).

📈 Scaling to Multi-Tenant

Modify project config:

const clients = {
  mercyhouse: {
    phone: "+1601XXX",
    timezone: "America/Chicago",
    businessNumber: "+1601YYY",
    blobPrefix: "mercyhouse/"
  }
};


Route by Twilio number (“To” field).

🧪 Testing Checklist
Test	Expected
Call during business hours	Forward to real phone
Call after hours	Grace answers
Grace speaks greeting	“Hi, this is Grace…”
Conversation works	Real-time voice both ways
Hang up	recording + transcript saved
Blob Storage	has folder /calls/<CallSid>
Optional alert	SMS/email received
🧘‍♀️ Grace System Prompt

Grace’s personality, tone, safety rules, and instructions are stored in code under GRACE_PROMPT.

Warm

Kind

Human-like ("hmm", "uh", soft pauses)

Faith-aligned

Never repeats caller name constantly

No medical advice

Emergency protocol: “Please hang up and call 911…”

🏁 DONE — Grace Is Live

You now have:

A real, talking, human-sounding AI receptionist

Deployed on Azure

Answering Twilio calls

Storing recordings + transcripts to Blob

Ready for multiple clients

💬 Support / Next Steps

If you'd like, I can help you:

✅ Generate full server.js with business hours routing + alerts
✅ Build a simple web dashboard to view calls
✅ Package this as a SaaS for clients (Grace.ai or your brand)