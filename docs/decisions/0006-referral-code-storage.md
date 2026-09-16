# ADR-0006 — Storing referral codes in readable form

- **Status:** accepted
- **Date:** 2026-08-14
- **Milestone:** M3 (S19 — Invite friends)
- **Decided by:** engineering. It narrows a security property established in Milestone 1, so it
  is recorded rather than made silently (§22).

## Context

Milestone 1 built the invitation ledger with one deliberate property, stated in the schema:

> Stores a SHA-256 digest, never the code, so a leaked backup yields no working invitations.

`invites.code_hash` holds the digest. Redemption hashes the submitted code and compares
digests, so nothing anywhere can recover a code from the database. That is the correct design
for founder and campaign codes, which are minted by an operator, handed out through some other
channel, and never need to be read back.

§S19 asks for something that design cannot do:

> Personal referral code, remaining invitations, share sheet and redemption count.

A referral code has to be shown to its owner, every time they open S19, on any device they
sign in from. A digest cannot be shown. Whatever else is decided, **something readable has to
exist somewhere**, and the only questions are where and who can reach it.

## Options considered

**1. Show the code once, at the moment it is minted.** Preserves the hash-only property
exactly. Rejected because it is not what §S19 describes — it asks for a screen, not a
one-time reveal — and because a code shown once and then lost is a referral that never happens.
It also fails the ordinary case of signing in on a new phone.

**2. Derive the code from the user id.** A deterministic function means nothing extra is
stored. Rejected: the derivation would have to be reversible or enumerable to be verified at
redemption, which makes every user's code computable from their id — strictly worse than
storing it, and much easier to get wrong.

**3. Encrypt the code with a key held outside the database.** Preserves the property against a
database-only leak. Rejected as disproportionate: it adds key management, key rotation and a
decryption path on a read that happens on every visit to S19, to protect something whose value
is analysed below. Worth revisiting if referral codes ever grant more than they do now.

**4. Store the plaintext for referral codes only, readable by the owner.** Chosen.

## Decision

`invites.code_plain` is populated **only** for referral invitations — those with
`owner_user_id` set — and a check constraint enforces that:

```sql
constraint code_plain_only_for_referrals
  check (code_plain is null or owner_user_id is not null)
```

Founder and campaign codes remain hash-only and are unaffected.

Access is one RLS policy:

```sql
create policy "invites: own referral" on public.invites
  for select to authenticated using (owner_user_id = auth.uid());
```

`invites` remains otherwise unreachable from any client session, exactly as Milestone 1 left
it. What opened is a single row per person: their own.

## What this costs

Stated plainly, because the point of writing it down is that a future reader can disagree.

A database leak would expose referral codes in usable form. What an attacker gains from one is
**the ability to register**, which is:

- still gated by manual operator review (§15.2) before the account can do anything;
- still limited to `referral_capacity()` seats — three — per code;
- worth nothing on its own, since the beta contains no content to read and nobody to message.

Compare that to what the hash protects in the founder-code case, where a leaked campaign code
with fifty seats would let someone flood the review queue. That asymmetry is why the two are
treated differently rather than uniformly.

What this does **not** weaken: no password, session token or personal record becomes readable.
`code_plain` is a random eight-character string with no relationship to the person it belongs
to, which is also what satisfies §S19's "shared link contains an opaque code, not the inviter's
user ID".

## Consequences

- S19 can show a code, its capacity and its redemption count, from one row, under one policy.
- The Edge Function that mints a code passes both halves — plaintext and digest — so hashing
  stays in `_shared/invite-code.ts` and minting and redeeming keep a single normalisation.
- `ensure_referral_invite` is idempotent, so a second device or a retried request finds the
  existing code rather than minting a rival one.
- If referral codes ever confer something beyond the ability to register — a bypassed review,
  a paid tier, an elevated role — this decision must be revisited before that ships. That is
  the trigger to watch for, and it is the reason this file exists rather than a code comment.
