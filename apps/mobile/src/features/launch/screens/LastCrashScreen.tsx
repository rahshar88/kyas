import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { StoredCrash } from '@/services/crash-log';

/**
 * What killed the app last time, shown after it restarts.
 *
 * Built from raw `View`, `Text` and `TouchableOpacity` with literal colours — no theme, no
 * providers, no `@kyascene/ui`. A screen whose entire job is to explain a crash must not
 * depend on the parts of the app that might have caused it. If this screen can fail, it is
 * useless at the only moment it is needed.
 *
 * The text is selectable so it can be copied rather than photographed. A stack trace read off
 * a photograph of a phone is how two wrong diagnoses happened.
 */
export function LastCrashScreen({
  crash,
  onDismiss,
}: {
  crash: StoredCrash;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>KyaScene stopped unexpectedly</Text>
        <Text style={styles.body}>
          This is the error from the last time it closed. Send it to whoever gave you the app — you
          can select and copy the text below.
        </Text>

        <View style={styles.detail}>
          <Text style={styles.label}>Where</Text>
          <Text style={styles.mono} selectable testID="crash-where">
            {crash.at}
          </Text>

          <Text style={styles.label}>What</Text>
          <Text style={styles.mono} selectable testID="crash-message">
            {crash.message}
          </Text>

          {crash.stack === undefined ? null : (
            <>
              <Text style={styles.label}>Stack</Text>
              <Text style={styles.mono} selectable testID="crash-stack">
                {crash.stack}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          style={styles.button}
          testID="crash-continue"
        >
          <Text style={styles.buttonLabel}>Continue to KyaScene</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#032C24' },
  content: { padding: 24, paddingTop: 72, gap: 16 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: '#F5F1E8' },
  body: { fontSize: 15, lineHeight: 22, color: '#B1BAB1' },
  detail: { padding: 16, borderRadius: 12, backgroundColor: '#06110F', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#B1BAB1', letterSpacing: 0.5 },
  mono: { fontFamily: 'Courier', fontSize: 12, lineHeight: 17, color: '#E9A13B' },
  button: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#FF7A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, fontWeight: '600', color: '#06110F' },
});
