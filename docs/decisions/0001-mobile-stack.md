# ADR-0001 — Mobile technology stack and pinned versions

- **Status:** accepted
- **Date:** 2026-08-07
- **Milestone:** M0
- **Decided by:** specification §4, implemented as-written

## Context

§4.1 requires one Expo/React Native application, iOS-first, with Android compiling in CI
from the first milestone. §4.2 names a baseline "verified on 7 August 2026" and instructs
the coding agent to _"verify current stable compatibility before the first install"_ and to
avoid canary, alpha and beta packages.

That verification found the spec's versions to be real and mutually consistent, but also
turned up five constraints that are not obvious from the spec text and that each break the
build if guessed wrong.

## Decision

Build on Expo SDK 57 with the exact pins below, taken from
`expo@57.0.11/bundledNativeModules.json` — the authoritative source, in preference to any
version range in prose.

| Package                         | Pin        | Why not `latest`                                                                                                                                               |
| ------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo`                          | `~57.0.11` | —                                                                                                                                                              |
| `react`                         | `19.2.3`   | `latest` is 19.2.8; SDK 57's template pins 19.2.3, which is also §4.2's number                                                                                 |
| `react-native`                  | `0.86.2`   | —                                                                                                                                                              |
| `typescript`                    | `~6.0.3`   | `latest` is **7.0.2** (the Go rewrite). `typescript-eslint` via `eslint-config-expo@57` caps at `<6.1.0`                                                       |
| `jest`                          | `~29.7.0`  | `jest-expo@57.0.3` depends on `jest-snapshot@^29`, `jest-environment-jsdom@^29`, `babel-jest@^29.2.1` — a Jest 30 runner over Jest 29 internals fails silently |
| `@testing-library/react-native` | `^14.0.1`  | peers `test-renderer: ^1.0.0`, which must be installed explicitly                                                                                              |
| `test-renderer`                 | `^1.2.0`   | community replacement for the deprecated `react-test-renderer`; RNTL 14 throws at render without it                                                            |
| `eslint`                        | `^9`       | `eslint-config-expo@57.0.1` peers `eslint>=8.10`; its `eslint-plugin-import` tree is not ESLint-10-clean                                                       |
| `react-native-reanimated`       | `4.5.1`    | SDK-pinned exactly, not a range                                                                                                                                |
| `react-native-worklets`         | `0.10.1`   | required by Reanimated 4; SDK-pinned exactly                                                                                                                   |

Backend is Supabase (§4.3), reached through typed service interfaces so a vendor can be
replaced without rewriting screens. Supporting libraries from §4.4 are installed by the
milestone that first uses them, not up front.

Two smaller decisions recorded here:

- **`@testing-library/react-native` v14's `render` is asynchronous.** Tests must
  `await render(...)`; forgetting produces the misleading `getByText is not a function`.
- **`expo-dev-client` is a Milestone 0 dependency**, not an afterthought: Milestone 0's exit
  criterion is that the _development_ build opens on device, and `eas.json`'s development
  profile sets `developmentClient: true`.

## Consequences

- The stack installs, typechecks, lints, tests, prebuilds and bundles cleanly on Linux with
  `expo-doctor` reporting 20/20. Verified, not assumed.
- Version drift is now a CI failure: `expo-doctor` runs in the `security` job and fails if
  anyone moves off an SDK-compatible version.
- We are pinned to TypeScript 6 until `typescript-eslint` supports 7. That is a deliberate
  hold, not neglect — revisit when `eslint-config-expo` widens its peer range.
- §25 requires revalidating these references before any major upgrade. The next checkpoint
  is the SDK 58 upgrade.

## Alternatives considered

- **Two native codebases (Swift + Kotlin).** Rejected by §4.1 — it would mean two products
  and two release trains for a beta whose whole purpose is fast learning.
- **`typescript@latest` (7.x).** Rejected: breaks lint through `typescript-eslint`'s peer
  range, and SDK 57's own template pins 6.
- **Installing the full §4.4 library list in Milestone 0.** Rejected: TanStack Query,
  Zustand, React Hook Form, Sentry and PostHog would all be unexercised dependency surface,
  and §22 reserves the Sentry/analytics vendor choice for the founder anyway.
- **The `default` Expo template as shipped.** Rejected in part: it brings `@expo/ui`,
  `expo-symbols`, `expo-glass-effect` and `react-native-web`, which conflict with §4.4's "do
  not install a large UI kit" and §4.7's "no consumer web application". We scaffolded from
  it for correct pins and pruned those.
