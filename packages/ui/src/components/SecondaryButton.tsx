import { useTheme } from '../theme';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';

/**
 * The alternative path — "I already have an account". Outlined so it reads as secondary
 * without relying on colour alone (§7.5).
 */
export function SecondaryButton(props: ButtonBaseProps) {
  const theme = useTheme();
  return (
    <ButtonBase
      {...props}
      variant="outlined"
      backgroundColor="transparent"
      borderColor={theme.textPrimary}
      textColor={theme.textPrimary}
    />
  );
}
