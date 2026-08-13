import { semanticColors, type ColorScheme } from '../colors';

/** WCAG 2.1 relative luminance. */
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** §7.5: "WCAG AA colour contrast for text and essential controls." */
const AA_NORMAL_TEXT = 4.5;

type Pair = { name: string; foreground: string; background: string };

function textPairsFor(scheme: ColorScheme): Pair[] {
  const t = semanticColors[scheme];
  return [
    { name: 'textPrimary on background', foreground: t.textPrimary, background: t.background },
    { name: 'textSecondary on background', foreground: t.textSecondary, background: t.background },
    {
      name: 'textPrimary on backgroundElevated',
      foreground: t.textPrimary,
      background: t.backgroundElevated,
    },
    /**
     * Every text role against *both* surfaces. Checking only `background` was the gap that
     * let accent-coloured text ship at 2.31:1 in light mode: cards are drawn on
     * `backgroundElevated`, which nothing tested, and in the light scheme that is white —
     * a brighter surface than the background, so it is the harder of the two.
     */
    { name: 'accentText on background', foreground: t.accentText, background: t.background },
    {
      name: 'accentText on backgroundElevated',
      foreground: t.accentText,
      background: t.backgroundElevated,
    },
    { name: 'positiveText on background', foreground: t.positiveText, background: t.background },
    {
      name: 'positiveText on backgroundElevated',
      foreground: t.positiveText,
      background: t.backgroundElevated,
    },
    {
      name: 'textSecondary on backgroundElevated',
      foreground: t.textSecondary,
      background: t.backgroundElevated,
    },
    { name: 'dangerText on background', foreground: t.dangerText, background: t.background },
    { name: 'cautionText on background', foreground: t.cautionText, background: t.background },
    // Labels sitting on a filled control — the PrimaryButton and status badges.
    { name: 'onAccent on accent', foreground: t.onAccent, background: t.accent },
    {
      name: 'onPositiveFill on positiveFill',
      foreground: t.onPositiveFill,
      background: t.positiveFill,
    },
    { name: 'onDangerFill on dangerFill', foreground: t.onDangerFill, background: t.dangerFill },
    {
      name: 'onCautionFill on cautionFill',
      foreground: t.onCautionFill,
      background: t.cautionFill,
    },
  ];
}

describe('design tokens meet the §7.5 accessibility floor', () => {
  describe.each<ColorScheme>(['dark', 'light'])('%s scheme', (scheme) => {
    it.each(textPairsFor(scheme))(
      '$name clears WCAG AA for normal text',
      ({ foreground, background }) => {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      },
    );
  });

  /**
   * Guards the reasoning recorded in colors.ts. The raw §7.1 Error and Warning tokens are
   * fill colours: they do NOT clear AA as text on Scene Emerald. If someone "simplifies"
   * dangerText back to colors.error, this test explains why that is wrong before the
   * change reaches a tester.
   */
  /**
   * The reason `accentText` exists at all.
   *
   * Scene Saffron is a *fill*: Night on Saffron is 7.35:1 and that is how PrimaryButton uses
   * it. As text it measures 5.79:1 on Scene Emerald — fine — and **2.31:1 on Warm Cream**,
   * which fails AA and fails even the 3:1 large-text floor. The palette said so in a comment
   * from Milestone 0; eight call sites used `theme.accent` as a text colour anyway, and no
   * test contradicted them because the only accent pair asserted was the fill.
   *
   * Nothing showed it for months because dark mode passes. It took a screenshot of a phone in
   * light mode.
   */
  it('does not let accent be used as text where it would fail', () => {
    const light = semanticColors.light;

    expect(contrastRatio(light.accent, light.background)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(light.accent, light.backgroundElevated)).toBeLessThan(AA_NORMAL_TEXT);
    expect(light.accentText).not.toBe(light.accent);
  });

  it('keeps status text distinct from status fills on the dark surface', () => {
    const dark = semanticColors.dark;
    expect(contrastRatio(dark.dangerFill, dark.background)).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(dark.cautionFill, dark.background)).toBeLessThan(AA_NORMAL_TEXT);
    expect(dark.dangerText).not.toBe(dark.dangerFill);
    expect(dark.cautionText).not.toBe(dark.cautionFill);
  });
});
