# ADR-0004 — EAS project ownership and untethered device distribution

- **Status:** accepted
- **Date:** 2026-08-13
- **Milestone:** M1 (tooling; the delivery mechanism M4's TestFlight build will inherit)
- **Decided by:** founder, on the §22 reserved decision "developer-account ownership"

## Context

Until now the only way to see KyaScene on a phone was `expo run:ios --device`: a development
build whose JavaScript is served by Metro over the local network. The app stops working the
moment the terminal closes or the phone leaves the Wi-Fi. Reviewing a change meant being at
the Mac, plugged in.

That is fine while writing code and useless for the actual job of the next few milestones —
carrying the app around, showing it to people, and shipping a fix in the time it takes to
notice one.

§4.2 already names EAS Build and EAS Update in the baseline stack. What was undecided was
**which Expo account owns the project**, and §22 reserves account ownership for the founder.

## Decision

**The EAS project is owned by the `nighthawk-productions-pty-ltd` organisation account, not a
personal one.**

- Project: `@nighthawk-productions-pty-ltd/kyascene`
- Project id: `d1f7b10c-c114-4d66-8f34-fe0892d0bec9`

The alternative offered at `eas init` was the personal `1818app` account. An organisation was
chosen because the App Store listing, the Apple Developer membership and the Play Console
entry will all sit under the company, and moving an EAS project later means re-issuing signing
credentials and invalidating the update URL already baked into installed builds.

### Both values are committed to `app.config.ts`

```ts
const EAS_OWNER = process.env.EAS_OWNER ?? 'nighthawk-productions-pty-ltd';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'd1f7b10c-c114-4d66-8f34-fe0892d0bec9';
```

Neither is a secret. The project id appears in plain text inside every update request the app
makes (`https://u.expo.dev/<id>`), and the owner is visible on the public project page. They
are committed rather than injected because **EAS Build evaluates this config from a clean
server-side checkout, where `.env` does not exist** — an id that lived only in a local file
would produce a build with no project to attach to.

`owner` is stated explicitly because the founder's Expo login can reach more than one account.
Without it, EAS resolves the project against the personal account and reports a project that
does not exist there.

The environment overrides exist so a fork can point at its own EAS project without editing
source, and an empty id disables over-the-air updates entirely — so a fresh clone still builds
and runs without an Expo account.

### `preview` is the profile testers use, not `beta`

`pnpm run eas:build:preview` produces an internally-distributed build running the
**`development`** environment, which does not require Sentry or analytics keys. The `beta`
profile does require them (§20), and those vendors are still open §22 decisions. Using
`preview` now avoids either blocking on a vendor choice or, worse, making one by default.

### The runtime version is a fingerprint, deliberately

`runtimeVersion: { policy: 'fingerprint' }` hashes the native project. A change to a screen,
some copy or a validation rule ships over the air in seconds; adding a native module changes
the fingerprint, and EAS then **refuses** to send that update to an incompatible binary and
asks for a new build.

The alternative — a hand-maintained version string — fails in exactly one direction, and it is
the bad one: an update reaching a binary that cannot run it, bricking the app on the tester's
phone until they reinstall. The fingerprint cannot make that mistake.

## Consequences

- Reviewing a change is `pnpm run eas:update`, then force-close and reopen the app. No cable,
  no Mac running, no Metro.
- A native change now has a visible cost — a fresh ~20-minute cloud build and a reinstall — so
  it is worth knowing which category a change falls into before making it.
- Signing credentials are managed by EAS under the organisation account. Every physical test
  device must be registered against the Apple account before an internal build will install.
- **The update URL is now part of the installed binary.** Changing the EAS project after real
  testers have builds installed strands those builds. This decision is expensive to reverse,
  which is why it was made by the founder rather than defaulted.
- M4's TestFlight build inherits this project and these credentials; only the profile changes.

## Note — `eas init` could not write the id back

`eas init` created the project successfully and then failed with:

```
Error reading Expo config at .../apps/mobile/app.config.ts:
Cannot read properties of undefined (reading 'CommonJS')
```

The CLI writes the project id into `app.json` for you, but this repository uses a **dynamic**
`app.config.ts` (ADR-0003 — the environment must be validated at config time), which is code
and cannot be machine-edited. The error is that write-back path failing, not the config being
invalid: `npx expo config --json` resolves the same file without complaint.

The supported path for a dynamic config is to paste the id from the project dashboard, which
is what was done. `scripts/verify-app-config.mjs` now asserts that `updates.url`,
`runtimeVersion.policy` and `extra.eas.projectId` agree, so a mistyped id fails CI rather than
producing a build that quietly fetches another project's JavaScript.
