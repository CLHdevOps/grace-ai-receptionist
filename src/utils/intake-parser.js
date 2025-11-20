/**
 * Intake Data Parser
 *
 * Parses structured intake data from Grace's conversation transcripts.
 */

/**
 * Parse an "INTAKE: {json}" line from Grace into the intakeData object.
 *
 * @param {string} text - The text to parse
 * @param {object} intakeData - The intake data object to update
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

/**
 * Create a new intake data object with optional initial values
 *
 * @param {object} initialData - Initial data (e.g., phone from Twilio)
 * @returns {object} Intake data object
 */
function createIntakeData(initialData = {}) {
  return {
    name: initialData.name || null,
    phone: initialData.phone || null,
    city: initialData.city || null,
    state: initialData.state || null,
    reason: initialData.reason || null,
  };
}

module.exports = {
  updateIntakeFromText,
  createIntakeData,
};
