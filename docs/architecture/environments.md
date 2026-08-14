# Environments and configuration

## The three environments (§5.2)

| Environment | Purpose                                   | Data                 |
| ----------- | ----------------------------------------- | -------------------- |
| Development | Local engineering and automated tests     | Synthetic only       |
| Beta        | TestFlight and Google Play closed testing | Real invited testers |
| Production  | Public stores and national launch         | Real public users    |

> Never use production data in local development. Beta and production must have separate
> Supabase projects, storage buckets, signing configuration, analytics projects and push
> credentials.

## Identity per environment (§4.5)

| Environment | Bundle id / application id | App name      |
| ----------- | -------------------------- | ------------- |
| Development | `app.kyascene.beta`        | KyaScene Beta |
| Beta        | `app.kyascene.beta`        | KyaScene Beta |
| Production  | `app.kyascene`             | KyaScene      |

Development reuses the beta identifier rather than introducing a third one. See
[ADR-0002](../decisions/0002-monorepo-and-tooling.md) for the reasoning and when to revisit.

Constant across environments: URL scheme `kyascene`, link host `kyascene.app`. Universal
links and app links are configured for beta and production only — development has no
verified domain.

**Not yet confirmed:** §4.5 requires checking that `app.kyascene` and `app.kyascene.beta` are
actually available in Apple Developer and Google Play Console before the first signed build.
That has not been done.

## Variables (§5.3)

Only publishable values may use the `EXPO_PUBLIC_` prefix. **Anything with that prefix is
readable by anyone who downloads the app.**

| Variable                               | Required in      | Notes                                         |
| -------------------------------------- | ---------------- | --------------------------------------------- |
| `EXPO_PUBLIC_ENVIRONMENT`              | all              | `development` \| `beta` \| `production`       |
| `EXPO_PUBLIC_SUPABASE_URL`             | all              | per-environment project                       |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all              | publishable/anon key only                     |
| `EXPO_PUBLIC_SENTRY_DSN`               | beta, production | optional in development                       |
| `EXPO_PUBLIC_ANALYTICS_KEY`            | beta, production | optional in development                       |
| `EXPO_PUBLIC_SUPPORT_URL`              | all              | must be live before an external build (§16.4) |
| `EXPO_PUBLIC_PRIVACY_URL`              | all              | must be live before an external build (§16.4) |
| `EXPO_PUBLIC_TERMS_URL`                | all              | must be live before an external build (§16.4) |

### Where each value lives

| Kind                                            | Home                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Publishable, local development                  | `apps/mobile/.env` (gitignored; copy `.env.example`)           |
| Publishable, `development` and `preview` builds | `eas.json`, in the `dev-environment` profile                   |
| Publishable, beta and production builds         | EAS environment variables (`eas env:create`)                   |
| Service-role keys, provider secrets             | Supabase Edge Function secrets                                 |
| Signing credentials                             | EAS credentials — never in the repository                      |
| CI placeholders                                 | `.github/workflows/ci.yml` `env:` — obviously fake, never real |

### The rule that makes this non-obvious

**`.env` does not exist on an EAS build server.** It is gitignored, so it is not in the archive
EAS uploads. Whatever the build profile's `env` block supplies **is the entire environment**.

A profile carrying only `EXPO_PUBLIC_ENVIRONMENT` therefore resolves perfectly on a developer's
machine — where `.env` fills the gaps — and fails on EAS at the "Read app config" phase. The
CLI reports that as `Unknown error. See logs of the Read app config build phase`, naming
neither the variable nor the file.

That cost a real iOS build on 13 August. Two gates now make it impossible to repeat:

- `scripts/verify-eas-config.mjs` runs each profile's merged `env` through the **same Zod
  schema** `app.config.ts` uses, so a variable added to the schema is immediately required of
  every profile.
- `scripts/verify-eas-build-env.mjs` goes further and actually runs `expo config` per profile
  with `KYASCENE_IGNORE_DOTENV=1` and every inherited `EXPO_PUBLIC_*` stripped — reproducing
  the server's "Read app config" phase on a machine that has a `.env` sitting right there.

Both run in CI, and both run as a preflight before `pnpm run eas:build:preview` and
`pnpm run eas:update`, so a broken profile fails in about a second instead of after a queue.

### Why the development values are committed, and beta's are not

The `development` and `preview` profiles build against the shared development Supabase project.
Its URL and **publishable** key are committed in `eas.json` because they are published by
definition — they ship inside the app bundle, where anyone who downloads it can read them. Row
Level Security is what protects that data, not the secrecy of the key (§13.1); this is why the
RLS suite exists and why the anonymous role is revoked from every table.

Beta and production get their values from EAS environment variables instead. Not because those
keys are more secret, but because §5.2 requires separate Supabase projects and §22 reserves the
Sentry and analytics vendor choices for the founder — so those profiles stay deliberately
incomplete, and the verifier reports them as pending rather than quietly passing.

`scripts/verify-eas-config.mjs` fails CI if a privileged-looking value appears in `eas.json`,
including `sb_secret_` and `service_role`, which is the one paste that would undo all of the
above.

## Validation

`apps/mobile/env.config.js` holds the Zod schema; `apps/mobile/src/config/env.ts` supplies
the values and re-exports the typed result. Validation runs at **config time**, so a missing
variable fails `expo config`, `expo prebuild`, `expo export` and every EAS build with a
message naming the file to copy — rather than showing a tester a white screen.

Two implementation constraints, both load-bearing:

1. **The schema is CommonJS JavaScript, not TypeScript.** `@expo/config` evaluates
   `app.config.ts` by transpiling that one file and `require`-ing the result; the hook does
   not extend to the config's own relative imports, so `app.config.ts` cannot import a `.ts`
   module. Keeping the schema in `.js` lets the config and the bundle share one definition.
2. **`src/config/env.ts` lists every variable as a literal `process.env.EXPO_PUBLIC_X`
   access.** `babel-preset-expo` inlines these by static analysis; a dynamic
   `process.env[key]` lookup is not inlined and silently evaluates to `undefined` in a
   release bundle. Do not refactor that object into a loop.

## Local setup

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in the Supabase values, then:

```bash
pnpm --filter @kyascene/mobile start
```
