/**
 * Azure Voice Live Configuration
 *
 * This module handles all Azure Voice Live API configuration settings.
 */

module.exports = {
  /**
   * Get Azure Voice Live WebSocket URL
   * Converts HTTPS endpoint to WSS and adds required path and parameters
   */
  getWebSocketUrl() {
    const endpoint = process.env.AZURE_VOICELIVE_ENDPOINT;
    const model = process.env.AZURE_VOICELIVE_MODEL || 'gpt-realtime';
    const apiVersion = process.env.AZURE_VOICELIVE_API_VERSION || '2025-10-01';

    if (!endpoint) {
      throw new Error('AZURE_VOICELIVE_ENDPOINT environment variable is required');
    }

    // Convert HTTPS to WSS for WebSocket connection
    const wsEndpoint = endpoint.replace('https://', 'wss://');
    return `${wsEndpoint}/voice-live/realtime?api-version=${apiVersion}&model=${model}`;
  },

  /**
   * Get authentication headers for Voice Live API
   */
  getAuthHeaders() {
    const apiKey = process.env.AZURE_VOICELIVE_API_KEY;

    if (!apiKey) {
      throw new Error('AZURE_VOICELIVE_API_KEY environment variable is required');
    }

    return {
      'api-key': apiKey,
    };
  },

  /**
   * Get voice configuration
   * Detects if it's an HD voice and returns proper configuration
   */
  getVoiceConfig() {
    const voiceName = process.env.AZURE_VOICELIVE_VOICE || 'DragonHDLatest';

    // Detect voice type based on name pattern
    // HD voices end with "HDLatest" (e.g., DragonHDLatest, PhoenixHDLatest)
    // Standard voices follow pattern like "en-US-AvaNeural"
    const isHDVoice = voiceName.includes('HDLatest');
    const voiceType = isHDVoice ? 'azure-hd' : 'azure-standard';

    return {
      name: voiceName,
      type: voiceType,
      temperature: parseFloat(process.env.AZURE_VOICELIVE_VOICE_TEMP || '0.8'),
    };
  },

  /**
   * Get session configuration for Voice Live API
   */
  getSessionConfig(instructions) {
    const voiceConfig = this.getVoiceConfig();

    return {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: instructions,

        // Voice configuration
        voice: voiceConfig,

        // Audio format - g711_ulaw is natively supported by Azure Voice Live
        // This matches Twilio's format exactly (no transcoding needed)
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',

        // Response temperature
        temperature: parseFloat(process.env.AZURE_VOICELIVE_RESPONSE_TEMP || '0.8'),

        // Speaking rate (1.0 = normal)
        output_audio_speed: parseFloat(process.env.AZURE_VOICELIVE_SPEAKING_RATE || '1.0'),

        // Azure Semantic VAD - understands meaning and intent, not just silence
        turn_detection: {
          type: 'azure_semantic_vad',
          threshold: parseFloat(process.env.AZURE_VOICELIVE_VAD_THRESHOLD || '0.3'),
          silence_duration_ms: parseInt(process.env.AZURE_VOICELIVE_VAD_SILENCE_MS || '200', 10),
          interrupt_response: true,
          remove_filler_words: true,
        },

        // Audio enhancement features
        input_audio_noise_reduction: {
          type: 'azure_deep_noise_suppression',
        },
        input_audio_echo_cancellation: {
          type: 'server_echo_cancellation',
        },
      },
    };
  },

  /**
   * Get greeting request configuration
   */
  getGreetingConfig() {
    return {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Greet the caller warmly as instructed in your system prompt.',
      },
    };
  },

  /**
   * Get audio buffer append message
   */
  getAudioAppendMessage(audioPayload) {
    return {
      type: 'input_audio_buffer.append',
      audio: audioPayload,
    };
  },

  /**
   * Validate environment variables
   */
  validateConfig() {
    const required = [
      'AZURE_VOICELIVE_ENDPOINT',
      'AZURE_VOICELIVE_API_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
  },
};
