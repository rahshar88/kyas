import { z } from 'zod';

/**
 * Registration validation, shared between the forms and the service boundary (§4.4:
 * "Validation: Zod, shared between forms and service boundaries").
 *
 * Defining these once matters more than it looks. A rule that lives only in a form is a
 * suggestion — anything that writes to the database another way bypasses it. These schemas
 * are mirrored by CHECK constraints in the migrations, so the same rule holds in three
 * places: the keyboard, the API boundary and the table.
 */

/** §S05 eligibility, all four questions from the spec. */
export const eligibilitySchema = z.object({
  isEighteenOrOlder: z.boolean(),
  isFromIndia: z.boolean(),
  isStudyingOrOffered: z.boolean(),
  hasSydneyConnection: z.boolean(),
});

export type EligibilityAnswers = z.infer<typeof eligibilitySchema>;

/**
 * §2.4 and §2.5 define the audience boundary. All four must be true.
 *
 * Deliberately a pure function over the answers rather than a chain of `if` statements in
 * the screen: §S05 requires that "no user can bypass eligibility through direct navigation",
 * which means the check has to be callable from a route guard too.
 */
export function isEligible(answers: EligibilityAnswers): boolean {
  return (
    answers.isEighteenOrOlder &&
    answers.isFromIndia &&
    answers.isStudyingOrOffered &&
    answers.hasSydneyConnection
  );
}

/** Which answer disqualified them, so §S05's "respectful explanation" can be specific. */
export function ineligibilityReason(answers: EligibilityAnswers): IneligibilityReason | null {
  if (!answers.isEighteenOrOlder) return 'under_18';
  if (!answers.isFromIndia) return 'not_from_india';
  if (!answers.isStudyingOrOffered) return 'not_studying';
  if (!answers.hasSydneyConnection) return 'not_sydney';
  return null;
}

export type IneligibilityReason = 'under_18' | 'not_from_india' | 'not_studying' | 'not_sydney';

// ------------------------------------------------------------------ S06 study

export const STUDY_LEVELS = [
  'certificate',
  'diploma',
  'bachelor',
  'master',
  'phd',
  'other',
] as const;
export type StudyLevel = (typeof STUDY_LEVELS)[number];

export const STUDY_LEVEL_LABELS: Record<StudyLevel, string> = {
  certificate: 'Certificate',
  diploma: 'Diploma',
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  phd: 'PhD',
  other: 'Something else',
};

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(2000).max(2100);

export const studyDetailsSchema = z
  .object({
    provider: z.string().min(1, 'Choose your education provider'),
    /** §S06 requires a "Not listed" option; that path fills this instead of `provider`. */
    providerOther: z.string().trim().max(120).optional(),
    campus: z.string().trim().max(80).optional(),
    course: z.string().trim().min(1, 'Tell us what you are studying').max(120),
    studyLevel: z.enum(STUDY_LEVELS),
    intakeMonth: monthSchema,
    intakeYear: yearSchema,
    completionMonth: monthSchema,
    completionYear: yearSchema,
    /** §S06: "student email if different". Optional, and never shown publicly (§13.2). */
    studentEmail: z.email('That does not look like an email address').optional(),
  })
  .refine(
    (value) =>
      value.completionYear * 100 + value.completionMonth >=
      value.intakeYear * 100 + value.intakeMonth,
    {
      // §S06: "Completion cannot precede intake. Future intake is allowed."
      message: 'Completion cannot be before your intake',
      path: ['completionYear'],
    },
  )
  .refine((value) => value.provider !== PROVIDER_NOT_LISTED || Boolean(value.providerOther), {
    message: 'Tell us the name of your provider',
    path: ['providerOther'],
  });

export type StudyDetails = z.infer<typeof studyDetailsSchema>;

/** Sentinel for §S06's "Not listed" choice. Never a real provider code. */
export const PROVIDER_NOT_LISTED = '__not_listed__';

// --------------------------------------------------------------- S07 location

export const ARRIVAL_STATUSES = ['in_sydney', 'arriving_soon', 'not_yet_decided'] as const;
export type ArrivalStatus = (typeof ARRIVAL_STATUSES)[number];

export const ARRIVAL_STATUS_LABELS: Record<ArrivalStatus, string> = {
  in_sydney: "I'm in Sydney now",
  arriving_soon: "I'm arriving soon",
  not_yet_decided: 'Not in Sydney yet',
};

/**
 * §S07. Suburb-level only.
 *
 * There is deliberately no latitude, longitude or street field anywhere in this schema —
 * §13.2 forbids exact GPS, background location and street address in P0, and the absence is
 * the enforcement. The device location permission is never requested either.
 */
export const sydneyLocationSchema = z.object({
  suburb: z.string().trim().min(1, 'Which suburb?').max(80),
  /** Australian postcodes are four digits. Optional per §S07. */
  postcode: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, 'An Australian postcode is four digits')
    .optional()
    .or(z.literal('')),
  arrivalStatus: z.enum(ARRIVAL_STATUSES),
  /** §S07: "Public suburb visibility defaults off." */
  suburbVisible: z.boolean().default(false),
});

export type SydneyLocation = z.infer<typeof sydneyLocationSchema>;

// ------------------------------------------------------------- S08 background

/**
 * §S08. State comes from a maintained list; hometown is optional free text.
 *
 * §S08 acceptance: "A user may decline the city field without blocking registration", which
 * is why `hometown` is optional rather than merely allowed to be empty.
 */
export const indiaBackgroundSchema = z.object({
  stateCode: z.string().min(1, 'Choose your state or union territory'),
  hometown: z.string().trim().max(80).optional(),
  /** §S08: "Both fields have independent profile-visibility controls." */
  stateVisible: z.boolean().default(false),
  hometownVisible: z.boolean().default(false),
});

export type IndiaBackground = z.infer<typeof indiaBackgroundSchema>;

// -------------------------------------------------------------------- S02/S03

/**
 * §S02: "Normalise case and whitespace; validate syntax locally."
 *
 * Normalisation is part of the schema rather than the screen because the same address must
 * hash to the same account whether it was typed, pasted or autofilled.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

/** §S03: "Six-digit code with paste support." */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter the 6-digit code');

/** §S04. Matches the normalisation in the redeem-invite Edge Function. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^[A-Z0-9]{6,16}$/, 'That invite code does not look right'));
