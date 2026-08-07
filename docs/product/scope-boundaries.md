# Scope boundaries

A guardrail against scope drift, drawn from spec §1.1, §1.2 and §3.3. Read this before
adding anything to the beta.

## Priority vocabulary (§1.1)

| Level      | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| **P0**     | Required before the Sydney registration beta can be invited |
| **P1**     | Next release after the registration beta is stable          |
| **P2**     | Useful after early product-market learning                  |
| **Future** | Deliberately excluded from the current build                |

## The operating rule (§1.2)

> The coding AI must never implement a later milestone merely because related UI appears in
> a concept image. It must complete the current milestone, tests, documentation and
> acceptance checks before moving forward.

Concept artwork communicates brand direction and long-term ambition. It is **not** an
implementation specification. Where a concept image conflicts with the spec, the spec wins.

## Explicit P0 non-goals (§3.3)

Do **not** build these into the registration beta:

|                                        |                                   |
| -------------------------------------- | --------------------------------- |
| Public video feed                      | Likes, comments or public posting |
| Private messaging                      | Groups                            |
| Events                                 | Accommodation listings            |
| Job listings                           | Marketplace                       |
| Business advertising                   | Student subscriptions             |
| Payments                               | Dating                            |
| Live or background location            | Contact-book upload               |
| Kya AI chat                            | Voice assistant                   |
| Automated identity-document processing |                                   |

> Placeholders or feature-voting cards may be shown, but **no incomplete feature may appear
> functional.**

That last sentence is why every future module is behind a server feature flag defaulting to
`false` (§6.5, `packages/domain/src/feature-flags.ts`).

## Data that must never be collected in P0 (§13.2)

- No exact GPS, and no background location
- No street address
- No contact-book upload
- No religion field
- No identity-document retention
- No public email address or telephone number
- No analytics event containing names, email addresses, phone numbers or free text

The first four are enforced mechanically: `app.config.ts` blocks the corresponding Android
permissions, and `scripts/verify-native-output.mjs` fails CI if any reappears in the
generated manifest. The last is enforced by the type of `AnalyticsProperties`
(`packages/analytics/src/properties.ts`) — attaching personal data is a compile error.

## Audience and age boundary (§2.4, §2.5)

The community is only for people from India currently studying in Australia, or holding a
confirmed upcoming Australian course. The Sydney beta is limited to Greater Sydney. Users
must be **18 or older** — under-18 onboarding, guardianship and child-safety workflows are
not part of P0.

## What Milestone 0 deliberately did not do

So the next agent does not assume the stack is fully wired:

- No Supabase client, migrations, tables or RLS — Milestone 1 adds them together
- No authentication, invite redemption, eligibility or registration logic
- 6 of the 26 §7.4 components built; the rest arrive with the screen that needs them
- No `(registration)` or `(approved)` route files — the §8.2 rules exist and are tested as
  a pure function, but the screens do not
- No Sentry or analytics vendor — §22 reserves those choices for the founder
- No EAS project id, no signed build, no store record
