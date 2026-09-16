import { Platform, type TextStyle } from 'react-native';

/**
 * Typography, per spec §7.2.
 *
 * "Use the platform system font for functional UI. iOS renders with San Francisco through
 * the system stack. Android renders with Roboto through the system stack." We therefore
 * load no custom font — `fontFamily: undefined` gets the platform default on both
 * platforms, which is the intent. The KyaScene wordmark is an asset, not a font.
 */
export const fontFamily = {
  system: Platform.select({ ios: 'System', default: undefined }),
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Type scale. Sizes are unscaled base values — §7.5 requires Dynamic Type / font scaling,
 * so components must not set `allowFontScaling={false}` and must not use fixed heights
 * that would clip scaled text.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: fontWeight.bold },
  title: { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.bold },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: fontWeight.semibold },
  body: { fontSize: 17, lineHeight: 24, fontWeight: fontWeight.regular },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: fontWeight.semibold },
  label: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.medium },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.regular },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
