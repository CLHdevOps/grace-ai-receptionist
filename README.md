<div align="center">

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ░██████╗░██████╗░░█████╗░░█████╗░███████╗                 ║
║   ██╔════╝░██╔══██╗██╔══██╗██╔══██╗██╔════╝                 ║
║   ██║░░██╗░██████╔╝███████║██║░░╚═╝█████╗░░                 ║
║   ██║░░╚██╗██╔══██╗██╔══██║██║░░██╗██╔══╝░░                 ║
║   ╚██████╔╝██║░░██║██║░░██║╚█████╔╝███████╗                 ║
║   ░╚═════╝░╚═╝░░╚═╝╚═╝░░╚═╝░╚════╝░╚══════╝                 ║
║                                                               ║
║             AI Receptionist with a Human Touch                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### After-hours voice assistant for small businesses, nonprofits, and ministries

[![Azure Voice Live](https://img.shields.io/badge/Azure-Voice%20Live%20API-0078D4?logo=microsoft-azure&logoColor=white)](https://azure.microsoft.com/en-us/products/ai-services/ai-speech)
[![Twilio](https://img.shields.io/badge/Twilio-Media%20Streams-F22F46?logo=twilio&logoColor=white)](https://www.twilio.com/docs/voice/media-streams)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

</div>

Grace is an AI receptionist powered by **Azure Voice Live API**, **Twilio Media Streams**, and **Azure services**. She provides natural phone conversations using Azure's highest quality HD Neural Voices.

## 🌟 Features

### ✅ Ultra-Natural Voice
- **Azure Dragon HD Neural Voice** - Highest quality voice available
- **Semantic turn detection** - Understands meaning and intent
- **Deep noise suppression** - Crystal clear audio
- **Echo cancellation** - Prevents feedback
- **Automatic filler word removal** - Professional speech ("um", "ah" removed)

### ✅ Real-Time Conversations
- Speech-to-speech with Azure Voice Live API
- Natural pauses and emotional expression
- Context-aware responses

### ✅ Website Context Integration
Grace automatically fetches and uses content from Mercy House website to answer questions about:
- Programs and services
- Admission process
- Contact information
- Mission and values

### ✅ Structured Data Collection
Grace intelligently collects caller information in JSON format:
- Name
- Phone number (auto-captured from Twilio)
- City and State
- Reason for calling

### ✅ Azure Blob Storage
All calls generate three files:
- `transcript.json` - Complete conversation transcript
- `intake.json` - Structured caller information
- `recording.json` - Call metadata (duration, timestamp)

---

## 📁 Project Structure

```
grace-ai-receptionist/
├── src/                          # Source code
│   ├── server-voicelive.js      # Main server (Azure Voice Live)
│   └── utils/                    # Utility modules
│       ├── website-scraper.js   # Website content fetching
│       ├── intake-parser.js     # Intake data parsing
│       └── blob-storage.js      # Azure Blob Storage operations
├── config/                       # Configuration modules
│   ├── voicelive.config.js      # Azure Voice Live configuration
│   └── grace.prompt.js          # Grace's personality and instructions
├── docs/                         # Documentation
│   ├── FINAL-SETUP-CHECKLIST.md # Quick start guide
│   ├── AZURE-AI-FOUNDRY-CONFIG.md # Azure AI Foundry configuration
│   └── ...                       # Additional documentation
├── azure-resources/              # Azure deployment scripts
├── server.js                     # Legacy: OpenAI Realtime API version
├── server-azure.js               # Legacy: Azure OpenAI version
├── .env.example                  # Environment configuration template
└── package.json                  # Node.js dependencies
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Azure AI Foundry or Cognitive Services resource with Voice Live API
- Twilio account with phone number
- Azure Storage account (for call recordings)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/your-org/grace-ai-receptionist.git
   cd grace-ai-receptionist
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your credentials (see Configuration section)
   ```

3. **Run the server**
   ```bash
   node src/server-voicelive.js
   ```

4. **Expose locally (development)**
   ```bash
   # In another terminal
   ngrok http 8080
   ```

5. **Configure Twilio webhook**
   - Go to [Twilio Console](https://console.twilio.com/)
   - Phone Numbers → Manage → Active numbers → Your number
   - Voice Configuration:
     - **Webhook URL**: `https://your-ngrok-id.ngrok.io/voice`
     - **Method**: POST
   - Save

6. **Call your number and test!**

---

## ⚙️ Configuration

### Required Environment Variables

```bash
# Azure Voice Live API
AZURE_VOICELIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_VOICELIVE_API_KEY=your_api_key_here
AZURE_VOICELIVE_MODEL=gpt-realtime
AZURE_VOICELIVE_VOICE=DragonHDLatest

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=your_storage_connection_string
BLOB_CONTAINER=calls
```

**Where to get credentials:**

| Variable | Location |
|----------|----------|
| `AZURE_VOICELIVE_ENDPOINT` | Azure Portal → Your AI Resource → Overview → Endpoint |
| `AZURE_VOICELIVE_API_KEY` | Azure Portal → Your AI Resource → Keys and Endpoint → KEY 1 |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com/) → Account Info |
| `TWILIO_AUTH_TOKEN` | [Twilio Console](https://console.twilio.com/) → Account Info |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Portal → Storage Account → Access Keys |

See [.env.example](.env.example) for all configuration options.

### Voice Selection

Azure Voice Live supports multiple voices:

**HD Neural Voices** (Highest quality):
- `DragonHDLatest` (Emma2) - Female, warm, natural ⭐ **Recommended**
- `PhoenixHDLatest` - Female, professional

**Standard Neural Voices**:
- `en-US-AvaNeural` - Female, warm
- `en-US-JennyNeural` - Female, friendly
- `en-US-AriaNeural` - Female, expressive

Configure in `.env`:
```bash
AZURE_VOICELIVE_VOICE=DragonHDLatest
```

---

## 🏗️ Architecture

### Modular Design

The project follows best practices with a clean, modular structure:

- **Configuration Layer** (`config/`)
  - Centralized API configuration
  - Personality and prompt management
  - Easy to test and maintain

- **Utility Layer** (`src/utils/`)
  - Reusable, focused modules
  - Website scraping
  - Data parsing
  - Storage operations

- **Application Layer** (`src/`)
  - Clean business logic
  - Minimal coupling
  - Easy to extend

### Call Flow

```
Caller
  ↓
Twilio Phone Number
  ↓
Twilio Media Stream (WebSocket, g711_ulaw audio)
  ↓
Grace Server (src/server-voicelive.js)
  ├→ Fetch website content
  ├→ Connect to Azure Voice Live API
  ├→ Stream audio bidirectionally
  └→ Parse intake data
  ↓
Azure Blob Storage (save transcript + intake)
```

---

## 📚 Documentation

- **[Quick Start Checklist](docs/FINAL-SETUP-CHECKLIST.md)** - Step-by-step setup
- **[Azure AI Foundry Config](docs/AZURE-AI-FOUNDRY-CONFIG.md)** - Configuration alignment
- **[Voice Live Assessment](docs/VOICELIVE-ASSESSMENT.md)** - Technical analysis
- **[Voice Live Setup](docs/VOICELIVE-SETUP.md)** - Detailed setup guide

---

## 🔄 Alternative Implementations

Three server implementations for comparison:

| File | Provider | Voice Quality | Use Case |
|------|----------|---------------|----------|
| `src/server-voicelive.js` | Azure Voice Live | ⭐⭐⭐⭐⭐ | **Recommended** - Best quality |
| `server-azure.js` | Azure OpenAI | ⭐⭐⭐⭐ | Azure infrastructure |
| `server.js` | OpenAI | ⭐⭐⭐ | Original/testing |

Test different versions:
```bash
node src/server-voicelive.js  # Recommended
node server-azure.js            # Azure OpenAI
node server.js                  # OpenAI
```

---

## 🎤 Grace's Personality

Grace is configured with a warm, caring personality in [config/grace.prompt.js](config/grace.prompt.js).

**Key characteristics:**
- **Warm and empathetic** - Kind, caring tone
- **Natural speech** - Conversational, not scripted
- **Faith-aligned** - Comfortable with hope and prayer references
- **Professional boundaries** - No medical/legal advice
- **Safety-focused** - Emergency protocol for 911 situations

**Customization:**
Edit `config/grace.prompt.js` to adjust Grace's personality, mission, or response style.

---

## 🚢 Deployment

### Azure App Service

```bash
# 1. Create Azure resources (if needed)
cd azure-resources
./create-rg.sh
./create-storage.sh
./create-appservice-webapp.sh

# 2. Set environment variables
az webapp config appsettings set \
  -g rg-grace-receptionist \
  -n grace-receptionist-app \
  --settings \
  AZURE_VOICELIVE_ENDPOINT="..." \
  AZURE_VOICELIVE_API_KEY="..." \
  # ... other settings

# 3. Deploy
zip -r app.zip src/ config/ package.json package-lock.json
az webapp deployment source config-zip \
  -g rg-grace-receptionist \
  -n grace-receptionist-app \
  --src app.zip
```

### Update Twilio webhook to production URL:
```
https://grace-receptionist-app.azurewebsites.net/voice
```

---

## 🧪 Testing

```bash
# Health check
curl http://localhost:8080/healthz

# Run with logging
node src/server-voicelive.js

# Test with ngrok
ngrok http 8080
```

---

## 🔧 Customization

### For Other Organizations

1. **Update website URLs**: Edit `src/utils/website-scraper.js`
2. **Modify system prompt**: Edit `config/grace.prompt.js`
3. **Adjust intake fields**: Edit `src/utils/intake-parser.js` (if needed)
4. **Change voice**: Update `.env` → `AZURE_VOICELIVE_VOICE`
5. **Update Azure resources**: Edit Azure resource names in deployment scripts

---

## 🐛 Troubleshooting

### Common Issues

**"401 Unauthorized"**
- Check API key is correct (no extra spaces)
- Verify endpoint URL format
- Ensure Azure subscription is active

**"Model not found"**
- Verify deployment name in Azure AI Foundry
- Check model is deployed and active

**No audio / Poor quality**
- Verify Twilio webhook URL is correct
- Check ngrok is running (for local dev)
- Try different voice: `AZURE_VOICELIVE_VOICE=en-US-AvaNeural`

**WebSocket errors**
- Endpoint should be `https://` (code converts to `wss://`)
- Check firewall allows WebSocket connections
- Review console logs for details

### Debug Logging

The server logs detailed information to console. Watch for:
- Connection status
- WebSocket events
- Intake data extraction
- Blob storage operations

---

## 📈 Performance

- **Latency**: ~200-300ms (Azure Voice Live)
- **Audio Quality**: HD 24kHz (downsampled to 8kHz for telephony)
- **Concurrent Calls**: Limited by Azure quota
- **Reliability**: 99.9% uptime (Azure SLA)

---

## 💰 Cost Estimation

Approximate costs per minute of conversation:

- **Azure Voice Live**: ~$0.05-0.10/min
- **Twilio Phone**: ~$0.01/min
- **Azure Storage**: ~$0.0001/month/GB

*Check Azure and Twilio pricing for current rates.*

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

[Add your license here]

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/grace-ai-receptionist/issues)
- **Documentation**: [docs/](docs/)

---

## 🙏 Acknowledgments

- **Mercy House Adult & Teen Challenge** - For inspiring this project
- **Azure Voice Live** - For exceptional voice quality
- **Twilio** - For reliable telephony infrastructure
- **OpenAI** - For pioneering realtime speech-to-speech

---

**Built with ❤️ for organizations making a difference.**
