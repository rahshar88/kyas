/**
 * Brand tokens, verbatim from spec §7.1. These seven values are the brand.
 */
export const colors = {
  /** Primary brand and dark surfaces. */
  sceneEmerald: '#032C24',
  /** Primary accent and important calls to action. */
  sceneSaffron: '#FF7A1A',
  /** Light background. */
  warmCream: '#F5F1E8',
  /** Dark background and high-contrast text. */
  night: '#06110F',
  /** Positive status and secondary accent. */
  mint: '#61D89B',
  /** Errors and destructive confirmation. */
  error: '#C73B3B',
  /** Caution states. */
  warning: '#B06B00',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Semantic roles. Components reference roles, never raw hex.
 *
 * Why the `*Text` roles are not simply the brand tokens: §7.5 sets a WCAG AA floor, and
 * the measured ratios say the raw tokens do not clear it as text on our dark surface —
 * Error on Scene Emerald is 2.96:1 and Warning is 3.56:1, against a 4.5:1 requirement.
 * Both are *fill* colours: they pass comfortably as a button or badge background with a
 * Night or Warm Cream label on top (Cream on Error is 4.52:1, Night on Warning 4.52:1).
 * So each status has a fill role carrying the brand token and a text role carrying a
 * tint of it that clears AA. `contrast.test.ts` enforces every pair below, which means a
 * future palette edit fails CI rather than shipping unreadable error text.
 *
 * Ratios in comments are measured, not estimated. §7.5 also forbids colour-only status
 * communication, so every status role must be paired with an icon or text at the call site.
 */
export const semanticColors = {
  dark: {
    background: colors.sceneEmerald,
    backgroundElevated: colors.night,
    /** 13.41:1 on background. */
    textPrimary: colors.warmCream,
    /** 7.58:1 on background. Solid rather than translucent so it stays testable. */
    textSecondary: '#B1BAB1',
    /** 5.79:1 on background. */
    accent: colors.sceneSaffron,
    /** 7.35:1 on accent. */
    onAccent: colors.night,

    /** Fills: brand tokens, used as backgrounds behind `onStatus`. */
    positiveFill: colors.mint,
    dangerFill: colors.error,
    cautionFill: colors.warning,
    /** Label colour placed on any status fill. 10.78 / 4.52 / 4.52:1 respectively. */
    onPositiveFill: colors.night,
    onDangerFill: colors.warmCream,
    onCautionFill: colors.night,

    /** Status text on `background`. 8.49 / 7.44 / 6.93:1. */
    positiveText: colors.mint,
    dangerText: '#FF9A9A',
    cautionText: '#E9A13B',

    border: 'rgba(245, 241, 232, 0.16)',
  },
  light: {
    background: colors.warmCream,
    backgroundElevated: '#FFFFFF',
    /** 17.02:1 on background. */
    textPrimary: colors.night,
    /** 6.39:1 on background. */
    textSecondary: '#525954',
    /** Saffron is only 2.32:1 on Warm Cream, so light-mode accent *text* is not saffron;
        saffron remains the fill for primary actions with a Night label (7.35:1). */
    accent: colors.sceneSaffron,
    onAccent: colors.night,

    positiveFill: '#0E7A4B',
    dangerFill: colors.error,
    cautionFill: colors.warning,
    onPositiveFill: colors.warmCream,
    onDangerFill: colors.warmCream,
    onCautionFill: colors.night,

    /** Status text on `background`. 4.77 / 4.52 / 6.64:1. */
    positiveText: '#0E7A4B',
    dangerText: colors.error,
    cautionText: '#7A4A00',

    border: 'rgba(6, 17, 15, 0.14)',
  },
} as const;

export type ColorScheme = keyof typeof semanticColors;
export type SemanticColorRole = keyof (typeof semanticColors)['dark'];
