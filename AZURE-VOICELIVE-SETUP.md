# Azure VoiceLive Integration - Setup Guide

## Overview

Grace AI Receptionist now uses **Azure VoiceLive API** for real-time voice conversations with the highest quality Azure HD Neural voices.

## Quick Start

1. **Copy environment configuration:**
   ```bash
   cp .env.voicelive .env
   ```

2. **Update your `.env` file with your credentials:**
   - `AZURE_VOICELIVE_ENDPOINT` - Your Azure Cognitive Services endpoint
   - `AZURE_VOICELIVE_API_KEY` - Your resource key from Azure Portal
   - Other settings are pre-configured

3. **Start the server:**
   ```bash
   node server-voicelive.js
   ```

4. **Make a test call** to your Twilio number

## Voice Configuration

The system uses **Emma2 Dragon HD Latest** - Azure's highest quality neural voice with natural, warm tone perfect for a receptionist.

To change voices, update `AZURE_VOICELIVE_VOICE` in `.env`:

### Azure HD Neural Voices (Recommended)
- `en-US-Emma2:DragonHDLatestNeural` - Female, warm, natural ✓ (default)
- `en-US-Aria:PhoenixHDLatestNeural` - Female, professional

### Standard Azure Neural Voices
- `en-US-AvaNeural` - Female, warm
- `en-US-JennyNeural` - Female, friendly
- `en-US-AriaNeural` - Female, expressive

### OpenAI Voices (fallback)
- `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

## Key Features

✅ **Native g711_ulaw support** - Direct Twilio audio streaming, no transcoding
✅ **Azure Semantic VAD** - Natural turn-taking based on meaning, not just silence
✅ **Deep Noise Suppression** - Crystal clear audio even in noisy environments
✅ **Echo Cancellation** - Server-side echo cancellation for better call quality
✅ **Interrupt Handling** - Natural conversation flow with interrupt support
✅ **Filler Word Removal** - Automatic removal of "um", "uh", etc.

## Debug Mode

Enable verbose logging to troubleshoot issues:

```bash
# In .env file:
DEBUG_VOICELIVE=true
```

This will log all WebSocket messages between your server and Azure VoiceLive API.

**Remember to disable debug mode in production!**

## Architecture

### Flow
1. **Twilio** receives call → Connects to `/media-stream` WebSocket
2. **Server** connects to Azure VoiceLive API via WebSocket
3. **Audio queuing** - Incoming audio is queued until session is ready
4. **Session initialization:**
   - Wait for `session.created` from Azure
   - Send `session.update` with Grace's configuration
   - Receive `session.updated` confirmation
   - Flush queued audio packets
5. **Real-time streaming** - Bidirectional audio between caller and Grace

### Audio Format
- **Input/Output:** g711_ulaw (8kHz)
- **Encoding:** Native Twilio format, no conversion needed
- **Latency:** Minimal - direct streaming

## Troubleshooting

### No audio / Silent calls
- Check `DEBUG_VOICELIVE=true` and verify `session.updated` event received
- Ensure audio queue is being flushed (check logs for "Flushing X queued audio packets")

### Voice name errors
- Use full format: `en-US-VoiceName:ModelNeural`
- Don't use shortened names like `EMMA2DragonHDLatest`

### WebSocket connection issues
- Verify endpoint URL doesn't have trailing slash
- Check API key is correct
- Ensure region supports Voice Live API (eastus2 confirmed working)

### Session configuration errors
- Wait for `session.created` before sending `session.update`
- Ensure `type: 'session.update'` at root level, not nested

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_VOICELIVE_ENDPOINT` | Your Azure Cognitive Services endpoint | `https://yourname.cognitiveservices.azure.com` |
| `AZURE_VOICELIVE_API_KEY` | Resource key from Azure Portal | `CzOd1hi...` |
| `AZURE_VOICELIVE_MODEL` | Realtime model name | `gpt-realtime` |
| `AZURE_VOICELIVE_API_VERSION` | API version | `2025-10-01` |
| `AZURE_VOICELIVE_VOICE` | Voice name | `en-US-Emma2:DragonHDLatestNeural` |
| `DEBUG_VOICELIVE` | Enable debug logging | `false` (production) / `true` (debug) |

## Fixed Issues (2025-11-20)

1. ✅ URL construction - Removed double-slash issue
2. ✅ Session timing - Wait for `session.created` before configuration
3. ✅ Audio buffering - Queue audio until session ready
4. ✅ Variable scope - Fixed `sessionReady` reference errors
5. ✅ Voice format - Updated to correct Azure format

## Support

For issues or questions, check the server logs with `DEBUG_VOICELIVE=true` enabled.
