# Project Reorganization - Migration Guide

## Summary

The Grace AI Receptionist project has been reorganized to follow best practices with a clean, modular structure.

## What Changed

### ✅ New Directory Structure

```
grace-ai-receptionist/
├── src/                          # Source code (NEW)
│   ├── server-voicelive.js      # Main server (refactored)
│   └── utils/                    # Utility modules (NEW)
│       ├── website-scraper.js   # Website content fetching
│       ├── intake-parser.js     # Intake data parsing
│       └── blob-storage.js      # Azure Blob Storage operations
├── config/                       # Configuration modules (NEW)
│   ├── voicelive.config.js      # Azure Voice Live configuration
│   └── grace.prompt.js          # Grace's personality
├── docs/                         # Documentation (NEW)
│   ├── FINAL-SETUP-CHECKLIST.md
│   ├── AZURE-AI-FOUNDRY-CONFIG.md
│   └── ...
├── azure-resources/              # Azure deployment scripts
├── server.js                     # Legacy: OpenAI version
├── server-azure.js               # Legacy: Azure OpenAI version
├── server-voicelive.js          # Legacy: Old Voice Live version
├── .env.example                  # Updated with new variables
└── README.md                     # Updated documentation
```

### ✅ Key Improvements

1. **Modular Configuration**
   - All Azure Voice Live config moved to `config/voicelive.config.js`
   - Grace's personality separated into `config/grace.prompt.js`
   - **Endpoint is now a variable** (no hardcoding)

2. **Reusable Utilities**
   - Website scraping: `src/utils/website-scraper.js`
   - Intake parsing: `src/utils/intake-parser.js`
   - Blob storage: `src/utils/blob-storage.js`

3. **Clean Server Code**
   - New server: `src/server-voicelive.js`
   - Imports config and utilities
   - Focused on business logic
   - Easy to test and maintain

4. **Organized Documentation**
   - All `.md` files moved to `docs/`
   - Except `README.md` (stays at root)

## Breaking Changes

### Command to Run Server

**Before:**
```bash
node server-voicelive.js
```

**After:**
```bash
node src/server-voicelive.js
```

### Environment Variables

**New variables added to `.env.example`:**

```bash
# Voice configuration (NEW)
AZURE_VOICELIVE_VOICE_TEMP=0.8
AZURE_VOICELIVE_RESPONSE_TEMP=0.8
AZURE_VOICELIVE_SPEAKING_RATE=1.0

# VAD configuration (NEW)
AZURE_VOICELIVE_VAD_THRESHOLD=0.3
AZURE_VOICELIVE_VAD_SILENCE_MS=200
```

**Endpoint is now fully configurable:**
```bash
# Before: Hardcoded in code
# After: Fully configurable via .env
AZURE_VOICELIVE_ENDPOINT=https://devopsaifoundry.cognitiveservices.azure.com
```

## Migration Steps

### For Existing Installations

1. **Pull latest code:**
   ```bash
   git pull
   ```

2. **Update your `.env` file:**
   ```bash
   # Copy from updated example
   cp .env .env.backup
   cp .env.example .env
   # Manually copy your keys from .env.backup to .env
   ```

3. **Update run command:**
   ```bash
   # Old
   node server-voicelive.js

   # New
   node src/server-voicelive.js
   ```

4. **Test locally:**
   ```bash
   node src/server-voicelive.js
   ```

### For Azure Deployment

Update deployment command to include new directories:

```bash
# Old
zip -r app.zip server-voicelive.js package.json node_modules

# New
zip -r app.zip src/ config/ package.json package-lock.json node_modules
```

Update startup command in Azure App Service:

```bash
az webapp config set \
  -g rg-grace-receptionist \
  -n grace-receptionist-app \
  --startup-file "node src/server-voicelive.js"
```

## Benefits

### 1. **Better Maintainability**
- Clear separation of concerns
- Easy to find and modify code
- Reduced duplication

### 2. **Improved Testability**
- Modular functions easy to test
- Configuration isolated
- Utilities are reusable

### 3. **Easier Customization**
- Configuration in one place (`config/`)
- Utilities are documented
- Clear entry point (`src/server-voicelive.js`)

### 4. **Scalability**
- Easy to add new features
- Can support multiple organizations
- Plugin-like architecture

### 5. **Professional Structure**
- Follows Node.js best practices
- Industry-standard layout
- Easy for new developers to understand

## Configuration Module API

### `config/voicelive.config.js`

**Key functions:**

```javascript
const voiceLiveConfig = require('../config/voicelive.config');

// Get WebSocket URL (builds from endpoint + params)
const url = voiceLiveConfig.getWebSocketUrl();

// Get authentication headers
const headers = voiceLiveConfig.getAuthHeaders();

// Get voice configuration
const voice = voiceLiveConfig.getVoiceConfig();

// Get complete session configuration
const session = voiceLiveConfig.getSessionConfig(instructions);

// Validate environment variables
voiceLiveConfig.validateConfig();
```

### `config/grace.prompt.js`

```javascript
const { buildInstructions } = require('../config/grace.prompt');

// Build instructions with website context
const fullInstructions = buildInstructions(websiteContext);
```

## Utility Module API

### `src/utils/website-scraper.js`

```javascript
const { fetchMercyHouseContent } = require('./utils/website-scraper');

// Fetch and clean website content
const content = await fetchMercyHouseContent();
```

### `src/utils/intake-parser.js`

```javascript
const { updateIntakeFromText, createIntakeData } = require('./utils/intake-parser');

// Create intake data object
const intakeData = createIntakeData({ phone: '+1601XXXXXXX' });

// Parse INTAKE line from transcript
updateIntakeFromText(text, intakeData);
```

### `src/utils/blob-storage.js`

```javascript
const { initBlobStorage, saveCallData } = require('./utils/blob-storage');

// Initialize storage
const container = initBlobStorage();

// Save call data
await saveCallData(callSid, audioBuffer, transcript, intakeData);
```

## Testing the Migration

### Quick Test

```bash
# 1. Verify structure
ls src/
ls config/
ls docs/

# 2. Check environment
cat .env | grep AZURE_VOICELIVE_ENDPOINT

# 3. Run health check
node src/server-voicelive.js &
sleep 3
curl http://localhost:8080/healthz
```

### Full Test

```bash
# 1. Start server
node src/server-voicelive.js

# 2. Expose with ngrok
ngrok http 8080

# 3. Update Twilio webhook

# 4. Make test call
```

## Rollback Plan

If you need to rollback to the old structure:

```bash
# Checkout previous commit
git log --oneline  # Find commit before reorganization
git checkout <commit-hash>

# Or use old server files
node server-voicelive.js  # Legacy version still exists
```

## Documentation

Updated documentation in `docs/`:

- [README.md](../README.md) - Main project documentation
- [FINAL-SETUP-CHECKLIST.md](docs/FINAL-SETUP-CHECKLIST.md) - Quick start
- [AZURE-AI-FOUNDRY-CONFIG.md](docs/AZURE-AI-FOUNDRY-CONFIG.md) - Configuration details

## Support

If you encounter issues after migration:

1. Check your `.env` file has all required variables
2. Verify the endpoint format (should be `https://`, not `wss://`)
3. Review console logs for detailed errors
4. See [Troubleshooting](../README.md#troubleshooting) in README

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Server Location** | `./server-voicelive.js` | `./src/server-voicelive.js` |
| **Configuration** | Hardcoded in server | `./config/*.js` modules |
| **Utilities** | Inline in server | `./src/utils/*.js` modules |
| **Documentation** | Root directory | `./docs/` directory |
| **Endpoint** | Hardcoded | Environment variable |
| **Lines of Code** | ~500 in one file | ~100 per module |
| **Maintainability** | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

**Migration Complete!** 🎉

The project now follows industry best practices with a clean, modular architecture.
