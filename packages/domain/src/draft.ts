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
 * **2** since Milestone 2 added S09–S15. Anyone holding a Milestone 1 draft loses the first
 * four steps and re-enters them; that is a couple of minutes with a visible reason, against
 * the alternative of submitting half-migrated answers under a real person's name.
 */
export const REGISTRATION_DRAFT_VERSION = 2;

/**
 * The registration steps in order (§8.1), S05 through S15.
 *
 * Order is load-bearing: `nextIncompleteStep` resumes the first unfinished one, so this array
 * is the single definition of "what comes next" for both the flow and §10.2's resume.
 *
 * S13 (photograph) is absent on purpose. §S13 makes it optional and requires that skipping
 * remains a first-class outcome; including it here would make an unfinished photograph block
 * resume forever, since "skipped" and "not reached" would be indistinguishable.
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
  'privacy',
  'consent',
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
