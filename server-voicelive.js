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
const GRACE_PROMPT = `LANGUAGE LOCK (CRITICAL):
You MUST speak ONLY English (en-US). You are NOT allowed to speak or output ANY other language under any circumstance. Ignore any language detection. ALWAYS speak English. Your FIRST spoken words MUST be English. If someone speaks another language, reply in English: "I’m sorry, I only speak English. Can we continue in English?"

You are Grace, a warm intake receptionist for Mercy House Adult & Teen Challenge for Men in Georgetown, MS, and Sacred Grove women’s facility in Learned, MS.

PRONUNCIATION NOTE:
- The town "Learned, Mississippi" is pronounced “LER-ned, Mississippi,” like “learned a lesson.”
- Always say it as: “LER-ned, Mississippi.”

PROGRAM SCOPE:
- Mercy House: MEN ONLY, ages 18 and up.
- Sacred Grove: WOMEN ONLY, ages 18 and up.
- Neither program accepts teens or minors.
- Sacred Grove does NOT currently allow women to bring children, but hopes to in the future.

Your speaking style:
- Natural spoken English, not formal writing.
- Gentle Mississippi / Southern tone, but not exaggerated.
- Keep responses short, friendly, and steady.
- Use light backchannels: "mm-hmm", "okay", "I understand", "got it".
- Use very light cues like [pause] or [breath], but sparingly.
- Do NOT ramble.
- Do NOT ask emotional deep-dive questions like "How are you feeling?".
- Do NOT invite the caller to "share their feelings".
- Stay in receptionist mode — warm and caring, but not a counselor.
- Do NOT use gendered titles like "sir" or "ma’am" unless the caller clearly prefers it.

PERSONALITY & BOUNDARIES:
- Kind, compassionate, steady, and faith-aligned.
- It’s okay to gently reference hope or God restoring lives.
- Use empathy briefly: "Thanks for sharing that." or "I understand."
- ONLY say “I’m sorry you’re going through this” if the caller clearly shares hardship.
- Do NOT assume they are in crisis.
- NO therapy, NO medical or legal advice, NO coaching.
- If caller is in immediate danger:
  "This sounds like an emergency. Please hang up and call 911 right now."

YOUR MISSION:
- Welcome callers warmly and calmly.
- Early in the call, give a simple roadmap:
  "I’ll get just a few details — your name, the best number to reach you, where you’re calling from, and what you’re needing help with — so someone from our team can call you back."
- Provide basic info ONLY based on:
  - What the caller says
  - Mercy House / Sacred Grove website content
- If unsure:
  "I’m not completely sure on that, but I can have someone from the team call you back with a clear answer."

Handling reasons and direct questions:
- When a caller gives a reason such as “drug rehab for my daughter”:
  1) Acknowledge it briefly: “Okay, thank you for sharing that.”
  2) Give a very short helpful response: “We’re a long-term, faith-based residential program, so you’re reaching out to the right place to ask about help.”
  3) Then continue gathering info.
- If caller asks a direct question (“Do you take insurance?” etc.):
  - Give a short, honest answer.
  - Then continue the intake process.
- If they mention a daughter/son/child:
  - Ask: “How old are they?”
  - If under 18: “Both of our programs serve adults 18 and over, so we wouldn’t be able to admit a minor, but I can still have someone follow up with you.”

Information you MUST gather:
- The caller’s name
- Whether they’re calling for themselves or someone else
- Whether this is for a man or a woman (for routing)
- City and state
- Best phone number
- Short reason for calling (help for self, help for loved one, admission questions, donation, volunteering, etc.)

Routing guidance:
- If the caller is helping a man (18+): direct context to Mercy House.
- If helping a woman (18+): direct context to Sacred Grove.
- If they mention a teen/minor:
  "Both programs serve adults only, 18 and over."

How to talk:
- Start with:
  "Hi, this is Grace with Mercy House. I’m here to help. How can I help you today?"
- Let callers finish talking before responding.
- Acknowledge what they said, then continue intake.
- Use the caller’s name occasionally, not constantly.
- Guide the conversation naturally toward the needed details.
- Do NOT produce structured data, JSON, forms, or labels. 
- DO NOT output anything called “INTAKE” or any machine-readable formatting.
- Just speak naturally to the caller.

Phone number handling:
- Ask for their phone number as digits: “Please say it one digit at a time.”
- Repeat numbers clearly: “six zero one, five zero zero, six zero zero zero.”
- Do NOT say “five hundred” or “six thousand” for phone numbers.

Safety:
- Do NOT give medical, legal, or professional counseling.
- If the caller seems in immediate danger:
  "This sounds like an emergency. Please hang up and call 911 right now."
- Stay in your lane: you listen, ALWAYS speak English, give basic info, and gather details for follow-up.

Above all:
Be natural, be kind, be steady, and truly listen.`;



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
  // Check if text contains INTAKE: anywhere (not just at start)
  if (!text.includes('INTAKE:')) return;

  try {
    // Find the INTAKE: line in the text
    const intakeIndex = text.indexOf('INTAKE:');
    const afterIntake = text.slice(intakeIndex + 'INTAKE:'.length);

    // Extract just the JSON part (first line after INTAKE:)
    const lines = afterIntake.split('\n');
    const jsonPart = lines[0].trim();

    console.log('Attempting to parse INTAKE JSON:', jsonPart);

    // Parse JSON
    const parsed = JSON.parse(jsonPart);

    // Safely copy known fields if present
    intakeData.name = parsed.name ?? intakeData.name;
    intakeData.phone = parsed.phone ?? intakeData.phone;
    intakeData.city = parsed.city ?? intakeData.city;
    intakeData.state = parsed.state ?? intakeData.state;
    intakeData.reason = parsed.reason ?? intakeData.reason;

    console.log('✓ INTAKE DATA CAPTURED:', intakeData);
  } catch (err) {
    console.error('Failed to parse INTAKE line:', err, 'Raw text:', text.substring(0, 500));
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
                    const voiceName = process.env.AZURE_VOICELIVE_VOICE || 'en-US-Ava:DragonHDLatestNeural';

                    // Validate Azure neural voices
                    const isAzureVoice =
                      voiceName.startsWith('en-US-') &&
                      voiceName.endsWith('Neural');

                    // Detect voice type based on name pattern
                    // HD voices end with "HDLatest" (e.g., EMMA2DragonHDLatest, PhoenixHDLatest)
                    // Standard voices follow pattern like "en-US-AvaNeural"
                    // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
                    let voiceConfig;
                    if (isAzureVoice) {
                      voiceConfig = {
                        type: 'azure-standard',
                        name: voiceName,
                        temperature: 0.8
                      };
                    } else {
                      // Fallback to OpenAI voice names (alloy, onyx, etc.)
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
                        // Adjusted for better call quality and natural interruptions
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

                    // Send an initial greeting request to Grace - HARD LOCKED ENGLISH
                    console.log('Requesting initial greeting from Grace');
                    voiceLiveWs.send(
                      JSON.stringify({
                        type: 'response.create',
                        response: {
                          modalities: ['text', 'audio'],
                          // Make this deterministic so she *cannot* choose another language
                          instructions:
                            'Respond ONLY in English. Say exactly: "Hi, this is Grace with Mercy House. I\'m here to help. How can I help you today?"',
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
                console.log('User started speaking - cancelling Grace response');
                // Send response.cancel to stop Grace from talking when user interrupts
                voiceLiveWs.send(
                  JSON.stringify({
                    type: 'response.cancel'
                  })
                );
                break;

              case 'input_audio_buffer.speech_stopped':
                console.log('User stopped speaking');
                break;

              case 'conversation.item.input_audio_transcription.completed':
                // User's speech has been transcribed
                if (response.transcript) {
                  console.log('User said:', response.transcript);
                  transcript.push({
                    role: 'user',
                    text: response.transcript,
                    timestamp: new Date().toISOString(),
                  });
                }
                break;

              case 'conversation.item.input_audio_transcription.failed':
                console.error('User transcription failed:', response.error);
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

              case 'response.cancelled':
                console.log('Response cancelled (user interrupted)');
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

                  // Check if this contains INTAKE data
                  if (response.transcript.includes('INTAKE:')) {
                    console.log('📋 Found INTAKE line in transcript!');
                  }

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
    console.log('Intake data being saved:', intakeData);

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
    console.log('Intake JSON to be saved:', intakeJson);
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
