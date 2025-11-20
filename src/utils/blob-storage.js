/**
 * Azure Blob Storage Utilities
 *
 * Handles saving call data to Azure Blob Storage.
 */

const { BlobServiceClient } = require('@azure/storage-blob');

// Initialize Blob Storage client
let containerClient = null;

/**
 * Initialize Blob Storage container client
 */
function initBlobStorage() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || 'calls';

  if (!connectionString) {
    console.warn('AZURE_STORAGE_CONNECTION_STRING not set. Blob storage will not be available.');
    return null;
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);

  return containerClient;
}

/**
 * Save call data to Azure Blob Storage
 *
 * @param {string} callSid - Twilio call SID
 * @param {array} audioBuffer - Audio buffer chunks
 * @param {array} transcript - Conversation transcript
 * @param {object} intakeData - Caller intake information
 */
async function saveCallData(callSid, audioBuffer, transcript, intakeData) {
  if (!containerClient) {
    console.warn('Blob storage not initialized. Skipping save.');
    return;
  }

  try {
    console.log(`Saving call data for ${callSid}`);

    const prefix = `calls/${callSid}/`;

    // Save transcript
    const transcriptJson = JSON.stringify(transcript, null, 2);
    const transcriptBlob = containerClient.getBlockBlobClient(`${prefix}transcript.json`);
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
    const recordingMetaBlob = containerClient.getBlockBlobClient(`${prefix}recording.json`);
    await recordingMetaBlob.upload(recordingMetaJson, Buffer.byteLength(recordingMetaJson), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });

    console.log(`Call data saved successfully for ${callSid}`);
  } catch (error) {
    console.error('Error saving call data:', error);
  }
}

module.exports = {
  initBlobStorage,
  saveCallData,
};
