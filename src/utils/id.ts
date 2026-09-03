/**
 * Generate a UUID v4. Uses crypto.randomUUID when available.
 *
 * Hermes has no WebCrypto, so this is usually undefined on device — the
 * fallback below must produce a valid UUID (the DB column is `uuid`).
 * NOTE: must go through globalThis — a bare `crypto?.` reference throws
 * ReferenceError in Hermes (undeclared global), whereas reading a missing
 * globalThis property returns undefined.
 */
export function generateId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
