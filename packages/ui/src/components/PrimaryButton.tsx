import { useTheme } from '../theme';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';

/**
 * The single most important action on a screen — "Join the beta", "Verify", "Submit for
 * approval". Scene Saffron fill with a Night label (7.35:1, §7.5).
 */
export function PrimaryButton(props: ButtonBaseProps) {
  const theme = useTheme();
  return (
    <ButtonBase
      {...props}
      variant="filled"
      backgroundColor={theme.accent}
      textColor={theme.onAccent}
    />
  );
}
