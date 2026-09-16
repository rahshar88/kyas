# Runbook — connecting a Supabase project

Turning the built-but-unconnected Milestone 1 code into a working sign-in. About 15 minutes.

## Before you start

§5.2 requires **three separate projects** — development, beta and production — with separate
credentials, storage and push configuration. Start with development only. Beta arrives at
Milestone 4, production at national launch.

§22 reserves two decisions here for the founder: the **region** and the **paid plan**.
Recommended region is **Sydney (ap-southeast-2)**: the users are there, latency is lower, and
Australian student data stays in Australia, which is the easier answer for a privacy policy.

## 1. Create the project

supabase.com → **New project**

| Field             | Value                                          |
| ----------------- | ---------------------------------------------- |
| Name              | `kyascene-dev`                                 |
| Region            | Sydney (ap-southeast-2)                        |
| Database password | Generate one and save it to a password manager |

Provisioning takes a couple of minutes.

## 2. Collect the credentials

**Settings → API.** Three values matter, and the distinction between them is not cosmetic:

| Value                                                            | Where it goes                                | Safe to share?                              |
| ---------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| **Project URL**                                                  | `apps/mobile/.env`                           | Yes                                         |
| **publishable key** (`sb_publishable_…`, or a legacy `anon` JWT) | `apps/mobile/.env`                           | Yes — it is designed to ship inside the app |
| **secret key** (`sb_secret_…`, or a legacy `service_role` JWT)   | Supabase Edge Function secrets, nowhere else | **No. Never.**                              |

The `anon` key is safe in the app precisely because Row Level Security decides what it can
reach — that is what the policies in `supabase/migrations/20260808000200_rls.sql` are for. The
`service_role` key **bypasses every one of those policies**. It must never appear in the
mobile bundle, in `eas.json`, or in this repository (§5.3, §13.1), and `verify-eas-config.mjs`
fails CI if anything resembling it is committed.

## 3. Point the app at it

```bash
cd ~/kyas
```

```bash
open -e apps/mobile/.env
```

Set:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env` is gitignored and stays on your machine.

## 4. Apply the schema

Every command below assumes you are in the repository. Run each on its own line — typing a
path by itself makes zsh try to execute the folder:

```bash
cd ~/kyas
```

```bash
git pull
```

Always after a pull — dependencies change, and a stale `node_modules` produces confusing
failures further down:

```bash
pnpm install
```

Once per machine. This prints a verification code and opens your browser:

```bash
npx supabase login
```

Then, substituting your own ref:

```bash
pnpm run supabase:deploy your-ref
```

It prompts for the **database password** set when the project was created — not your Supabase
account password. Lost it? Dashboard → **Settings → Database → Reset database password**.

The ref is the subdomain of your project URL — for `https://abcdefgh.supabase.co` it is
`abcdefgh`. This applies the migrations, seeds the state and provider lists, and deploys the
`redeem-invite` Edge Function. It is idempotent, so re-running is safe.

## 5. Give the Edge Function its secret

The function needs the service-role key to redeem invitations, and that is the **only** place
that key belongs:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref your-ref
```

## 6. Confirm Row Level Security is actually on

**Database → Tables.** Every table must show **RLS enabled**. §13.1: _"Row Level Security
enabled before any beta user is added."_ The migrations set it, but confirming by eye costs
ten seconds and is the single highest-consequence check in this runbook.

## 7. Create yourself an invite code

The beta is invite-only (§S04). Codes are stored as a SHA-256 digest, never in plaintext, so
you insert the digest rather than the code. In **SQL Editor**:

```sql
-- Replace KYASCENE01 with your chosen code. Keep the code itself somewhere safe —
-- it cannot be recovered from the database.
insert into public.invites (code_hash, capacity, campaign)
values (encode(digest('KYASCENE01', 'sha256'), 'hex'), 50, 'founder');
```

If `digest` is unavailable, run `create extension if not exists pgcrypto;` first.

The code must be 6–16 characters, letters and digits only. Case and dashes do not matter — the
app and the Edge Function normalise identically.

## 8. Try it

```bash
pnpm run mobile:ios
```

Join the beta → your email → check your inbox for the 6-digit code → enter your invite code →
answer the four eligibility questions → study details → suburb → India background.

Force-close the app halfway through and reopen it. Your answers should still be there — that
is §S06's acceptance criterion, and the reason the draft is stored locally rather than only on
the server.

## Troubleshooting

**No email arrives, or the email has no 6-digit code.** There are two separate causes and they
look identical from the phone. Check both.

_Cause 1 — the built-in mailer is rate-limited._ Supabase's default email service allows
roughly **two messages per hour** on a free project. Retrying makes it worse, not better. You
can confirm it without guessing:

```bash
curl -s -X POST "https://YOUR-REF.supabase.co/auth/v1/otp" -H "apikey: YOUR-PUBLISHABLE-KEY" -H "Content-Type: application/json" -d '{"email":"you@example.com","create_user":true}'
```

`{"error_code":"over_email_send_rate_limit"}` means the limit, not a broken configuration.

_Cause 2 — the template sends a link, not a code._ This one is easy to miss because nothing
errors. Supabase's stock templates contain only `{{ .ConfirmationURL }}`, so the email arrives
with a "Confirm your email" button and no digits — while the app is asking for six of them
(§S03). Clicking the button goes to `http://localhost:3000`, the default Site URL, which is a
dead end on a phone.

**Two templates must both be edited**, and this is the part that catches people out — which one
Supabase sends depends on whether the address is already registered:

| Template           | Sent when                                              |
| ------------------ | ------------------------------------------------------ |
| **Confirm signup** | The address is new — a first-time tester               |
| **Magic Link**     | The address already exists — everyone signing in again |

Editing only one leaves half your testers stuck, and it will be whichever half you did not test
with. Under **Authentication → Email Templates**, set the body of **both** to:

```html
<h2>Your KyaScene code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
<p>If you didn't ask for this, ignore this email.</p>
```

`{{ .Token }}` is the six-digit code. Without it, no code will ever arrive no matter how long
you wait. Note there is no link in that body at all — the app is the only way in, so a link is
a phishing surface with no purpose (§4.7: no consumer web application).

While you are there, set **Authentication → URL Configuration → Site URL** to
`https://kyascene.app`. Nothing in the code-based flow uses it, but leaving it as
`http://localhost:3000` means any Supabase email that does contain a link points somewhere
broken.

**The real fix, needed before any tester exists.** Configure a custom SMTP provider under
**Authentication → Emails → SMTP Settings**. §20 expects the funnel to work in beta, and the
built-in mailer is explicitly not built for that — it is rate-limited and, on some plans,
delivers only to addresses on your Supabase organisation. Sender domain should be
`kyascene.app`.

Choosing the provider is a **§22 founder decision**: an email vendor processes tester email
addresses, which is personal data. Resend, Postmark and SendGrid all have free tiers that cover
a closed beta comfortably. Once chosen, record it as an ADR.

**"This invitation could not be used."** The digest does not match. Check the code is 6–16
alphanumeric characters and that `pgcrypto` was installed before the insert.

**A screen shows "We couldn't load…".** The reference catalogues did not seed. Re-run
`pnpm run supabase:deploy your-ref` and check the SQL Editor for rows in `india_states`.

**Sign-in succeeds but nothing follows.** Check `profiles` has a row for your user. If not,
RLS is blocking the insert — confirm the policies from `20260808000200_rls.sql` are present
under **Authentication → Policies**.
