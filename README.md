# KyaScene

**The private community app for students from India studying in Australia. Sydney first.**

> Open KyaScene and find one useful person, place, opportunity or activity near you in
> under 30 seconds.

Powered by 1818. Native mobile only — iOS beta first, Android beta second, one shared
React Native codebase (§2.2, §4.1).

The source of truth for this repository is the **[KyaScene Native App Development Master
Specification](docs/product/master-specification.md)**, committed here in full. Read §1
before changing anything: where a concept image conflicts with the specification, the
specification wins.

---

## Status: Milestone 0 complete

Milestone 0 is the repository and vertical foundation (§17). What exists:

- pnpm monorepo, Expo SDK 57 app, TypeScript strict across every package
- Expo Router shell — S00 launch and S01 welcome only
- Design tokens (§7.1, §7.3) with a WCAG AA contrast test as a CI gate
- Environment validation that fails the build, not the tester's phone
- `eas.json` profiles, Supabase folder structure, CI compiling both platforms
- 108 tests passing across the iOS and Android Jest projects

**Not** implemented: authentication, invites, eligibility, registration, Supabase tables or
RLS, the other 21 P0 screens, or the admin console. See
[scope boundaries](docs/product/scope-boundaries.md) for the full list and why.

## Requirements

|                     |                                |
| ------------------- | ------------------------------ |
| Node                | 22.13+ (`.nvmrc` pins 22.22.2) |
| pnpm                | 10 (`corepack enable`)         |
| iOS development     | macOS with Xcode 16+           |
| Android development | JDK 17 and the Android SDK     |
| Watchman            | recommended on macOS           |

## Setup

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
pnpm run mobile:ios
```

Open the copied `.env` and set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to any text of 20
characters or more; leave the rest as-is. Milestone 0 makes no backend calls, so placeholders
are fine. A variable that is missing entirely **will fail the build** — deliberately, see
[ADR-0003](docs/decisions/0003-environment-validation.md).

**Setting up a Mac from scratch?** Follow
[docs/runbooks/first-run-on-mac.md](docs/runbooks/first-run-on-mac.md) — it covers Xcode,
CocoaPods, running on a real iPhone with a free Apple ID, and what to check once it opens.

## Commands

| Command                                   | What it does                                     |
| ----------------------------------------- | ------------------------------------------------ |
| `pnpm run mobile:ios` · `mobile:android`  | build and launch on a simulator or emulator      |
| `pnpm run typecheck`                      | strict TypeScript across every package           |
| `pnpm run lint` · `pnpm run format:check` | the §5.4 style gates                             |
| `pnpm run test`                           | Jest, both iOS and Android projects              |
| `pnpm run mobile:config`                  | resolved Expo config for the current environment |
| `pnpm run mobile:prebuild:check`          | generate both native projects                    |
| `pnpm run mobile:export`                  | bundle both platforms through Metro              |
| `pnpm run mobile:doctor`                  | Expo SDK compatibility audit                     |
| `pnpm run verify:eas`                     | `eas.json` structure and secret scan             |
| `pnpm run assets:generate`                | regenerate placeholder icons                     |

## Layout

```
apps/mobile/        Expo SDK 57 app — the whole of Milestone 0
apps/admin/         placeholder; Milestone 2 owns it (§15)
packages/ui/        design tokens + the 6 components S00/S01 need
packages/domain/    account status, error codes, feature flags (types only)
packages/contracts/ API response envelope (types only)
packages/analytics/ vendor-neutral adapter + event catalogue (types only)
packages/config/    shared TypeScript, ESLint, Prettier
supabase/           structure only — no tables until Milestone 1
docs/               specification, architecture, ADRs, runbooks
scripts/            config and native-output verifiers
```

## Required external accounts

Nothing here is set up yet. Each row is a founder action; the §22 column marks decisions the
coding agent is **not** permitted to make alone.

| Account or asset                                                                 | Needed by | §22 founder decision                                         |
| -------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| Apple Developer Program (organisation, 2FA enforced)                             | M4        | account ownership; legal entity name for the listing         |
| App Store Connect record + bundle ids `app.kyascene`, `app.kyascene.beta`        | M4        | — (§4.5: confirm availability before the first signed build) |
| Google Play Console + Play App Signing                                           | M5        | account ownership                                            |
| Expo / EAS organisation (`eas init` writes the project id)                       | M4        | —                                                            |
| Supabase organisation — **three separate projects**, dev/beta/production (§5.2)  | M1        | region and paid plan                                         |
| Sentry organisation + beta and production projects                               | M4        | vendor approval — it processes personal data                 |
| PostHog or equivalent analytics                                                  | M4        | vendor approval — it processes personal data                 |
| DNS control of `kyascene.app` (AASA + `assetlinks.json`), `kyascene.io` redirect | M4/M5     | —                                                            |
| Live privacy, terms, community-guidelines and support URLs                       | M4        | policy and retention wording                                 |
| Web account-deletion request page (required for Play, §13.4)                     | M5        | retention policy                                             |

## Verification

What was run and passed on this Linux environment:

| Check                                                   | Result                                  |
| ------------------------------------------------------- | --------------------------------------- |
| `pnpm install --frozen-lockfile`                        | clean                                   |
| `pnpm run typecheck`                                    | clean, strict, all 6 projects           |
| `pnpm run lint` · `format:check`                        | clean                                   |
| `pnpm run test`                                         | **108 passed** (iOS + Android projects) |
| `expo config` for all 3 environments                    | 20 assertions each                      |
| `expo prebuild` iOS **and** Android, all 3 environments | 21–22 native assertions each            |
| `expo export --platform ios --platform android`         | both bundles built from one commit      |
| `expo-doctor`                                           | **20/20**                               |
| `verify-eas-config.mjs`                                 | 22 checks                               |

### What could not be verified here, and needs a Mac

This environment has no macOS, no Xcode, no Android SDK, no signing certificates and no
store or Supabase accounts. So Milestone 0's exit criterion splits in two:

- ✅ **"CI is green"** — substantially proven above.
- ⬜ **"The signed development app opens on iOS and Android"** — _not verified._ Needs
  `pod install`, an Xcode build, a Gradle build, a simulator/emulator and EAS credentials.

Also unverified: that `app.kyascene` and `app.kyascene.beta` are actually available in Apple
Developer and Play Console (§4.5 requires confirming this before the first signed build);
any real Supabase, Sentry or analytics connection; universal links (they need files hosted
at `kyascene.app`); and Maestro execution.

## Documentation

|                                                              |                                                     |
| ------------------------------------------------------------ | --------------------------------------------------- |
| [First run on a Mac](docs/runbooks/first-run-on-mac.md)      | Xcode, simulator, real iPhone, troubleshooting      |
| [Master specification](docs/product/master-specification.md) | the source of truth                                 |
| [Scope boundaries](docs/product/scope-boundaries.md)         | P0 non-goals, drift guardrail                       |
| [Architecture overview](docs/architecture/overview.md)       | layering, feature modules, packages                 |
| [Navigation](docs/architecture/navigation.md)                | full route map with milestone owners                |
| [Environments](docs/architecture/environments.md)            | the three environments and where each value lives   |
| [Decisions](docs/decisions/README.md)                        | ADRs, and the §22 list the founder must decide      |
| [Runbooks](docs/runbooks/README.md)                          | local development, CI, and the §13.5 incident stubs |

## Next: Milestone 1

Authentication and resumable onboarding — S00–S08, email OTP, atomic invite redemption,
eligibility, study and location steps, local draft persistence and typed analytics. Exit
criterion: an invited tester can authenticate and resume after an app restart.

Read [scope boundaries](docs/product/scope-boundaries.md) first. Do not build the feed.

---

**KyaScene. Connect. Discover. Belong. Powered by 1818.**
