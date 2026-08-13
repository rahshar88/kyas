import type { ConsentChoice } from './consent';
import type {
  CommunitySelection,
  LanguageChoice,
  ProfilePhoto,
  VisibilityPreferences,
} from './profile';
import type {
  EligibilityAnswers,
  IndiaBackground,
  StudyDetails,
  SydneyLocation,
} from './registration';

/**
 * The resumable registration draft (§6.3, §S06, §10.2).
 *
 * §6.3: "Multi-step registration draft: persisted local draft with explicit version number."
 * §S06 acceptance: "Draft saves after valid field changes and survives app restart."
 * §16.2 requires an end-to-end test that the draft resumes after force-closing the app.
 *
 * The version number is the point. An app update that changes the shape of these answers
 * would otherwise read stale data into a new form and either crash or silently mis-populate
 * a student's registration. On a version mismatch the draft is discarded and the student
 * restarts — annoying, but honest, and far better than submitting mangled answers.
 *
 * **3** since S13 began collecting a name. Anyone holding an older draft re-enters it; that is
 * a couple of minutes with a visible reason, against the alternative of submitting
 * half-migrated answers under a real person's name.
 */
export const REGISTRATION_DRAFT_VERSION = 3;

/**
 * The registration steps in order (§8.1), S05 through S15.
 *
 * Order is load-bearing: `nextIncompleteStep` resumes the first unfinished one, so this array
 * is the single definition of "what comes next" for both the flow and §10.2's resume.
 *
 * S13 was absent from this list while it collected only a photograph. §S13 makes the photo
 * optional and requires skipping to stay a first-class outcome, so an unfinished S13 could not
 * be told apart from an unreached one and would have blocked resume forever.
 *
 * It belongs here now that the same screen also asks for a name, which is required. "Has a
 * name" is an unambiguous completion signal in a way "has decided about a photo" never was —
 * the photo remains genuinely optional, and skipping it still completes the step.
 */
export const REGISTRATION_STEPS = [
  'eligibility',
  'study',
  'sydney-location',
  'india-background',
  'languages',
  'communities',
  'interests',
  'goals',
  'photo',
  'privacy',
  'consent',
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

export interface RegistrationDraft {
  version: number;
  /** Which steps the student has completed, so §10.2 can resume the last valid one. */
  completed: RegistrationStep[];
  /** §S13. Required to submit — see `displayNameSchema` for why it is barely validated. */
  displayName?: string;
  eligibility?: EligibilityAnswers;
  study?: StudyDetails;
  sydneyLocation?: SydneyLocation;
  indiaBackground?: IndiaBackground;
  languages?: LanguageChoice[];
  communities?: CommunitySelection;
  interests?: string[];
  /** Rank order — the index is the rank, so screen order and stored rank cannot drift. */
  goals?: string[];
  /** Optional throughout (§S13). Absent means not chosen; `localUri` absent means skipped. */
  photo?: ProfilePhoto;
  visibility?: VisibilityPreferences;
  consents?: ConsentChoice[];
  updatedAt: string;
}

export function emptyDraft(now: string): RegistrationDraft {
  return { version: REGISTRATION_DRAFT_VERSION, completed: [], updatedAt: now };
}

/**
 * §10.2: "Launch → Restore session → Fetch status → Resume last valid registration step."
 *
 * Returns the first step the student has not completed. Steps are resumed in order rather
 * than jumping to the furthest one reached, so a student who went back to change an earlier
 * answer is not thrown forward past it.
 */
export function nextIncompleteStep(draft: RegistrationDraft): RegistrationStep | null {
  return REGISTRATION_STEPS.find((step) => !draft.completed.includes(step)) ?? null;
}

export function isDraftComplete(draft: RegistrationDraft): boolean {
  return nextIncompleteStep(draft) === null;
}

/**
 * A draft written by a different app version cannot be trusted. Callers discard and start
 * fresh rather than attempting a migration — there is no shipped version to migrate from
 * yet, and inventing a migration path for a hypothetical shape is how silent data corruption
 * gets introduced.
 */
export function isDraftUsable(value: unknown): value is RegistrationDraft {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RegistrationDraft>;
  return (
    candidate.version === REGISTRATION_DRAFT_VERSION &&
    Array.isArray(candidate.completed) &&
    typeof candidate.updatedAt === 'string'
  );
}

/** Progress for §S05's StepProgress indicator. */
export function draftProgress(draft: RegistrationDraft): { completed: number; total: number } {
  return { completed: draft.completed.length, total: REGISTRATION_STEPS.length };
}

/**
 * Where a step sits in the flow, for the "step N of M" indicator.
 *
 * Derived rather than written on each screen. Hand-numbered progress had already drifted:
 * the four Milestone 1 screens still said "of 4" after Milestone 2 made the flow ten steps
 * long, and S13 and the goals screen both claimed to be step 8 — because S13 was not counted
 * as a step at all. A student saw the total change halfway through, then a number repeat.
 */
export function stepNumber(step: RegistrationStep): number {
  return REGISTRATION_STEPS.indexOf(step) + 1;
}

export const REGISTRATION_STEP_COUNT = REGISTRATION_STEPS.length;
