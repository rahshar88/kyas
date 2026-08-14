# KyaScene — Native App Development Master Specification

> **Version 1.0 Foundation · Approved for engineering start · 7 August 2026 · Owner: 1818**
>
> Committed verbatim from the source DOCX so the repository is self-contained and the
> specification is version-controlled alongside the code it governs.
>
> Per §1: this document is the source of truth for the first KyaScene mobile application,
> and it overrides concept artwork wherever naming, pricing, platform, safety or milestone
> scope differs. Structural formatting (tables, images) is flattened by the conversion;
> the original DOCX remains authoritative for layout.

---

KyaScene
POWERED BY 1818
ENGINEERING FOUNDATION · IOS FIRST · ANDROID SECOND
Native App DevelopmentMaster Specification
The build-ready product, architecture, screen and release brief for the Sydney Registration Beta.
Document metadata
Value
Version
1.0 Foundation
Status
Approved for engineering start
Date
7 August 2026
Owner
1818
Primary domain
kyascene.app
First release
iOS closed beta · Sydney
Build the smallest trustworthy native product that can register and onboard Indian students in Sydney, learn from them quickly, and grow without requiring a rewrite.
CONFIDENTIAL PRODUCT SYSTEM

## Document map

This specification is organised for execution. Product decisions and scope come first, followed by architecture, detailed screens, data, security, testing, delivery milestones and copy-ready coding-agent prompts.
Approved product and beta scope
Technical baseline, repository and architecture
Brand system, navigation and 23 P0 screens
Data model, API contracts, security and analytics
Private administration and testing
iOS-first and Android-second release milestones
Coding AI operating prompts and future roadmap
Decision hierarchy: this specification overrides concept artwork whenever naming, pricing, platform, safety or milestone scope differs.

## 1. How to use this document

This is the source of truth for the first KyaScene mobile application. It is written for a coding AI, a mobile engineer, a product designer and the founder. The coding agent must implement one milestone at a time, respect the scope boundaries, and treat every item marked P0 as required for the first external beta.
The visual concepts supplied with the KyaScene pitch communicate brand direction and long-term product ambition. They are not literal implementation specifications. Where a concept image conflicts with this document, this document wins.

### 1.1 Priority vocabulary

P0: required before the Sydney registration beta can be invited.
P1: next release after the registration beta is stable.
P2: useful after early product-market learning.
Future: deliberately excluded from the current build.

### 1.2 Engineering operating rule

The coding AI must never implement a later milestone merely because related UI appears in a concept image. It must complete the current milestone, tests, documentation and acceptance checks before moving forward.

## 2. Approved product decisions


### 2.1 Product definition

KyaScene is a mobile community and local-life application made exclusively for students from India who are studying in Australia. Sydney is the first market.
The long-term promise is:
Open KyaScene and find one useful person, place, opportunity or activity near you in under 30 seconds.

### 2.2 Launch position

Consumer experience: native mobile app only.
Platform sequence: iOS beta first, Android beta second.
Codebase: shared React Native codebase from day one.
First audience: invited Indian students in Sydney.
Tester price: free.
Public launch domain: kyascene.app.
Defensive domain: kyascene.io, redirected to the main brand.
Current marketing and tester recruitment: kyascene.1818.one.
Brand attribution: Powered by 1818, always secondary to KyaScene.
AI character: Kya, a feature inside KyaScene rather than a separate product.

### 2.3 Product principles

Nearby before global. Prioritise the student's local context.
Useful before viral. Housing, work, events, safety and belonging outrank empty engagement.
Trust by design. Verification, privacy, reporting and moderation are product features.
India is plural. State, city, culture, language and religion must never be collapsed into a single identity field.
Progressive disclosure. Ask only for information needed at the current step.
Exact location is private. The beta stores suburb-level location only.
Build for learning. Every beta release must create observable feedback.

### 2.4 Audience boundary

The consumer community is only for people from India who are currently studying in Australia or have a confirmed upcoming Australian course. The Sydney beta is limited to users living in, studying in, or preparing to arrive in Greater Sydney.

### 2.5 Age boundary

The beta is for users aged 18 or older. Under-18 onboarding, guardianship and child-safety workflows are not part of P0.

## 3. P0 outcome and non-goals


### 3.1 P0 outcome

A tester can receive an invitation, install the iOS beta, verify their email, complete a culturally respectful student profile, submit registration, receive approval, enter the beta home, invite another eligible student, submit feedback and delete their account.
An administrator can view registrations, approve or reject applicants, suspend access, review feedback, inspect referral performance and maintain an audit trail.

### 3.2 P0 success measures

Median completed registration time: under 3 minutes.
At least 70% of users who verify email complete registration.
At least 50% of approved testers return within seven days.
Crash-free sessions: at least 99.5% during closed beta.
Every administrative decision is recorded in an audit log.
Every tester can locate privacy controls and account deletion without support.
These are working beta targets, not investor forecasts.

### 3.3 Explicit P0 non-goals

Do not build these into the registration beta:
Public video feed
Likes, comments or public posting
Private messaging
Groups
Events
Accommodation listings
Job listings
Marketplace
Business advertising
Student subscriptions
Payments
Dating
Live location or background location
Contact-book upload
Kya AI chat
Voice assistant
Automated identity-document processing
Placeholders or feature-voting cards may be shown, but no incomplete feature may appear functional.

## 4. Recommended technical baseline


### 4.1 Architecture decision

Build one Expo/React Native application with iOS as the first release target. Android must compile in continuous integration from the first milestone, even though external Android testing follows iOS.
This avoids two independent products while preserving native navigation, permissions, store builds and platform-specific UI where needed.

### 4.2 Baseline versions

Baseline verified on 7 August 2026:
Expo SDK 57 stable
React Native 0.86
React 19.2.3
TypeScript with strict mode enabled
Node.js 22.13 or newer
Expo Router for file-based native navigation
EAS Build, EAS Submit and EAS Update
The coding agent must verify current stable compatibility before the first install. Do not use canary, alpha or beta packages in production builds.

### 4.3 Backend baseline

Use Supabase for the initial backend:
Supabase Auth for email one-time-password authentication
PostgreSQL for application data
Row Level Security for every user-accessible table
Storage for profile photographs
Edge Functions for privileged operations
Realtime reserved for later messaging and feed milestones
This is the recommended default for speed. The application must access backend capabilities through typed service interfaces so individual vendors can be changed later without rewriting screens.

### 4.4 Supporting libraries

Server state: TanStack Query
Local UI state: Zustand, limited to ephemeral state
Forms: React Hook Form
Validation: Zod, shared between forms and service boundaries
Secure secrets: Expo SecureStore
Images: Expo Image
Notifications: Expo Notifications
Error reporting: Sentry through an adapter
Analytics: PostHog or equivalent through an internal analytics adapter
Unit and component tests: Jest plus React Native Testing Library
End-to-end tests: Maestro
Do not install a large UI kit. Build KyaScene's small component library from design tokens.

### 4.5 Identity configuration

Product name: KyaScene
iOS bundle identifier, production: app.kyascene
Android application ID, production: app.kyascene
Beta identifiers: app.kyascene.beta
URL scheme: kyascene
Universal/app link host: kyascene.app
Display attribution: Powered by 1818
Confirm identifier availability in Apple Developer and Google Play Console before committing the first signed build.

### 4.6 Authentication choice for P0

Use email one-time codes for the first beta. Do not add Google authentication without also evaluating Sign in with Apple requirements. Social login can be added after the email flow is stable.

### 4.7 No consumer web application

Do not generate a browser version of the community. Web surfaces are limited to:
Marketing and beta instructions
Privacy policy and terms
Account-deletion request page required for Android distribution
Support
Private administrative console
Universal-link fallback pages

## 5. Repository and environment structure


### 5.1 Recommended monorepo

kyascene/  apps/    mobile/                 # Expo React Native app    admin/                  # Private operations console, introduced in P0  packages/    ui/                     # Design tokens and reusable mobile components    domain/                 # Domain types, validation schemas and policies    contracts/              # API request/response contracts    analytics/              # Vendor-neutral event adapter    config/                 # Shared lint, TypeScript and environment config  supabase/    migrations/    seed/    functions/    tests/  docs/    architecture/    decisions/    product/    runbooks/  .github/workflows/  app.config.ts  eas.json  package.json  pnpm-workspace.yaml

### 5.2 Environments

Use three isolated environments:
Environment
Purpose
Data
Development
Local engineering and automated tests
Synthetic only
Beta
TestFlight and Google Play closed testing
Real invited testers
Production
Public stores and national launch
Real public users
Never use production data in local development. Beta and production must have separate Supabase projects, storage buckets, signing configuration, analytics projects and push credentials.

### 5.3 Environment variables

Only publishable values may use the EXPO_PUBLIC_ prefix. Service-role keys, signing credentials and provider secrets must never be included in the mobile bundle.
Required public variables:
EXPO_PUBLIC_ENVIRONMENTEXPO_PUBLIC_SUPABASE_URLEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEYEXPO_PUBLIC_SENTRY_DSNEXPO_PUBLIC_ANALYTICS_KEYEXPO_PUBLIC_SUPPORT_URLEXPO_PUBLIC_PRIVACY_URLEXPO_PUBLIC_TERMS_URL
Privileged keys belong only in EAS secrets, CI secrets or backend function secrets.

### 5.4 Branching and delivery

main: releasable production history
beta: optional integration branch for closed testing
Short-lived feature branches per milestone story
Pull request required for merging to main
Every pull request runs formatting, lint, type-checking, unit tests and iOS/Android configuration validation
Tag signed beta builds using ios-beta-x.y.z-build.n and android-beta-x.y.z-build.n

## 6. Application architecture


### 6.1 Layering

Screens and routes      ↓Feature controllers and hooks      ↓Domain services and policies      ↓Typed repositories and API clients      ↓Supabase Auth, Database, Storage and Edge Functions
Screens must not contain direct database queries. Supabase calls belong in repository modules. Business rules belong in domain services or database policies, not in button handlers.

### 6.2 Feature module shape

src/features/registration/  components/  screens/  hooks/  services/  schemas/  types/  analytics/  __tests__/

### 6.3 State ownership

Remote persistent state: TanStack Query and repositories
Authentication session: auth provider
Multi-step registration draft: persisted local draft with explicit version number
Purely visual state: component state or Zustand
Form state: React Hook Form
Do not duplicate server records into a global client store.

### 6.4 Error contract

Every service error must become a typed application error:
type AppErrorCode =  | 'NETWORK_UNAVAILABLE'  | 'SESSION_EXPIRED'  | 'VALIDATION_FAILED'  | 'INVITE_INVALID'  | 'INVITE_EXHAUSTED'  | 'REGISTRATION_ALREADY_SUBMITTED'  | 'ACCOUNT_SUSPENDED'  | 'RATE_LIMITED'  | 'UNKNOWN';
Screens show human guidance and never expose raw backend messages.

### 6.5 Feature flags

The beta home and future modules must be controlled by server-managed feature flags. Minimum flags:
registration_open
invite_required
profile_photo_enabled
referrals_enabled
feedback_enabled
discovery_enabled
scene_feed_enabled
messaging_enabled
kya_enabled
Default every future flag to false.

## 7. Brand and mobile design system


### 7.1 Brand tokens

Token
Value
Purpose
Scene Emerald
#032C24
Primary brand and dark surfaces
Scene Saffron
#FF7A1A
Primary accent and important calls to action
Warm Cream
#F5F1E8
Light background
Night
#06110F
Dark background and high-contrast text
Mint
#61D89B
Positive status and secondary accent
Error
#C73B3B
Errors and destructive confirmation
Warning
#B06B00
Caution states

### 7.2 Typography

Use the platform system font for functional UI.
iOS renders with San Francisco through the system stack.
Android renders with Roboto through the system stack.
The KyaScene wordmark is an asset, not a substitute font.
Support Dynamic Type/font scaling without clipped content.

### 7.3 Spacing and geometry

Spacing scale: 4, 8, 12, 16, 24, 32
Radius: 12, 18, 24 and pill
Minimum interactive target: 48 by 48 logical units across both platforms
Main screen horizontal padding: 20
Card padding: 16 or 20
Bottom navigation safe-area aware

### 7.4 Core components required for P0

AppScreen
AppHeader
KyaSceneWordmark
PoweredBy1818
PrimaryButton
SecondaryButton
TextButton
DestructiveButton
IconButton
TextField
EmailField
SearchField
SelectField
MultiSelectChips
ChoiceCard
StepProgress
StatusBadge
StudentAvatar
ProfileSummaryCard
PermissionExplainer
InlineError
FullScreenError
EmptyState
LoadingSkeleton
Toast
ConfirmationSheet
OfflineBanner
Every component must support loading, disabled, focus, pressed and accessibility states where applicable.

### 7.5 Accessibility floor

WCAG AA colour contrast for text and essential controls
Screen-reader labels for icons and non-text controls
Logical focus order
Dynamic Type/font scaling
Reduced-motion support
No colour-only status communication
Form errors announced and associated with their fields
Keyboard-safe forms and visible focus handling

### 7.6 Tone of voice

Direct: “Verify your email”
Human: “What’s your scene?”
Respectful: “Choose any communities you identify with”
Specific: “Your suburb is visible only if you allow it”
Calm in errors: “We couldn’t save this yet. Your answers are still on this phone.”

## 8. Navigation model


### 8.1 P0 route groups

(public)/  welcome  sign-in  verify-email  legal/privacy  legal/terms(registration)/  eligibility  study  sydney-location  india-background  languages  communities  interests  goals  photo  privacy  consent  review  submitted(approved)/  home  invite  feedback  profile  settings  delete-account

### 8.2 Routing rules

No session: public welcome or sign-in.
Verified session with incomplete onboarding: resume the last valid onboarding step.
Submitted registration awaiting review: submitted-status screen.
Approved registration: beta home.
Rejected registration: respectful status and support path.
Suspended account: suspended status and appeal/support path.
Deleted account: session cleared and public welcome.
Route guards must be derived from server status, not only client state.

## 9. P0 screen specifications


### S00 — Launch and session restoration

Purpose: Start quickly, restore a valid session and route safely. UI: KyaScene wordmark, dark emerald background, subtle progress treatment and Powered by 1818. Logic: Check secure session, network state, onboarding draft version and server account status. Failure: After a bounded timeout, show retry and offline guidance. Never trap the user on a permanent splash screen. Analytics: app_opened, session_restore_succeeded, session_restore_failed. Acceptance: A returning approved tester reaches home without seeing authentication; a signed-out tester reaches welcome.

### S01 — Welcome

Purpose: Explain the beta in one screen and start registration. Content: “KyaScene — The private community for students from India in Sydney.” Include Connect, Discover and Belong; state that the beta is free and invite-only. Actions: Join the beta, I already have an account, privacy and terms links. States: Registration closed, maintenance and invite-only messaging. Acceptance: The primary action is visible without scrolling on supported phone sizes.

### S02 — Email sign-in

Purpose: Create or recover an account without a password. Fields: Email address. Validation: Normalise case and whitespace; validate syntax locally; rate-limit server requests. Actions: Send one-time code, return to welcome. Privacy: Explain why the email is required and that it will not appear publicly. Analytics: auth_started, otp_requested, otp_request_failed without recording the address.

### S03 — Verify email

Purpose: Confirm control of the submitted email. Fields: Six-digit code with paste support. Actions: Verify, resend after countdown, change email. States: Invalid, expired, rate-limited, offline and success. Acceptance: Successful verification creates or restores the authenticated session and routes based on registration status.

### S04 — Beta invitation

Purpose: Restrict early access and attribute referrals. Fields: Invite code. Actions: Redeem, scan/paste link, request an invitation through the marketing site. Rules: Code may be active, expired, exhausted or restricted to a campaign. Redemption must be atomic. Acceptance: A code cannot be redeemed beyond its allowance under concurrent requests.

### S05 — Eligibility

Purpose: Confirm audience fit before collecting a full profile. Questions: 18 or older; from India; currently studying or holding a confirmed offer in Australia; Sydney connection during beta. Outcome: Eligible users continue. Ineligible users receive a respectful explanation and optional future-market waitlist. Privacy: Store only the answers needed to record the decision. Acceptance: No user can bypass eligibility through direct navigation.

### S06 — Study details

Purpose: Establish student context and support manual verification. Fields: Education provider, campus, course, study level, intake month/year, expected completion month/year and student email if different. Input: Searchable provider list plus Not listed. Validation: Completion cannot precede intake; future intake is allowed. Acceptance: Draft saves after valid field changes and survives app restart.

### S07 — Sydney location

Purpose: Enable suburb-level relevance without exact tracking. Fields: Current or expected suburb; arrival status; optional postcode. Rules: Do not request device location in P0. Do not collect street address or coordinates. Privacy control: Public suburb visibility defaults off. Acceptance: Users arriving later can choose Not in Sydney yet and enter expected suburb if known.

### S08 — India background

Purpose: Represent origin accurately without stereotyping. Fields: State or union territory and optional hometown/city. Rules: State uses a maintained reference list. Hometown is free text with length and safety limits. Visibility: Both fields have independent profile-visibility controls. Acceptance: A user may decline the city field without blocking registration.

### S09 — Languages

Purpose: Support culturally relevant recommendations later. Fields: Multiple languages and proficiency: native, fluent, conversational or learning. Rules: English may be selected like any other language. Provide search and Other. Acceptance: Duplicate language entries are prevented.

### S10 — Cultural communities

Purpose: Let users self-identify with multiple cultural communities. Examples: Punjabi, Gujarati, Marathi, Bengali, Tamil, Telugu, Malayali, Kannada, Rajasthani, Haryanvi, Bihari, Goan, Kashmiri, Assamese, Odia, Sindhi, Konkani, Pahadi, North-East Indian and Other. Rules: Optional, multi-select and never inferred from state, language or religion. Acceptance: Prefer not to specify clears other selections.

### S11 — Interests

Purpose: Seed future discovery and group recommendations. Options: Cricket, gym, movies, music, travel, photography, cooking, gaming, startups, investing, cars, volunteering, study groups and networking. Rules: Require at least three for the beta; allow search and a controlled Other. Acceptance: Selection count and requirement are clear before continuing.

### S12 — Goals

Purpose: Learn what students need first and personalise the beta home. Options: Meet people, find events, accommodation, jobs, study support, sport, food, local services and professional networking. Rules: Select up to five and rank the top need. Analytics: Record category identifiers, not free-text personal information.

### S13 — Profile photograph

Purpose: Add recognition and trust while remaining optional in P0. Actions: Camera, photo library, skip and remove. Processing: Crop to square, compress before upload, remove unnecessary image metadata and store a generated derivative. Permissions: Ask only when the user chooses camera or library. Acceptance: Permission denial returns to a usable screen with instructions and skip option.

### S14 — Privacy preferences

Purpose: Give explicit control over what future approved users may see. Controls: Show/hide suburb, Indian state, hometown, languages, cultural communities and study details. Defaults: Conservative; contact information never public. Explanation: Exact address and exact location are never shown. Acceptance: Preview updates immediately and settings remain editable later.

### S15 — Terms, privacy and beta consent

Purpose: Record informed acceptance before submission. Required: Terms acceptance, privacy acknowledgement, community guidelines and confirmation that beta features may change. Optional: Marketing communication consent, separate and unchecked. Data: Store policy type, version, accepted timestamp and user ID. Acceptance: Required and optional consent must never be bundled.

### S16 — Review profile

Purpose: Let the user inspect and correct all submitted information. UI: Profile card followed by grouped sections with Edit actions. Action: Submit for approval. Rules: Run server validation again; submission is idempotent. Acceptance: Repeated taps cannot create duplicate registration records.

### S17 — Registration status

Purpose: Explain pending, approved, rejected or suspended states. Pending content: Expected review process, editable information and feedback/support link. Do not promise a review time unless operations can meet it. Approved action: Enter KyaScene. Rejected action: Read reason category and contact support. Avoid exposing internal moderation notes. Acceptance: Status refreshes on foreground and pull-to-refresh.

### S18 — Beta home

Purpose: Give approved testers a useful destination before the social product ships. Content: Personal greeting, registration status, top selected goals, feature-voting cards, invite progress, beta announcements and feedback action. Future cards: Find people, Scene feed, events, housing and jobs, all clearly labelled Coming soon unless enabled. Acceptance: No disabled feature looks tappable; enabled features are controlled by server flags.

### S19 — Invite friends

Purpose: Recruit eligible testers and measure referrals. UI: Personal referral code, remaining invitations, share sheet and redemption count. Safety: Do not reveal referred users until they independently consent and connect in a future milestone. Analytics: referral_viewed, referral_shared, invite_redeemed. Acceptance: Shared link contains an opaque code, not the inviter’s user ID.

### S20 — Beta feedback

Purpose: Turn testing into structured learning. Fields: Rating, feedback category, free-text comment and optional screenshot. Categories: Bug, confusing, missing feature, safety concern and general feedback. Privacy: Warn users not to include passwords or identity documents. Acceptance: Submission works without an email client and returns a reference number.

### S21 — Profile and settings

Purpose: Let users review their information and access controls. Items: Edit profile, privacy, notification preferences, legal documents, support, beta version, sign out and delete account. Acceptance: Legal and account-deletion actions are available without searching multiple menus.

### S22 — Delete account

Purpose: Allow complete account-deletion initiation inside the app. Flow: Explain effect, confirm identity/session, require a deliberate confirmation and submit a deletion request. Rules: Sign out immediately after confirmed deletion or scheduled deletion, according to the approved retention policy. Acceptance: Deactivation alone is not presented as deletion; the user receives confirmation and support information.

## 10. Core user flows


### 10.1 New invited tester

Install → Welcome → Email OTP → Invite → Eligibility → Profile steps→ Privacy → Consent → Review → Submit → Pending → Approved → Beta home

### 10.2 Returning incomplete tester

Launch → Restore session → Fetch status → Resume last valid registration step

### 10.3 Referred tester

Open universal link → Install/open app → Preserve opaque invite code→ Verify email → Redeem invitation → Continue eligibility

### 10.4 Account deletion

Settings → Delete account → Explanation → Re-authentication if needed→ Confirmation → Server deletion workflow → Sign out → Confirmation

## 11. Data model

All primary keys use UUIDs. All mutable records include created_at and updated_at timestamps. Tables containing user data use Row Level Security.

### 11.1 P0 tables

Table
Purpose
Important fields
profiles
Public-safe account shell
user_id, display_name, avatar_path, status, onboarding_version
student_profiles
Private student information
provider, course, study level, intake, completion, Sydney suburb, Indian state, hometown
profile_visibility
Per-field privacy choices
suburb, state, hometown, languages, communities, study visibility
languages
Reference catalogue
code, name, active, sort order
profile_languages
User-language relation
user, language, proficiency
communities
Cultural community catalogue
code, label, active, sort order
profile_communities
User-community relation
user, community
interests
Interest catalogue
code, label, category, active
profile_interests
User-interest relation
user, interest
goals
Goal catalogue
code, label, active
profile_goals
User-goal relation
user, goal, rank
invites
Campaign or personal invitation
code hash, owner, campaign, capacity, redeemed count, expiry, status
invite_redemptions
Atomic redemption ledger
invite, user, redeemed timestamp
verification_requests
Manual student review
user, status, method, reviewer, reason category, timestamps
consents
Versioned consent evidence
user, policy type, version, accepted, timestamp
beta_feedback
Structured tester feedback
user, category, rating, comment, screenshot path, status
push_devices
Push notification destinations
user, platform, token, enabled, last seen
feature_flags
Controlled release switches
key, enabled, environment, rules
admin_audit_logs
Immutable administrative history
actor, action, target, reason, metadata, timestamp
deletion_requests
Account-deletion workflow
user, requested, state, completion, retention note

### 11.2 Account status enum

invitedemail_verifiedonboardingpending_reviewapprovedrejectedsuspendeddeletion_pendingdeleted
Status changes must be validated server-side and recorded in admin_audit_logs.

### 11.3 P1/P2 tables reserved for later migrations

Do not create empty future tables merely to appear complete. Add them with the milestone that owns them:
connections
blocks
reports
posts
media_assets
comments
reactions
groups and group_members
events and event_attendees
conversations and messages
listings
businesses and business_users
campaigns and campaign_metrics
subscriptions and entitlements
recommendations

### 11.4 Deletion behaviour

The deletion workflow must define, test and document what is deleted, anonymised or retained. Authentication, profile, storage objects, push tokens, consents and third-party analytics identifiers must be included. Any retained security or audit record must not remain publicly attributable and requires an approved policy reason.

## 12. Backend operations and API contracts


### 12.1 Client-access pattern

Use direct Supabase access only for operations that are safe under Row Level Security, such as reading/updating the current user's permitted records. Use Edge Functions for operations requiring privileged checks, multi-table transactions or administrative authority.

### 12.2 P0 Edge Functions

Function
Responsibility
redeem-invite
Validate and atomically redeem an invitation
submit-registration
Validate complete profile and move status to pending review
submit-feedback
Create feedback and optional screenshot reference
request-account-deletion
Verify request and initiate full deletion workflow
register-push-device
Validate and store a platform push token
admin-review-registration
Approve/reject registration with reason and audit event
admin-suspend-user
Suspend access with reason and audit event
admin-send-announcement
Send controlled beta communication

### 12.3 Standard response envelope

{  "data": {},  "error": null,  "requestId": "uuid"}
Failure:
{  "data": null,  "error": {    "code": "INVITE_INVALID",    "message": "This invitation could not be used."  },  "requestId": "uuid"}
The client may display the safe message but must log only the code and request ID.

### 12.4 Idempotency

Registration submission, invite redemption, feedback with uploads, push-device registration and deletion requests must tolerate retries. Use an idempotency key or a unique database constraint where appropriate.

### 12.5 Rate limits

Apply rate limits to OTP requests, invite redemption, feedback, image upload and administrative bulk communication. Return a typed RATE_LIMITED error with a safe retry time.

## 13. Security, privacy and safety requirements


### 13.1 Mandatory controls

Row Level Security enabled before any beta user is added
No service-role keys in mobile code
Transport encryption for all traffic
SecureStore for refresh/session secrets
Short-lived signed URLs for private media
File type, size and content validation for uploads
Database migrations reviewed and committed
Admin actions authenticated, authorised and audited
Separate beta and production credentials
Dependency and secret scanning in CI
Backups and a tested restoration procedure

### 13.2 Data minimisation

No exact GPS or background location in P0
No street address
No contact-book upload
No religion field in P0
Profile photograph optional
No identity-document retention in P0
No public email or telephone number
No analytics event containing names, email addresses, phone numbers or free-text feedback

### 13.3 Profile moderation

Even before the feed exists, profile names, photographs and hometown text are user-generated content. Administrators need controls to hide an avatar, edit/reject unsafe content, suspend an account and record a reason.

### 13.4 Store deletion requirements

Account deletion must be initiated inside the iOS app. Android distribution also requires an accessible web resource through which users can request deletion after uninstalling. Link the web deletion resource from kyascene.app and from Play Console.

### 13.5 Incident readiness

Create runbooks for:
Credential or API-key exposure
Inappropriate profile content
Harassment or safety report
Incorrect approval/suspension
Data-deletion failure
Push-notification mistake
Service outage
Lost store-signing access

## 14. Analytics and learning plan


### 14.1 Event naming

Use lowercase snake case. Each event has a typed schema and owner.

### 14.2 P0 events

app_openedwelcome_viewedauth_startedotp_requestedauth_completedauth_failedinvite_viewedinvite_redeemedeligibility_completedeligibility_failedonboarding_step_viewedonboarding_step_completedonboarding_resumedregistration_submittedregistration_approvedregistration_rejectedbeta_home_viewedfeature_vote_submittedreferral_viewedreferral_sharedfeedback_submittedprofile_updatedprivacy_updatedaccount_deletion_startedaccount_deletion_requested

### 14.3 Allowed properties

App version and build
Platform and OS major version
Environment
Screen/step identifier
Invite campaign identifier
Broad goal or interest identifiers
Success/failure code
Duration bucket
Never attach contact information, free-text answers or raw location.

### 14.4 Beta dashboard

Track:
Invitations issued, opened and redeemed
Email verification completion
Funnel completion by step
Approval turnaround
Approved registrations by education provider and broad suburb region
Seven-day return rate
Referral contribution
Feature votes
Feedback categories
Crashes and failed requests

## 15. Private admin console

The founder and authorised operators need a small private web console. This does not conflict with the app-only consumer strategy.

### 15.1 P0 admin screens

Admin sign-in
Registration queue
Registration detail
Approve/reject decision
User search and status
Invite campaigns
Referral overview
Feedback inbox
Beta announcements
Audit log

### 15.2 Admin rules

Admin roles are separate from student roles.
Never rely only on hidden navigation for authorisation.
Sensitive actions require a reason.
Bulk announcements require a preview and confirmation.
Rejected users do not see private moderator notes.
Exports are restricted, logged and contain only the required fields.

## 16. Testing strategy


### 16.1 Test pyramid

Domain unit tests for validation and status transitions
Repository integration tests against a dedicated test project or local Supabase
Component tests for forms, error states and accessibility labels
End-to-end tests for critical user journeys
Manual device checks before each beta build

### 16.2 Required P0 end-to-end scenarios

New invited eligible tester completes registration.
Invalid and expired OTP are handled.
Invalid, expired and exhausted invitation codes are handled.
Ineligible user receives the correct outcome.
Registration draft resumes after force-closing the app.
Offline save failure preserves local answers.
Pending registration becomes approved after refresh.
Referral link survives install/open flow.
Privacy controls change the preview.
Profile photo permission denial is recoverable.
Account deletion is requested successfully.
Suspended account cannot enter approved routes.

### 16.3 Device matrix

For iOS beta, test at minimum:
Small supported iPhone
Current standard iPhone
Current large-screen iPhone
Current iOS release and minimum supported iOS release
Light and dark appearance where supported
Increased text size and VoiceOver
For Android release, add:
Small 360dp-wide Android device
Current Pixel-class device
Samsung-class device
Minimum supported Android version and current version
Gesture and three-button navigation
TalkBack and increased font/display size

### 16.4 Quality gates

No external beta build may ship with:
Known P0 crash
Broken account deletion
Missing privacy or terms links
Disabled Row Level Security
Exposed service credentials
Unreviewed migration
Unlabelled destructive control
Registration dead end
Analytics containing personal data

## 17. Delivery milestones


### Milestone 0 — Repository and vertical foundation

Target: 2–3 working days. Deliverables: Monorepo, Expo SDK 57 app, TypeScript strict mode, routing shell, tokens, lint, tests, environment validation, Supabase local structure, EAS configuration and CI compiling both platforms. Exit: The signed development app opens on iOS and Android; CI is green.

### Milestone 1 — Authentication and resumable onboarding

Target: 4–6 working days. Deliverables: S00–S08, email OTP, invite redemption, eligibility, study and location steps, local draft persistence and typed analytics. Exit: An invited tester can authenticate and resume after app restart.

### Milestone 2 — Complete registration and administration

Target: 4–6 working days. Deliverables: S09–S17, privacy, consent, registration submission, status handling, profile moderation and admin approval queue. Exit: An administrator can approve a submitted student and the user can enter approved routes.

### Milestone 3 — Beta home, referrals and feedback

Target: 3–5 working days. Deliverables: S18–S22, feature voting, referral sharing, feedback, settings, push foundation and deletion workflow. Exit: Full P0 experience passes end-to-end tests.

### Milestone 4 — iOS closed beta

Target: 3–5 working days plus review time. Deliverables: App Store Connect metadata, privacy answers, TestFlight group, support/legal URLs, crash monitoring, operator runbook and first 20–50 invitations. Exit: Real invited Sydney students complete registration through TestFlight.

### Milestone 5 — Android closed beta

Target: 4–7 working days after iOS stability. Deliverables: Android-specific QA, adaptive icon, back navigation, notification channel, Play Data Safety information, web deletion request path, Play App Signing and closed-testing group. Exit: Same P0 flow passes on the Android device matrix and real testers register.

### Milestone 6 — Find Your People (P1)

Student directory, public-safe profiles, search, filters, connection requests, blocking and reporting. Release only after P0 data shows sufficient approved users.

### Milestone 7 — Scene Feed (P1)

Nearby-first text, image and short-video posts, categories, moderation, reporting, saves and relevance ranking.

### Milestone 8 — Community (P1/P2)

Messaging, groups, notifications and events. Messaging cannot launch before blocking, reporting and operator moderation are tested.

### Milestone 9 — Utilities and monetisation (P2)

Events, accommodation, jobs, marketplace, verified businesses, sponsored videos and later Student Premium capped at AUD 9 per month.

### Milestone 10 — Kya and future expansion

Kya recommendations, daily brief, voice, live Scene map, national expansion and eventually verified dating after safety systems mature.

## 18. iOS-first release checklist


### Product

P0 acceptance criteria complete
Test data removed from beta project
Support and feedback monitored
Feature flags default safe
Version and build visible in Settings

### Apple configuration

Apple Developer organisation/account secured with two-factor authentication
Bundle identifiers registered
App Store Connect record created
Distribution certificates and profiles managed through EAS
Privacy policy and support URL live
App privacy answers match real SDK and data behaviour
Account deletion available in-app
Camera/photo descriptions explain the user action
TestFlight internal testing completed before external testing

### Operations

Registration approval owner named
Support response owner named
Safety escalation path documented
Daily beta metrics reviewed during the first week
Rollback or feature-disable path tested

## 19. Android second-release adaptation

Android is not a rewrite. The shared features and contracts remain the same.

### Android-specific work

Validate system back behaviour on every nested route and modal
Use Android notification channels
Validate keyboard and autofill behaviour
Provide adaptive icon and monochrome icon
Check edge-to-edge layout and safe insets
Validate permissions wording and denial recovery
Test file/photo picker variations
Complete Play Data Safety accurately
Publish a functional web account-deletion request path
Enable Play App Signing and protect account access
Do not fork the product design into an unrelated Android experience. Respect platform conventions while keeping KyaScene's hierarchy, language and design tokens consistent.

## 20. Acceptance definition for P0

P0 is complete only when all statements below are true:
A new eligible tester can register without founder assistance.
Registration resumes correctly after termination, update and network loss.
An administrator can make and audit approval decisions.
An approved user reaches the beta home; a pending or suspended user cannot.
Users control profile visibility and can delete their accounts.
No exact location, address, contact list or identity document is collected.
Row Level Security tests prove that one user cannot read another user's private records.
iOS and Android builds compile from the same commit.
Critical flows have automated end-to-end coverage.
Crash reporting, analytics and support workflows work in beta.
Privacy, terms, community guidelines and support URLs are live.
The founder can invite a controlled Sydney cohort and understand the resulting funnel.

## 21. Coding AI operating instructions


### 21.1 Master prompt

Copy the following into the coding agent at the start of the repository:
You are the lead mobile engineer for KyaScene, an iOS-first native community appfor students from India studying in Australia. Read the entire KyaScene Native AppDevelopment Master Specification before editing code.Build a single Expo SDK 57 / React Native / TypeScript codebase. iOS is releasedfirst; Android must compile from day one. Use Expo Router, Supabase, strictTypeScript, typed validation, Row Level Security and feature-based modules.Only implement the milestone I name. Do not build future features shown in conceptartwork. Before changing files:1. Inspect the repository and existing decisions.2. State a short implementation plan.3. Identify assumptions and risks.4. Preserve all working unrelated code.For every milestone:- implement loading, empty, offline and error states;- add unit/component tests and required end-to-end coverage;- add or update database migrations and RLS tests;- instrument only the approved analytics events without PII;- update architecture decisions and environment documentation;- run formatting, lint, type-check, tests and iOS/Android build validation;- report files changed, verification performed and remaining limitations.Never place privileged secrets in the mobile application. Never collect exactlocation, street address, contacts or identity documents in P0. Do not continueto the next milestone until the current acceptance criteria pass.

### 21.2 Milestone 0 prompt

Implement Milestone 0 from the KyaScene specification. Scaffold the monorepo,Expo SDK 57 mobile application, Expo Router route groups, shared design tokens,TypeScript strict mode, linting, testing, environment validation, Supabase folder,EAS profiles and CI. Use app.kyascene.beta for beta identifiers and app.kyascenefor production. Create a minimal launch screen and welcome route only. Do notimplement registration business logic yet. Ensure both iOS and Android configurationvalidation passes and document all setup commands and required external accounts.

### 21.3 Milestone 1 prompt

Implement Milestone 1 only: S00 through S08. Add email OTP authentication, atomicinvite redemption, eligibility, study details, Sydney suburb and India-backgroundsteps. Registration must be resumable, versioned and safe offline. Create requiredSupabase migrations, RLS policies, typed repositories, validation schemas, analyticsevents and automated tests. Do not add feed, messaging, social login or payments.

### 21.4 Milestone 2 prompt

Implement Milestone 2 only: S09 through S17 plus the minimum private admin approvalworkflow. Add languages, cultural communities, interests, goals, optional profilephoto, privacy controls, versioned consent, review/submission and registrationstatus. Implement profile media handling, moderation controls, audit logs and RLStests. Do not expose private profile fields to other students.

### 21.5 Milestone 3 prompt

Implement Milestone 3 only: beta home, feature voting, referrals, structured feedback,profile/settings, push-token foundation and complete account deletion. Future featurecards must remain server-flagged and visibly unavailable. Add all P0 end-to-end tests,operational metrics and release documentation. Do not build the social feed.

### 21.6 iOS beta prompt

Prepare the completed P0 KyaScene application for iOS closed beta. Audit permissions,privacy disclosures, deletion, universal links, app icons, splash assets, build numbers,EAS credentials, App Store Connect metadata, TestFlight groups, crash reporting andsupport URLs. Run the complete iOS device and accessibility checklist. Do not submituntil all P0 gates pass and provide a human-readable release report.

### 21.7 Android beta prompt

Adapt the stable P0 codebase for Android closed testing without forking product logic.Complete Android back behaviour, notification channels, adaptive/monochrome icons,edge-to-edge layout, permission recovery, keyboard tests, Play Data Safety preparation,web deletion path and Play App Signing. Run the Android device matrix and the same P0end-to-end suite before producing the closed-test build.

### 21.8 Per-screen implementation prompt template

Implement screen [SCREEN ID AND NAME] exactly as defined in the KyaScene MasterSpecification. First list its purpose, entry conditions, data dependencies, actions,validation, states, analytics and acceptance criteria. Reuse existing KyaScene UIcomponents and tokens. Add accessibility labels, loading, offline, empty and errorbehaviour. Add focused component tests and update the relevant end-to-end journey.Do not introduce a new dependency unless the existing stack cannot satisfy the need;if proposing one, explain maintenance, privacy and platform implications first.

## 22. Decisions that require founder approval later

The coding agent may prepare recommendations but must not independently decide:
Final legal entity name used in store listings
Apple and Google developer-account ownership
Production Supabase region and paid plan
Privacy-policy and retention wording
Whether student verification requires documents
Social-login providers
Analytics and error-reporting vendors if they process personal data
Notification campaigns
Premium pricing and entitlements
Business advertising categories
Dating launch and safety rules
AI provider and Kya memory policy
Record each approved decision in docs/decisions as an Architecture Decision Record.

## 23. Future product sequence


### P1 — Find Your People

Approved users discover public-safe student profiles by university, suburb, language and interests. Add connection requests, block and report before messaging.

### P1 — Scene Feed

Nearby-first posts and short video organised around useful categories. Public posting, recommendation ranking, video processing and moderation require their own specification.

### P1/P2 — Community

Messages, groups and events launch after trust operations are proven. Location remains approximate and opt-in.

### P2 — Student utilities

Events, accommodation, jobs, marketplace, study resources and business offers ship one category at a time according to beta evidence.

### P2 — Revenue

Students retain meaningful free access. Premium remains capped at AUD 9 per month. Businesses pay for approved, clearly labelled sponsored content and relevant local reach.

### Future — Kya

Kya becomes the assistant inside KyaScene: Ask Kya, Kya Brief, Hey Kya and Kya Now. The public master brand remains KyaScene. Do not use “GPT” in product naming.

### Future — Dating

Dating is a separate, opt-in, verified and heavily moderated mode. It is not activated until identity, age, reporting, blocking and safety-response operations are mature.

## 24. Visual references

Approved KyaScene product concept board. Long-term direction only; the P0 specification controls implementation.
Early fifteen-screen mobile flow. Use as visual inspiration, not as the P0 scope boundary.
The following approved concept images are included in the companion DOCX:
KyaScene product board: long-term visual and feature direction
Fifteen-screen mobile flow: early navigation and layout foundation
Use them for tone, hierarchy and component inspiration. Replace old naming, pricing and unsupported feature claims with this specification's approved decisions.

## 25. Technical references

These references were checked on 7 August 2026. Revalidate before major upgrades.
Expo SDK reference: https://docs.expo.dev/versions/latest/
Expo Router introduction: https://docs.expo.dev/router/introduction/
Expo Application Services: https://docs.expo.dev/eas/
EAS Build: https://docs.expo.dev/build/introduction/
Supabase Auth with React Native: https://supabase.com/docs/guides/auth/quickstarts/react-native
Apple account deletion guidance: https://developer.apple.com/support/offering-account-deletion-in-your-app/
Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111

## 26. Immediate instruction

Begin with Milestone 0 — Repository and vertical foundation. Do not start by drawing or coding the future feed. The first demonstrable build should open on an iPhone, display the KyaScene launch and welcome experience, connect safely to the beta environment and prove that the same commit can compile for Android.
KyaScene. Connect. Discover. Belong. Powered by 1818.
