import { useState } from 'react';

import { supabase } from './supabase';

/**
 * Admin sign-in (§15.1).
 *
 * The same email one-time code as the app, on purpose. §15.2 says "admin roles are separate
 * from student roles" — separate *roles*, not separate credentials — so authority comes from
 * membership of `admin_users`, not from a second password nobody would rotate.
 *
 * There is no sign-up. An operator exists because someone inserted a row; a console that could
 * create its own administrators would be the most valuable thing to phish in the company.
 *
 * The screen never says whether an address is an operator's. Every failure looks the same, so
 * this form cannot be used to enumerate who has access.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const request = async () => {
    setBusy(true);
    setError(undefined);
    try {
      // `shouldCreateUser: false`: unlike the app, this must not mint an account. Someone
      // typing any address into the console should not become a user at all.
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      // A deliberate no-op on failure. Reporting "no such user" here would confirm which
      // addresses exist, so the screen advances either way and a non-operator simply never
      // receives a code.
      if (sendError && sendError.status !== 400) throw sendError;
      setSent(true);
    } catch {
      setError('Could not send a code. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (verifyError) throw verifyError;
      // Signing in succeeds for any KyaScene account. Whether this one may see anything is
      // decided by `admin_whoami` in App.tsx — and by the database on every single request.
    } catch {
      setError('That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="layout" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>KyaScene operations</h1>
      <p className="muted small">Internal. Authorised operators only.</p>

      <div className="panel stack" style={{ marginTop: 24 }}>
        {!sent ? (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              className="primary"
              onClick={() => void request()}
              disabled={busy || email.trim().length < 5}
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <p className="small muted">
              If that address has access, a six-digit code is on its way to it.
            </p>
            <div className="field">
              <label htmlFor="code">Six-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="primary"
              onClick={() => void verify()}
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button onClick={() => setSent(false)} disabled={busy}>
              Use a different email
            </button>
          </>
        )}

        {error ? (
          <p className="error small" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
