# Runbook — CI and quality gates

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main` and `beta`.

## Jobs

| Job                      | What it proves                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `quality`                | §5.4 gates: format, lint, strict types, unit tests, plus the eas.json secret scan                                  |
| `config-validation` (×3) | Identifiers, links and permissions are correct per environment, and both native projects generate from this commit |
| `bundle`                 | Metro compiles iOS **and** Android from one commit — the §20 claim, minus signing                                  |
| `security`               | §13.1: dependency audit, Expo SDK compatibility, gitleaks                                                          |

## Why `config-validation` is matrixed over three environments

A wrong identifier only shows up in the environment that uses it. Running all three catches
a beta build wired to the production bundle id before it reaches TestFlight.

## What the native verification actually checks

`scripts/verify-native-output.mjs` reads the **generated** `Info.plist`, `project.pbxproj`,
entitlements, `build.gradle` and `AndroidManifest.xml`. Checking `expo config` alone would
only prove the JavaScript object is right, not that the value survived into the native
project — a config-plugin regression or an SDK upgrade could break that silently.

Note on Android permissions: `blockedPermissions` does not delete the entry, it emits
`tools:node="remove"` for the Gradle manifest merger. The verifier treats a permission as
banned if it is absent **or** carries that directive, and fails if a dependency has
reintroduced it as a live request.

## The dependency audit allow-list

`pnpm audit --audit-level=high` blocks the `security` job. Two advisories are exempted in
`package.json` under `pnpm.auditConfig.ignoreGhsas`, because JSON cannot carry the reasoning:

| Advisory              | Package      | Why exempt                     |
| --------------------- | ------------ | ------------------------------ |
| `GHSA-w3rx-r6r6-pgpr` | `image-size` | ICNS parser infinite loop      |
| `GHSA-5p2g-fcmc-qvqq` | `image-size` | JXL/HEIF parser infinite loops |

Both reach us only through `expo → @expo/metro → metro`, and **both report
`patched: <0.0.0`, meaning no fixed version exists**. Metro is the build-time bundler: it
parses images on a developer's machine or a CI runner, never on a tester's phone, and the
images it parses are the ones committed to this repository. Triggering either bug would
require committing a malicious image to our own assets.

The gate stays _blocking_ rather than being downgraded to `--audit-level=critical`, so any
**new** high-severity advisory still fails CI. Re-check this list whenever the Expo SDK is
upgraded (§25 requires revalidating references before a major upgrade anyway); if `metro`
moves to a patched `image-size`, delete the entries.

## Branch protection

§5.4 requires a pull request to merge to `main`. Configure these as required checks (a
GitHub setting, not a file):

- `quality`
- `config-validation (development)`, `(beta)`, `(production)`
- `bundle`
- `security`

## What CI does NOT prove

CI runs on Linux. It cannot compile Xcode or Gradle projects, run a simulator or emulator,
execute Maestro flows, or produce a signed build. Milestone 0's exit criterion — _"the
signed development app opens on iOS and Android"_ — requires a Mac and store accounts, and
is signed off there. See the README's verification section for the full list.
