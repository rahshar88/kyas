# Build log

A chronological record of what has been built, what was decided, and — importantly — what
went wrong and how it was fixed. Written so that someone joining later can reconstruct not
just the current state but the reasoning that produced it.

The [master specification](master-specification.md) says _what_ to build. The
[ADRs](../decisions/README.md) record _why_ the big choices were made. This file records
_what actually happened_, including the mistakes, because those are the parts that never
appear in a clean commit history.

All dates are 2026.

---

## Milestone 0 — repository and vertical foundation

**Status: complete.** Verified running on a physical iPhone (iOS 26.6), 8 August.

### What was built

A pnpm monorepo containing an Expo SDK 57 app, five shared packages, Supabase folder
structure, CI, and two screens: S00 launch and S01 welcome. Nothing more, because §21.2 says
_"Create a minimal launch screen and welcome route only. Do not implement registration
business logic yet."_

- **Design tokens** from §7.1 and §7.3, with a WCAG contrast test wired into CI
- **Environment validation** that fails the build rather than a tester's phone (ADR-0003)
- **Six of §7.4's 26 components** — exactly what S00 and S01 consume
- **Routing rules** from §8.2 as a tested pure function, without shipping empty screens
- **CI** proving both native projects generate and bundle from one commit

### Decisions

Recorded as [ADR-0001](../decisions/0001-mobile-stack.md) (stack and pinned versions),
[ADR-0002](../decisions/0002-monorepo-and-tooling.md) (monorepo layout, pnpm hoisting,
config placement) and [ADR-0003](../decisions/0003-environment-validation.md) (fail-loud
environment validation).

Two deliberate deviations from the specification, both recorded rather than made silently:

1. **`app.config.ts` and `eas.json` live in `apps/mobile/`, not the repository root** as §5.1
   draws them. Expo requires them beside the app's `package.json`.
2. **Development reuses the `app.kyascene.beta` identifier.** A third identifier would have
   to be registered in two consoles for a benefit that does not exist until TestFlight.

### Problems found and fixed

**Two brand colours fail WCAG AA as text.** Measuring every pair in §7.1 against the §7.5
accessibility floor found Error red at **2.96:1** and Warning amber at **3.56:1** on Scene
Emerald, against a 4.5:1 requirement. They are _fill_ colours — Warm Cream on Error is 4.52:1
— so each status now carries a fill role and an AA-clearing text tint, with a contrast test
enforcing every pair. **This remains an open question for whoever owns the brand:** the
palette as specified cannot render error text legibly on the primary surface.

**Five version traps**, each of which breaks the build if taken from `latest`. `typescript`
is now 7.x (the Go rewrite) but `typescript-eslint` caps at `<6.1.0`; `jest-expo@57` depends
on Jest **29** internals; `@testing-library/react-native@14` requires a `test-renderer` peer
that did not exist in the v12 era. All recorded in ADR-0001.

**React Native Testing Library v14 made `render` and `fireEvent` asynchronous.** Missing
`await` produces misleading failures — a testID that "cannot be found", a state change that
appears never to have happened.

**A privacy leak that would have reached the Play Store.** `expo-dev-client` contributes
`SYSTEM_ALERT_WINDOW` to the _main_ Android manifest, not just the debug one, so a release
build would have shipped a "draw over other apps" permission requiring a Data Safety
justification (§19) for a capability the product does not use. Now blocked for release-like
builds, with CI reading the generated manifest to prove it.

**The CI I wrote would have failed on its first run.** `pnpm audit --audit-level=high`
reports two advisories in `image-size` with `patched: <0.0.0` — no fix exists. Rather than
weaken the gate, both are exempted by GHSA id with the reasoning in
[docs/runbooks/ci.md](../runbooks/ci.md): they reach us only through Metro, the build-time
bundler, which parses images on a developer machine and never on a phone. Any _new_
high-severity advisory still fails.

**Copying `.env.example` verbatim failed validation** — the exact step the README prescribes.
A `.env` writes "not set" as `KEY=`, which is an empty string rather than `undefined`, so the
optional Sentry and analytics keys were rejected. `parseEnv` now trims and treats blank as
absent, and a test parses the shipped `.env.example` itself so the instruction cannot drift
from the schema again.

**Every shell block in the docs contained `#` comments.** macOS zsh does not enable
`interactive_comments` by default, so pasting one produces `zsh: command not found: #`. All
blocks are now comment-free and safe to paste whole.

### Verified on device, 8 August

`expo run:ios --device` built, signed and installed on a physical iPhone. The device log
showed the expected §14.2 sequence — `app_opened`, `session_restore_succeeded`,
`welcome_viewed`, `auth_started` — with **no personal data attached to any event**, so §14.3
holds in practice and not only in a unit test.

Signing also **registered `app.kyascene.beta`**, closing §4.5's requirement to confirm
identifier availability before the first signed build. `app.kyascene` (production) is still
unclaimed.

---

## Milestone 1 — authentication and resumable onboarding

**Status: built. Schema deployed to a live Supabase project. Exit criterion not yet
demonstrated end to end.**

### The database

Schema, Row Level Security and atomic invite redemption, covering only what Milestone 1
needs — §11.3 forbids creating tables ahead of the milestone that owns them.

| Table                                 | Purpose                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `profiles`                            | Public-safe account shell; status is server-controlled                                                            |
| `student_profiles`                    | Private detail. Suburb and postcode only — no street address, no coordinates, enforcing §13.2 at the schema level |
| `invites`                             | Stores a SHA-256 digest, never the code, so a leaked backup yields no working invitations                         |
| `invite_redemptions`                  | Unique on `user_id`: one invitation per tester                                                                    |
| `india_states`, `education_providers` | Reference catalogues for §S06 and §S08                                                                            |

**Atomicity lives in SQL, not TypeScript.** `redeem_invite` is a `SECURITY DEFINER` function
taking `for update` on the invite row; the Edge Function is a thin wrapper that authenticates
the caller and maps the outcome to the §12.3 envelope. A read-then-write over the network
would reintroduce the exact race §S04 forbids.

### Verified against a real PostgreSQL 16 server — 39 assertions

- **Cross-user isolation** (§20): one student cannot read another's profile, private record,
  suburb, hometown or redemption
- **Privilege escalation blocked**: a student cannot promote their own status to `approved`
- **The invite ledger is unreachable** to clients at all
- **8 concurrent connections racing for one remaining seat yield exactly 1 redemption** —
  §S04's acceptance criterion tested rather than asserted
- **Anonymous callers cannot reach any table**

The suite was **negative-controlled** against four deliberately broken variants: a select
policy widened to `using (true)`, the privileged-column guard trigger dropped, RLS disabled on
`student_profiles`, and the anon lockdown migration removed. Each was caught by the assertion
that should have caught it, so the tests can fail.

### The app

- **Nine screens**: launch, welcome, sign-in, verify, invite, eligibility, study, location,
  background
- **Validation defined once** in `@kyascene/domain` and shared between forms and the service
  boundary (§4.4) — the completion-after-intake rule from §S06 is a Zod refinement _and_ a
  CHECK constraint
- **Local-first draft**, versioned, per-user, surviving a force-close (§S06, §16.2)
- **Session in the platform keychain** (§13.1), chunked because a Supabase session exceeds
  SecureStore's practical per-value size
- **Repositories are the only modules touching Supabase**, so §4.3's swappable-vendor
  requirement stays real; every error becomes a typed `AppErrorCode` before reaching a screen

### Problems found and fixed

**The anonymous role could reach every table.** Verifying the live project revealed that
querying all six tables with only the publishable key returned HTTP 200 with zero rows — not
a permission error. RLS was working, but it was the _only_ thing between a stranger and the
data. Supabase grants ALL on new tables in `public` to `anon` by default, and the migrations
granted to `authenticated` explicitly but never revoked anon.

The local test environment was **why this hid**: it created roles from scratch, so `anon` had
no grants and the missing revoke passed. `00-local-shim.sql` now reproduces Supabase's
`alter default privileges`, making local match production rather than being stricter than it.

**`supabase db execute --file` does not exist.** Written untested in the deploy script. The
real mechanism is `db push --include-seed` with seed paths in `config.toml`.

**Four screens hydrated form state inside an effect**, cascading a render. The same pattern in
the draft hook would have briefly shown one tester another's answers on a shared device.

**The hand-written Supabase `Database` type was missing `Relationships`, `Views` and
`Functions`**, so every query inferred as `never`.

### Deployed, 13 August

`pnpm run supabase:deploy` applied all migrations, seeded 36 states and 16 providers, and
deployed the `redeem-invite` function to project `yvofvmrsnhddpthzgkep`. Verified from
outside: tables exist, anonymous callers see nothing, and the function returns our own §12.3
envelope.

### Untethered distribution, 13 August

Reviewing a change meant being at the Mac with the phone plugged in, because
`expo run:ios --device` serves JavaScript from Metro. Replaced with EAS Build (a real signed
app installed once) plus EAS Update (new JavaScript in seconds, over the air).

The EAS project is owned by the **`nighthawk-productions-pty-ltd`** organisation rather than a
personal account — [ADR-0004](../decisions/0004-eas-project-ownership.md), a §22 founder
decision, and an expensive one to reverse because the update URL is baked into every installed
binary.

`runtimeVersion` uses the **fingerprint** policy, which hashes the native project. A screen or
copy change ships over the air; a native change makes EAS refuse the update and ask for a new
build, rather than shipping JavaScript the installed binary cannot run.

**`eas init` created the project and then failed** with
`Cannot read properties of undefined (reading 'CommonJS')`. The cause is not the config: it is
the CLI trying to write the project id back into what it assumes is a static `app.json`, while
this repository uses a dynamic `app.config.ts` so the environment can be validated at config
time (ADR-0003). `npx expo config --json` resolves the same file cleanly. The id was pasted in
from the dashboard, and `verify-app-config.mjs` now asserts that `updates.url`,
`runtimeVersion.policy` and `extra.eas.projectId` agree — a mistyped id would otherwise build,
install and quietly fetch another project's JavaScript.

`owner` is stated explicitly in the config because the founder's Expo login can reach more than
one account; without it EAS resolves against the personal account and reports a project that
does not exist there.

**The first build failed, and the verification I had written did not catch it.** The `preview`
profile supplied only `EXPO_PUBLIC_ENVIRONMENT`; the Supabase URL, publishable key and three
legal URLs lived in `apps/mobile/.env`, which is gitignored and therefore **does not exist on
an EAS build server**. The build failed at "Read app config" after roughly twenty minutes of
queue, with `Unknown error. See logs of the Read app config build phase` — a summary naming
neither the variable nor the file.

The environment validation from ADR-0003 did exactly its job: it refused to build a
misconfigured app. The failure was that it did so in the most expensive place available.

The deeper defect was in the checks. `verify-eas-config.mjs` had 22 green assertions about
`eas.json` and asked none of them the only question that mattered — whether a profile can
produce a valid config — and `preview`, the profile actually used to build, was **not in the
list of profiles it checked at all**. `docs/architecture/environments.md` compounded it by
documenting the intended design ("every other publishable value comes from EAS environment
variables") as though it had been done; the variables were never created.

Fixed in three layers, each verified against a reintroduction of the bug:

1. `eas.json` gained a `dev-environment` mixin carrying the full publishable environment, which
   `development` and `preview` extend.
2. `verify-eas-config.mjs` now covers every buildable profile, resolves `extends` chains, and
   runs each profile's merged environment through **the same Zod schema `app.config.ts` uses**
   — so a variable added to the schema is immediately required of every profile. Profiles that
   cannot be complete yet (beta, production) are listed with their reason and still fail when
   named explicitly, so building one gets the missing list in a second.
3. `verify-eas-build-env.mjs` actually runs `expo config` per profile with
   `KYASCENE_IGNORE_DOTENV=1` and every inherited `EXPO_PUBLIC_*` stripped, reproducing the
   server's config read on a machine that has a `.env`. That opt-out had to be a new variable
   rather than `EXPO_NO_DOTENV`, because EAS CLI sets `EXPO_NO_DOTENV` on every invocation and
   honouring it there is the bug the dotenv loader exists to fix.

Both gates run in CI **and** as a preflight inside `pnpm run eas:build:preview` and
`pnpm run eas:update`. Reverting the `eas.json` fix makes both fail, naming all five variables,
in about a second.

The secret scan was widened at the same time to catch `sb_secret_`, since a Supabase project
presents the publishable and secret keys side by side and the secret one bypasses every RLS
policy in the schema.

### Still open

The exit criterion — _"an invited tester can authenticate and resume after app restart"_ —
needs someone to actually sign in. That requires the schema re-deployed with the anon
lockdown, an invite code minted, and a run through the flow on a device.

---

## Milestone 2 — complete registration and administration

**Status: built. Awaiting a real end-to-end run, which is blocked on email delivery.**

### The database

Eleven tables for S09–S17 plus the approval workflow, and four server functions. Rules are
constraints wherever they can be, because a form is not the only way a row can be written:

| Rule (spec)                                         | Where it actually holds                       |
| --------------------------------------------------- | --------------------------------------------- |
| S09 "duplicate language entries are prevented"      | Primary key                                   |
| S12 "up to five, rank the top need"                 | `rank BETWEEN 1 AND 5` + unique rank per user |
| S16 "repeated taps cannot create duplicates"        | Partial unique index on pending requests      |
| S10 "prefer not to specify clears other selections" | Trigger pair, both directions                 |
| §11.1 "immutable administrative history"            | Trigger refusing UPDATE and DELETE            |

Rejection reasons are a closed enum because §S17 shows the student a category and never the
operator's notes; free text written by an operator would leak internal reasoning to its
subject. `admin_users` is a separate table rather than a column on `profiles` (§15.2) — a table
a student can update must never describe that student's privileges.

**102 database assertions**, up from 39. Seven mutants introduced and all seven caught: a
mutable audit log, a widened language policy, editable consent, the S10 trigger removed,
non-idempotent submission, an operator reviewing themselves, and a rejection with no category.

### Problems found and fixed

**Every incomplete registration would have returned a server error.** `v_missing || 'study'`
resolves to `anyarray || anyarray`, so Postgres tried to parse the word "study" _as_ an array
and raised "malformed array literal". The ordinary path — someone who has not finished a step —
would have got a crash instead of the list of what to finish.

**`admin_users` and `admin_audit_logs` were readable by every signed-in user.** The Milestone 1
lockdown revoked from `authenticated` **once** rather than by default, so all eleven new tables
received Supabase's default grant again and RLS was doing the whole job alone. The same failure
as the anonymous-role one, recurring for the same reason: a one-time revoke does not constrain
the future. `alter default privileges` now does.

**Registration could never have been submitted.** The trigger guarding `profiles.status` keyed
on `auth.uid() is null` — which describes how a caller connected, not whether it holds
authority — so it refused `submit_registration`'s own server-side transition. It also carried
`SECURITY DEFINER`, which it never needed and which would have made `current_user` the owner
for every caller, permitting everything.

**The launch screen sent every signed-in user to the welcome screen.** Milestone 0 shipped a
placeholder with a comment saying Milestone 1 would replace it. Milestone 1 did not. A tester
mid-registration was greeted with "Join the beta", and a submitted tester never saw their own
status — so §10.2's resume and Milestone 2's exit criterion were both broken by a line nobody
had looked at since. Now a pure `resolveDestination` function, exhaustive over all nine
statuses and every registration step.

**`deno check` listed its files by hand** and had silently omitted both new Edge Functions.

### The app

Nine screens. Three decisions that rejected the obvious alternative:

- **S12 ranks by tap order, not drag.** Drag is conventional and the least accessible
  interaction available, in a flow §7.5 requires to work under a screen reader. Each goal shows
  its rank as a number, and the array index is the rank all the way to the database.
- **S13 re-encodes the photograph** rather than stripping named EXIF tags. Phone photos carry
  GPS coordinates, so an original upload would import precise location — which §13.2 forbids —
  through a field nobody would audit. Re-encoding drops everything; naming tags drops what you
  remembered.
- **S15 has no accept-all control, and a test asserts its absence.** Required and optional
  consent render from separate lists, so a future edit cannot sweep marketing into the required
  loop. That single loop is how consent bundling gets introduced (§S15 forbids it).

S13 is deliberately not a registration step: skipping is a valid outcome, so "skipped" and
"never reached" would be the same state and §10.2's resume would loop on it forever.

### The console

A static Vite SPA — queue, detail, approve/reject, user search, audit log (§15.1's minimum).

It holds no authority. The only credential in the bundle is the publishable key; every read
goes through the `admin-console` Edge Function and every write through
`admin-review-registration`, both passing the **verified JWT's** user id to a SECURITY DEFINER
function that checks `admin_users`. Hiding the interface from a non-operator is a courtesy, not
the control (§15.2).

Reads are SQL functions rather than an "admins can read everything" RLS policy. Such a policy
would have to live on `profiles` and `student_profiles`, widening what a _student's_ session can
reach and making §20's isolation tests depend on the caller's role instead of the policy.

`verify-admin-bundle.mjs` fails CI if a secret key or service-role JWT reaches the bundle. It is
not a grep — `supabase-js` contains the literal `"sb_secret_"` in its own prefix detection, so a
naive scan fails on a safe bundle and gets switched off. It matches a secret's shape, decodes
JWTs to read the role claim, and asserts a publishable key **is** present, without which a
bundle built with no environment would pass while proving nothing.

### Still open

Nobody can receive a sign-in code until custom SMTP is configured
([ADR-0005](../decisions/0005-transactional-email.md)), which is blocked on DNS. Until then the
flow cannot be walked end to end by anyone, including the founder — so Milestone 2's exit
criterion, _"an administrator can approve a submitted student and the user can enter approved
routes"_, is built and tested but not yet demonstrated.

---

## Tooling added along the way

| Capability                                                    | Where                                               |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Row-isolation tests against real PostgreSQL                   | `pnpm run test:rls`, CI `database` job              |
| Deno type-check for Edge Functions                            | `pnpm run test:functions`                           |
| Native output assertions (Info.plist, manifest, entitlements) | `scripts/verify-native-output.mjs`                  |
| App config assertions per environment                         | `scripts/verify-app-config.mjs`                     |
| `eas.json` structure and secret scan                          | `scripts/verify-eas-config.mjs`                     |
| Schema + seed + function deployment                           | `pnpm run supabase:deploy <ref>`                    |
| Untethered device builds and OTA updates                      | `pnpm run eas:build:preview`, `pnpm run eas:update` |
| Consent version consistency across app, function and SQL      | `scripts/verify-consent-version.mjs`                |
| Admin bundle carries no privileged credential                 | `scripts/verify-admin-bundle.mjs`                   |
| Operations console                                            | `pnpm run admin:dev`                                |
| Sign-in code without an inbox, and operator grants            | `pnpm run dev:code`, `pnpm run dev:admin`           |

## Documentation map

| Document                                                      | Covers                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Master specification](master-specification.md)               | The source of truth, committed verbatim                           |
| [Scope boundaries](scope-boundaries.md)                       | P0 non-goals, the drift guardrail                                 |
| [Architecture overview](../architecture/overview.md)          | Layering, feature modules, packages                               |
| [Navigation](../architecture/navigation.md)                   | Full route map with milestone owners                              |
| [Environments](../architecture/environments.md)               | The three environments and where each value lives                 |
| [ADRs](../decisions/README.md)                                | Stack, monorepo, environment validation, and the §22 founder list |
| [First run on a Mac](../runbooks/first-run-on-mac.md)         | Xcode, CocoaPods, simulator, real iPhone                          |
| [Supabase setup](../runbooks/supabase-setup.md)               | Creating a project, keys, invite codes                            |
| [Email delivery](../runbooks/email-delivery.md)               | Resend, DNS, templates — the only way sign-in codes arrive        |
| [Device builds and OTA](../runbooks/device-builds.md)         | Untethered install, updates without a cable                       |
| [Admin console](../runbooks/admin-console.md)                 | Running it, and how to become an operator                         |
| [Testing without email](../runbooks/testing-without-email.md) | Signing in while SMTP is still pending                            |
| [CI](../runbooks/ci.md)                                       | What each job proves, and the audit allow-list                    |
| [Local development](../runbooks/local-development.md)         | Day-to-day commands and common failures                           |

## Open questions for the founder

Carried forward, all §22 decisions:

1. **The Error and Warning brand colours fail accessibility as text.** A tint has been derived
   and enforced, but the palette gap is a design decision.
2. **`app.kyascene` (production) is unclaimed.** §4.5 wants this confirmed before the first
   signed build.
3. **Analytics and error-reporting vendors** — both process personal data.
4. **Privacy policy, terms and retention wording** — required before any external tester.
5. **Whether student verification requires documents** — currently it does not, and §13.2
   forbids retaining identity documents in P0.
