import { z } from 'zod';

/**
 * Profile detail collected by S09–S14, shared between the forms and the service boundary
 * (§4.4). Each rule here has a counterpart in the Milestone 2 migrations, so it holds at the
 * keyboard, at the API boundary and in the table.
 *
 * Where the two deliberately differ is worth stating: a rule that needs to count rows —
 * "at least three interests" — cannot be a CHECK constraint, so the database enforces it in
 * `submit_registration` instead, at the moment status changes. The schema below is the first
 * of those three lines of defence, not the only one.
 */

// -------------------------------------------------------------- S09 languages

export const LANGUAGE_PROFICIENCIES = ['native', 'fluent', 'conversational', 'learning'] as const;
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  native: 'Native',
  fluent: 'Fluent',
  conversational: 'Conversational',
  learning: 'Learning',
};

export const languageChoiceSchema = z.object({
  code: z.string().min(1),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES),
});

export type LanguageChoice = z.infer<typeof languageChoiceSchema>;

/**
 * §S09 acceptance: "Duplicate language entries are prevented."
 *
 * Checked here so the form can say so plainly, and again by the `(user_id, language_code)`
 * primary key so it holds for any caller. The screen prevents it structurally too — a
 * language already chosen is not offered again — which makes this the backstop rather than
 * the mechanism.
 */
export const languagesSchema = z
  .array(languageChoiceSchema)
  .min(1, 'Add at least one language')
  .max(12, 'That is a lot of languages — pick the ones you actually use')
  .refine(
    (choices) => new Set(choices.map((choice) => choice.code)).size === choices.length,
    'You have added the same language twice',
  );

// ------------------------------------------------------------ S10 communities

/**
 * §S10: "Optional, multi-select and never inferred from state, language or religion."
 *
 * `notSpecified` is a separate field rather than a sentinel value in `codes`, because
 * declining to answer and having no answer are different facts. The refinement below is
 * §S10's acceptance criterion — "Prefer not to specify clears other selections" — and the
 * database enforces the same thing with a trigger pair, so the two can never disagree
 * whichever order a client writes them in.
 */
export const communitiesSchema = z
  .object({
    codes: z.array(z.string().min(1)).max(20),
    notSpecified: z.boolean(),
  })
  .refine(
    (value) => !(value.notSpecified && value.codes.length > 0),
    'Choosing "prefer not to specify" clears the other selections',
  );

export type CommunitySelection = z.infer<typeof communitiesSchema>;

// -------------------------------------------------------------- S11 interests

/** §S11: "Require at least three for the beta." */
export const MINIMUM_INTERESTS = 3;

export const interestsSchema = z
  .array(z.string().min(1))
  .min(MINIMUM_INTERESTS, `Choose at least ${MINIMUM_INTERESTS}`)
  .max(15, 'Pick the ones you would actually turn up for')
  .refine((codes) => new Set(codes).size === codes.length, 'That interest is already selected');

// ------------------------------------------------------------------ S12 goals

/** §S12: "Select up to five and rank the top need." */
export const MAXIMUM_GOALS = 5;

/**
 * Goals are stored in rank order, so the array index *is* the rank. That removes a whole
 * class of bug — a separate `rank` field can drift out of step with the order shown on
 * screen, and the user would have no way to tell.
 */
export const goalsSchema = z
  .array(z.string().min(1))
  .min(1, 'Choose at least one')
  .max(MAXIMUM_GOALS, `Choose up to ${MAXIMUM_GOALS}`)
  .refine((codes) => new Set(codes).size === codes.length, 'That goal is already selected');

// -------------------------------------------------------------- S13 photograph

/**
 * §S13: "Add recognition and trust while remaining optional in P0."
 *
 * The photograph is a local file path until submission uploads it. Nothing here records
 * where it came from — camera or library — because that is not information the product
 * needs, and §13.2's data minimisation applies to metadata as much as to fields.
 */
export const profilePhotoSchema = z.object({
  /** Absent means skipped, which §S13 requires to remain a first-class outcome. */
  localUri: z.string().min(1).optional(),
});

export type ProfilePhoto = z.infer<typeof profilePhotoSchema>;

/** §S13: "compress before upload". A square derivative at this edge is plenty for an avatar. */
export const AVATAR_EDGE_PIXELS = 512;
export const AVATAR_JPEG_QUALITY = 0.8;

// ------------------------------------------------------------- S14 visibility

/**
 * §S14: "Give explicit control over what future approved users may see."
 *
 * Every default is false. §S14 asks for conservative defaults, and this is the direction a
 * bug should fail in: a screen that never runs leaves a student sharing nothing, rather than
 * sharing something they never agreed to.
 *
 * There is no field for email, telephone or precise location. §13.2 forbids all three
 * outright, so they are not settings anyone can get wrong — the capability does not exist.
 */
export const visibilitySchema = z.object({
  showSuburb: z.boolean(),
  showIndiaState: z.boolean(),
  showHometown: z.boolean(),
  showLanguages: z.boolean(),
  showCommunities: z.boolean(),
  showStudy: z.boolean(),
});

export type VisibilityPreferences = z.infer<typeof visibilitySchema>;

export const DEFAULT_VISIBILITY: VisibilityPreferences = {
  showSuburb: false,
  showIndiaState: false,
  showHometown: false,
  showLanguages: false,
  showCommunities: false,
  showStudy: false,
};

export const VISIBILITY_LABELS: Record<keyof VisibilityPreferences, string> = {
  showSuburb: 'Suburb',
  showIndiaState: 'Indian state',
  showHometown: 'Hometown',
  showLanguages: 'Languages',
  showCommunities: 'Cultural communities',
  showStudy: 'Course and provider',
};

/**
 * §S14: "Exact address and exact location are never shown."
 *
 * Stated as a constant so the screen cannot quietly reword it into something weaker, and so
 * a test can assert the promise is actually on screen.
 */
export const VISIBILITY_ASSURANCE =
  'Your exact address and location are never shown to anyone, and your email and phone number are never public.';

// ---------------------------------------------------------- S17 review status

/**
 * §S17: the categories a rejected student may be shown. Mirrors the `rejection_category`
 * enum. The operator's own notes are never included — §15.2: "Rejected users do not see
 * private moderator notes."
 */
export const REJECTION_CATEGORIES = [
  'not_eligible',
  'incomplete_information',
  'unable_to_verify_study',
  'duplicate_account',
  'safety_concern',
  'other',
] as const;

export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export const REJECTION_CATEGORY_MESSAGES: Record<RejectionCategory, string> = {
  not_eligible: 'Your answers put you outside who the beta is for right now.',
  incomplete_information: 'Some of your details were incomplete or could not be read.',
  unable_to_verify_study: 'We could not confirm your study details in Sydney.',
  duplicate_account: 'There is already an account for you.',
  safety_concern: 'We are unable to approve this account.',
  other: 'We are unable to approve this account right now.',
};

/**
 * The identifiers `submit_registration` returns in its `missing` array, mapped to the step
 * that collects each one.
 *
 * §S16's purpose is to "inspect and correct", so a server rejection has to be able to send
 * the student to the right screen rather than leaving them to hunt. The server returns codes
 * rather than sentences for exactly this reason (§14.3 also forbids free text reaching
 * analytics).
 */
/**
 * S13 — what to call someone.
 *
 * The specification never asks for a name. `profiles.display_name` was created in Milestone 1
 * because the console lists people and §15.2 lets a moderator clear a name — both of which
 * assume one exists — but no screen between S02 and S17 ever collected it. Every applicant
 * reached the review queue as "No name", and §S18's beta home would have had nobody to greet.
 *
 * 1 to 60 characters, matching the `display_name_length` constraint exactly rather than
 * approximately: a rule the form is stricter about than the table produces a rejection the
 * student cannot see the cause of.
 *
 * Deliberately not validated beyond length. Names do not follow rules — not two words, not
 * alphabetic, not Latin script, not a minimum length — and every pattern that has ever been
 * used to "check" one has locked out somebody real. Moderation handles abuse (§13.3); a regex
 * would only mean the wrong people cannot register.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter the name you would like to be known by')
  .max(60, 'That name is longer than 60 characters');

export const MISSING_STEP_ROUTES = {
  eligibility: '/eligibility',
  name: '/photo',
  study: '/study',
  location: '/sydney-location',
  india_background: '/india-background',
  languages: '/languages',
  interests: '/interests',
  goals: '/goals',
  privacy: '/privacy',
  consent: '/consent',
} as const;

export type MissingStep = keyof typeof MISSING_STEP_ROUTES;

export function isMissingStep(value: unknown): value is MissingStep {
  return typeof value === 'string' && Object.hasOwn(MISSING_STEP_ROUTES, value);
}
