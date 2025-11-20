# Azure Voice Live Quick Start Guide

## Your Configuration

I've configured the code to work with your Azure resource:

- **Endpoint**: `https://devopsaifoundry.cognitiveservices.azure.com`
- **Region**: `eastus2`
- **WebSocket URL**: `wss://devopsaifoundry.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-10-01&model=gpt-realtime`

## Next Steps

### 1. Get Your API Key

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your **devopsaifoundry** resource
3. Click **Keys and Endpoint** in the left menu
4. Copy **KEY 1** (or KEY 2)

### 2. Check Model Deployment

Before testing, verify the model is deployed:

1. Go to [Azure AI Foundry](https://ai.azure.com/)
2. Select your **devopsaifoundry** resource
3. Navigate to **Deployments**
4. Confirm you have a deployment named **gpt-realtime** (or note the actual name)

**If you don't see a deployment:**
- Click **Create new deployment**
- Select **gpt-4o-realtime-preview** model
- Name it `gpt-realtime`
- Deploy

### 3. Update Environment Variables

Edit `.env` file (or copy from `.env.voicelive`):

```bash
# Copy the template
cp .env.voicelive .env

# Then edit .env and replace the API key:
AZURE_VOICELIVE_API_KEY=your_actual_key_here

# Keep these as-is (already configured for your resource):
AZURE_VOICELIVE_ENDPOINT=https://devopsaifoundry.cognitiveservices.azure.com
AZURE_VOICELIVE_MODEL=gpt-realtime
AZURE_VOICELIVE_API_VERSION=2025-10-01
AZURE_VOICELIVE_VOICE=en-US-AvaNeural

# Don't forget your existing Twilio and Azure Storage settings:
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
AZURE_STORAGE_CONNECTION_STRING=...
BLOB_CONTAINER=calls
```

### 4. Test Locally

```bash
# Install dependencies (if not already done)
npm install

# Run the Azure Voice Live server
node server-voicelive.js

# You should see:
# Grace AI Receptionist server (Azure VoiceLive version) running on port 8080
# Health check: http://localhost:8080/healthz
```

### 5. Test with ngrok + Twilio

In a new terminal:

```bash
# Expose your local server
ngrok http 8080

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

Update your Twilio phone number webhook:
1. Go to [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers** → **Manage** → **Active numbers**
3. Click your phone number
4. Under **Voice Configuration**:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-ngrok-id.ngrok.io/voice`
   - **HTTP**: POST
5. Click **Save**

### 6. Make a Test Call!

Call your Twilio number and Grace should answer with Azure Voice Live!

Listen for:
- **More natural voice** (Azure Neural Voice)
- **Better turn-taking** (Semantic VAD)
- **Cleaner audio** (noise suppression & echo cancellation)
- **No "um" or "ah"** (filler word removal)

---

## Troubleshooting

### "401 Unauthorized" or "403 Forbidden"

**Check:**
- Your API key is correct (no extra spaces)
- The API key is from the correct resource (devopsaifoundry)
- Your Azure subscription is active

**Fix:**
```bash
# Verify your key in Azure Portal
# Update .env with the correct key
```

### "Model not found" or "Deployment not found"

**Check:**
- The model is deployed in Azure AI Foundry
- The deployment name matches `AZURE_VOICELIVE_MODEL` in .env

**Fix:**
```bash
# If your deployment has a different name, update .env:
AZURE_VOICELIVE_MODEL=your-actual-deployment-name
```

### "Connection refused" or WebSocket error

**Check:**
- Your endpoint URL is correct (https://devopsaifoundry.cognitiveservices.azure.com)
- The resource exists and is active
- Network/firewall isn't blocking WebSocket connections

### No audio or poor quality

**Check:**
- Twilio webhook is pointing to the correct ngrok URL
- Your internet connection is stable
- Try a different voice:
  ```bash
  AZURE_VOICELIVE_VOICE=en-US-JennyNeural
  ```

### Verbose Logging

To see detailed connection logs:

```javascript
// Add at the top of server-voicelive.js (line 11)
const DEBUG = true;

// Then add logging throughout:
if (DEBUG) console.log('Debug info:', data);
```

---

## Compare Voice Quality

Test all three versions side-by-side:

```bash
# 1. Original OpenAI
node server.js

# 2. Azure OpenAI
node server-azure.js

# 3. Azure Voice Live (NEW!)
node server-voicelive.js
```

For each version:
1. Update Twilio webhook to ngrok URL
2. Call the number
3. Have the same conversation
4. Compare voice quality and naturalness

---

## Voice Options

Want to try different voices? Edit `.env`:

```bash
# Warm and caring (recommended for Grace)
AZURE_VOICELIVE_VOICE=en-US-AvaNeural

# Friendly and conversational
AZURE_VOICELIVE_VOICE=en-US-JennyNeural

# Expressive and empathetic
AZURE_VOICELIVE_VOICE=en-US-AriaNeural

# Male, conversational
AZURE_VOICELIVE_VOICE=en-US-GuyNeural

# Male, professional
AZURE_VOICELIVE_VOICE=en-US-DavisNeural
```

See all available voices:
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts

---

## What's Different in Voice Live?

### ✅ Improvements Over OpenAI

1. **Azure Neural Voices** - More human-like, natural speech
2. **Semantic VAD** - Understands meaning, not just silence
3. **Noise Suppression** - Cleaner audio from callers
4. **Echo Cancellation** - No feedback issues
5. **Filler Word Removal** - Automatic removal of "um", "ah", "like"
6. **Native g711_ulaw** - No audio transcoding (lower latency)

### Audio Format

```javascript
// Azure Voice Live (configured in server-voicelive.js)
input_audio_format: 'g711_ulaw',   // Native Twilio support!
output_audio_format: 'g711_ulaw',  // No conversion needed

// vs OpenAI (server.js)
input_audio_format: 'g711_ulaw',   // Also supported
output_audio_format: 'g711_ulaw',
```

### Turn Detection

```javascript
// Azure Voice Live - Semantic understanding
turn_detection: {
  type: 'azure_semantic_vad',      // Understands intent
  threshold: 0.3,
  silence_duration_ms: 200,
  interrupt_response: true,         // Better barge-in
  remove_filler_words: true         // Removes "um", "ah"
}

// vs OpenAI - Basic silence detection
turn_detection: {
  type: 'server_vad',               // Volume-based only
  threshold: 0.42,
  prefix_padding_ms: 250,
  silence_duration_ms: 650
}
```

---

## Expected Results

After testing, Grace should:
- Sound **more human** and **less robotic**
- Have **better timing** in conversations (less interrupting)
- Produce **cleaner audio** (even with background noise)
- Handle **natural pauses** more intelligently
- Be **more polished** (no "um" or filler words)

---

## Next Steps After Testing

If you like Azure Voice Live:

1. **Deploy to Azure App Service**
2. **Update production environment variables**
3. **Monitor costs** (compare with OpenAI pricing)
4. **Gather user feedback** on voice quality
5. **Fine-tune VAD settings** if needed

---

## Support Resources

- [Azure Voice Live API Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live)
- [Azure Neural Voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
- [Azure AI Foundry Portal](https://ai.azure.com/)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)

---

## What You Need to Provide

To complete the setup, please share:

1. ✅ **Your API Key (Resource Key)** from Azure Portal
   - Go to: Azure Portal → devopsaifoundry → Keys and Endpoint → KEY 1

2. ✅ **Confirm the model deployment name**
   - Go to: Azure AI Foundry → devopsaifoundry → Deployments
   - Is it named `gpt-realtime` or something else?

Once you provide these, you can start testing immediately! 🎤
