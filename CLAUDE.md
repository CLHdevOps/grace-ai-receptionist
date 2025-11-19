# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Grace AI Receptionist is an after-hours voice assistant for small businesses, nonprofits, and ministries. It uses Twilio Voice, OpenAI GPT-4o Realtime API, and Azure services to provide natural phone conversations that capture caller information and store recordings/transcripts.

**Current Status**: Fully implemented MVP with production-ready features:
- Real-time voice conversation with OpenAI GPT-4o Realtime API
- Automatic website content scraping for contextual answers
- Structured intake data collection with JSON output
- Azure Blob Storage integration for call recordings and transcripts
- Customized for Mercy House Adult & Teen Challenge in Mississippi
- Deployed on Azure App Service with ngrok support for local development

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

## Grace AI Personality & Website Integration

Grace's system prompt is defined in `GRACE_PROMPT` (lines 69-121 in `server.js`).

### Key Features

**Website Content Scraping:**
Grace automatically fetches and uses content from Mercy House website on each call:
- `fetchMercyHouseContent()` function (lines 29-55) scrapes configured URLs
- Strips HTML, scripts, styles and compresses whitespace
- Limits to 2000 characters per page to keep context manageable
- URLs configured in `MERCY_URLS` array (lines 18-23)
- Content is injected into OpenAI session instructions

**Personality Traits:**
- Warm, kind, and genuinely caring
- Professional but conversational (never stiff)
- Faith-aligned - appropriately mentions hope, prayer, and restoration
- Uses natural human speech patterns (pauses, "hmm", "okay, I hear you")
- Varies phrasing to avoid sounding repetitive or robotic

**Structured Data Collection:**
Grace outputs caller information using a special **INTAKE:** format:
```
INTAKE: {"name":"John Doe","phone":"+1601XXXXXXX","city":"Brandon","state":"MS","reason":"Asking about admission"}
```

The `updateIntakeFromText()` function (lines 105-126) parses this JSON from the transcript and populates the `intakeData` object with:
- name
- phone (pre-filled from Twilio caller ID via custom parameters)
- city
- state
- reason

**Safety Protocols:**
- No medical, legal, or professional counseling advice
- Emergency protocol: "This sounds like an emergency. Please hang up and call 911 right away."
- Stays in lane as a receptionist
- Never makes up information - says "let me have someone call you back" when uncertain

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

## Implementation Details

The main application (`server.js`) is fully implemented with:

1. **Express server with `/voice` webhook endpoint** (lines 140-170)
   - Receives Twilio webhook POST requests
   - Returns TwiML with WebSocket `<Stream>` connection
   - Passes caller phone number as custom parameter

2. **WebSocket server handling Twilio Media Streams** (lines 172-313)
   - Endpoint: `/media-stream`
   - Handles `start`, `media`, and `stop` events from Twilio
   - Manages bidirectional audio streaming

3. **OpenAI Realtime API integration** (lines 217-305)
   - WebSocket connection to `wss://api.openai.com/v1/realtime`
   - Session configuration with custom instructions + website content
   - Audio format: g711_ulaw (compatible with Twilio)
   - Server-side Voice Activity Detection (VAD)
   - Handles `response.audio.delta`, `response.audio_transcript.done`, and `conversation.item.created` events

4. **Azure Blob Storage upload logic** (lines 315-363)
   - `saveCallData()` function uploads three files per call:
     - `transcript.json` - Full conversation transcript
     - `intake.json` - Structured caller information
     - `recording.json` - Call metadata (CallSid, duration, timestamp)
   - Uses `@azure/storage-blob` SDK
   - Error handling with console logging

5. **Business hours routing logic** (lines 167-129)
   - `isBusinessHours()` function (currently commented out)
   - Can be configured to forward calls during business hours
   - After-hours calls handled by Grace

6. **Health check endpoint** (lines 138-140)
   - GET `/healthz`
   - Returns JSON with status and timestamp

## Key Implementation Patterns

**Session Management:**
- Active sessions stored in `Map()` with CallSid as key
- Session includes: callSid, streamSid, audioBuffer, transcript, intakeData, startTime
- Cleaned up on call end or WebSocket close

**Error Handling:**
- Try-catch blocks around message processing
- OpenAI WebSocket error listeners
- Graceful degradation if website scraping fails (returns empty string)

**Data Flow:**
1. Twilio → `/voice` webhook → TwiML response
2. Twilio Media Stream → WebSocket `/media-stream`
3. Audio chunks → OpenAI Realtime API
4. OpenAI audio response → Twilio Media Stream
5. Conversation transcript → INTAKE parser → intakeData object
6. Call end → Azure Blob Storage upload

## Customization for Other Organizations

To adapt this for another organization:
1. Update `MERCY_URLS` array with new website URLs
2. Modify `GRACE_PROMPT` with organization name, mission, and personality
3. Adjust intake fields in `intakeData` object if needed
4. Update Azure resource names in deployment commands
5. Configure Twilio webhook to point to new Azure App Service URL
