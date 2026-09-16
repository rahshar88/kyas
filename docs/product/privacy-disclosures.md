# App Store privacy answers and Play Data Safety

**Status: drafted from the code, awaiting founder review before submission.**

§18 requires that _"app privacy answers match real SDK and data behaviour"_, and §16.4 makes a
mismatch a release blocker. This document is that answer set, derived from
[`data-inventory.json`](data-inventory.json) — which classifies all **155 columns across 25
tables** and is checked against the migrations by `scripts/verify-privacy-disclosure.mjs` on
every pull request.

That check is the point. These forms are filled in once, months before a schema changes, and
nothing normally connects a migration to a declaration made in App Store Connect. Now a new
column fails the build until somebody says what it holds.

**An inaccurate privacy declaration is not a documentation defect.** It is a false statement to
a regulator, to Apple and to every person who read it before deciding whether to register.

---

## What the app actually does

Established by reading the code, not by recollection:

| Question                           | Answer                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Third-party SDKs that collect data | **None shipping today.** Analytics and crash reporting sit behind adapters with no-op implementations; the vendor is a §22 decision              |
| Push notification service          | **Apple APNs and Expo**, for token registration only. A token is minted by Apple and exchanged through Expo's service; nothing is sent           |
| Data sent to a third party         | **None today.** The only network destination is the project's own Supabase instance                                                              |
| Tracking across apps or websites   | **No.** No advertising identifier is read, no attribution SDK is present                                                                         |
| Precise location                   | **No.** `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` and `ACCESS_BACKGROUND_LOCATION` are blocked in the Android manifest and asserted by CI |
| Contacts                           | **No.** `READ_CONTACTS` is blocked and asserted by CI                                                                                            |
| Microphone                         | **No.** `RECORD_AUDIO` is blocked and asserted by CI                                                                                             |
| Identity documents                 | **No.** §13.2 forbids retaining them in P0, and no screen asks                                                                                   |
| Payment information                | **No.** KyaScene is free (§2.3) and has no payment path                                                                                          |

The blocked permissions are worth stating precisely, because "we do not use location" is a
promise anyone can make. In KyaScene it is a line in `app.config.ts` and a CI job that reads
the **generated** `AndroidManifest.xml` and fails if any of the four appear.

---

## Apple — App Privacy

### Contact Info → Email Address

- **Collected:** yes
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** the Supabase auth record, plus `student_profiles.student_email` when a student
  supplies an institutional address

Sign-in is a one-time code sent by email (§4.6), so an address is the account. The optional
student email exists so an operator can see an `.edu.au` domain during review.

### Contact Info → Name

- **Collected:** yes
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `profiles.display_name`

Collected at §S13. It is what other students would see, and what the review console shows.

### User Content → Photos

- **Collected:** yes, optional
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `profiles.avatar_path`, pointing at a private storage object

A profile photo is optional throughout (§S13). It is resized on the device and stripped of
metadata — including the location the camera recorded — before upload.

### User Content → Customer Support

- **Collected:** yes
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `feedback.comment`, `feedback.screenshot_path`, `deletion_requests.reason`

Free text a person wrote. Treated as the highest-risk data in the product: never sent to
analytics, and the §S20 screen warns against including passwords or identity documents
**above** the field rather than below it.

### Identifiers → User ID

- **Collected:** yes
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** every table, as `user_id`

### Identifiers → Device ID

- **Collected:** yes, optional
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `push_tokens.token`

An Expo push token, stored only if someone turns notifications on at S21 → Notifications. It
identifies a device rather than a person, and it is linked to identity because the row carries
`user_id` — that is what makes a notification reach the right phone.

Declared from **14 August**, when an Apple Push Notifications key was generated and a real
device stored a token for the first time. Before that `getExpoPushTokenAsync` threw without the
`aps-environment` entitlement, so the table could not fill on iOS at all. The column existed
and was classified; what changed is that it stopped being unreachable.

**Nothing is sent.** Milestone 3 registers tokens and has no send path (§21.5). The
notifications screen says so in those words, because asking for permission and then never using
it is how people learn to decline.

### Other Data

- **Collected:** yes
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `student_profiles` (education provider, course, level, intake and completion
  dates, suburb, postcode, arrival status, Indian state, hometown), `profile_languages`,
  `profile_communities`, `profile_interests`, `profile_goals`, `profile_visibility`,
  `consents`, `feature_votes`

Apple has no category for "which Indian state you are from" or "how well you speak Punjabi", so
these belong under Other Data. **Cultural community and language are sensitive in substance
even though Apple's form has no such box**, and they are handled accordingly: optional, never
inferred from anything else (§S10), and covered by per-field visibility controls the student
sets (§S14).

### Location

- **Collected:** yes — **coarse only**
- **Linked to identity:** yes
- **Used for tracking:** no
- **Purposes:** App Functionality
- **Where:** `student_profiles.suburb`, `student_profiles.postcode`

Declared as Coarse Location and not Precise. The distinction is structural rather than a policy
promise: the schema has no column for a street address or a coordinate pair, the location
permissions are blocked at the manifest, and the student types a suburb name into a form. There
is no code path by which a precise location could be obtained.

### Not collected

Health, fitness, financial info, payment info, browsing history, search history, purchase
history, sensitive info as Apple defines it, contacts, precise location, advertising data,
audio, and any form of tracking identifier.

---

## Google Play — Data Safety

Play asks two questions Apple does not, and both have good answers here.

**Is data encrypted in transit?** Yes. All traffic is HTTPS to Supabase; there is no other
destination.

**Can users request that data be deleted?** Yes, in the app, at §S22 — Profile and settings →
Delete my account. §19 additionally requires _"a functional web account-deletion request
path"_ for Android, which does **not exist yet** and is tracked as a Milestone 5 blocker below.

| Data type              | Collected | Shared | Required | Purpose           |
| ---------------------- | --------- | ------ | -------- | ----------------- |
| Name                   | Yes       | No     | Required | App functionality |
| Email address          | Yes       | No     | Required | App functionality |
| User IDs               | Yes       | No     | Required | App functionality |
| Device or other IDs    | Yes       | No     | Optional | App functionality |
| Photos                 | Yes       | No     | Optional | App functionality |
| Approximate location   | Yes       | No     | Required | App functionality |
| Other personal info    | Yes       | No     | Required | App functionality |
| In-app support content | Yes       | No     | Optional | App functionality |

**Shared is "No" throughout**, and that will remain true only while no analytics or crash
vendor is enabled. Turning either on changes several rows in this table — see below.

---

## What changes when a vendor is turned on

Analytics and crash reporting are §22 decisions still open. Both are wired behind adapters with
no-op implementations, so enabling one is a configuration change — which is exactly why the
consequence needs writing down now rather than being discovered at submission.

**Enabling analytics** makes "Data shared with third parties" true, and adds Product
Interaction / Analytics to both forms. What would be sent is bounded by the
`AnalyticsProperties` allowlist — eight keys, every one an identifier we chose rather than
anything a person typed — and the privacy gate fails if that type grows without this document
being updated. The comment someone writes in §S20 never appears there.

**Enabling crash reporting** makes "Diagnostics → Crash Data" true, and typically "Other
Diagnostic Data". Crash reports are the classic accidental leak: a stack trace can carry a
form field, an email in a URL, or a user id in a breadcrumb. `packages/observability` scrubs
before sending rather than trusting a vendor's own filter.

---

## Open before submission

These are the founder's, not engineering's:

1. **A privacy policy at a live URL** that says what this document says. §16.4 makes a missing
   privacy link a ship blocker, and §18 requires the URL to resolve before review.
2. **Terms of use and a support URL**, same requirement.
3. **The analytics and crash vendors** (§22), including whether either is worth the
   declaration it forces.
4. **A retention policy.** §S22 currently records a deletion request and closes the account;
   what happens at `scheduled_for` is undefined, and Apple and Google both ask what becomes of
   deleted data. This is the one open item that blocks an accurate answer rather than merely
   an incomplete one.
5. **A web deletion path** (§19), before Android closed testing.

## Keeping this true

```bash
node scripts/verify-privacy-disclosure.mjs
```

Runs on every pull request. It fails when a table or column appears in the migrations without a
classification, when a classification is removed while the column still exists, and when the
analytics allowlist grows. Each of those is a moment where a privacy answer may have silently
stopped being accurate.
