/**
 * Content export fingerprint helpers.
 * Owns canonical stringification and hashing used for factual export fingerprints.
 */

/**
 * Computes the deterministic fingerprint for an export envelope's conversation payload.
 *
 * @param {Array<object>} conversations Enriched conversations.
 * @param {string} sourceUrl Source page URL.
 * @param {string} schemaVersion Schema version identifier.
 * @returns {string} Hex fingerprint payload without prefix.
 */
function computeEnvelopeFingerprint(conversations, sourceUrl, schemaVersion) {
  return hashFNV1aHex(stableStringify({ schemaVersion, sourceUrl, conversations }));
}

/**
 * Serializes a value with stable object key ordering for deterministic hashing.
 *
 * @param {*} value Value to stringify.
 * @returns {string} Stable JSON-like string.
 */
function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Computes an FNV-1a hash and returns it as an 8-character hex string.
 *
 * @param {string} text Input text to hash.
 * @returns {string} Hex hash string.
 */
function hashFNV1aHex(text) {
  let hash = 0x811c9dc5;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
