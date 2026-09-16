/**
 * Removes personal data from anything on its way to an error-reporting vendor.
 *
 * §13.2 minimises what KyaScene holds, and §14.3 allowlists what analytics may carry. Crash
 * reporting has neither protection by default, and it is the likeliest place for a leak in the
 * whole product: nobody writes a stack trace, so nobody reviews one. A crash inside a form
 * handler carries the field value in a frame. A failed request carries the URL, and Supabase
 * puts identifiers in URLs. A breadcrumb records the email somebody just typed.
 *
 * None of that is caught by review, because the code that produces it looks like
 * `captureException(error)`.
 *
 * So scrubbing happens here, before the adapter, rather than being configured in a vendor
 * dashboard. Two reasons: a rule in a dashboard is not in the repository, cannot be tested and
 * is invisible to anyone reading this code; and by the time a vendor filters, the data has
 * already left the device and crossed a border, which is the part that matters legally.
 *
 * The list is deliberately aggressive. A redacted stack trace is still a usable stack trace,
 * and the cost of over-redacting is a slightly harder debugging session — against a cost of
 * under-redacting that is a personal data breach.
 */

const REDACTED = '[redacted]';

/**
 * Patterns replaced anywhere they appear in a message, a frame or a breadcrumb.
 *
 * Ordered most specific first, because an email inside a URL should be redacted as an email
 * rather than surviving inside a partly-redacted query string.
 */
const PATTERNS: { name: string; pattern: RegExp }[] = [
  // Email addresses. The single most likely thing to appear, since every account is one.
  {
    name: 'email',
    pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
  },
  // Supabase and GoTrue tokens: `sb_publishable_…`, `sb_secret_…`, and JWTs.
  {
    name: 'token',
    pattern: /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g,
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g,
  },
  // Expo push tokens identify a device.
  {
    name: 'push-token',
    pattern: /Expo(?:nent)?PushToken\[[^\]]+\]/g,
  },
  // Bearer headers, whatever they carry.
  {
    name: 'authorization',
    pattern: /\b(bearer|apikey|authorization)[=:\s]+\S+/gi,
  },
  // Query strings. Supabase filters put column values — a suburb, a name — into the URL.
  {
    name: 'query',
    pattern: /\?[^\s"']{2,}/g,
  },
  // UUIDs: every user id in the system.
  {
    name: 'uuid',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  },
  // Invitation and referral codes, which are shaped like KYASCENE01 or ASHA01.
  {
    name: 'invite-code',
    pattern: /\b(?:code|invite|referral)[=:\s"']+[A-Z0-9]{6,16}\b/gi,
  },
  // §S20 feedback references. Not sensitive alone, but they tie a report to a person.
  {
    name: 'feedback-reference',
    pattern: /\bKYA-[A-Z2-9]{6}\b/g,
  },
];

export function scrubText(input: string): string {
  let output = input;
  for (const { pattern } of PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  return output;
}

/**
 * Keys whose *values* are dropped wholesale, whatever they contain.
 *
 * Pattern matching cannot recognise a suburb, a hometown or a course name — they are ordinary
 * words. What can be recognised is the key they arrive under, so anything named after a field
 * this product collects is removed by name rather than by inspection.
 */
const FORBIDDEN_KEYS = new Set(
  [
    'email',
    'student_email',
    'studentEmail',
    'password',
    'token',
    'access_token',
    'refresh_token',
    'apikey',
    'api_key',
    'authorization',
    'display_name',
    'displayName',
    'name',
    'suburb',
    'postcode',
    'hometown',
    'course',
    'campus',
    'comment',
    'reason',
    'body',
    'code',
    'code_plain',
    'avatar_path',
    'screenshot_path',
  ].map((key) => key.toLowerCase()),
);

/** Depth limit, because a cyclic or enormous object should not become an enormous report. */
const MAX_DEPTH = 6;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return REDACTED;

  if (typeof value === 'string') return scrubText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((entry) => scrubValue(entry, depth + 1));

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = FORBIDDEN_KEYS.has(key.toLowerCase()) ? REDACTED : scrubValue(entry, depth + 1);
    }
    return output;
  }

  // Functions, symbols, bigints: not worth reporting and not worth guessing about.
  return REDACTED;
}

/**
 * An error, ready to send.
 *
 * The stack is scrubbed as text rather than parsed. Frame formats differ across engines and
 * across Hermes versions, and a parser that fails to recognise one silently stops redacting —
 * failing open on exactly the surface this exists to protect.
 */
export function scrubError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: scrubText(error.message),
      ...(error.stack === undefined ? {} : { stack: scrubText(error.stack) }),
    };
  }

  return { name: 'NonError', message: scrubText(String(error)) };
}
