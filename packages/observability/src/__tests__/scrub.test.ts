import { ConsoleErrorReporter } from '../reporter';
import { scrubError, scrubText, scrubValue } from '../scrub';

/**
 * Crash reporting is the likeliest privacy leak in the product, because nobody writes a stack
 * trace and so nobody reviews one. The code that produces the leak is `captureException(error)`
 * — which looks correct in every review it will ever get.
 *
 * So these tests are written as attacks: each one is a real string this app can produce, taken
 * from a URL it builds, a message a library throws, or a field a person typed. The assertion is
 * always the same — the personal part must not survive.
 */
describe('scrubText', () => {
  it('removes an email address from anywhere in a message', () => {
    expect(scrubText('Failed to sign in asha.sharma+beta@example.com')).not.toContain(
      'asha.sharma',
    );
  });

  /** The exact shape supabase-js produces on a failed filter — column values in the URL. */
  it('removes a Supabase query string carrying somebody’s suburb', () => {
    const url =
      'https://abc.supabase.co/rest/v1/student_profiles?select=*&suburb=eq.Ultimo&hometown=eq.Mohali';

    const scrubbed = scrubText(`Request failed: GET ${url}`);

    expect(scrubbed).not.toContain('Ultimo');
    expect(scrubbed).not.toContain('Mohali');
    // The host survives, which is what makes the report useful at all.
    expect(scrubbed).toContain('abc.supabase.co');
  });

  it('removes API keys and JWTs', () => {
    expect(scrubText('apikey: sb_publishable_s_SszST7DbCgJG-9j4czVQ_opSSFIhu')).not.toContain(
      'SszST7',
    );
    expect(
      scrubText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdef'),
    ).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('removes a user id', () => {
    expect(scrubText('no rows for aaaaaaaa-0000-0000-0000-000000000001')).not.toContain(
      'aaaaaaaa-0000',
    );
  });

  it('removes a device push token', () => {
    expect(scrubText('send failed for ExponentPushToken[xxxxxxxxxxxxxx]')).not.toContain(
      'xxxxxxxxxxxxxx',
    );
  });

  /** A feedback reference ties a report to the person who filed it. */
  it('removes a feedback reference', () => {
    expect(scrubText('while loading KYA-7F3K2Q')).not.toContain('KYA-7F3K2Q');
  });

  it('leaves an ordinary technical message alone', () => {
    const message = 'Unable to resolve module ./FeatureCard from BetaHomeScreen.tsx';
    expect(scrubText(message)).toBe(message);
  });
});

describe('scrubValue', () => {
  /**
   * The case pattern matching cannot solve. A suburb, a hometown and a course name are
   * ordinary words — 'Ultimo' is indistinguishable from any other capitalised token. What can
   * be recognised is the key, so these are dropped by name rather than by inspection.
   */
  it('drops values whose key names something this app collects', () => {
    const scrubbed = scrubValue({
      screen: 'S18',
      suburb: 'Ultimo',
      hometown: 'Mohali',
      course: 'Masters in AI',
      comment: 'My landlord Priya at 14 Wattle Street',
    }) as Record<string, unknown>;

    expect(scrubbed.screen).toBe('S18');
    expect(scrubbed.suburb).toBe('[redacted]');
    expect(scrubbed.hometown).toBe('[redacted]');
    expect(scrubbed.course).toBe('[redacted]');
    expect(scrubbed.comment).toBe('[redacted]');
  });

  it('reaches into nested objects and arrays', () => {
    const scrubbed = scrubValue({
      request: { headers: { authorization: 'Bearer abc123' } },
      users: [{ email: 'asha@example.com' }],
    });

    expect(JSON.stringify(scrubbed)).not.toContain('abc123');
    expect(JSON.stringify(scrubbed)).not.toContain('asha@example.com');
  });

  it('matches key names regardless of case', () => {
    const scrubbed = scrubValue({ Email: 'asha@example.com', DisplayName: 'Asha' }) as Record<
      string,
      unknown
    >;

    expect(scrubbed.Email).toBe('[redacted]');
    expect(scrubbed.DisplayName).toBe('[redacted]');
  });

  it('does not recurse forever', () => {
    const cyclic: Record<string, unknown> = { screen: 'S18' };
    cyclic.self = cyclic;

    expect(() => scrubValue(cyclic)).not.toThrow();
  });
});

describe('scrubError', () => {
  /**
   * Stacks are scrubbed as text rather than parsed. Frame formats differ across engines and
   * Hermes versions, and a parser that fails to recognise one stops redacting silently —
   * failing open on exactly the surface this exists to protect.
   */
  it('removes personal data from a stack trace, not only the message', () => {
    const error = new Error('Request failed');
    error.stack = [
      'Error: Request failed',
      '    at fetch (https://abc.supabase.co/rest/v1/profiles?user_id=eq.aaaaaaaa-0000-0000-0000-000000000001:1:1)',
      '    at submit (asha@example.com)',
    ].join('\n');

    const scrubbed = scrubError(error);

    expect(scrubbed.stack).not.toContain('aaaaaaaa-0000');
    expect(scrubbed.stack).not.toContain('asha@example.com');
    expect(scrubbed.stack).toContain('at fetch');
  });

  it('handles something thrown that is not an Error', () => {
    expect(scrubError('failed for asha@example.com').message).not.toContain('asha@example.com');
    expect(scrubError(undefined).name).toBe('NonError');
  });
});

describe('ConsoleErrorReporter', () => {
  /**
   * Asserts on what would have been **sent**, not on what was passed in. A test that checked
   * the input would prove nothing about what leaves the device, which is the only claim worth
   * making about this module.
   */
  it('stores the scrubbed report, not the original', () => {
    const reporter = new ConsoleErrorReporter();
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    reporter.captureException(new Error('sign-in failed for asha@example.com'), {
      screen: 'S02',
    });

    expect(reporter.reports[0]?.message).not.toContain('asha@example.com');
    expect(reporter.reports[0]?.context?.screen).toBe('S02');
    quiet.mockRestore();
  });

  it('scrubs breadcrumb data too', () => {
    const reporter = new ConsoleErrorReporter();

    reporter.addBreadcrumb({
      category: 'navigation',
      message: 'opened /review',
      data: { suburb: 'Ultimo' },
    });

    expect(reporter.breadcrumbs[0]?.data?.suburb).toBe('[redacted]');
  });
});
