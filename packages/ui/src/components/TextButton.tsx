import { useTheme } from '../theme';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';

export interface TextButtonProps extends ButtonBaseProps {
  /** Marks destructive actions (§7.4 DestructiveButton, §16.4 "unlabelled destructive control"). */
  tone?: 'default' | 'danger';
}

/**
 * Low-emphasis inline action — privacy and terms links on S01, "change email" on S03.
 * Keeps the 48pt target via `hitSlop` rather than by inflating the visible text.
 */
export function TextButton({ tone = 'default', ...props }: TextButtonProps) {
  const theme = useTheme();
  return (
    <ButtonBase
      {...props}
      variant="bare"
      backgroundColor="transparent"
      textColor={tone === 'danger' ? theme.dangerText : theme.textSecondary}
    />
  );
}
