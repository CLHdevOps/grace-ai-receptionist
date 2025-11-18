require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const { BlobServiceClient } = require('@azure/storage-blob');
const OpenAI = require('openai');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 8080;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.BLOB_CONTAINER || 'calls'
);

// Store active sessions
const sessions = new Map();

// Grace's system prompt
const GRACE_PROMPT = `You are Grace, a warm and caring AI receptionist for a nonprofit organization.

Your personality:
- Warm, kind, and genuinely caring
- Professional but conversational
- Faith-aligned and compassionate
- Use natural human speech patterns like "hmm", "uh", soft pauses
- Never sound robotic or overly formal

Your responsibilities:
- Greet callers warmly
- Collect their information: name, phone number, city/state, and reason for calling
- Listen actively and show empathy
- Keep the conversation natural - don't repeat the caller's name constantly
- Be helpful and reassuring

Important safety rules:
- You do NOT provide medical advice
- For emergencies, immediately say: "This sounds like an emergency. Please hang up and call 911 right away."
- Stay within your role as a receptionist - don't pretend to be a doctor, lawyer, or counselor

Example greeting:
"Hi, this is Grace. I'm here to help you. How are you doing today?"

Be natural, be kind, and truly listen.`;

// Business hours check (optional - customize as needed)
function isBusinessHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Example: Monday-Friday, 9 AM - 5 PM
  const isWeekday = day >= 1 && day <= 5;
  const isDuringHours = hour >= 9 && hour < 17;

  return isWeekday && isDuringHours;
}

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Twilio voice webhook
app.post('/voice', express.urlencoded({ extended: false }), (req, res) => {
  const callSid = req.body.CallSid;

  console.log(`Incoming call: ${callSid}`);

  // Optional: Forward to real number during business hours
  // Uncomment and configure as needed
  /*
  if (isBusinessHours()) {
    return res.type('text/xml').send(`
      <Response>
        <Dial>+1601XXXXXXX</Dial>
      </Response>
    `);
  }
  */

  // Start Media Stream to WebSocket for Grace to handle
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${req.headers.host}/media-stream" />
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
});

// WebSocket endpoint for Twilio Media Stream
app.ws('/media-stream', async (ws, req) => {
  console.log('Media stream connected');

  let callSid = null;
  let streamSid = null;
  let openAiWs = null;
  let audioBuffer = [];
  let transcript = [];
  let intakeData = {
    name: null,
    phone: null,
    city: null,
    state: null,
    reason: null
  };

  // Handle incoming messages from Twilio
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case 'start':
          callSid = msg.start.callSid;
          streamSid = msg.start.streamSid;
          console.log(`Stream started: ${streamSid} for call ${callSid}`);

          // Initialize session
          sessions.set(callSid, {
            callSid,
            streamSid,
            audioBuffer: [],
            transcript: [],
            intakeData: { ...intakeData },
            startTime: new Date()
          });

          // Connect to OpenAI Realtime API
          openAiWs = new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
            {
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
              }
            }
          );

          openAiWs.on('open', () => {
            console.log('Connected to OpenAI Realtime API');

            // Configure session
            openAiWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: GRACE_PROMPT,
                voice: 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500
                }
              }
            }));
          });

          openAiWs.on('message', (data) => {
            const response = JSON.parse(data);

            // Handle different OpenAI event types
            switch (response.type) {
              case 'response.audio.delta':
                // Send audio back to Twilio
                if (response.delta) {
                  ws.send(JSON.stringify({
                    event: 'media',
                    streamSid: streamSid,
                    media: {
                      payload: response.delta
                    }
                  }));
                }
                break;

              case 'response.audio_transcript.done':
              case 'conversation.item.created':
                // Log transcript
                if (response.transcript || response.item?.formatted?.transcript) {
                  const text = response.transcript || response.item.formatted.transcript;
                  transcript.push({
                    role: response.role || 'assistant',
                    text: text,
                    timestamp: new Date().toISOString()
                  });
                }
                break;

              case 'error':
                console.error('OpenAI error:', response.error);
                break;
            }
          });

          openAiWs.on('error', (error) => {
            console.error('OpenAI WebSocket error:', error);
          });

          openAiWs.on('close', () => {
            console.log('OpenAI WebSocket closed');
          });

          break;

        case 'media':
          // Forward audio to OpenAI
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            audioBuffer.push(msg.media.payload);

            openAiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: msg.media.payload
            }));
          }
          break;

        case 'stop':
          console.log(`Stream stopped: ${streamSid}`);

          // Close OpenAI connection
          if (openAiWs) {
            openAiWs.close();
          }

          // Save call data to blob storage
          await saveCallData(callSid, audioBuffer, transcript, intakeData);

          // Clean up session
          sessions.delete(callSid);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', async () => {
    console.log('Twilio WebSocket closed');

    if (openAiWs) {
      openAiWs.close();
    }

    if (callSid && sessions.has(callSid)) {
      const session = sessions.get(callSid);
      await saveCallData(callSid, session.audioBuffer, session.transcript, session.intakeData);
      sessions.delete(callSid);
    }
  });
});

// Save call data to Azure Blob Storage
async function saveCallData(callSid, audioBuffer, transcript, intakeData) {
  try {
    console.log(`Saving call data for ${callSid}`);

    const prefix = `calls/${callSid}/`;

    // Save transcript
    const transcriptBlob = containerClient.getBlockBlobClient(`${prefix}transcript.json`);
    await transcriptBlob.upload(
      JSON.stringify(transcript, null, 2),
      Buffer.byteLength(JSON.stringify(transcript, null, 2)),
      {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      }
    );

    // Save intake data
    const intakeBlob = containerClient.getBlockBlobClient(`${prefix}intake.json`);
    await intakeBlob.upload(
      JSON.stringify(intakeData, null, 2),
      Buffer.byteLength(JSON.stringify(intakeData, null, 2)),
      {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      }
    );

    // Save recording metadata
    const recordingMetadata = {
      callSid,
      duration: audioBuffer.length,
      timestamp: new Date().toISOString()
    };

    const recordingMetaBlob = containerClient.getBlockBlobClient(`${prefix}recording.json`);
    await recordingMetaBlob.upload(
      JSON.stringify(recordingMetadata, null, 2),
      Buffer.byteLength(JSON.stringify(recordingMetadata, null, 2)),
      {
        blobHTTPHeaders: { blobContentType: 'application/json' }
      }
    );

    console.log(`Call data saved successfully for ${callSid}`);

    // Optional: Send notification to staff
    // await sendNotification(callSid, intakeData);

  } catch (error) {
    console.error('Error saving call data:', error);
  }
}

// Optional: Send notification function (implement as needed)
async function sendNotification(callSid, intakeData) {
  // TODO: Implement email/SMS notification
  // Use SendGrid, Twilio SMS, or other service
  console.log(`Notification would be sent for call ${callSid}`);
}

// Start server
app.listen(PORT, () => {
  console.log(`Grace AI Receptionist server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
});
