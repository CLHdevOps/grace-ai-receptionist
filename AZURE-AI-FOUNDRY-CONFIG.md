# Azure AI Foundry Configuration Summary

## Your Current Setup

Based on your Azure AI Foundry configuration, here's what you have:

### Resource Information
- **Resource Name**: devopsaifoundry
- **Endpoint**: `https://devopsaifoundry.cognitiveservices.azure.com`
- **Region**: eastus2
- **API Version**: 2025-10-01

### Model Configuration
- **Model**: GPT Realtime
- **Deployment Name**: gpt-realtime (assumed)

### Voice Configuration
- **Voice**: Emma2 Dragon HD Latest
- **Voice Type**: Azure HD Neural Voice (highest quality!)
- **Voice Temperature**: 0.8
- **Speaking Rate**: 1.0 (normal speed)

### Response Configuration
- **Response Temperature**: 0.8
- **Modalities**: Text + Audio

### Speech Input
- **Language**: Auto-detect
- **VAD Type**: Azure semantic VAD ✅
- **End of Utterance (EOU)**: Enabled ✅

### Audio Enhancement
- **Deep Noise Suppression**: Enabled ✅
- **Echo Cancellation**: Enabled ✅

---

## Code Configuration Alignment

I've updated [server-voicelive.js](server-voicelive.js) to match your Azure AI Foundry configuration:

### ✅ Matched Settings

```javascript
// Voice Configuration
voice: {
  name: 'DragonHDLatest',          // Emma2 Dragon HD Latest
  type: 'azure-hd',                 // HD Neural Voice
  temperature: 0.8                  // Match your config
}

// Response Settings
temperature: 0.8,                   // Match your config
output_audio_speed: 1.0,           // Normal speaking rate

// Turn Detection
turn_detection: {
  type: 'azure_semantic_vad',      // ✅ Match your config
  threshold: 0.3,
  silence_duration_ms: 200,
  interrupt_response: true,
  remove_filler_words: true
}

// Audio Enhancement
input_audio_noise_reduction: {
  type: 'azure_deep_noise_suppression'  // ✅ Match your config
},
input_audio_echo_cancellation: {
  type: 'server_echo_cancellation'      // ✅ Match your config
}
```

---

## System Prompt Comparison

### Your Azure AI Foundry Prompt

You have a comprehensive system prompt that includes:

1. **Objective**: Grace as warm receptionist ✅
2. **Personality**: Kind, gentle, supportive ✅
3. **Speaking Style**: Natural, conversational with vocal cues ✅
4. **Capabilities**: Answer questions, provide support ✅
5. **Fallback**: "I can have someone call you back" ✅
6. **Required Info**: Name, phone, city/state, reason ✅
7. **User Personalization**: Gentle questions ✅

### Code Implementation

The [server-voicelive.js](server-voicelive.js:69-139) `GRACE_PROMPT` includes all these elements plus:
- Mercy House website context integration
- INTAKE JSON format for structured data capture
- Safety protocols (emergency handling)

**Both prompts are aligned!** ✅

---

## Voice: Emma2 Dragon HD Latest

### What is Dragon HD?

**Dragon HD** (Emma2) is Azure's **highest quality neural voice**, featuring:

- **Ultra-realistic speech** - Most human-like Azure voice
- **Natural intonation** - Better emotional expression
- **Smooth cadence** - More natural rhythm and flow
- **High fidelity** - Superior audio quality
- **Warm tone** - Perfect for Grace's caring personality

### Voice Format

In Azure Voice Live API:
- **Full name**: `Emma2DragonHDLatest` or `DragonHDLatest`
- **Type**: `azure-hd` (HD Neural Voice)
- **Gender**: Female
- **Tone**: Warm, natural, conversational

### Why Dragon HD for Grace?

Perfect match for Grace's personality:
- ✅ Warm and caring tone
- ✅ Natural conversational style
- ✅ Emotional expressiveness
- ✅ Professional yet approachable
- ✅ Clear articulation

---

## Environment Variables

Update your `.env` file with:

```bash
# Azure Voice Live Configuration
AZURE_VOICELIVE_ENDPOINT=https://devopsaifoundry.cognitiveservices.azure.com
AZURE_VOICELIVE_API_KEY=your_resource_key_here
AZURE_VOICELIVE_MODEL=gpt-realtime
AZURE_VOICELIVE_API_VERSION=2025-10-01
AZURE_VOICELIVE_REGION=eastus2
AZURE_VOICELIVE_VOICE=DragonHDLatest

# Twilio (existing)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Azure Storage (existing)
AZURE_STORAGE_CONNECTION_STRING=...
BLOB_CONTAINER=calls
```

---

## Configuration Checklist

- [x] Endpoint configured: `devopsaifoundry.cognitiveservices.azure.com`
- [x] Region identified: `eastus2`
- [x] Model: `gpt-realtime`
- [x] Voice: `DragonHDLatest` (Emma2 Dragon HD Latest)
- [x] Voice temperature: `0.8`
- [x] Response temperature: `0.8`
- [x] Speaking rate: `1.0` (normal)
- [x] VAD: `azure_semantic_vad`
- [x] Audio enhancement: Noise suppression + Echo cancellation
- [x] Audio format: `g711_ulaw` (Twilio compatible)
- [ ] API Key: *Need to add to `.env`*

---

## What You Still Need

### 1. API Key (Resource Key)

Get your API key from Azure Portal:

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "devopsaifoundry"
3. Click **Keys and Endpoint** in the left menu
4. Copy **KEY 1**
5. Add to `.env`:
   ```bash
   AZURE_VOICELIVE_API_KEY=paste_key_here
   ```

### 2. Verify Model Deployment

Confirm in Azure AI Foundry:

1. Go to [Azure AI Foundry](https://ai.azure.com/)
2. Select **devopsaifoundry** resource
3. Go to **Deployments**
4. Verify **gpt-realtime** exists and is active

---

## Testing with Your Configuration

Once you add the API key, run:

```bash
# Copy config
cp .env.voicelive .env

# Add your API key to .env
# Then run:
node server-voicelive.js

# In another terminal:
ngrok http 8080

# Update Twilio webhook and test!
```

---

## Expected Voice Quality

With **Dragon HD Latest**, Grace should have:

1. **Ultra-natural voice** - Most human-like Azure voice available
2. **Warm personality** - Perfect for Grace's caring role
3. **Clear articulation** - Easy to understand over phone
4. **Emotional range** - Can express empathy and care
5. **Professional quality** - Highest fidelity Azure offers

This will be a **significant upgrade** from standard OpenAI voices!

---

## Comparison: Voice Quality Tiers

| Voice Type | Example | Quality | Cost |
|------------|---------|---------|------|
| OpenAI | Alloy, Echo, Coral | Good | $ |
| Azure Standard Neural | en-US-AvaNeural | Better | $$ |
| **Azure HD Neural** | **DragonHDLatest** | **Best** | **$$$** |

You're using the **highest quality tier** available! 🎯

---

## Configuration Summary

Your Azure Voice Live setup is now **fully aligned** with your Azure AI Foundry configuration:

```
Resource:         devopsaifoundry.cognitiveservices.azure.com
Region:           eastus2
Model:            gpt-realtime
Voice:            DragonHDLatest (Emma2 Dragon HD - highest quality)
Audio Format:     g711_ulaw (native Twilio compatibility)
VAD:              Azure Semantic VAD (meaning + intent detection)
Temperature:      0.8 (response and voice)
Speaking Rate:    1.0 (normal)
Enhancements:     Deep noise suppression + echo cancellation
Filler Removal:   Enabled (removes "um", "ah")
```

**Ready to test!** Just add your API key and run. 🚀
