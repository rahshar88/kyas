import { useTheme } from '../theme';
import { ButtonBase, type ButtonBaseProps } from './ButtonBase';

/**
 * An action that cannot be undone — S22's "Delete my account" (§7.4).
 *
 * Error red as a *fill* with a Warm Cream label, which measures 4.52:1 and clears §7.5's AA
 * floor. Red text on the app background does not: it measures 2.96:1, which is why the palette
 * carries separate fill and text roles at all (recorded in the Milestone 0 build log). A
 * destructive button rendered the obvious way would have been unreadable.
 *
 * It looks unlike every other button on purpose. §S22 requires "a deliberate confirmation",
 * and the first part of deliberate is that the control does not resemble the one beside it.
 */
export function DestructiveButton(props: ButtonBaseProps) {
  const theme = useTheme();
  return (
    <ButtonBase
      {...props}
      variant="filled"
      backgroundColor={theme.dangerFill}
      textColor={theme.onDangerFill}
    />
  );
}
