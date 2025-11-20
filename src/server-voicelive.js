require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const WebSocket = require('ws');

// Configuration modules
const voiceLiveConfig = require('../config/voicelive.config');
const { buildInstructions } = require('../config/grace.prompt');

// Utility modules
const { fetchMercyHouseContent } = require('./utils/website-scraper');
const { updateIntakeFromText, createIntakeData } = require('./utils/intake-parser');
const { initBlobStorage, saveCallData } = require('./utils/blob-storage');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 8080;

// Initialize Blob Storage
const containerClient = initBlobStorage();

// Store active sessions
const sessions = new Map();

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
  const from = req.body.From; // Twilio caller ID

  console.log(`Incoming call: ${callSid} from ${from}`);

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
  // Include caller number as a custom parameter so we can pre-fill intake.phone
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${req.headers.host}/media-stream">
      <Parameter name="from" value="${from}" />
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
});

// WebSocket endpoint for Twilio Media Stream
app.ws('/media-stream', async (ws, req) => {
  console.log('Media stream connected (Azure VoiceLive version)');

  let callSid = null;
  let streamSid = null;
  let voiceLiveWs = null;
  let audioBuffer = [];
  let transcript = [];
  let intakeData = createIntakeData();

  // Handle incoming messages from Twilio
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case 'start': {
          callSid = msg.start.callSid;
          streamSid = msg.start.streamSid;

          // Optional: pre-fill phone from Twilio custom parameter
          const fromNumber = msg.start.customParameters?.from || null;
          if (fromNumber) {
            intakeData.phone = fromNumber;
          }

          console.log(`Stream started: ${streamSid} for call ${callSid} from ${fromNumber}`);

          // Initialize session; store references so they stay updated
          sessions.set(callSid, {
            callSid,
            streamSid,
            audioBuffer,
            transcript,
            intakeData,
            startTime: new Date(),
          });

          try {
            // Validate configuration
            voiceLiveConfig.validateConfig();

            // Get WebSocket URL and auth headers
            const voiceLiveUrl = voiceLiveConfig.getWebSocketUrl();
            const authHeaders = voiceLiveConfig.getAuthHeaders();

            console.log(`Connecting to Azure VoiceLive: ${voiceLiveUrl}`);

            // Connect to Azure VoiceLive API
            voiceLiveWs = new WebSocket(voiceLiveUrl, {
              headers: authHeaders,
            });

            voiceLiveWs.on('open', async () => {
              console.log('Connected to Azure VoiceLive API');

              // Fetch Mercy House website content to give Grace real context
              const mercyContext = await fetchMercyHouseContent();

              // Build instructions with website reference data appended
              const fullInstructions = buildInstructions(mercyContext);

              // Get session configuration
              const sessionConfig = voiceLiveConfig.getSessionConfig(fullInstructions);

              // Send session configuration
              voiceLiveWs.send(JSON.stringify(sessionConfig));

              // Send an initial greeting request to Grace
              console.log('Requesting initial greeting from Grace');
              const greetingConfig = voiceLiveConfig.getGreetingConfig();
              voiceLiveWs.send(JSON.stringify(greetingConfig));
            });

            voiceLiveWs.on('message', (data) => {
              const response = JSON.parse(data);

              // Handle different VoiceLive event types
              switch (response.type) {
                case 'session.updated':
                  console.log('VoiceLive session ready:', response.session?.id);
                  break;

                case 'input_audio_buffer.speech_started':
                  console.log('User started speaking');
                  break;

                case 'input_audio_buffer.speech_stopped':
                  console.log('User stopped speaking');
                  break;

                case 'response.created':
                  console.log('Assistant response created');
                  break;

                case 'response.audio.delta':
                case 'response.audio_delta':
                  // Send audio back to Twilio
                  if (response.delta || response.audio) {
                    const audioData = response.delta || response.audio;

                    ws.send(
                      JSON.stringify({
                        event: 'media',
                        streamSid: streamSid,
                        media: {
                          payload: audioData,
                        },
                      })
                    );
                  }
                  break;

                case 'response.audio.done':
                case 'response.audio_done':
                  console.log('Assistant finished speaking');
                  break;

                case 'response.done':
                  console.log('Response complete');
                  break;

                case 'response.audio_transcript.done':
                case 'conversation.item.created': {
                  const text =
                    response.transcript ||
                    response.item?.formatted?.transcript ||
                    response.item?.content?.find((c) => c.type === 'text')?.text;

                  if (text) {
                    transcript.push({
                      role: response.role || response.item?.role || 'assistant',
                      text,
                      timestamp: new Date().toISOString(),
                    });

                    // Try to extract intake data if this is the special INTAKE line
                    updateIntakeFromText(text, intakeData);
                  }
                  break;
                }

                case 'error':
                  console.error('Azure VoiceLive error:', response.error);
                  break;

                default:
                  console.log('Unhandled event type:', response.type);
                  break;
              }
            });

            voiceLiveWs.on('error', (error) => {
              console.error('Azure VoiceLive WebSocket error:', error);
            });

            voiceLiveWs.on('close', () => {
              console.log('Azure VoiceLive WebSocket closed');
            });
          } catch (configError) {
            console.error('Configuration error:', configError.message);
            ws.send(
              JSON.stringify({
                event: 'error',
                error: configError.message,
              })
            );
          }

          break;
        }

        case 'media':
          // Forward audio to Azure VoiceLive
          if (voiceLiveWs && voiceLiveWs.readyState === WebSocket.OPEN) {
            audioBuffer.push(msg.media.payload);

            // Send audio directly - Azure Voice Live natively supports g711_ulaw!
            const audioAppendMsg = voiceLiveConfig.getAudioAppendMessage(msg.media.payload);
            voiceLiveWs.send(JSON.stringify(audioAppendMsg));
          }
          break;

        case 'stop':
          console.log(`Stream stopped: ${streamSid}`);

          // Close VoiceLive connection
          if (voiceLiveWs) {
            voiceLiveWs.close();
          }

          // Save call data to blob storage
          if (containerClient) {
            await saveCallData(callSid, audioBuffer, transcript, intakeData);
          }

          // Clean up session
          sessions.delete(callSid);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', async () => {
    console.log('Twilio WebSocket closed');

    if (voiceLiveWs) {
      voiceLiveWs.close();
    }

    if (callSid && sessions.has(callSid)) {
      const session = sessions.get(callSid);
      if (containerClient) {
        await saveCallData(callSid, session.audioBuffer, session.transcript, session.intakeData);
      }
      sessions.delete(callSid);
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Grace AI Receptionist server (Azure VoiceLive version) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log(`Endpoint: ${process.env.AZURE_VOICELIVE_ENDPOINT || 'Not configured'}`);
  console.log(`Voice: ${process.env.AZURE_VOICELIVE_VOICE || 'DragonHDLatest (default)'}`);
});
