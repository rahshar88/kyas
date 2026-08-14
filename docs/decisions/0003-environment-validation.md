# ADR-0003 — Environment configuration and fail-loud validation

- **Status:** accepted
- **Date:** 2026-08-07
- **Milestone:** M0
- **Decided by:** coding agent, implementing §5.2, §5.3 and §13.1

## Context

§5.3 draws a hard line: _"Only publishable values may use the `EXPO_PUBLIC_` prefix.
Service-role keys, signing credentials and provider secrets must never be included in the
mobile bundle."_ §16.4 makes missing privacy or terms links a release blocker, and §20
requires crash reporting and analytics to actually work in beta.

A missing environment variable in a React Native app normally surfaces as a blank screen or
a failed network call on a tester's phone — the worst possible place to find out.

## Decision

**Validate the environment at config time and fail the build.** A Zod schema over the eight
`EXPO_PUBLIC_*` variables runs inside `app.config.ts`, so a misconfigured environment breaks
`expo config`, `expo prebuild`, `expo export` and every EAS build, with an error naming the
exact file to copy.

Sentry and analytics keys are **optional in `development`** — so a fresh clone runs without
vendor accounts — and **required in `beta` and `production`**, per §20.

### The schema is CommonJS JavaScript, not TypeScript

`@expo/config` evaluates `app.config.ts` by transpiling that one file through a Babel
require-hook and `require`-ing the result. The hook does **not** extend to the config's own
relative imports, so `import { parseEnv } from './src/config/env'` fails with
`Cannot find module './src/config/env'`. This was hit and fixed, not theorised.

So the schema lives in `apps/mobile/env.config.js` (CommonJS) with types in
`env.config.d.ts`, and both `app.config.ts` and `src/config/env.ts` import it. One
definition, no drift.

### Every variable is read as a literal `process.env.EXPO_PUBLIC_X`

`babel-preset-expo` inlines `EXPO_PUBLIC_*` values by **static analysis of literal member
expressions**. A dynamic `process.env[key]` lookup is not inlined and evaluates to
`undefined` in a release bundle — invisible in development, broken in production. So
`src/config/env.ts` writes all eight out longhand, with a comment saying why. Do not
refactor it into a loop.

### Enforcement, not convention

| Rule                                      | Enforced by                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| No non-publishable variable in the bundle | `env.test.ts` asserts every schema key starts with `EXPO_PUBLIC_` and none matches `/SERVICE_ROLE\|SECRET\|PRIVATE_KEY\|PASSWORD\|SIGNING/i` |
| No secret in `eas.json`                   | `scripts/verify-eas-config.mjs`, scanning raw text, in CI                                                                                    |
| No location or contacts permission        | `android.blockedPermissions` + `scripts/verify-native-output.mjs` reading the generated manifest                                             |
| No personal data in analytics             | the `AnalyticsProperties` type — a PII property is a compile error                                                                           |
| Secrets anywhere in the repo              | gitleaks in the `security` CI job                                                                                                            |

### EAS CLI suppresses `.env`, so app.config.ts loads it

EAS CLI sets `EXPO_NO_DOTENV=1` so build environments come from `eas.json` profiles rather
than a developer's local file. That is right for a build — but it also applies when EAS
merely _reads_ the config, as `eas init` does, and validation then failed on a machine where
`.env` was sitting right there. EAS reports it as
`expo/bin/cli config --json exited with non-zero code: 1`: an exit code with no error text,
from a command the developer never typed.

`app.config.ts` therefore loads `.env` itself, filling only gaps — anything already in the
environment wins, so profiles, CI and shell overrides stay authoritative, and on EAS Build
servers (where `.env` is gitignored and absent) it is a no-op.

This lives in `app.config.ts`, **not** `env.config.js`, and that placement is load-bearing:
`env.config.js` is also bundled into the React Native app, where `node:fs` cannot be resolved.
Putting it there broke the Metro bundle immediately — caught by the `bundle` CI job, which is
exactly the class of failure that job exists to catch.

## Consequences

- A fresh clone fails fast with an actionable message rather than starting and misbehaving.
  This is intentional friction; `.env.example` and the README setup step are the answer.
- CI must supply placeholder values for every job that resolves the config. They live in
  `.github/workflows/ci.yml` and `scripts/ci-env.sh`, and are obviously fake by design.
- `eas.json` carries only `EXPO_PUBLIC_ENVIRONMENT`; every other publishable value comes from
  EAS environment variables, keeping beta and production Supabase URLs out of git.

## Alternatives considered

- **Validate at app startup instead of config time.** Rejected: it moves the failure from
  the build machine to the tester's phone, which is exactly backwards.
- **Duplicate the schema inside `app.config.ts`.** Rejected: two copies drift, and the drift
  would be silent.
- **Make `app.config.ts` a plain `app.config.js`.** Would work, but loses type checking on
  the config object itself — which is what caught `edgeToEdgeEnabled` and `newArchEnabled`
  being removed in SDK 57.
- **Skip validation and rely on review.** Rejected on the strength of §13.1 and §16.4; both
  describe failures that a checklist has repeatedly failed to prevent in real projects.
