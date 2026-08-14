# apps/admin — private operations console

The console for approving registrations (spec §15). **Built in Milestone 2.**

§15 notes this does not conflict with §4.7's app-only consumer strategy: the consumer product
is native-only, and this is internal tooling for the founder and authorised operators.

Setup, usage and how to make yourself an operator:
**[docs/runbooks/admin-console.md](../../docs/runbooks/admin-console.md)**

```bash
pnpm run admin:dev
```

## Shape

A static Vite single-page app. No server, no framework beyond React, no component library —
§7's design system governs the consumer product, and an operations console that borrows its
brand invites the assumption that it is part of it.

```
src/
  App.tsx                 shell, queue, user search, audit log
  RegistrationDetail.tsx  one registration, and the approve/reject decision
  SignIn.tsx              email one-time code
  supabase.ts             the single client, and the Edge Function calls
  styles.css              plain CSS, no dependencies
```

## The security property this app is built around

**It holds no authority.** The only credential in the bundle is the publishable key, which
grants nothing Row Level Security does not already permit — and this console reads almost
nothing directly. Every privileged read goes to the `admin-console` Edge Function, every write
to `admin-review-registration`, and both pass the **verified JWT's** user id to a
`SECURITY DEFINER` function that checks `admin_users` before touching a row.

So the interesting question is not "is the console careful?" but "what could someone do with
the whole bundle and a browser?" — and the answer is nothing they could not do with the mobile
app, because a browser bundle is public and this one carries no secret.

`admin_whoami` hides the interface from a non-operator. That is a courtesy. §15.2 —
"never rely only on hidden navigation for authorisation" — is satisfied in the database.

`scripts/verify-admin-bundle.mjs` builds this app in CI and fails if a Supabase secret key or a
service-role JWT ever appears in the output. It also asserts a publishable key **is** present,
because a bundle built with no environment would otherwise pass while proving nothing.

## §15.1 screens

| Screen                 | Status                                      |
| ---------------------- | ------------------------------------------- |
| Admin sign-in          | ✅ built                                    |
| Registration queue     | ✅ built                                    |
| Registration detail    | ✅ built                                    |
| Approve/reject         | ✅ built                                    |
| User search and status | ✅ built                                    |
| Audit log              | ✅ built                                    |
| Invite campaigns       | pending — Milestone 3 owns referrals (§S19) |
| Referral overview      | pending — Milestone 3                       |
| Feedback inbox         | pending — Milestone 3 owns §S20             |
| Beta announcements     | pending — Milestone 3                       |

§21.4 scopes Milestone 2 to "the minimum private admin approval workflow", which is the first
six. The rest arrive with the features they administer — an inbox for feedback that cannot yet
be submitted would be a screen with nothing in it.
