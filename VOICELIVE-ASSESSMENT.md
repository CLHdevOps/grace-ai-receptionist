# Azure Voice Live API Assessment for Grace

## Executive Summary

✅ **GREAT NEWS**: Azure Voice Live API **NATIVELY SUPPORTS** Twilio's audio format!

After reviewing the official Microsoft documentation, Azure Voice Live API is **fully compatible** with Twilio Media Streams and requires **minimal changes** to your existing Grace implementation.

---

## Key Findings

### 1. ✅ Native Audio Format Support

**Azure Voice Live API supports G.711 μ-law (`g711_ulaw`)** - the exact format Twilio uses!

From the [official API reference](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-api-reference):

**Supported Input Formats:**
- `pcm16` - 16-bit PCM at 16kHz, 24kHz (default), or 8kHz
- **`g711_ulaw`** - G.711 μ-law at 8kHz ✅ (Twilio compatible!)
- `g711_alaw` - G.711 A-law at 8kHz

**Supported Output Formats:**
- Same as input formats
- **`g711_ulaw` at 8kHz** ✅ (Perfect for Twilio!)

**Result**: **NO audio transcoding needed!** 🎉

### 2. 🔌 WebSocket Endpoint Format

**Format:**
```
wss://<your-resource-name>.services.ai.azure.com/voice-live/realtime?api-version=2025-10-01&model=gpt-realtime
```

**Alternative (older resources):**
```
wss://<your-resource-name>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-10-01&model=gpt-realtime
```

### 3. 🔐 Authentication

**Two methods available:**

**Option 1: API Key (Simplest)**
- Header: `api-key: <your-key>`
- Or query parameter: `?api-key=<your-key>`

**Option 2: Microsoft Entra Token (Recommended for production)**
- Header: `Authorization: Bearer <token>`
- Scope: `https://ai.azure.com/.default`

### 4. 🎤 Azure Neural Voices

Azure Voice Live supports **Azure Standard Voices** (Neural):

**Recommended for Grace:**
- `en-US-AvaNeural` - Female, warm, caring ✅ (Best match for Grace)
- `en-US-JennyNeural` - Female, friendly
- `en-US-AriaNeural` - Female, expressive
- `en-US-GuyNeural` - Male, conversational
- `en-US-DavisNeural` - Male, professional

**Voice configuration format:**
```json
{
  "voice": {
    "name": "en-US-AvaNeural",
    "type": "azure-standard"
  }
}
```

### 5. 🧠 Advanced Turn Detection

Azure Voice Live offers **superior turn detection** compared to OpenAI:

**Azure Semantic VAD** (Recommended):
- Understands **meaning** and **intent**, not just silence
- Detects natural conversation pauses
- Reduces premature interruptions
- Supports barge-in (`interrupt_response: true`)
- Can remove filler words ("um", "ah", "like")

**Configuration:**
```json
{
  "turn_detection": {
    "type": "azure_semantic_vad",
    "threshold": 0.3,
    "silence_duration_ms": 200,
    "interrupt_response": true,
    "remove_filler_words": true
  }
}
```

### 6. 🔊 Audio Enhancement Features

Azure Voice Live includes built-in audio quality improvements:

- **Deep Noise Suppression** - Removes background noise
- **Echo Cancellation** - Eliminates playback feedback
- **Optimized for telephony** - Specifically designed for phone calls

**Configuration:**
```json
{
  "input_audio_noise_reduction": {
    "type": "azure_deep_noise_suppression"
  },
  "input_audio_echo_cancellation": {
    "type": "server_echo_cancellation"
  }
}
```

---

## Implementation Changes Required

### ✅ What We Can Keep (No Changes)

1. **Twilio Media Stream integration** - Works as-is
2. **Audio format** - g711_ulaw is natively supported
3. **WebSocket architecture** - Same bidirectional pattern
4. **Grace's personality prompt** - No changes needed
5. **Blob Storage integration** - Keep existing code
6. **Intake data parsing** - Keep existing logic

### 🔧 What Needs to Be Updated

#### 1. WebSocket Connection URL

**Current (OpenAI):**
```javascript
wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
```

**New (Azure Voice Live):**
```javascript
wss://<your-resource>.services.ai.azure.com/voice-live/realtime?api-version=2025-10-01&model=gpt-realtime
```

#### 2. Authentication Headers

**Current (OpenAI):**
```javascript
headers: {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'OpenAI-Beta': 'realtime=v1'
}
```

**New (Azure Voice Live):**
```javascript
headers: {
  'api-key': AZURE_VOICELIVE_API_KEY
}
```

#### 3. Session Configuration

**Current (OpenAI):**
```json
{
  "type": "session.update",
  "session": {
    "modalities": ["text", "audio"],
    "instructions": "...",
    "voice": "coral",
    "input_audio_format": "g711_ulaw",
    "output_audio_format": "g711_ulaw",
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.42,
      "prefix_padding_ms": 250,
      "silence_duration_ms": 650
    }
  }
}
```

**New (Azure Voice Live):**
```json
{
  "type": "session.update",
  "session": {
    "modalities": ["text", "audio"],
    "instructions": "...",
    "voice": {
      "name": "en-US-AvaNeural",
      "type": "azure-standard"
    },
    "input_audio_format": "g711_ulaw",
    "output_audio_format": "g711_ulaw",
    "turn_detection": {
      "type": "azure_semantic_vad",
      "threshold": 0.3,
      "silence_duration_ms": 200,
      "interrupt_response": true,
      "remove_filler_words": true
    },
    "input_audio_noise_reduction": {
      "type": "azure_deep_noise_suppression"
    },
    "input_audio_echo_cancellation": {
      "type": "server_echo_cancellation"
    }
  }
}
```

#### 4. Event Types (Minor naming differences)

**OpenAI → Azure Voice Live mapping:**

| OpenAI Event | Azure Voice Live Event | Notes |
|--------------|------------------------|-------|
| `session.updated` | `session.updated` | ✅ Same |
| `response.audio.delta` | `response.audio.delta` | ✅ Same |
| `response.audio_transcript.done` | `response.audio_transcript.done` | ✅ Same |
| `conversation.item.created` | `conversation.item.created` | ✅ Same |
| `response.created` | `response.created` | ✅ Same |
| `response.done` | `response.done` | ✅ Same |
| `error` | `error` | ✅ Same |

**Result**: Event handling code needs **minimal changes**! 🎉

---

## Updated Implementation

I've already created [server-voicelive.js](server-voicelive.js) based on the Python sample. Now I need to update it with the correct API format.

### Environment Variables Needed

```bash
# Azure Voice Live Configuration
AZURE_VOICELIVE_ENDPOINT=wss://your-resource-name.services.ai.azure.com/voice-live/realtime
AZURE_VOICELIVE_API_KEY=your_api_key_here
AZURE_VOICELIVE_MODEL=gpt-realtime
AZURE_VOICELIVE_VOICE=en-US-AvaNeural
AZURE_VOICELIVE_API_VERSION=2025-10-01

# Existing configuration (keep as-is)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
AZURE_STORAGE_CONNECTION_STRING=...
BLOB_CONTAINER=calls
```

---

## Comparison: OpenAI vs Azure Voice Live

| Feature | OpenAI Realtime | Azure Voice Live | Winner |
|---------|-----------------|------------------|--------|
| **Voice Quality** | Good (Alloy, Echo, etc.) | Azure Neural Voices (more natural) | 🏆 Azure |
| **Turn Detection** | Basic server VAD | Semantic VAD with intent detection | 🏆 Azure |
| **Audio Enhancement** | None | Deep noise suppression + echo cancellation | 🏆 Azure |
| **Twilio Compatibility** | Native g711_ulaw support ✅ | Native g711_ulaw support ✅ | 🤝 Tie |
| **Setup Complexity** | Simple (single API key) | Slightly more (Azure resource needed) | 🏆 OpenAI |
| **Cost** | OpenAI pricing | Azure AI pricing | Depends |
| **Latency** | ~200-300ms | Similar (~200-300ms expected) | 🤝 Tie |
| **Filler Word Removal** | No | Yes (removes "um", "ah") | 🏆 Azure |
| **Barge-in/Interruption** | Basic | Advanced with semantic detection | 🏆 Azure |

**Overall**: Azure Voice Live is **technically superior** for voice quality and natural conversations! 🎯

---

## Prerequisites to Get Started

### 1. Azure Resources Required

You need to create:

**Option A: Azure AI Foundry Resource** (Recommended)
- Go to [Azure AI Foundry portal](https://ai.azure.com/)
- Create a new AI Foundry resource
- Deploy the `gpt-realtime` model
- Get your endpoint and API key

**Option B: Azure Cognitive Services Resource**
- Create an "Azure AI Services" resource in Azure Portal
- Enable Voice Live API
- Deploy the model
- Get your endpoint and API key

### 2. Information to Provide Me

Please provide:

1. ✅ **Your Azure AI Foundry/Cognitive Services endpoint**
   - Format: `https://your-resource-name.services.ai.azure.com`
   - Or: `https://your-resource-name.cognitiveservices.azure.com`

2. ✅ **Your API Key**
   - Found in: Azure Portal → Your Resource → Keys and Endpoint → KEY 1

3. ✅ **Model deployment name** (likely `gpt-realtime`)

4. ✅ **Preferred voice** (recommend: `en-US-AvaNeural` for Grace)

---

## Next Steps

### 1. I'll Update the Code

Once you provide the endpoint and API key, I'll:
- Update [server-voicelive.js](server-voicelive.js) with correct API format
- Configure g711_ulaw audio format (no transcoding needed!)
- Add Azure semantic VAD configuration
- Enable noise suppression and echo cancellation
- Test event handling

### 2. You'll Test Locally

```bash
# Update .env with Voice Live config
cp .env.voicelive .env
# Edit .env with your actual values

# Run the server
node server-voicelive.js

# In another terminal, expose with ngrok
ngrok http 8080

# Update Twilio webhook to ngrok URL
```

### 3. We'll Compare Voice Quality

Test all three versions side-by-side:

```bash
# OpenAI (current)
node server.js

# Azure OpenAI
node server-azure.js

# Azure Voice Live (new)
node server-voicelive.js
```

Call the same Twilio number with each server and compare:
- Voice naturalness
- Turn-taking quality
- Response latency
- Background noise handling

---

## Expected Benefits

Based on Azure Voice Live's features, Grace should have:

1. **More natural voice** - Azure Neural Voices are considered more human-like
2. **Better conversation flow** - Semantic VAD understands natural pauses
3. **Cleaner audio** - Built-in noise suppression and echo cancellation
4. **Fewer interruptions** - Smarter turn detection reduces premature cut-offs
5. **More polished** - Automatic filler word removal ("um", "ah")

---

## Potential Challenges

### 1. Azure Resource Setup ⚠️

- Requires Azure AI Foundry or Cognitive Services resource
- May need to request access to Voice Live API (preview)
- Model deployment may have regional restrictions

### 2. Pricing 💰

- Azure Voice Live pricing may differ from OpenAI
- Need to check your Azure subscription quotas
- Monitor costs during testing

### 3. API Differences 🔧

- Slightly different event structures (but mostly compatible)
- Voice configuration is an object (not a string)
- May have different rate limits

---

## Documentation References

- [Voice Live API Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live)
- [Voice Live API Reference](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-api-reference)
- [Voice Live How-to Guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to)
- [Voice Live Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-quickstart)
- [Azure Neural Voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)

---

## Summary

✅ **Azure Voice Live is a great fit for Grace!**

**Key advantages:**
1. Native Twilio compatibility (g711_ulaw support)
2. Superior voice quality with Azure Neural Voices
3. Advanced semantic turn detection
4. Built-in audio enhancements (noise suppression, echo cancellation)
5. Minimal code changes required

**To proceed, I need:**
1. Your Azure Voice Live endpoint URL
2. Your API key
3. Model name (likely `gpt-realtime`)

Once you provide these, I'll update the code and you can test it immediately!

**Ready to give Grace a more human voice?** 🎤✨
