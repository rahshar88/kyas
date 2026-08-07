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

| Kind                                    | Home                                                           |
| --------------------------------------- | -------------------------------------------------------------- |
| Publishable, local development          | `apps/mobile/.env` (gitignored; copy `.env.example`)           |
| Publishable, beta and production builds | EAS environment variables (`eas env:create`)                   |
| Service-role keys, provider secrets     | Supabase Edge Function secrets                                 |
| Signing credentials                     | EAS credentials — never in the repository                      |
| CI placeholders                         | `.github/workflows/ci.yml` `env:` — obviously fake, never real |

`eas.json` carries only `EXPO_PUBLIC_ENVIRONMENT` per profile. Every other publishable value
comes from EAS environment variables so that beta and production Supabase URLs stay out of
git. `scripts/verify-eas-config.mjs` fails CI if a privileged-looking key appears in it.

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
# fill in the Supabase values, then:
pnpm --filter @kyascene/mobile start
```
