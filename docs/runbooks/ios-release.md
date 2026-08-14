# Runbook — iOS closed beta

§18's release checklist, as something to work through rather than read. Each line is either
**done**, **blocked on a founder decision**, or has a command beside it.

§21.6 is explicit: _"Do not submit until all P0 gates pass."_ The gates are automated; the
account and legal work is not, and that is what most of this runbook is.

---

## Where it stands

| §18 line                                          | State                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| P0 acceptance criteria complete                   | ✅ M0–M3 built; M3 not yet exercised on a device                   |
| Test data removed from beta project               | ⬜ see "Clearing test data" below                                  |
| Support and feedback monitored                    | ⬜ needs a named owner                                             |
| Feature flags default safe                        | ✅ every unbuilt feature off, asserted by a database test          |
| Version and build visible in Settings             | ✅ S21 shows both                                                  |
| Apple Developer account with two-factor           | ⬜ founder                                                         |
| Bundle identifiers registered                     | ⚠️ `app.kyascene.beta` registered; **`app.kyascene` is not**       |
| App Store Connect record created                  | ⬜ founder                                                         |
| Certificates and profiles through EAS             | ✅ EAS-managed since the first preview build                       |
| Privacy policy and support URL live               | ⬜ **blocker** — §16.4 makes a missing privacy link a ship blocker |
| App privacy answers match real behaviour          | ✅ drafted and gated — `docs/product/privacy-disclosures.md`       |
| Account deletion available in-app                 | ✅ S22                                                             |
| Camera/photo descriptions explain the user action | ✅ asserted by CI for all three environments                       |
| TestFlight internal testing before external       | ⬜ after the first `beta` build                                    |
| Registration approval owner named                 | ⬜ founder                                                         |
| Support response owner named                      | ⬜ founder                                                         |
| Safety escalation path documented                 | ⬜ see "Safety escalation" below                                   |
| Daily beta metrics reviewed in week one           | ⬜ queries are in `beta-operations.md`                             |
| Rollback or feature-disable path tested           | ✅ documented and testable — see below                             |

---

## Before anything else: the four blockers

These cannot be worked around, and three of them are only yours to do.

**1. A live privacy policy, terms and support page.** §16.4 makes a missing privacy or terms
link a release blocker, and Apple will not review an app whose privacy URL does not resolve.
`docs/product/privacy-disclosures.md` says exactly what the policy has to cover, because it was
derived from the schema rather than from memory.

**2. A retention policy.** §S22 closes an account and records the request; what happens at
`scheduled_for` is undefined. Both stores ask what becomes of deleted data, so this blocks an
_accurate_ answer rather than merely a complete one.

**3. `app.kyascene`.** §4.5 wants the production identifier confirmed before the first signed
build. `app.kyascene.beta` was registered when the first preview build was signed.

**4. Email delivery.** Custom SMTP is still not configured, so nobody can receive a sign-in
code without you generating it by hand. A closed beta of twenty people is possible that way;
fifty is not. See `email-delivery.md`.

---

## Clearing test data

§18: _"Test data removed from beta project."_ Beta and production are separate Supabase
projects (§5.2), so this is about the beta project specifically — the accounts created while
building, including your own repeated registrations.

Check what is there:

```sql
select p.status, count(*) from public.profiles p group by p.status order by 2 desc;
```

```sql
select u.email, p.status, p.created_at
  from public.profiles p join auth.users u on u.id = p.user_id
 order by p.created_at;
```

Deleting a user from `auth.users` cascades through every table that references it, which is
what the foreign keys were written for. Do this in the **beta** project, never production:

```sql
delete from auth.users where email in ('someone@example.test', 'another@example.test');
```

Keep the operator account and its `admin_users` row, or you will lock yourself out of the
console.

---

## The build

```bash
cd ~/kyas && git pull && pnpm install
```

```bash
pnpm run supabase:deploy <project-ref>
```

The ref is the subdomain of your project URL — for `https://abcdefgh.supabase.co` it is
`abcdefgh`. There is deliberately no default: §5.2 keeps beta and production separate, so the
script refuses to deploy to a project you have not named.

```bash
pnpm run eas:build:preview
```

`preview` is internal distribution against the development environment — the right thing for
your own device. TestFlight needs the `beta` profile, which requires the Sentry and analytics
values §20 mandates for that environment:

```bash
cd apps/mobile && npx eas-cli@latest build --profile beta --platform ios
```

That profile will refuse to build until `EXPO_PUBLIC_SENTRY_DSN` and
`EXPO_PUBLIC_ANALYTICS_KEY` exist as EAS environment variables. That refusal is deliberate
(ADR-0003): a beta build that silently reports nothing is worse than one that will not start.

If you decide not to use a crash or analytics vendor at all, say so and the `beta` profile's
schema should be relaxed rather than filled with placeholder values — a placeholder DSN means
a build that thinks it is reporting and is not.

---

## TestFlight

1. **App Store Connect → your app → TestFlight.** The build appears a few minutes after EAS
   finishes uploading.
2. **Export compliance.** KyaScene uses HTTPS and nothing else, so the answer is that it uses
   only exempt encryption. Answer it once and it applies to later builds.
3. **Internal testing first** (§18). Up to 100 people on your own team, no review needed.
4. **External testing** needs a Beta App Review — usually a day. What gets rejected at this
   stage is almost always a missing privacy URL or a demo account that does not work.
5. **The demo account.** Reviewers cannot register: KyaScene is invite-only and requires
   operator approval. Provide an already-approved account and an invitation code in the review
   notes, or the app is untestable and will be rejected as such.

Draft review notes:

> KyaScene is an invite-only community app for students from India studying in Sydney.
> Registration requires an invitation code and manual approval by our team, so please use the
> account below, which is already approved.
>
> Email: `<reviewer account>` — sign-in is a one-time code sent to that address; contact us at
> `<support email>` and we will provide it immediately.
> Invitation code (if you wish to test registration): `<a code with spare capacity>`

---

## Rollback and feature-disable

§18 asks for this path to be **tested**, not just to exist. There are three, in increasing
order of disruption.

**Turn a feature off** — seconds, no build, no review:

```sql
update public.feature_flags set enabled = false, updated_at = now() where key = 'feedback_enabled';
```

Takes effect on each app's next flag fetch. This is the one to reach for first, and it is worth
actually doing once on a real device before the beta starts, so you know what it looks like.

**Roll back the JavaScript** — minutes, no review. EAS Update keeps history, so republishing a
known-good update is the fastest recovery from a bad release:

```bash
pnpm run eas:versions
```

```bash
cd apps/mobile && npx eas-cli@latest update:republish --branch preview
```

**Roll back the binary** — hours. Only for native-layer breakage. Build again from a known-good
commit and distribute that.

Rehearse the first two before the beta opens. A rollback path first used during an incident is
not a rollback path.

---

## Safety escalation

§18 requires this documented, and §S20 has a `safety_concern` feedback category that must go
somewhere.

Until a named person exists, the path is: `safety_concern` feedback is checked **daily** with
the query in `beta-operations.md`; anything describing harm to a person is acted on within the
day; suspension is immediate and reversible, so the safe default is to suspend and then find
out.

```sql
select * from public.feedback where category = 'safety_concern' order by created_at desc;
```

Suspension is in the console — Users → search → Suspend, with a reason. It goes to the audit
log, and §13.3's reinstatement returns the account to review rather than straight to approved.

**This is a placeholder, not a policy.** §18 wants a named owner and it should not be a
`SELECT` statement.

---

## App Store Connect metadata — draft

Yours to edit. Written to be accurate rather than promotional.

**Name:** KyaScene
**Subtitle:** For Indian students in Sydney
**Category:** Social Networking
**Age rating:** 17+ — user-generated content and unmoderated social features are planned;
rating down later is harder than rating up.

**Promotional text** (changeable without review):

> Early access. We are building KyaScene with the first students who join, so tell us what is
> missing.

**Description:**

> KyaScene is a community app for students from India studying in Sydney.
>
> Moving countries to study is hard in ways nobody warns you about — finding somewhere to live,
> finding people who understand where you are from, working out how anything works. KyaScene is
> being built to make that easier, with the people going through it.
>
> This is an early, invite-only beta. Right now you can create a profile, tell us what you need
> first, and help decide what we build. Finding people, events, housing and the rest are coming,
> and the order depends on what testers ask for.
>
> KyaScene is free. You need an invitation from someone already in, and a person reviews every
> registration.
>
> What we ask for and why:
> • Your name and an optional photo, so people can recognise you
> • Where you study and roughly where you live — the suburb, never your address
> • Which languages and communities you identify with, if you want to share them
> • What you need first, so we build that first
>
> You choose what other students can see. We never ask for your exact location, your contacts
> or identity documents.

**Keywords:** indian students,sydney,international students,community,australia,student life

**Support URL / Privacy Policy URL:** blocked on item 1 above.

---

## The gates, before you submit

```bash
pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run test
```

```bash
pnpm run test:rls && pnpm run test:functions
```

```bash
pnpm run verify:privacy && pnpm run verify:consent && pnpm run verify:cors
```

All of these run in CI on every pull request. Running them by hand before a submission is
worth the two minutes: a red CI badge on the commit you shipped is a bad thing to discover
afterwards.

**And the one that is not automated:** walk the whole flow on a real device. Every bug that
reached a tester in Milestones 1 and 2 was found this way and none by the suite, because each
lived at a seam between two systems that a unit test owns both sides of.
