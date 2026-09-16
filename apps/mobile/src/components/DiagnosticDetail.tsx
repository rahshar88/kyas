import { TextButton, spacing, typography, useTheme } from '@kyascene/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { env } from '@/config/env';
import { describeCause } from '@/repositories/errors';

/**
 * What went wrong, in the words of whatever went wrong — on internal builds only.
 *
 * §6.4 says screens "show human guidance and never expose raw backend messages", and that
 * still holds: this renders nothing in production, which `verify-native-output` cannot check
 * but the test beside it does.
 *
 * It exists because the rule has a cost nobody priced in. Every failure reaching a tester
 * looks identical — one calm sentence — so a wrong API key, a phone that cannot resolve DNS
 * and a mistyped code are indistinguishable from the outside. Diagnosing them has meant
 * guessing from a screenshot, shipping a build, and guessing again.
 *
 * The connection check is the other half. "We couldn't reach KyaScene" is a claim about the
 * network made by a library, three layers of retry away from the socket; this asks the phone
 * itself, against the same host the app uses, and reports the raw answer.
 */
export function DiagnosticDetail({ error, testID }: { error: unknown; testID?: string }) {
  const theme = useTheme();
  const [probe, setProbe] = useState<string | undefined>();
  const [probing, setProbing] = useState(false);

  if (env.EXPO_PUBLIC_ENVIRONMENT === 'production') return null;

  const detail = describeCause(error);
  if (detail === undefined) return null;

  const check = async () => {
    setProbing(true);
    setProbe(undefined);
    try {
      // Deliberately bare `fetch`, not supabase-js: the question is whether this phone can
      // reach that host at all, and the client is the thing under suspicion.
      const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`);
      setProbe(`reached it — HTTP ${response.status}`);
    } catch (caught) {
      setProbe(`could not reach it — ${describeCause(caught) ?? 'no detail'}`);
    } finally {
      setProbing(false);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[typography.caption, styles.mono, { color: theme.textSecondary }]}>
        {detail}
      </Text>

      <TextButton
        label={probing ? 'Checking…' : 'Check the connection'}
        onPress={() => void check()}
        disabled={probing}
        testID="diagnostic-check"
      />

      {probe === undefined ? null : (
        <Text
          style={[typography.caption, styles.mono, { color: theme.textSecondary }]}
          testID="diagnostic-probe"
        >
          {env.EXPO_PUBLIC_SUPABASE_URL} — {probe}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, marginTop: spacing.sm },
  mono: { fontFamily: 'Courier' },
});
