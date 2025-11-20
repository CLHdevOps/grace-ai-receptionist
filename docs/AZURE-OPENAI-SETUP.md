# Azure OpenAI Setup Guide for Grace

This guide will help you set up and test Azure OpenAI's GPT-4o Realtime API with Grace AI Receptionist.

## What You'll Need

### 1. Azure OpenAI Resource

You need an **Azure OpenAI Service** resource with the **GPT-4o Realtime** model deployed.

#### Steps to Get This Information:

**A. Create/Access Azure OpenAI Resource:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure OpenAI"
3. Create a new resource or use an existing one
4. **Note:** GPT-4o Realtime requires specific regions (check Azure docs for availability)

**B. Deploy the GPT-4o Realtime Model:**
1. In your Azure OpenAI resource, go to **Azure OpenAI Studio**
2. Navigate to **Deployments**
3. Click **Create new deployment**
4. Select model: **gpt-4o-realtime-preview**
5. Give it a deployment name (e.g., `gpt-4o-realtime`)
6. **IMPORTANT:** Save this deployment name - you'll need it for `AZURE_OPENAI_DEPLOYMENT`

**C. Get Your Endpoint and API Key:**
1. In Azure Portal, go to your Azure OpenAI resource
2. Go to **Keys and Endpoint** in the left menu
3. Copy:
   - **Endpoint** (e.g., `https://your-resource.openai.azure.com`)
   - **KEY 1** (your API key)

### 2. Configuration Values Needed

Update [.env.azure](.env.azure) or your `.env` file with:

```bash
# Azure OpenAI Endpoint (from Azure Portal)
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com

# Azure OpenAI API Key (from Azure Portal > Keys and Endpoint)
AZURE_OPENAI_API_KEY=your_api_key_here

# Azure OpenAI Deployment Name (from Azure OpenAI Studio > Deployments)
AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
```

### 3. Keep Your Existing Configuration

You'll still need your existing Twilio and Azure Storage settings:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `AZURE_STORAGE_CONNECTION_STRING`
- `BLOB_CONTAINER`

## Running the Azure OpenAI Version

### Local Development

1. **Copy environment configuration:**
   ```bash
   cp .env.azure .env
   # OR manually update your existing .env with the Azure OpenAI values
   ```

2. **Run the Azure version:**
   ```bash
   node server-azure.js
   ```

3. **Expose with ngrok (for Twilio testing):**
   ```bash
   ngrok http 8080
   ```

4. **Update Twilio webhook:**
   - Use the ngrok HTTPS URL: `https://your-ngrok-id.ngrok.io/voice`

### Testing Locally

```bash
# Health check
curl http://localhost:8080/healthz
```

### Comparing OpenAI vs Azure OpenAI

You can easily switch between versions:

**Original OpenAI version:**
```bash
node server.js
```

**Azure OpenAI version:**
```bash
node server-azure.js
```

## Key Differences: Azure OpenAI vs OpenAI

### 1. **WebSocket URL Format**

**OpenAI:**
```
wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
```

**Azure OpenAI:**
```
wss://{your-resource}.openai.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment={deployment-name}
```

### 2. **Authentication**

**OpenAI:**
```javascript
headers: {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'OpenAI-Beta': 'realtime=v1'
}
```

**Azure OpenAI:**
```javascript
headers: {
  'api-key': azureApiKey
}
```

### 3. **Voice Options**

Azure OpenAI may have different voice options than OpenAI. In [server-azure.js](server-azure.js:321), the default is set to `"alloy"`. You can experiment with:
- `alloy`
- `echo`
- `shimmer`

(Check Azure OpenAI docs for the latest supported voices)

### 4. **Pricing & Quotas**

- Azure OpenAI pricing may differ from OpenAI's pricing
- Check your Azure subscription quotas and limits
- Monitor usage in Azure Portal

## Deployment to Azure App Service

When deploying the Azure OpenAI version:

1. **Update App Settings in Azure Portal:**
   ```bash
   az webapp config appsettings set \
     -g rg-grace-receptionist \
     -n grace-receptionist-app \
     --settings \
     AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com" \
     AZURE_OPENAI_API_KEY="your_key" \
     AZURE_OPENAI_DEPLOYMENT="gpt-4o-realtime"
   ```

2. **Deploy the Azure version:**
   ```bash
   # Package and deploy
   zip -r app-azure.zip server-azure.js package.json node_modules azure-resources .env

   az webapp deployment source config-zip \
     -g rg-grace-receptionist \
     -n grace-receptionist-app \
     --src app-azure.zip
   ```

3. **Update startup command:**
   ```bash
   az webapp config set \
     -g rg-grace-receptionist \
     -n grace-receptionist-app \
     --startup-file "node server-azure.js"
   ```

## Troubleshooting

### "Connection refused" or "401 Unauthorized"
- Verify your `AZURE_OPENAI_ENDPOINT` is correct (should be HTTPS, not WSS)
- Verify your `AZURE_OPENAI_API_KEY` is correct
- Check that the deployment name matches exactly

### "Model not found" or "Deployment not found"
- Verify your deployment name in Azure OpenAI Studio
- Ensure the deployment is active and not stopped
- Check that you're using the correct API version (`2024-10-01-preview`)

### "Voice quality issues"
- Try different voice options: `alloy`, `echo`, `shimmer`
- Adjust VAD settings in [server-azure.js](server-azure.js:326-331):
  - `threshold`: Lower = more sensitive (0.3-0.6)
  - `silence_duration_ms`: Longer = fewer interruptions (500-1000ms)

### WebSocket errors
- Check Azure OpenAI region availability for Realtime API
- Verify network connectivity and firewall rules
- Check Azure OpenAI service health status

## Next Steps

1. Get your Azure OpenAI credentials (endpoint, key, deployment name)
2. Update `.env` with the Azure values
3. Run `node server-azure.js` locally
4. Test with ngrok and Twilio
5. Compare voice quality between OpenAI and Azure OpenAI
6. Choose which version to deploy to production

## Resources

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure OpenAI Realtime API Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/openai/realtime-audio-quickstart)
- [Azure OpenAI Studio](https://oai.azure.com/)
