# Runbook — local development

## First run

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # then fill in the Supabase values
pnpm --filter @kyascene/mobile start
```

## Common failures

### `EnvValidationError: KyaScene environment configuration is invalid`

Working as designed (ADR-0003). The message lists every missing or malformed variable. Copy
`.env.example` to `.env` and fill it in.

### `Cannot find module '@kyascene/…'`

`pnpm install` was not run after adding the dependency, or the package is missing
`@kyascene/config` in its devDependencies (needed for `tsconfig.json` to resolve the shared
base). Run `pnpm install` from the repository root, not from inside a package.

### Metro resolves two copies of React ("invalid hook call")

Check `.npmrc` still has `node-linker=hoisted`, and that `pnpm.overrides` in the root
`package.json` still pins `react`, `react-dom` and `react-native`. See ADR-0002.

### `expo-doctor` reports a version mismatch

Do not silence it. It means a dependency has drifted off the Expo SDK 57 pins recorded in
ADR-0001. `pnpm exec expo install --check` inside `apps/mobile` proposes the right versions.

## Useful commands

| Command                                   | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `pnpm run typecheck`                      | strict TypeScript across every package           |
| `pnpm run lint` / `pnpm run format:check` | the CI style gates                               |
| `pnpm run test`                           | Jest, both the iOS and Android projects          |
| `pnpm run mobile:config`                  | resolved Expo config for the current environment |
| `pnpm run mobile:prebuild:check`          | generate both native projects                    |
| `pnpm run mobile:export`                  | bundle both platforms through Metro              |
| `pnpm run mobile:doctor`                  | Expo SDK compatibility audit                     |
| `pnpm run verify:eas`                     | eas.json structure and secret scan               |
| `pnpm run assets:generate`                | regenerate placeholder icons                     |

## Regenerating native projects

`ios/` and `android/` are gitignored and generated on demand. Never edit them by hand —
the next `expo prebuild --clean` discards the change. Native configuration belongs in
`app.config.ts` or a config plugin.
