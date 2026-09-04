// ─────────────────────────────────────────────────────────────────────────────
// privacy.js — PDPA helpers used across the API
//
// Wraps encryption.js with safe fallbacks so that:
//   1. Legacy rows stored as plaintext (before AES-256 was enabled) still
//      decrypt gracefully — decryptText() returns the original value.
//   2. If ENCRYPTION_KEY is missing (local dev without .env), encryption is
//      skipped instead of crashing the server.
//   3. LINE User IDs are always stored as a one-way SHA-256 hash (anonymized),
//      never the raw ID.
// ─────────────────────────────────────────────────────────────────────────────
import { encrypt, decrypt, anonymize } from "./encryption.js";

let warnedNoKey = false;
let warnedDecrypt = false;

/** True when AES-256-GCM is configured (ENCRYPTION_KEY present). */
export function isEncryptionEnabled() {
  return Boolean(process.env.ENCRYPTION_KEY);
}

/**
 * Encrypt text for storage. Falls back to plaintext (with a one-time warning)
 * when ENCRYPTION_KEY is not set — deployment must never crash over this.
 */
export function encryptText(plaintext) {
  if (plaintext == null || plaintext === "") return plaintext;
  if (!isEncryptionEnabled()) {
    if (!warnedNoKey) {
      console.warn("[privacy] ENCRYPTION_KEY not set — storing chat text in plaintext. Set APP_ENCRYPTION_KEY in GitLab CI/CD.");
      warnedNoKey = true;
    }
    return plaintext;
  }
  try {
    return encrypt(String(plaintext));
  } catch (err) {
    if (!warnedDecrypt) {
      console.warn("[privacy] encrypt() failed:", err.message, "— falling back to plaintext");
      warnedDecrypt = true;
    }
    return String(plaintext);
  }
}

/**
 * Decrypt text read from storage. If the value is not valid AES-256-GCM
 * ciphertext (legacy plaintext row), returns it unchanged.
 */
export function decryptText(ciphertext) {
  if (ciphertext == null || ciphertext === "") return ciphertext;
  if (!isEncryptionEnabled()) return ciphertext;
  try {
    return decrypt(String(ciphertext));
  } catch {
    return ciphertext; // legacy plaintext row
  }
}

/**
 * One-way anonymization of a LINE / web User ID (SHA-256 hex).
 * Use this EVERYWHERE a user id is persisted or used as a DB key.
 */
export function hashId(rawId) {
  return anonymize(String(rawId ?? ""));
}