# Navigation

The full §8.1 route map, with the milestone that owns each route. Milestone 0 ships only
the launch screen and `(public)/welcome` — §21.2 limits it to exactly that.

## Route map (§8.1)

| Route                             | Screen                              | Status |
| --------------------------------- | ----------------------------------- | ------ |
| `index`                           | S00 Launch and session restoration  | ✅ M0  |
| `+not-found`                      | Unknown deep link                   | ✅ M0  |
| `(public)/welcome`                | S01 Welcome                         | ✅ M0  |
| `(public)/sign-in`                | S02 Email sign-in                   | M1     |
| `(public)/verify-email`           | S03 Verify email                    | M1     |
| `(public)/legal/privacy`          | Privacy policy                      | M1     |
| `(public)/legal/terms`            | Terms                               | M1     |
| `(registration)/eligibility`      | S05 Eligibility                     | M1     |
| `(registration)/study`            | S06 Study details                   | M1     |
| `(registration)/sydney-location`  | S07 Sydney location                 | M1     |
| `(registration)/india-background` | S08 India background                | M1     |
| `(registration)/languages`        | S09 Languages                       | M2     |
| `(registration)/communities`      | S10 Cultural communities            | M2     |
| `(registration)/interests`        | S11 Interests                       | M2     |
| `(registration)/goals`            | S12 Goals                           | M2     |
| `(registration)/photo`            | S13 Profile photograph              | M2     |
| `(registration)/privacy`          | S14 Privacy preferences             | M2     |
| `(registration)/consent`          | S15 Terms, privacy and beta consent | M2     |
| `(registration)/review`           | S16 Review profile                  | M2     |
| `(registration)/submitted`        | S17 Registration status             | M2     |
| `(approved)/home`                 | S18 Beta home                       | M3     |
| `(approved)/invite`               | S19 Invite friends                  | M3     |
| `(approved)/feedback`             | S20 Beta feedback                   | M3     |
| `(approved)/profile`              | S21 Profile and settings            | M3     |
| `(approved)/settings`             | S21 Settings                        | M3     |
| `(approved)/delete-account`       | S22 Delete account                  | M3     |

S04 (beta invitation) sits in the registration flow and is added in Milestone 1.

## Why the empty groups do not exist yet

`(registration)` and `(approved)` have **no route files** in Milestone 0, deliberately:

- §21.2 says "minimal launch screen and welcome route only".
- An Expo Router group with no leaf routes still produces typed-route entries, so
  `router.push('/(registration)')` type-checks and then fails at runtime.
- Empty placeholder screens are worse: they look like an implemented shell and invite the
  next milestone to skip the design step.

What does exist is the **rule**, as a pure function:
`apps/mobile/src/navigation/route-groups.ts` implements §8.2's guard table over
`AccountStatus`, and its test covers all nine statuses exhaustively via
`satisfies Record<AccountStatus, RouteGroup>` — so adding a status without deciding where it
routes is a compile error. Milestone 1 wires it to the real server status query.

## Routing rules (§8.2)

| Condition                               | Destination                              |
| --------------------------------------- | ---------------------------------------- |
| No session                              | Public welcome or sign-in                |
| Verified session, incomplete onboarding | Resume the last valid onboarding step    |
| Submitted, awaiting review              | Submitted-status screen                  |
| Approved                                | Beta home                                |
| Rejected                                | Respectful status and support path       |
| Suspended                               | Suspended status and appeal/support path |
| Deleted                                 | Session cleared, public welcome          |

> **Route guards must be derived from server status, not only client state.**

This is why `resolveRouteGroup` takes an `AccountStatus` and nothing else — no local flags,
no draft inspection. A client-side-only guard is a bug, not a shortcut.

## Deep links (§4.5)

- URL scheme: `kyascene`
- Universal / app link host: `kyascene.app`, configured in `app.config.ts` for beta and
  production only — development has no verified domain to associate with.
- iOS uses `associatedDomains: ['applinks:kyascene.app']`; Android uses an `autoVerify`
  intent filter. Both require files hosted at `kyascene.app`
  (`/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`), which is a
  Milestone 4/5 task.
- §S19: a shared referral link must carry an **opaque code, never the inviter's user id**.
