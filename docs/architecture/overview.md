# Architecture overview

## Layering (§6.1)

```
Screens and routes
      ↓
Feature controllers and hooks
      ↓
Domain services and policies
      ↓
Typed repositories and API clients
      ↓
Supabase Auth, Database, Storage and Edge Functions
```

Two rules that this layering exists to enforce:

- **Screens must not contain direct database queries.** Supabase calls belong in repository
  modules.
- **Business rules belong in domain services or database policies**, not in button handlers.

## Feature module shape (§6.2)

```
src/features/<feature>/
  components/
  screens/
  hooks/
  services/
  schemas/
  types/
  analytics/
  __tests__/
```

Milestone 0 has two features — `launch` (S00) and `welcome` (S01) — so only the
subdirectories they need exist. Later features create the rest as they need them.

### Route files are re-exports

Every file under `apps/mobile/app/` is a route to Expo Router. A test or a helper placed
there becomes a navigable screen. So `app/` contains only one-line re-exports:

```ts
export { WelcomeScreen as default } from '@/features/welcome/screens/WelcomeScreen';
```

and the real component lives at `src/features/welcome/screens/WelcomeScreen.tsx` with its
tests beside it in `src/features/welcome/__tests__/`.

## Workspace packages

| Package               | Contains                                                               | Depends on         |
| --------------------- | ---------------------------------------------------------------------- | ------------------ |
| `@kyascene/ui`        | Design tokens (§7.1, §7.3) and the shared component library            | React Native only  |
| `@kyascene/domain`    | Account status (§11.2), error codes (§6.4), feature flags (§6.5)       | nothing            |
| `@kyascene/contracts` | API response envelope (§12.3)                                          | `@kyascene/domain` |
| `@kyascene/analytics` | Adapter interface, event catalogue (§14.2), property allowlist (§14.3) | nothing            |
| `@kyascene/config`    | Shared TypeScript, ESLint and Prettier configuration                   | nothing            |

`domain`, `contracts` and `analytics` contain **no I/O and no vendor SDKs** — they are
types and constants. That is what makes them safe to depend on from the mobile app, the
admin console and Edge Functions alike, and it is why §4.3's "typed service interfaces so
individual vendors can be changed later without rewriting screens" is achievable.

Packages are consumed as **raw TypeScript source** (`"main": "src/index.ts"`), transpiled by
Metro through `babel-preset-expo`. There is no build step, no bundler and no Turborepo — a
deliberate simplification while the workspace is this small.

## State ownership (§6.3)

| State                         | Owner                                                 | Arrives in  |
| ----------------------------- | ----------------------------------------------------- | ----------- |
| Remote persistent state       | TanStack Query + repositories                         | Milestone 1 |
| Authentication session        | Auth provider                                         | Milestone 1 |
| Multi-step registration draft | Persisted local draft with an explicit version number | Milestone 1 |
| Purely visual state           | Component state, or Zustand                           | as needed   |
| Form state                    | React Hook Form                                       | Milestone 1 |

> Do not duplicate server records into a global client store.

## Error contract (§6.4)

Every service error becomes a typed `AppErrorCode` before it reaches a screen. Screens show
human guidance from `APP_ERROR_MESSAGES` and never expose raw backend messages. The client
logs only the code and the request id (§12.3).

## Feature flags (§6.5)

Nine server-managed flags, **all defaulting to `false`**. The beta home and every future
module is gated by one, so an unfinished feature can never look functional to a tester
(§3.3). See `packages/domain/src/feature-flags.ts`.
