# ADR-0002 — Monorepo layout, pnpm hoisting and config placement

- **Status:** accepted
- **Date:** 2026-08-07
- **Milestone:** M0
- **Decided by:** coding agent, implementing §5.1 (deviations noted below)

## Context

§5.1 draws a monorepo with `apps/`, `packages/`, `supabase/`, `docs/` and — at the repository
root — `app.config.ts` and `eas.json`. React Native's native tooling has resolution
requirements that a naive workspace setup breaks in ways that only surface at native build
time, long after CI has gone green.

## Decision

### pnpm workspaces with `node-linker=hoisted`

`.npmrc` sets `node-linker=hoisted`. This is not a preference. React Native's Gradle
autolinking, `expo-modules-autolinking` and CocoaPods all walk `node_modules` using
Node-style resolution and do not understand pnpm's symlinked store. Expo's own monorepo
guidance mandates a hoisted layout.

Consequences that follow from the hoisted choice:

- `metro.config.js` sets `watchFolders` to the workspace root and `nodeModulesPaths` to the
  app then the root. It deliberately does **not** set `disableHierarchicalLookup` — that flag
  belongs to the isolated/symlinked layout, and `expo-doctor` flags it as a risky deviation
  from `expo/metro-config`'s defaults.
- Root `package.json` pins `react`, `react-dom` and `react-native` through `pnpm.overrides`,
  because `expo-router` declares `react-dom: "*"` and pnpm's `auto-install-peers` would
  otherwise resolve React DOM 19.2.8 against React 19.2.3.
- Web-only peers are listed in `peerDependencyRules.ignoreMissing`, since §4.7 excludes a
  consumer web application.

### Deviation: `app.config.ts` and `eas.json` live in `apps/mobile/`, not the root

§5.1 draws them at the repository root. That does not work: both must sit beside the app's
`package.json` for `expo` and `eas-cli` to find them. Recording the deviation here rather
than making it silently, per §1.2 and §22.

### Deviation: development reuses the beta bundle identifier

§4.5 names `app.kyascene` for production and `app.kyascene.beta` for beta. A third
`app.kyascene.dev` would let a developer keep a dev client and a TestFlight build on one
phone — genuinely useful, but it costs an identifier registered in **both** Apple Developer
and Play Console for a benefit that does not exist until there is a TestFlight build to sit
beside. Development therefore reuses `app.kyascene.beta`.

**Revisit at Milestone 4**, when TestFlight distribution starts and the collision becomes
real. That is a founder decision, since it means registering another identifier.

### Workspace packages are source-only TypeScript

Each package sets `"main": "src/index.ts"` and is transpiled by Metro through
`babel-preset-expo`. No build step, no `tsup`, no Turborepo. Jest resolves the symlinks to
their real paths under `packages/`, so they transform as first-party source and never hit the
preset's `/node_modules/` transform-ignore rules.

### `apps/admin` is a placeholder

§15 names ten admin screens as P0. Milestone 2's exit criterion is an administrator
approving a submitted student, so Milestone 2 owns the implementation. Milestone 0 ships a
README describing the screens and the §15.2 authorisation rules, consistent with §11.3's
principle of not creating empty scaffolding to appear complete.

## Consequences

- `pnpm install` produces a layout that `expo prebuild` and `expo export` both accept on
  Linux, verified for iOS and Android.
- Anyone cloning the repo must use pnpm 10; `packageManager` and `engines` enforce it.
- Adding a workspace package requires adding `@kyascene/config` to its devDependencies, or
  its `tsconfig.json` cannot resolve the shared base.
- React Native packages (`@kyascene/ui`) must extend `expo/tsconfig.base`, not
  `@kyascene/config/tsconfig.base.json` — mixing `@types/node` and DOM libs with React
  Native's globals produces hundreds of duplicate-declaration errors.

## Alternatives considered

- **pnpm default (isolated) linking.** Rejected: breaks autolinking and CocoaPods.
- **npm or Yarn workspaces.** Workable, but pnpm's disk efficiency and stricter dependency
  resolution are worth more than the small extra configuration.
- **Turborepo or Nx.** Rejected for now: five tiny source-only packages and one app do not
  justify a task orchestrator. Revisit when the admin console has real content and build
  times become noticeable.
- **Following §5.1's root placement literally.** Not possible; see above.
