# Azure VoiceLive Setup Guide for Grace

This guide will help you set up and test Azure VoiceLive API with Grace AI Receptionist.

## What is Azure VoiceLive?

Based on your Python code, Azure VoiceLive appears to be a real-time speech-to-speech API service that provides:
- Real-time audio streaming (similar to OpenAI Realtime API)
- Azure Neural Voice support (more human-like speech)
- Server-side Voice Activity Detection (VAD)
- Text and audio modalities

## Information You Need to Provide

To complete the setup, I need the following information from you:

### 1. **Azure VoiceLive WebSocket Endpoint**
   - **What it looks like**: `wss://api.voicelive.com/v1` or `wss://your-region.api.cognitive.microsoft.com/voicelive`
   - **Where to find it**: Azure Portal → Your VoiceLive resource → Endpoint URL
   - **Question for you**: What is your VoiceLive WebSocket endpoint URL?

### 2. **Azure VoiceLive API Key**
   - **Where to find it**: Azure Portal → Your VoiceLive resource → Keys and Endpoint → KEY 1
   - **Question for you**: What is your API key?

### 3. **Model Name**
   - **Default in Python code**: `gpt-4o-realtime-preview`
   - **Question for you**: Is this the correct model, or do you have a different model name?

### 4. **Voice Selection**
   - **Azure Neural Voices** (from Python code):
     - `en-US-AvaNeural` - Female, warm and caring
     - `en-US-JennyNeural` - Female, friendly
     - `en-US-GuyNeural` - Male, conversational
   - **OpenAI-style voices** (if supported):
     - `alloy`, `echo`, `shimmer`, `nova`, `fable`, `onyx`
   - **Recommendation for Grace**: `en-US-AvaNeural` or `en-US-JennyNeural`
   - **Question for you**: Which voice would you like to use?

### 5. **Authentication Method**
   - **Question for you**: Does VoiceLive use:
     - `api-key: YOUR_KEY` header? (most common for Azure)
     - `Authorization: Bearer YOUR_KEY` header? (OpenAI-style)

### 6. **Audio Format Compatibility**
   - **Important**: The Python code uses **PCM16 at 24kHz**
   - **Twilio uses**: **g711_ulaw at 8kHz**
   - **Question for you**: Does VoiceLive support `g711_ulaw` format, or do we need to handle audio transcoding?

## Current Implementation Status

I've created [server-voicelive.js](server-voicelive.js) based on your Python code, but there are a few areas that need your input:

### ✅ Already Implemented:
- WebSocket connection to VoiceLive endpoint
- Session configuration with Grace's personality
- Turn detection with Server VAD
- Transcript capture and intake data parsing
- Azure Blob Storage integration
- Twilio Media Stream integration

### ⚠️ Needs Clarification:
1. **Audio Format Conversion**: The Python code uses PCM16 (24kHz), but Twilio uses g711_ulaw (8kHz)
   - Do we need to transcode audio between formats?
   - Does VoiceLive natively support g711_ulaw?

2. **Event Types**: The Python code references events like:
   - `SESSION_UPDATED`
   - `INPUT_AUDIO_BUFFER_SPEECH_STARTED`
   - `RESPONSE_AUDIO_DELTA`

   I've mapped these to the expected format, but **please verify** the actual event names from VoiceLive API documentation.

3. **Voice Configuration**: Need to confirm if the voice configuration format is:
   ```json
   {
     "voice": "en-US-AvaNeural"
   }
   ```
   or
   ```json
   {
     "voice": {
       "name": "en-US-AvaNeural",
       "type": "azure-standard"
     }
   }
   ```

## Setup Steps

### 1. Update Environment Variables

Edit [.env.voicelive](.env.voicelive) with your actual values:

```bash
# Azure VoiceLive Configuration
AZURE_VOICELIVE_ENDPOINT=wss://YOUR_ENDPOINT_HERE
AZURE_VOICELIVE_API_KEY=YOUR_API_KEY_HERE
AZURE_VOICELIVE_MODEL=gpt-4o-realtime-preview
AZURE_VOICELIVE_VOICE=en-US-AvaNeural

# Keep existing Twilio and Azure Storage settings
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection
BLOB_CONTAINER=calls
```

### 2. Install Dependencies

```bash
npm install
```

All required dependencies are already in your [package.json](package.json).

### 3. Run Locally

```bash
# Copy VoiceLive config to .env
cp .env.voicelive .env

# Run the VoiceLive server
node server-voicelive.js
```

### 4. Expose with ngrok (for Twilio)

```bash
ngrok http 8080
```

### 5. Update Twilio Webhook

Update your Twilio phone number webhook to:
```
https://your-ngrok-id.ngrok.io/voice
```

## Testing the Voice Quality

The main goal is to test if Azure VoiceLive's voices sound **more human** than OpenAI's voices.

### Side-by-Side Comparison:

**OpenAI Version (current):**
```bash
node server.js
```

**Azure VoiceLive Version (new):**
```bash
node server-voicelive.js
```

**Azure OpenAI Version (alternative):**
```bash
node server-azure.js
```

## Key Differences: VoiceLive vs OpenAI

| Feature | OpenAI Realtime | Azure VoiceLive |
|---------|----------------|-----------------|
| **Voices** | alloy, echo, shimmer, etc. | Azure Neural Voices (AvaNeural, JennyNeural, etc.) |
| **Audio Format** | g711_ulaw (8kHz) native | PCM16 (24kHz) - may need transcoding |
| **Naturalness** | Good | **Potentially more human-like** |
| **Latency** | ~200-300ms | Need to test |
| **Pricing** | OpenAI pricing | Azure pricing |

## Potential Audio Format Issue

The biggest technical challenge is the **audio format mismatch**:

- **Twilio**: Sends/receives `g711_ulaw` at 8kHz (µ-law encoded)
- **VoiceLive**: Expects `pcm16` at 24kHz (raw PCM)

### Solutions:

**Option 1: Check if VoiceLive supports g711_ulaw**
- Update the session config to use `g711_ulaw` instead of `pcm16`
- This would be the simplest solution

**Option 2: Audio Transcoding**
- Convert Twilio's g711_ulaw → PCM16 (for input)
- Convert PCM16 → g711_ulaw (for output)
- Requires additional Node.js library like `audio-converter` or `ffmpeg`

**Option 3: Use Twilio's PCM16 support**
- Configure Twilio Media Stream to send PCM16 instead of g711_ulaw
- Check Twilio documentation for supported formats

### Example Transcoding (if needed):

If we need to implement transcoding, I can add:

```javascript
const { Transform } = require('stream');
// Use a library like 'audio-converter' or 'ffmpeg-static'

function convertG711ToPCM16(g711Data) {
  // Convert µ-law to linear PCM
  // Resample from 8kHz to 24kHz
  // Return PCM16 buffer
}

function convertPCM16ToG711(pcm16Data) {
  // Resample from 24kHz to 8kHz
  // Convert linear PCM to µ-law
  // Return g711 buffer
}
```

## Troubleshooting

### Connection Issues
- Verify your `AZURE_VOICELIVE_ENDPOINT` is a WebSocket URL (`wss://`)
- Check that your API key is correct
- Verify network connectivity (firewalls, proxies)

### Authentication Errors (401)
- Confirm the correct header format: `api-key` vs `Authorization`
- Check that your API key hasn't expired
- Verify your Azure subscription is active

### Audio Quality Issues
- Check if audio format conversion is needed
- Try different voices (AvaNeural vs JennyNeural)
- Adjust VAD settings for better turn-taking

### No Audio Output
- Verify that VoiceLive is sending `response.audio.delta` events
- Check audio format compatibility with Twilio
- Enable verbose logging to see all events

## Next Steps

**Please provide me with:**

1. ✅ Azure VoiceLive endpoint URL
2. ✅ Azure VoiceLive API key
3. ✅ Confirmation of model name
4. ✅ Preferred voice (recommend: `en-US-AvaNeural`)
5. ✅ Authentication header format (`api-key` vs `Authorization`)
6. ✅ Supported audio formats (can it handle `g711_ulaw`?)
7. ✅ Any VoiceLive API documentation you have access to

Once you provide this information, I can:
- Update the configuration
- Add audio transcoding if needed
- Adjust event handling for actual API responses
- Test the integration locally

## Resources Needed

- Azure VoiceLive API documentation
- Supported voice list
- Supported audio formats
- API authentication method
- Pricing information

---

**Ready to test!** Once you provide the configuration details, we can get Grace speaking with Azure's more human-like voices.
