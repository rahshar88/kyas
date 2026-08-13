# Runbook — sign-in emails that actually arrive

Every KyaScene account begins with a six-digit code sent by email. This runbook sets up the
only configuration in which that works.

**Why this is not optional.** Supabase's built-in mailer sends roughly two messages an hour,
and — the part that blocks everything — **its templates cannot be edited without custom SMTP**.
The stock templates contain a confirmation link and no `{{ .Token }}`, so the email arrives
with a button and no digits while the app is asking for six of them. There is no setting that
fixes that on the built-in mailer.

Provider choice and reasoning: [ADR-0005](../decisions/0005-transactional-email.md).

Total time: about 15 minutes, plus DNS propagation.

## 1. Create the Resend account

Sign up at **resend.com**. The free tier covers 3,000 messages a month and 100 a day, which is
far beyond a closed beta.

## 2. Add and verify the domain

**Domains → Add Domain →** `kyascene.app`.

Resend then shows a set of DNS records — an MX record and two or three TXT records for SPF and
DKIM. **Copy the exact values Resend shows you.** They are specific to your account and region,
so do not take them from anywhere else, including this document.

Pick the region closest to your users when asked. There is no Sydney region; the choice affects
latency by milliseconds and nothing else that matters here.

## 3. Add the records at Namecheap

`kyascene.app` is registered with Namecheap and currently parked.

**Domain List → Manage → Advanced DNS → Add New Record.**

The one thing that catches everyone: **Namecheap's "Host" field takes only the subdomain part,
not the full name.** Resend shows you `send.kyascene.app`; Namecheap wants `send`. Pasting the
full domain creates `send.kyascene.app.kyascene.app`, which silently never verifies.

| Resend shows                     | Namecheap Type | Namecheap Host      |
| -------------------------------- | -------------- | ------------------- |
| `send.kyascene.app`              | MX Record      | `send`              |
| `send.kyascene.app`              | TXT Record     | `send`              |
| `resend._domainkey.kyascene.app` | TXT Record     | `resend._domainkey` |

Set TTL to Automatic. The MX record has a separate Priority field — use the number Resend
gives, usually 10.

Leave the existing parking records alone. Mail records and web records do not conflict.

Back in Resend, press **Verify**. It usually completes in a few minutes. If it does not, wait
and press it again rather than editing anything — Namecheap's propagation is the usual cause,
not a wrong record.

## 4. Create the API key

**Resend → API Keys → Create API Key.** Sending permission is enough.

Copy it now — it is shown once.

> This key is an SMTP password. It belongs in the Supabase dashboard and nowhere else: not in
> `eas.json`, not in `.env`, not in this repository, and never with an `EXPO_PUBLIC_` prefix
> (§5.3). Nothing in the app sends email, so the app never needs it.

## 5. Point Supabase at Resend

**Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP.**

| Field        | Value                  |
| ------------ | ---------------------- |
| Sender email | `noreply@kyascene.app` |
| Sender name  | `KyaScene`             |
| Host         | `smtp.resend.com`      |
| Port         | `465`                  |
| Username     | `resend`               |
| Password     | your Resend API key    |

Port 465 is implicit TLS. If your network blocks it, 587 works with STARTTLS.

The username is the literal string `resend` — not your email address, and not the key.

## 6. Edit both templates

Only possible once step 5 is saved. **Authentication → Emails → Templates.**

**Both of these need editing.** Supabase chooses between them by whether the address already
exists, so doing one leaves half your testers stuck — and it will be the half you do not notice,
because your own address is already registered:

| Template              | Sent to                                |
| --------------------- | -------------------------------------- |
| **Confirm sign up**   | A first-time address                   |
| **Magic link or OTP** | An address that already has an account |

Set the body of each to:

```html
<h2>Your KyaScene code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
<p>If you didn't ask for this, ignore this email.</p>
```

Subject: `Your KyaScene code`

`{{ .Token }}` is the six digits. Without it, no code arrives no matter how long you wait.

There is deliberately **no link** in that body. The app is the only way into KyaScene (§4.7 —
no consumer web application), so a link would be a phishing surface with nothing behind it.

## 7. Fix the Site URL

**Authentication → URL Configuration → Site URL** → `https://kyascene.app`.

Nothing in the code-based flow uses it, but the default is `http://localhost:3000`, which is
where those stock confirmation links were pointing.

## 8. Test it properly

Use an address that has **never** signed in — otherwise you only test the Magic link template
and leave Confirm sign up broken. A `+` suffix works: `you+test1@gmail.com`.

```bash
curl -s -X POST "https://yvofvmrsnhddpthzgkep.supabase.co/auth/v1/otp" -H "apikey: YOUR-PUBLISHABLE-KEY" -H "Content-Type: application/json" -d '{"email":"you+test1@gmail.com","create_user":true}'
```

`{}` means accepted. Then check the inbox for six digits.

Resend's **Logs** tab shows every message with its delivery state, which turns "did it send?"
into something you can answer instead of guess.

## Troubleshooting

**`over_email_send_rate_limit` still.** Supabase's own rate limit applies until custom SMTP is
enabled and saved. Confirm step 5 took effect, then raise the ceiling under
**Authentication → Rate Limits**, which only becomes editable with custom SMTP configured.

**Domain will not verify.** Almost always the Namecheap Host field containing the full domain
instead of the subdomain. Check for a record literally named
`send.kyascene.app.kyascene.app`.

**Email arrives with a button and no digits.** The template edit did not save, or you edited
only one of the two. Check both.

**Nothing arrives and Resend's log is empty.** Supabase never attempted a send — the SMTP
settings are not saved or the credentials are rejected. The username is `resend`, literally.

**Email lands in spam.** Expected until the domain builds reputation. Add a DMARC record
(`_dmarc` TXT, value `v=DMARC1; p=none;`) and send a handful of real messages. Do not buy a
warm-up service for a closed beta.
