# Runbook — testing before email works

Email delivery needs custom SMTP, which needs DNS ([ADR-0005](../decisions/0005-transactional-email.md)).
Until that lands, nobody can receive a sign-in code — including you.

This gets you into the app **today**, using the same authentication everyone else will use.

## What this is not

It is not a master code, a back door, or a test account with special powers in the app.

A fixed code compiled into the build would be an authentication bypass inside a signed binary:
readable by anyone who unpacked it, surviving every future build, and invisible on the day it
reached production. §13.1's mandatory controls exist to prevent precisely that, so nothing here
changes the app at all.

What it does instead is skip the **delivery** step. Supabase's Admin API will generate the same
one-time code the email would have carried. The code is real — same verification path, same
session, same expiry.

## One-time setup

Get the **service-role key**: Supabase → **Project settings → API keys → `service_role`**.

```bash
export SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'
```

> This key bypasses every Row Level Security policy in the schema. It belongs in your shell and
> nowhere else — never committed, never in `eas.json`, never in a chat or an issue, never with
> an `EXPO_PUBLIC_` prefix (§5.3). Nothing in the app or the console has ever held it, and
> nothing should.
>
> Add the `export` line to `~/.zshrc` if you would rather not repeat it, and understand that it
> now sits in a file on your machine.

## Signing in

```bash
cd ~/kyas
```

```bash
pnpm run dev:code 1818s@proton.me
```

It creates the account if it does not exist, then prints a six-digit code:

```
  ┌──────────────┐
  │    418207    │
  └──────────────┘
```

In the app: **Join the beta** → that address → **Send code** → type the code.

The app still sends its own email request, which will fail silently on the rate limit. That
does not matter — the code you were given is valid regardless of whether an email ever arrives.

Codes expire like any other. Generate a fresh one rather than reusing an old one.

## Becoming an operator

To open the console you also need a row in `admin_users`:

```bash
pnpm run dev:admin 1818s@proton.me
```

Then `pnpm run admin:dev` and sign in the same way — generate a code, type it in.

`admin_users` is unreachable from every client role, so this and the SQL editor are the only
ways to write it. That is deliberate: a console able to create its own administrators would be
the most valuable thing in the company to phish (§15.2).

## Walking the whole flow

With both of the above done, everything Milestone 2 built is reachable:

1. `pnpm run dev:code you+test1@gmail.com` — a **fresh** address, so you get a genuine
   first-time registration rather than resuming your own
2. In the app, sign in with that address and the code
3. Enter an invite code — mint one first if you have not:
   ```sql
   insert into public.invites (code_hash, capacity, campaign)
   values (encode(digest('KYASCENE01', 'sha256'), 'hex'), 50, 'founder');
   ```
4. Work through eligibility → study → suburb → India → languages → communities → interests →
   goals → photo → privacy → consent → review
5. **Force-close the app halfway and reopen it.** You should land back where you stopped —
   that is §10.2's resume, and it was broken until recently
6. Submit, and you land on the status screen
7. In the console, the queue shows the registration. Approve it with a reason
8. Back in the app, pull down to refresh — the status becomes approved

That sequence is Milestone 2's exit criterion in full.

## When email starts working

Nothing to undo. These scripts are development tooling that reads a key from your shell; they
are not wired into the app, the console or CI, and they change no behaviour. Keep using them
for throwaway test accounts long after real email works — they are faster than an inbox.

The one thing worth doing is **removing the export from `~/.zshrc`** if you added it, once you
no longer need it daily.
