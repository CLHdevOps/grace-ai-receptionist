require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const { BlobServiceClient } = require('@azure/storage-blob');
const OpenAI = require('openai');
const WebSocket = require('ws');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 8080;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // reserved for future use

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

Your speaking style:
- Speak in natural *spoken* English, not formal written English.
- Use contractions (“I’m”, “we’re”, “don’t”) and everyday phrasing.
- Vary sentence length and cadence; avoid monotone or predictable patterns.
- Add soft, natural pauses (“hmm,” “okay…,” “I hear you”) when appropriate.
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
- Faith-aligned; it’s okay to gently reference hope, prayer, or God’s ability to restore lives.
- Professional but human—sound like a real receptionist, not a narrator.

Your mission:
- Greet callers warmly and make them feel safe.
- Listen carefully, respond with empathy, and never rush them.
- Answer questions using ONLY:
  • What the caller tells you  
  • Information provided from the Mercy House website (included in your system context)
- If unsure, say something like:
  “I’m not completely sure on that detail, but I can have someone from Mercy House call you back with a clear answer.”
- Your goal is to collect callback info for a real staff member to follow up.

Information you MUST gather before ending the call:
- Caller’s name  
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

Example format (do NOT say “example” out loud):
INTAKE: {"name":"John Doe","phone":"+1601XXXXXXX","city":"Brandon","state":"MS","reason":"Asking about admission for a family member"}

Do NOT speak the word “INTAKE” to the caller. Continue the conversation naturally, but still send the machine-readable line.

How to talk:
- Start with something like:
  “Hi, this is Grace with Mercy House. I’m here to help. How are you doing today?”
- Let callers finish their thoughts. Use gentle, empathetic backchanneling (“mm-hmm”, “I understand”).
- Guide the conversation toward the info you need without sounding like a form.
- Use the caller’s name occasionally, not constantly.

Safety:
- Do NOT give medical, legal, or professional counseling.
- If the caller seems in immediate danger:
  “This sounds like an emergency. Please hang up and call 911 right now.”
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
    reason: null,
  };

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

          // Connect to OpenAI Realtime API
          openAiWs = new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
            {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1',
              },
            }
          );

          openAiWs.on('open', async () => {
            console.log('Connected to OpenAI Realtime API');

            // Fetch Mercy House website content to give Grace real context
            const mercyContext = await fetchMercyHouseContent();

            // Build instructions with website reference data appended
            const fullInstructions = `${GRACE_PROMPT}

Below is reference information from the Mercy House Adult & Teen Challenge website.
Use this ONLY as background knowledge to answer questions.
Do NOT read this text out loud or mention that you can "see the website".

${mercyContext}`;

            // Configure session for speech-to-speech
openAiWs.send(
  JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: fullInstructions,

      // Voice selection
      voice: "cedar",

      // Twilio codec
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",

      // Natural turn-taking
      turn_detection: {
        type: "server_vad",
        threshold: 0.42,
        prefix_padding_ms: 250,
        silence_duration_ms: 650
      }
    }
  })
);

            // Send an initial greeting request to Grace
            // This makes Grace speak first instead of waiting for the caller
            console.log('Requesting initial greeting from Grace');
            openAiWs.send(
              JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: 'Greet the caller warmly as instructed in your system prompt.',
                },
              })
            );
          });

          openAiWs.on('message', (data) => {
            const response = JSON.parse(data);

            // Handle different OpenAI event types
            switch (response.type) {
              case 'response.audio.delta':
                // Send audio back to Twilio
                if (response.delta) {
                  ws.send(
                    JSON.stringify({
                      event: 'media',
                      streamSid: streamSid,
                      media: {
                        payload: response.delta,
                      },
                    })
                  );
                }
                break;

              case 'response.audio_transcript.done':
              case 'conversation.item.created': {
                const text =
                  response.transcript || response.item?.formatted?.transcript;
                if (text) {
                  transcript.push({
                    role: response.role || 'assistant',
                    text,
                    timestamp: new Date().toISOString(),
                  });

                  // Try to extract intake data if this is the special INTAKE line
                  updateIntakeFromText(text, intakeData);
                }
                break;
              }

              case 'error':
                console.error('OpenAI error:', response.error);
                break;

              default:
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
        }

        case 'media':
          // Forward audio to OpenAI
          if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            audioBuffer.push(msg.media.payload);

            openAiWs.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
              })
            );
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

        default:
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

    // Optional: Send notification to staff
    // await sendNotification(callSid, intakeData);
  } catch (error) {
    console.error('Error saving call data:', error);
  }
}

// Optional: Send notification function (implement as needed)
async function sendNotification(callSid, intakeData) {
  console.log(`Notification would be sent for call ${callSid}`, intakeData);
}

// Start server
app.listen(PORT, () => {
  console.log(`Grace AI Receptionist server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
});
