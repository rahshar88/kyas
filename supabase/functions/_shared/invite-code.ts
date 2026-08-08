/**
 * Invite code normalisation and hashing (spec §S04, §11.1).
 *
 * The plaintext code is never stored. `invites.code_hash` holds this digest, so a leaked
 * database backup yields no working invitations.
 *
 * Normalisation matters as much as hashing: a tester typing a code off a screenshot will
 * introduce case differences, spaces and dashes, and §S02's principle of forgiving input
 * applies here too. Both the generator and the redeemer must use this function, or a
 * perfectly valid code will silently fail to match.
 */
export function normaliseInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

export async function hashInviteCode(raw: string): Promise<string> {
  const normalised = normaliseInviteCode(raw);
  const bytes = new TextEncoder().encode(normalised);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Codes are short enough to read aloud but long enough not to be guessable by hand. */
export function isPlausibleInviteCode(raw: string): boolean {
  const normalised = normaliseInviteCode(raw);
  return /^[A-Z0-9]{6,16}$/.test(normalised);
}
