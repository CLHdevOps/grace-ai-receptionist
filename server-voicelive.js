require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const { BlobServiceClient } = require('@azure/storage-blob');
const WebSocket = require('ws');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 8080;

// Debug logging toggle - set to true to enable verbose logging
const DEBUG = process.env.DEBUG_VOICELIVE === 'true' || false;

/**
 * Key Mercy House URLs to pull context from.
 * You can tweak or add more URLs as needed.
 */
const MERCY_URLS = [
  'https://mercyhouseatc.com/',
  'https://mercyhouseatc.com/about/',
  'https://mercyhouseatc.com/program/',
  'https://mercyhouseatc.com/contact/',
];

/**
 * Fetch and lightly clean text content from the Mercy House site
 * so Grace can answer questions based on real info.
 */
async function fetchMercyHouseContent() {
  try {
    const chunks = [];

    for (const url of MERCY_URLS) {
      const res = await fetch(url);
      const html = await res.text();

      // Strip scripts/styles and HTML tags, compress whitespace
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit per-page chunk to keep instructions reasonable in size
      chunks.push(`From ${url}:\n${text.slice(0, 2000)}`);
    }

    return chunks.join('\n\n');
  } catch (err) {
    console.error('Error fetching Mercy House content:', err);
    // If we fail to fetch, return empty string so session still works
    return '';
  }
}

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
const GRACE_PROMPT = `You are Grace, a warm, caring AI receptionist for Mercy House Adult & Teen Challenge in Mississippi.

Important:
- You must ALWAYS respond only in English.
- Never use any other language, even for greetings or short phrases.
- If a caller speaks another language, gently say you can only continue in English.

Your speaking style:
- Speak in natural spoken English, not formal written English.
- Vary sentence length and cadence; avoid monotone or predictable patterns.
- Add soft, natural pauses ("hmm," "okay…," "I hear you") when appropriate.
- Keep answers short, warm, and conversational.
- Never sound stiff, scripted, or overly polished.
- Use soft, natural vocal cues like:
  • [breath]
  • [pause 150ms]
  • [pause 300ms when thinking]
  • [soft chuckle] when appropriate
- Do NOT overuse them; sprinkle them lightly and naturally.


Your personality:
- Kind, empathetic, and genuinely caring.
- Calm, steady, and encouraging.
- Faith-aligned; it's okay to gently reference hope, prayer, or God's ability to restore lives.
- Professional but human—sound like a real receptionist, not a narrator.

Your mission:
- Greet callers warmly and make them feel safe.
- Listen carefully, respond with empathy, and never rush them.
- Answer questions using ONLY:
  • What the caller tells you
  • Information provided from the Mercy House website (included in your system context)
- If unsure, say something like:
  "I'm not completely sure on that detail, but I can have someone from Mercy House call you back with a clear answer."
- Your goal is to collect callback info for a real staff member to follow up.

Information you MUST gather before ending the call:
- Caller's name
- Best phone number
- City and state
- Short reason for calling (help for self, help for loved one, donation, volunteering, etc.)

Structured handoff requirement:
Once you have all four pieces of info, you must output exactly one line beginning with:

INTAKE: {JSON}

Where {JSON} is a single-line JSON object with keys:
- name
- phone
- city
- state
- reason

Example format (do NOT say "example" out loud):
INTAKE: {"name":"John Doe","phone":"+1601XXXXXXX","city":"Brandon","state":"MS","reason":"Asking about admission for a family member"}

Do NOT speak the word "INTAKE" to the caller. Continue the conversation naturally, but still send the machine-readable line.

How to talk:
- Start with something like:
  "Hi, this is Grace with Mercy House. I'm here to help. How are you doing today?"
- Let callers finish their thoughts. Use gentle, empathetic backchanneling ("mm-hmm", "I understand").
- Guide the conversation toward the info you need without sounding like a form.
- Use the caller's name occasionally, not constantly.

Safety:
- Do NOT give medical, legal, or professional counseling.
- If the caller seems in immediate danger:
  "This sounds like an emergency. Please hang up and call 911 right now."
- Stay in your lane: you listen, support, give basic info, and collect details for follow-up.

Above all:
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

/**
 * Parse an "INTAKE: {json}" line from Grace into the intakeData object.
 */
function updateIntakeFromText(text, intakeData) {
  if (!text.startsWith('INTAKE:')) return;

  try {
    // Strip the "INTAKE:" prefix and trim
    const jsonPart = text.slice('INTAKE:'.length).trim();

    // Parse JSON
    const parsed = JSON.parse(jsonPart);

    // Safely copy known fields if present
    intakeData.name = parsed.name ?? intakeData.name;
    intakeData.phone = parsed.phone ?? intakeData.phone;
    intakeData.city = parsed.city ?? intakeData.city;
    intakeData.state = parsed.state ?? intakeData.state;
    intakeData.reason = parsed.reason ?? intakeData.reason;

    console.log('Updated intake data from INTAKE line:', intakeData);
  } catch (err) {
    console.error('Failed to parse INTAKE line:', err, 'Raw text:', text);
  }
}

// WebSocket endpoint for Twilio Media Stream
app.ws('/media-stream', async (ws, req) => {
  console.log('Media stream connected (Azure VoiceLive version)');

  let callSid = null;
  let streamSid = null;
  let voiceLiveWs = null;
  let audioBuffer = [];
  let transcript = [];
  let intakeData = {
    name: null,
    phone: null,
    city: null,
    state: null,
    reason: null,
  };

  // Azure VoiceLive session state
  let sessionConfigured = false;
  let sessionReady = false;
  const audioQueue = [];

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

          // Build Azure VoiceLive WebSocket URL
          // Format: wss://<resource-name>.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-10-01&model=<model-name>
          const azureResourceEndpoint = (process.env.AZURE_VOICELIVE_ENDPOINT || 'https://devopsaifoundry.cognitiveservices.azure.com').replace(/\/+$/, '');
          const voiceLiveApiKey = process.env.AZURE_VOICELIVE_API_KEY;
          const voiceLiveModel = process.env.AZURE_VOICELIVE_MODEL || 'gpt-realtime';
          const apiVersion = process.env.AZURE_VOICELIVE_API_VERSION || '2025-10-01';

          // Convert HTTPS to WSS for WebSocket connection
          const wsEndpoint = azureResourceEndpoint.replace('https://', 'wss://');
          const voiceLiveUrl = `${wsEndpoint}/voice-live/realtime?api-version=${apiVersion}&model=${voiceLiveModel}`;

          console.log(`Connecting to Azure VoiceLive: ${voiceLiveUrl}`);

          // Connect to Azure VoiceLive API
          voiceLiveWs = new WebSocket(voiceLiveUrl, {
            headers: {
              'api-key': voiceLiveApiKey,
            },
          });

          // Wrap the send method to log all outgoing messages (if DEBUG enabled)
          const originalSend = voiceLiveWs.send.bind(voiceLiveWs);
          voiceLiveWs.send = function(data) {
            if (DEBUG) {
              console.log('>>> SENDING TO AZURE:', data.substring(0, 200));
            }
            return originalSend(data);
          };

          voiceLiveWs.on('open', async () => {
            console.log('Connected to Azure VoiceLive API');
            console.log('Waiting for session.created event from Azure...');
          });

          voiceLiveWs.on('message', (data) => {
            const response = JSON.parse(data);

            if (DEBUG) {
              console.log('<<< RECEIVED FROM AZURE:', response.type, JSON.stringify(response).substring(0, 200));
            }

            // Handle different VoiceLive event types
            // Based on Python code: SESSION_UPDATED, RESPONSE_AUDIO_DELTA, etc.
            switch (response.type) {
              case 'session.created':
                console.log('VoiceLive session created:', response.session?.id);

                // Now that session is created, configure it
                if (!sessionConfigured) {
                  sessionConfigured = true;

                  (async () => {
                    // Fetch Mercy House website content to give Grace real context
                    const mercyContext = await fetchMercyHouseContent();

                    // Build instructions with website reference data appended
                    const fullInstructions = `${GRACE_PROMPT}

Below is reference information from the Mercy House Adult & Teen Challenge website.
Use this ONLY as background knowledge to answer questions.
Do NOT read this text out loud or mention that you can "see the website".

${mercyContext}`;

                    // Determine voice configuration (Azure Neural Voice format)
                    const voiceName = process.env.AZURE_VOICELIVE_VOICE || 'alloy';

                    // Detect voice type based on name pattern
                    // HD voices end with "HDLatest" (e.g., EMMA2DragonHDLatest, PhoenixHDLatest)
                    // Standard voices follow pattern like "en-US-AvaNeural"
                    // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
                    let voiceConfig;
                    if (voiceName.includes('HDLatest') || voiceName.includes('Neural')) {
                      // Azure Neural Voice (HD or Standard)
                      voiceConfig = {
                        type: 'azure-standard',
                        name: voiceName,
                        temperature: 0.8
                      };
                    } else {
                      // OpenAI voice
                      voiceConfig = {
                        type: 'openai',
                        name: voiceName
                      };
                    }

                    // Configure session for speech-to-speech with Azure Voice Live
                    const sessionUpdateMessage = {
                      type: 'session.update',
                      session: {
                        modalities: ['text', 'audio'],
                        instructions: fullInstructions,

                        // Voice configuration - Azure Neural Voice format
                        voice: voiceConfig,

                        // Audio format - g711_ulaw is natively supported by Azure Voice Live!
                        // This matches Twilio's format exactly (no transcoding needed)
                        input_audio_format: 'g711_ulaw',
                        output_audio_format: 'g711_ulaw',

                        // Response temperature (matching Azure AI Foundry config: 0.8)
                        temperature: 0.8,

                        // Azure Semantic VAD - understands meaning and intent, not just silence
                        // Adjusted for better call quality and less interruptions
                        turn_detection: {
                          type: 'azure_semantic_vad',
                          threshold: 0.5,
                          prefix_padding_ms: 300,
                          silence_duration_ms: 500,
                          interrupt_response: true,
                          remove_filler_words: true
                        },

                        // Audio enhancement features (matching Azure AI Foundry config)
                        input_audio_noise_reduction: {
                          type: 'azure_deep_noise_suppression'
                        },
                        input_audio_echo_cancellation: {
                          type: 'server_echo_cancellation'
                        }
                      },
                    };

                    if (DEBUG) {
                      console.log('Sending session.update:', JSON.stringify(sessionUpdateMessage, null, 2));
                    }
                    voiceLiveWs.send(JSON.stringify(sessionUpdateMessage));

                    // Send an initial greeting request to Grace
                    console.log('Requesting initial greeting from Grace');
                    voiceLiveWs.send(
                      JSON.stringify({
                        type: 'response.create',
                        response: {
                          modalities: ['text', 'audio'],
                          instructions: 'Greet the caller warmly as instructed in your system prompt.',
                        },
                      })
                    );
                  })();
                }
                break;

              case 'session.updated':
                console.log('VoiceLive session ready:', response.session?.id);
                sessionReady = true;

                // Flush any queued audio data
                if (audioQueue.length > 0) {
                  console.log(`Flushing ${audioQueue.length} queued audio packets`);
                  audioQueue.forEach(audioData => {
                    voiceLiveWs.send(
                      JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: audioData,
                      })
                    );
                  });
                  audioQueue.length = 0; // Clear the queue
                }
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
                // NOTE: May need audio format conversion between PCM16 (24kHz) and g711_ulaw (8kHz)
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

              case 'response.audio_transcript.delta':
                // Capture transcript deltas to see what Grace is saying
                if (response.delta) {
                  console.log('Grace says:', response.delta);
                }
                break;

              case 'response.audio_transcript.done':
                // Full transcript available
                if (response.transcript) {
                  console.log('Grace full response:', response.transcript);
                  transcript.push({
                    role: 'assistant',
                    text: response.transcript,
                    timestamp: new Date().toISOString(),
                  });
                  updateIntakeFromText(response.transcript, intakeData);
                }
                break;

              case 'conversation.item.created': {
                const text =
                  response.item?.formatted?.transcript ||
                  response.item?.content?.find(c => c.type === 'text')?.text;

                if (text) {
                  transcript.push({
                    role: response.item?.role || 'assistant',
                    text,
                    timestamp: new Date().toISOString(),
                  });

                  // Try to extract intake data if this is the special INTAKE line
                  updateIntakeFromText(text, intakeData);
                }
                break;
              }

              case 'response.output_item.added':
              case 'response.content_part.added':
              case 'response.content_part.done':
              case 'response.output_item.done':
                // These are structural events, just acknowledge them
                break;

              case 'input_audio_buffer.committed':
                console.log('User audio committed');
                break;

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

          break;
        }

        case 'media':
          // Forward audio to Azure VoiceLive
          if (voiceLiveWs && voiceLiveWs.readyState === WebSocket.OPEN) {
            audioBuffer.push(msg.media.payload);

            // Only send audio if session is ready, otherwise queue it
            if (sessionReady) {
              // Send audio directly - Azure Voice Live natively supports g711_ulaw!
              voiceLiveWs.send(
                JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: msg.media.payload,
                })
              );
            } else {
              // Queue audio until session is ready
              audioQueue.push(msg.media.payload);
            }
          }
          break;

        case 'stop':
          console.log(`Stream stopped: ${streamSid}`);

          // Close VoiceLive connection
          if (voiceLiveWs) {
            voiceLiveWs.close();
          }

          // Save call data to blob storage
          await saveCallData(callSid, audioBuffer, transcript, intakeData);

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
      await saveCallData(
        callSid,
        session.audioBuffer,
        session.transcript,
        session.intakeData
      );
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
    const transcriptJson = JSON.stringify(transcript, null, 2);
    const transcriptBlob = containerClient.getBlockBlobClient(
      `${prefix}transcript.json`
    );
    await transcriptBlob.upload(transcriptJson, Buffer.byteLength(transcriptJson), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    // Save intake data
    const intakeJson = JSON.stringify(intakeData, null, 2);
    const intakeBlob = containerClient.getBlockBlobClient(`${prefix}intake.json`);
    await intakeBlob.upload(intakeJson, Buffer.byteLength(intakeJson), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    // Save recording metadata
    const recordingMetadata = {
      callSid,
      duration: audioBuffer.length,
      timestamp: new Date().toISOString(),
    };

    const recordingMetaJson = JSON.stringify(recordingMetadata, null, 2);
    const recordingMetaBlob = containerClient.getBlockBlobClient(
      `${prefix}recording.json`
    );
    await recordingMetaBlob.upload(
      recordingMetaJson,
      Buffer.byteLength(recordingMetaJson),
      {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      }
    );

    console.log(`Call data saved successfully for ${callSid}`);
  } catch (error) {
    console.error('Error saving call data:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Grace AI Receptionist server (Azure VoiceLive version) running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
});
