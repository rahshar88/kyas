import { REJECTION_CATEGORIES, type RejectionCategory } from '@kyascene/domain';
import { useEffect, useState } from 'react';

import { adminCall, reviewRegistration, type AuditRow } from './supabase';

interface Detail {
  userId: string;
  displayName: string | null;
  email: string;
  status: string;
  study: Record<string, string | null>;
  location: Record<string, string | null>;
  india: Record<string, string | null>;
  languages: { label: string; proficiency: string }[];
  communities: string[];
  interests: string[];
  goals: string[];
  consents: { policy: string; version: string; accepted: boolean; at: string }[];
  review: { state: string; submittedAt: string; rejectionCategory: string | null } | null;
  invite: { campaign: string | null; redeemedAt: string } | null;
}

const CATEGORY_LABELS: Record<RejectionCategory, string> = {
  not_eligible: 'Not eligible',
  incomplete_information: 'Incomplete information',
  unable_to_verify_study: 'Could not verify study',
  duplicate_account: 'Duplicate account',
  safety_concern: 'Safety concern',
  other: 'Other',
};

/**
 * Registration detail and the approve/reject decision (§15.1).
 *
 * Two rules from §15.2 are enforced here rather than trusted to the operator:
 *
 * - **"Sensitive actions require a reason."** Both buttons stay disabled until a reason is
 *   typed. The database refuses a reasonless decision as well, so this is the courteous half
 *   of a guarantee that holds either way.
 * - **"Rejected users do not see private moderator notes."** The reason box is labelled as
 *   internal, and the student-facing outcome is the separate category dropdown. Two fields
 *   rather than one, because an operator writing a single note would reasonably assume the
 *   person reads it.
 */
export function RegistrationDetail({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<RejectionCategory>('incomplete_information');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [record, log] = await Promise.all([
          adminCall<Detail>({ action: 'detail', userId }),
          adminCall<AuditRow[]>({ action: 'audit', userId }),
        ]);
        if (!cancelled) {
          setDetail(record);
          setHistory(log);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      await reviewRegistration({
        userId,
        approve,
        reason: reason.trim(),
        ...(approve ? {} : { category }),
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That decision could not be recorded.');
      setBusy(false);
    }
  };

  if (error && detail === null) return <p className="error">{error}</p>;
  if (detail === null) return <p className="muted">Loading…</p>;

  const pending = detail.review?.state === 'pending';

  return (
    <div className="stack">
      <div className="row">
        <button onClick={onDone}>← Back to queue</button>
        <span className={`badge ${detail.status}`}>{detail.status.replace('_', ' ')}</span>
      </div>

      <div className="panel">
        <h2>{detail.displayName ?? 'No name given'}</h2>
        <p className="muted small">{detail.email}</p>

        <dl className="detail">
          <dt>Provider</dt>
          <dd>{detail.study.provider ?? '—'}</dd>
          <dt>Course</dt>
          <dd>{detail.study.course ?? '—'}</dd>
          <dt>Level</dt>
          <dd>{detail.study.level ?? '—'}</dd>
          <dt>Intake</dt>
          <dd>{detail.study.intake ?? '—'}</dd>
          <dt>Student email</dt>
          <dd>{detail.study.studentEmail ?? '—'}</dd>

          <dt>Suburb</dt>
          <dd>{detail.location.suburb ?? '—'}</dd>
          <dt>Arrival</dt>
          <dd>{detail.location.arrival ?? '—'}</dd>

          <dt>Indian state</dt>
          <dd>{detail.india.state ?? '—'}</dd>
          <dt>Hometown</dt>
          <dd>{detail.india.hometown ?? '—'}</dd>

          <dt>Languages</dt>
          <dd>
            {detail.languages.length === 0
              ? '—'
              : detail.languages.map((l) => `${l.label} (${l.proficiency})`).join(', ')}
          </dd>
          <dt>Communities</dt>
          <dd>{detail.communities.length === 0 ? '—' : detail.communities.join(', ')}</dd>
          <dt>Interests</dt>
          <dd>{detail.interests.length === 0 ? '—' : detail.interests.join(', ')}</dd>
          <dt>Goals, in order</dt>
          <dd>{detail.goals.length === 0 ? '—' : detail.goals.join(' → ')}</dd>

          <dt>Invitation</dt>
          <dd>{detail.invite ? (detail.invite.campaign ?? 'redeemed') : 'none'}</dd>
        </dl>
      </div>

      <div className="panel">
        <h2>Consent</h2>
        <table>
          <tbody>
            {detail.consents.map((consent) => (
              <tr key={`${consent.policy}-${consent.version}`}>
                <td>{consent.policy.replace(/_/g, ' ')}</td>
                <td className="muted small">v{consent.version}</td>
                <td className={consent.accepted ? 'ok' : 'muted'}>
                  {consent.accepted ? 'accepted' : 'declined'}
                </td>
                <td className="muted small">{new Date(consent.at).toLocaleDateString('en-AU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.consents.some((c) => c.policy === 'marketing' && !c.accepted) ? (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Marketing declined — this is optional and has no bearing on the decision (§S15).
          </p>
        ) : null}
      </div>

      {pending ? (
        <div className="panel stack">
          <h2>Decision</h2>

          <div className="field">
            <label htmlFor="reason">
              Reason — internal only, never shown to this person (§15.2)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What you checked, and what convinced you."
            />
          </div>

          <div className="field">
            <label htmlFor="category">If rejecting, what they will be told</label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as RejectionCategory)}
            >
              {REJECTION_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            <button
              className="primary"
              onClick={() => void decide(true)}
              disabled={busy || reason.trim().length < 3}
            >
              Approve
            </button>
            <button
              className="danger"
              onClick={() => void decide(false)}
              disabled={busy || reason.trim().length < 3}
            >
              Reject
            </button>
            {reason.trim().length < 3 ? (
              <span className="muted small">A reason is required for either decision.</span>
            ) : null}
          </div>

          {error ? (
            <p className="error small" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {detail.review === null
              ? 'This person has not submitted a registration.'
              : `Already ${detail.review.state}. Nothing to decide.`}
          </p>
        </div>
      )}

      <div className="panel">
        <h2>History</h2>
        {history.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            No administrative action recorded for this person yet.
          </p>
        ) : (
          <table>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="small">{new Date(entry.created_at).toLocaleString('en-AU')}</td>
                  <td className="small">{entry.action.replace(/_/g, ' ')}</td>
                  <td className="muted small">{entry.actor_email}</td>
                  <td className="small">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
