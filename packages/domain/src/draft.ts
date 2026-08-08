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
 */
export const REGISTRATION_DRAFT_VERSION = 1;

/** The steps Milestone 1 covers, in order (§8.1). */
export const REGISTRATION_STEPS = [
  'eligibility',
  'study',
  'sydney-location',
  'india-background',
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

export interface RegistrationDraft {
  version: number;
  /** Which steps the student has completed, so §10.2 can resume the last valid one. */
  completed: RegistrationStep[];
  eligibility?: EligibilityAnswers;
  study?: StudyDetails;
  sydneyLocation?: SydneyLocation;
  indiaBackground?: IndiaBackground;
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
