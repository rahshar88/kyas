# Architecture Decision Records

Spec §22: _"Record each approved decision in docs/decisions as an Architecture Decision
Record."_

| ADR                                    | Title                                               | Status   |
| -------------------------------------- | --------------------------------------------------- | -------- |
| [0001](0001-mobile-stack.md)           | Mobile technology stack and pinned versions         | accepted |
| [0002](0002-monorepo-and-tooling.md)   | Monorepo layout, pnpm hoisting and config placement | accepted |
| [0003](0003-environment-validation.md) | Environment configuration and fail-loud validation  | accepted |
| [0004](0004-eas-project-ownership.md)  | EAS project ownership and untethered distribution   | accepted |
| [0005](0005-transactional-email.md)    | Transactional email provider (Resend)               | accepted |
| [0006](0006-referral-code-storage.md)  | Storing referral codes in readable form             | accepted |

## Decisions the coding agent may NOT make alone (§22)

The agent may prepare recommendations, but the founder decides:

- Final legal entity name used in store listings
- Apple and Google developer-account ownership — the **EAS** side is decided in
  [ADR-0004](0004-eas-project-ownership.md); Apple and Google remain open
- Production Supabase region and paid plan
- Privacy-policy and retention wording
- Whether student verification requires documents
- Social-login providers
- Analytics and error-reporting vendors, if they process personal data — the **email**
  provider is decided in [ADR-0005](0005-transactional-email.md); analytics and crash
  reporting remain open
- Notification campaigns
- Premium pricing and entitlements
- Business advertising categories
- Dating launch and safety rules
- AI provider and Kya memory policy

Each of these gets an ADR when it is decided.
