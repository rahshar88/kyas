# Maestro end-to-end flows

## Why these are not run in CI

Maestro drives a real simulator or emulator. The Linux CI runner has neither Xcode nor the
Android SDK, so these flows are authored and reviewed here but executed on a developer
machine. Wiring them into CI needs a hosted device farm — a decision for Milestone 3, when
the §16.2 scenario list is complete enough to be worth the cost.

## Running locally

```bash
curl -Ls https://get.maestro.mobile.dev | bash     # once
pnpm --filter @kyascene/mobile ios                 # or: android
maestro test apps/mobile/.maestro/flows
```

## Required P0 scenarios (§16.2)

Milestone 0 covers only the first line. The rest arrive with the milestone that builds the
screens they exercise — a flow written before its screen exists cannot be run, and an
unrunnable flow rots.

| Scenario                                                    | Milestone |
| ----------------------------------------------------------- | --------- |
| Launch reaches Welcome                                      | ✅ M0     |
| New invited eligible tester completes registration          | M2        |
| Invalid and expired OTP are handled                         | M1        |
| Invalid, expired and exhausted invitation codes are handled | M1        |
| Ineligible user receives the correct outcome                | M1        |
| Registration draft resumes after force-closing the app      | M1        |
| Offline save failure preserves local answers                | M1        |
| Pending registration becomes approved after refresh         | M2        |
| Referral link survives install/open flow                    | M3        |
| Privacy controls change the preview                         | M2        |
| Profile photo permission denial is recoverable              | M2        |
| Account deletion is requested successfully                  | M3        |
| Suspended account cannot enter approved routes              | M2        |
