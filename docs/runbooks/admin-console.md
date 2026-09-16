# Runbook — the operations console

The private console for approving registrations (§15). Internal tooling, not part of the
product: §4.7 keeps the consumer experience app-only, and §15 explicitly notes this does not
conflict with that.

## Making yourself an operator

Nobody is an operator until a row exists. There is deliberately no sign-up — a console that
could create its own administrators would be the most valuable thing in the company to phish.

You need to have signed into the **app** at least once, so an `auth.users` row exists for your
address. Then, in Supabase **SQL Editor**:

```sql
insert into public.admin_users (user_id, role)
select id, 'administrator' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set active = true, role = 'administrator';
```

Confirm it took:

```sql
select u.email, a.role, a.active
  from public.admin_users a join auth.users u on u.id = a.user_id;
```

`admin_users` is unreachable from any client session, so this is the only way to read or write
it (§15.2).

## Running it

```bash
cd ~/kyas
```

```bash
cp apps/admin/.env.example apps/admin/.env
```

Fill in the same two values the app uses — the project URL and the **publishable** key. Both
are in `apps/mobile/eas.json` under `dev-environment`, or on the Supabase dashboard under
**Project settings → API**.

> The publishable key is the only credential this console may hold. It is a browser bundle:
> everything inside it is readable by anyone who opens the page. A service-role key there would
> bypass every Row Level Security policy in the schema. `scripts/verify-admin-bundle.mjs` fails
> CI if one ever appears.

```bash
pnpm run admin:dev
```

Open **http://localhost:5173**, sign in with the same email code flow as the app, and the queue
appears.

## What it does

| Screen                  | What it is for                                          |
| ----------------------- | ------------------------------------------------------- |
| **Queue**               | Everyone awaiting review, oldest first                  |
| **Registration detail** | One person in full, with approve and reject             |
| **Users**               | Search by name or email across every status             |
| **Audit log**           | Every administrative action ever taken, with its reason |

### Approving and rejecting

Both need a reason, and both buttons stay disabled until you write one. That is §15.2 —
"sensitive actions require a reason" — and the database refuses a reasonless decision as well,
so it holds even for a caller that never opens this console.

The **reason** and the **category** are two separate fields on purpose:

- **Reason** is yours. It goes into the audit log and the person it concerns never sees it.
- **Category** is what they see on their status screen — a fixed list, not free text.

§S17 and §15.2 both require that rejected users do not read moderator notes. One combined field
would inevitably leak internal reasoning to its subject, because an operator writing a single
note would reasonably assume they are writing to someone.

## What it deliberately cannot do

- **Create operators.** Only SQL does that.
- **Edit or delete an audit record.** The table refuses an update or delete from any caller,
  including the service role (§11.1: "immutable administrative history").
- **List every user.** Search requires at least two characters. §15.2 restricts exports, and a
  blank search returning everybody is how an accidental one happens.
- **Name who invited someone.** §S19 keeps referrals private until both sides consent.

## Where authorisation actually lives

Not in this console. It asks `admin_whoami` once and hides the interface if the answer is no,
but that is a courtesy — §15.2 says never rely only on hidden navigation.

Every request goes to an Edge Function, which passes the **verified JWT's** user id to a
`SECURITY DEFINER` function that checks `admin_users` before reading anything. A non-operator
who bypassed the UI entirely, called the function directly and named someone else as the actor
would still get nothing: the actor comes from the token, not the request body.

## Deployment

Not deployed anywhere yet, and running it locally is the right answer for one operator. When it
does need hosting, it is a static bundle — `pnpm run admin:build` produces `apps/admin/dist`,
which any static host serves.

Two things to settle first, both §22 founder decisions:

- **Who may reach it.** Static hosting is public by default. An access layer (Cloudflare Access,
  an allow-list, a private network) matters more than the URL being obscure.
- **Where.** Cloudflare Pages is the obvious candidate given DNS already lives there for other
  domains.

Neither blocks anything today.

## Troubleshooting

**"This account is not an operator."** No `admin_users` row, or `active` is false. Run the
query above.

**The queue is empty but you know someone submitted.** The queue shows `pending` only. If they
were already approved or rejected, find them under **Users**.

**Everything returns "Request failed."** The Edge Functions are not deployed to this project.
Run `pnpm run supabase:deploy <project-ref>`.

**Sign-in never sends a code.** Same email setup as the app — see
[email-delivery.md](email-delivery.md). The console uses `shouldCreateUser: false`, so an
address with no account gets nothing and is told nothing, deliberately.
