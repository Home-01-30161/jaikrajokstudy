// ─────────────────────────────────────────────────────────────────────────────
// encryption.js — AES-256-GCM encryption for PDPA compliance
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derive a 32-byte key from ENCRYPTION_KEY env var using SHA-256
 * @returns {Buffer}
 */
function getKey() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }
  // Use SHA-256 to ensure we always have exactly 32 bytes
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} plaintext
 * @returns {string} Base64-encoded: iv + authTag + salt + ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH); // Additional entropy

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Format: iv(16) + authTag(16) + salt(32) + encrypted
  const combined = Buffer.concat([
    iv,
    authTag,
    salt,
    Buffer.from(encrypted, "base64"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {string} ciphertext Base64-encoded encrypted data
 * @returns {string} Decrypted plaintext
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return null;

  const key = getKey();
  const combined = Buffer.from(ciphertext, "base64");

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const salt = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH + SALT_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH + SALT_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, null, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Hash sensitive data for anonymization (one-way)
 * @param {string} data
 * @returns {string} SHA-256 hash
 */
export function anonymize(data) {
  return createHash("sha256").update(data).digest("hex");
}
