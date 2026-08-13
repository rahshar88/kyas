import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { RegistrationDetail } from './RegistrationDetail';
import { SignIn } from './SignIn';
import { adminCall, supabase, type AuditRow, type QueueRow, type SearchRow } from './supabase';

type Tab = 'queue' | 'search' | 'audit';

/**
 * The console shell (§15.1).
 *
 * Note what authorisation is *not* here: this component asks `admin_whoami` once and hides the
 * interface if the answer is no. That is a courtesy, not a control. §15.2 — "never rely only
 * on hidden navigation for authorisation" — is satisfied by every Edge Function checking
 * `admin_users` on every request, so a non-operator who bypassed this check entirely would
 * still see nothing but empty arrays.
 */
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('queue');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Clears on sign-out so the next person to sign in is re-checked rather than inheriting
      // the previous answer.
      if (next === null) setIsAdmin(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) return;

    let cancelled = false;
    void adminCall<{ isAdmin: boolean }>({ action: 'whoami' })
      .then((result) => {
        if (!cancelled) setIsAdmin(result.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!ready) return <div className="layout muted">Loading…</div>;
  if (session === null) return <SignIn />;

  if (isAdmin === null) return <div className="layout muted">Checking access…</div>;

  if (!isAdmin) {
    return (
      <div className="layout" style={{ maxWidth: 420, paddingTop: 80 }}>
        <h1>No access</h1>
        <p className="muted">This account is not an operator.</p>
        <button onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="bar">
        <div>
          <h1>KyaScene operations</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {session.user.email}
          </p>
        </div>
        <div className="row">
          <nav>
            {(['queue', 'search', 'audit'] as Tab[]).map((value) => (
              <button
                key={value}
                aria-current={tab === value}
                onClick={() => {
                  setTab(value);
                  setSelected(null);
                }}
              >
                {value === 'queue' ? 'Queue' : value === 'search' ? 'Users' : 'Audit log'}
              </button>
            ))}
          </nav>
          <button onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      {selected !== null ? (
        <RegistrationDetail userId={selected} onDone={() => setSelected(null)} />
      ) : tab === 'queue' ? (
        <Queue onSelect={setSelected} />
      ) : tab === 'search' ? (
        <UserSearch onSelect={setSelected} />
      ) : (
        <AuditLog />
      )}
    </div>
  );
}

/** §15.1 "Registration queue" — oldest first, because waiting longest should be seen first. */
function Queue({ onSelect }: { onSelect: (userId: string) => void }) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [reloads, setReloads] = useState(0);

  /**
   * Refresh is a counter rather than a callback the effect depends on.
   *
   * The React Compiler lint rule rejects an effect that calls a function which sets state,
   * because it cannot see past the callback to know the write happens after an await. Bumping
   * a number and letting the effect own every write keeps the rule satisfied and — more
   * usefully — leaves exactly one place that can populate this list.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next = await adminCall<QueueRow[]>({ action: 'queue', state: 'pending' });
        if (!cancelled) setRows(next);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Could not load the queue.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  if (error) return <p className="error">{error}</p>;
  if (rows === null) return <p className="muted">Loading…</p>;

  if (rows.length === 0) {
    return (
      <div className="panel empty">
        <p style={{ margin: 0 }}>Nothing waiting for review.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>
          Awaiting review <span className="muted small">({rows.length})</span>
        </h2>
        <button onClick={() => setReloads((n) => n + 1)}>Refresh</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Suburb</th>
            <th>Waiting since</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} onClick={() => onSelect(row.user_id)}>
              <td>{row.display_name ?? <span className="muted">No name</span>}</td>
              <td>{row.provider ?? '—'}</td>
              <td>{row.suburb ?? '—'}</td>
              <td className="muted small">
                {new Date(row.submitted_at).toLocaleDateString('en-AU')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * §15.1 "User search and status".
 *
 * A search term is required, and the database refuses anything shorter than two characters —
 * §15.2 restricts exports, and a blank search returning every user is how an accidental one
 * happens.
 */
function UserSearch({ onSelect }: { onSelect: (userId: string) => void }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  const run = async () => {
    setError(undefined);
    try {
      setRows(await adminCall<SearchRow[]>({ action: 'search', search: query }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed.');
    }
  };

  return (
    <div className="panel stack">
      <h2>Find someone</h2>

      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <input
          aria-label="Search by name or email"
          placeholder="Name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: 1 }}
        />
        <button className="primary" type="submit" disabled={query.trim().length < 2}>
          Search
        </button>
      </form>

      {error ? <p className="error small">{error}</p> : null}

      {rows === null ? null : rows.length === 0 ? (
        <p className="muted small">Nobody matches that.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user_id} onClick={() => onSelect(row.user_id)}>
                <td>{row.display_name ?? <span className="muted">No name</span>}</td>
                <td className="small">{row.email}</td>
                <td>
                  <span className={`badge ${row.status}`}>{row.status.replace('_', ' ')}</span>
                </td>
                <td className="muted small">
                  {new Date(row.created_at).toLocaleDateString('en-AU')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** §15.1 "Audit log". Append-only in the database — nothing here can edit or remove a row. */
function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void adminCall<AuditRow[]>({ action: 'audit' })
      .then(setRows)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load the audit log.'),
      );
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (rows === null) return <p className="muted">Loading…</p>;

  if (rows.length === 0) {
    return (
      <div className="panel empty">
        <p style={{ margin: 0 }}>No administrative actions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Everything operators have done</h2>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>To</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ cursor: 'default' }}>
              <td className="small">{new Date(row.created_at).toLocaleString('en-AU')}</td>
              <td className="muted small">{row.actor_email}</td>
              <td className="small">{row.action.replace(/_/g, ' ')}</td>
              <td className="small">{row.target_name ?? '—'}</td>
              <td className="small">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
