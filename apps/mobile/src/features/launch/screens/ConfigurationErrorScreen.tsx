import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Shown when the bundle has no usable configuration, instead of the app closing.
 *
 * Deliberately built from nothing: raw `View` and `Text`, literal colours, no theme, no
 * providers, no `AppScreen`. Everything in `@kyascene/ui` is fine here, but a screen whose job
 * is to explain that the app cannot start must not depend on the parts of the app that might
 * be why. If this screen can fail, it is worthless at the only moment it matters.
 *
 * §7.6 asks for calm and specific. `parseEnv` already names each missing variable, so the
 * message is passed through rather than replaced with something reassuring and useless.
 *
 * A tester should never see this — it means a broken bundle reached a device, which
 * `verify-update-bundle.mjs` now blocks. It exists because that gate did not, once, and the
 * result was an app that opened and shut with nothing to report.
 */
export function ConfigurationErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>KyaScene cannot start</Text>

        <Text style={styles.body}>
          This build is missing part of its configuration, so it has nothing to connect to. Nothing
          is wrong with your phone or your account.
        </Text>

        <Text style={styles.body}>
          If you are testing for us, please send this screen to whoever gave you the app.
        </Text>

        <View style={styles.detail}>
          <Text style={styles.mono} selectable testID="configuration-error-detail">
            {message}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Scene Emerald and Warm Cream by value, not by token — see the note above.
  screen: { flex: 1, backgroundColor: '#032C24' },
  content: { padding: 24, paddingTop: 96, gap: 16 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#F5F1E8' },
  body: { fontSize: 16, lineHeight: 24, color: '#B1BAB1' },
  detail: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#06110F',
  },
  // `selectable` above so it can be copied out, which is more use than a screenshot.
  mono: { fontFamily: 'Courier', fontSize: 13, lineHeight: 18, color: '#E9A13B' },
});
