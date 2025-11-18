# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grace AI Receptionist is an after-hours voice assistant for small businesses, nonprofits, and ministries. It uses Twilio Voice, OpenAI GPT-4o Realtime API, and Azure services to provide natural phone conversations that capture caller information and store recordings/transcripts.

**Current Status**: Early MVP stage - project structure and Azure deployment scripts exist, but main application code (`server.js`) has not yet been implemented.

## Technology Stack

- **Runtime**: Node.js 20+
- **Telephony**: Twilio Voice (Media Streams, WebSocket)
- **AI**: OpenAI GPT-4o Realtime API (speech-to-speech)
- **Cloud Platform**: Azure
  - App Service (Linux, Node:20-lts runtime)
  - Blob Storage (call recordings, transcripts, intake data)
- **Protocol**: WebSocket for real-time audio streaming

## Development Commands

```bash
# Install dependencies
npm install

# Run local development server
node server.js

# Local testing with external access
ngrok http 8080

# Health check
curl http://localhost:8080/healthz
```

## Azure Deployment

The project uses Azure CLI scripts located in `azure-resources/`:

```bash
# 1. Create resource group
./azure-resources/create-rg.sh

# 2. Create storage account and container
./azure-resources/create-storage.sh

# 3. Create App Service plan and web app
./azure-resources/create-appservice-webapp.sh

# 4. Get connection string for configuration
./azure-resources/get-connectionstring.sh

# 5. Deploy via zip (from repository root)
zip -r app.zip .
az webapp deployment source config-zip \
  -g rg-grace-receptionist \
  -n grace-receptionist-app \
  --src app.zip
```

**Azure Resource Names** (from scripts):
- Resource Group: `rg-grace-receptionist`
- App Service Plan: `asp-grace-receptionist`
- Web App: `grace-receptionist-app`
- Storage Container: `calls`

## Required Environment Variables

Set these in Azure App Settings or local `.env`:

```bash
WEBSITES_PORT=8080
OPENAI_API_KEY=<your-openai-key>
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
AZURE_STORAGE_CONNECTION_STRING=<your-azure-storage-connection>
BLOB_CONTAINER=calls
```

## Architecture Overview

**Call Flow**:
1. Caller dials Twilio number
2. Twilio webhook hits `/voice` endpoint
3. During business hours: forward to real phone number (optional)
4. After hours: return TwiML with `<Stream>` to start WebSocket connection
5. Node.js server proxies audio between Twilio Media Stream and OpenAI Realtime API
6. Grace conducts conversation, collecting caller information
7. On call end: upload recording (WAV), transcript (JSON), and intake data (JSON) to Azure Blob Storage

**Blob Storage Structure**:
```
/calls/<CallSid>/
  recording.wav
  recording.json
  transcript.json
  intake.json
```

## Grace AI Personality

Grace's system prompt defines her as:
- Warm, kind, and faith-aligned
- Uses natural speech patterns (pauses, fillers like "hmm", "uh")
- Collects: name, phone number, city/state, reason for calling
- Never repeats caller's name excessively
- Does not provide medical advice
- Emergency protocol: instructs caller to hang up and dial 911

## Twilio Configuration

After deployment, configure your Twilio phone number:
- **Voice Webhook**: `https://grace-receptionist-app.azurewebsites.net/voice`
- **Method**: HTTP POST

## Multi-Tenant Considerations

The README describes future multi-tenant architecture where different clients have:
- Separate phone numbers
- Different business hours/timezones
- Isolated blob storage prefixes
- Distinct forwarding numbers

Implementation would route based on the "To" field from Twilio to determine which client configuration to use.

## Next Implementation Steps

The main application (`server.js`) needs to be created with:
1. Express server with `/voice` webhook endpoint
2. WebSocket server handling Twilio Media Streams
3. OpenAI Realtime API integration
4. Azure Blob Storage upload logic
5. Business hours routing logic (optional)
6. Health check endpoint at `/healthz`
