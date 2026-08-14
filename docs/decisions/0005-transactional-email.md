# ADR-0005 — Transactional email provider

- **Status:** accepted
- **Date:** 2026-08-13
- **Milestone:** M1 (the sign-in code) and M4 (beta operations)
- **Decided by:** founder, on the §22 reserved decision "analytics and error-reporting vendors,
  if they process personal data" — an email provider processes tester email addresses and falls
  under the same rule

## Context

Every KyaScene account starts with a six-digit code sent by email (§4.6: "Use email one-time
codes for the first beta"). If that email does not arrive, there is no product — no sign-in, no
registration, no beta.

Supabase's built-in mailer cannot do this job, for three reasons found in practice rather than
in documentation:

1. **Roughly two messages per hour** on a free project. A single tester making an ordinary
   number of attempts exhausts it, and the failure surfaces as
   `over_email_send_rate_limit` — which the app correctly shows as a rate-limit message, but
   which reads to a tester as "the app is broken".
2. **The templates cannot be edited without custom SMTP.** The dashboard states this directly:
   _"Set up custom SMTP to edit templates."_ The stock templates contain only
   `{{ .ConfirmationURL }}` and no `{{ .Token }}`, so the email that arrives has a confirm
   button and no digits, while S03 is asking for six of them. There is no configuration that
   fixes this while using the built-in mailer.
3. **The link in those stock templates points at `http://localhost:3000`**, the default Site
   URL — a dead end on a phone.

§20 requires the beta funnel to work end to end. It cannot, on the built-in mailer.

## Decision

**Resend, sending from the `kyascene.app` domain, as Supabase's custom SMTP provider.**

Rejected alternatives:

- **Brevo or SendGrid with a single verified sender.** Working in five minutes with no DNS
  changes, which was genuinely tempting under time pressure. Rejected because the sender
  address would not be `kyascene.app`, and a sign-in code arriving from an unrelated domain is
  both a deliverability problem and a trust problem for a product whose entire pitch is being a
  private, invitation-only community. It would also have to be redone before real testers, so
  the saved time is borrowed, not earned.
- **Amazon SES.** Cheapest at volume, and the right answer if send volume ever justifies it.
  Rejected for now because leaving the SES sandbox requires a support request that can take a
  day, so it does not unblock anything today. Revisit if monthly volume approaches five
  figures.

## Consequences

- The rate limit becomes Resend's — 3,000 messages a month and 100 a day on the free tier,
  which is far beyond what a closed beta consumes.
- Templates become editable, which is what allows `{{ .Token }}` to appear at all. Both
  **Confirm sign up** and **Magic link or OTP** must carry it: Supabase picks between them by
  whether the address already exists, so editing one leaves half of all testers stuck.
- Sign-in codes come from `kyascene.app`, which is also the domain that will host the privacy
  policy, terms and support pages required by §16.4 before any external build ships.
- **The Resend API key is an SMTP password.** It lives in the Supabase dashboard and nowhere
  else — not in `eas.json`, not in `.env`, not in this repository. It is not an
  `EXPO_PUBLIC_` value and never becomes one; §5.3 is explicit that provider secrets must never
  reach the mobile bundle. Nothing in the app sends email, so the app never needs it.
- Adds a third-party processor of tester email addresses, which the privacy policy must name.
  That policy wording is still an open §22 decision.
- DNS for `kyascene.app` now carries mail records, so the domain is no longer purely parked.
  The same DNS zone will later hold the AASA and assetlinks files for universal links (§4.5).

## Note on what this does not change

The app is unaffected. No dependency, no code path, no environment variable. Sending email is
entirely a Supabase-side concern, which is the reason the repository needed no change to adopt
this — and the reason switching provider later costs nothing but a dashboard edit.
