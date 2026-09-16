import * as SecureStore from 'expo-secure-store';

/**
 * Session storage backed by the platform keychain (§13.1: "SecureStore for refresh/session
 * secrets").
 *
 * Why this is not a one-line adapter: `expo-secure-store` warns above roughly 2 KB per
 * value, and a Supabase session — access token, refresh token and the user object — routinely
 * exceeds that. An oversized write can be rejected, which signs the tester out at random and
 * looks like a server bug. So values are split into fixed-size chunks across numbered keys,
 * with a small header recording how many there are.
 *
 * The failure mode this is designed around is a partial write: if chunk 3 of 5 fails, the
 * header is never written, so `getItem` finds no header and reports no session rather than
 * reconstructing a corrupt token. Signing in again is a recoverable outcome; a malformed
 * token in the keychain is not.
 */

/** Comfortably under the platform warning threshold, leaving room for key overhead. */
const CHUNK_SIZE = 1536;

const headerKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

/**
 * SecureStore rejects keys containing characters outside `[A-Za-z0-9._-]`. Supabase's key
 * includes the project ref and can contain others, so keys are sanitised consistently on
 * every path.
 */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function clearChunks(key: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(headerKey(key))];
  for (let index = 0; index < count; index += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, index)));
  }
  await Promise.all(deletions);
}

export const secureSessionStore = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);

    try {
      const header = await SecureStore.getItemAsync(headerKey(key));
      if (header === null) return null;

      const count = Number.parseInt(header, 10);
      if (!Number.isInteger(count) || count < 1) return null;

      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await SecureStore.getItemAsync(chunkKey(key, index));
        // A missing chunk means a torn write. Report "no session" rather than a broken one.
        if (part === null) return null;
        parts.push(part);
      }

      return parts.join('');
    } catch {
      // A keychain read can fail on a locked device or after a restore from backup.
      // Treating that as "signed out" is the only safe reading.
      return null;
    }
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);

    // Remove any previous, possibly longer, value first so no stale tail survives.
    const previous = await SecureStore.getItemAsync(headerKey(key));
    if (previous !== null) {
      await clearChunks(key, Number.parseInt(previous, 10) || 0);
    }

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    // Chunks first, header last: the header is what makes the value readable, so writing it
    // only after every chunk landed makes a partial write invisible rather than corrupt.
    for (const [index, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(chunkKey(key, index), chunk);
    }
    await SecureStore.setItemAsync(headerKey(key), String(chunks.length));
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const header = await SecureStore.getItemAsync(headerKey(key));
    await clearChunks(key, header === null ? 0 : Number.parseInt(header, 10) || 0);
  },
};
