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

    // `shouldCreateUser: false`: unlike the app, this must not mint an account. Someone typing
    // any address into the console should not become a user at all.
    await supabase.auth
      .signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
      .catch(() => undefined);

    /**
     * Advance whatever happened, and report nothing.
     *
     * The outcome of the send is information this screen must not leak: "no such user" would
     * confirm which addresses are operators, and that is the one question an attacker at this
     * form is asking. The copy on the next screen already says "if that address has access" —
     * a visible failure contradicts it.
     *
     * It is also what makes the screen usable. Reporting a rate limit left an operator holding
     * a valid code with no way to enter it, because the only route to the code field was a
     * successful send — the same dead end the app had at S02. Codes last an hour; failing to
     * send a new one says nothing about the one already in hand.
     */
    setSent(true);
    setBusy(false);
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
            <p className="small muted">If that address has access, a code is on its way to it.</p>
            <div className="field">
              <label htmlFor="code">Code from your email</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button
              className="primary"
              onClick={() => void verify()}
              disabled={busy || code.length < 6}
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
