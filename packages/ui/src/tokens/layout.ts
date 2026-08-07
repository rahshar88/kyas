/** Spacing scale, per spec §7.3. Use the named steps; do not invent intermediate values. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Radius scale, per spec §7.3. `pill` is a large constant, not a percentage. */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;

export const layout = {
  /** "Main screen horizontal padding: 20" (§7.3). */
  screenPaddingHorizontal: 20,
  /** "Card padding: 16 or 20" (§7.3). */
  cardPadding: 16,
  cardPaddingLarge: 20,
  /**
   * "Minimum interactive target: 48 by 48 logical units across both platforms" (§7.3).
   * Every pressable in packages/ui asserts this, and component tests check it.
   */
  minTouchTarget: 48,
} as const;
