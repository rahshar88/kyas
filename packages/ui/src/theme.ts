import { useColorScheme } from 'react-native';

import { semanticColors, type ColorScheme } from './tokens/colors';

export type Theme = (typeof semanticColors)[ColorScheme];

/**
 * Resolves the active palette. Defaults to `dark` because the KyaScene launch and welcome
 * surfaces are Scene Emerald (§S00, §S01) and an unknown scheme should not flash light.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'light' ? semanticColors.light : semanticColors.dark;
}

export function themeFor(scheme: ColorScheme): Theme {
  return semanticColors[scheme];
}
