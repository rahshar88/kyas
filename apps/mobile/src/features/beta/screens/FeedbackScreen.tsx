import { APP_ERROR_MESSAGES, isAppError } from '@kyascene/domain';
import {
  AppHeader,
  AppScreen,
  PoweredBy1818,
  PrimaryButton,
  RatingField,
  SelectField,
  TextButton,
  TextField,
  spacing,
  typography,
  useTheme,
} from '@kyascene/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { betaRepository, type FeedbackCategory } from '@/repositories/beta-repository';
import { analytics } from '@/services/analytics';

/**
 * S20 — Beta feedback.
 *
 * §S20: "Turn testing into structured learning."
 *
 * Structured is the operative word: a category from a closed list, an optional rating, and one
 * free-text field. The category is what makes a hundred reports sortable; the comment is what
 * makes any one of them actionable.
 *
 * §S20 acceptance: "Submission works without an email client and returns a reference number."
 * Both matter. No `mailto:` anywhere — a tester without Mail configured, which is most people
 * on a shared or work phone, would simply have no way to report anything. And the reference
 * comes back from the database, so what they are told to quote is what was actually stored.
 *
 * §S20 privacy: "Warn users not to include passwords or identity documents." The warning sits
 * above the field rather than below it, because a warning read after typing is a warning read
 * too late.
 */
const CATEGORIES: { code: FeedbackCategory; name: string }[] = [
  { code: 'bug', name: 'Something is broken' },
  { code: 'confusing', name: 'Something is confusing' },
  { code: 'missing_feature', name: 'Something is missing' },
  { code: 'safety_concern', name: 'A safety concern' },
  { code: 'general', name: 'General feedback' },
];

export function FeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.userId;

  const [category, setCategory] = useState<FeedbackCategory | undefined>();
  const [rating, setRating] = useState<number | undefined>();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [reference, setReference] = useState<string | undefined>();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { screen: 'S20' });
  }, []);

  const submit = async () => {
    if (userId === undefined || category === undefined || comment.trim() === '') return;

    setBusy(true);
    setError(undefined);

    try {
      const receipt = await betaRepository.submitFeedback(userId, {
        category,
        comment,
        rating,
      });

      setReference(receipt.reference);
      // §14.3: the category identifier only. The comment is the field most likely to contain
      // a name, an address or a complaint about a person, and it never leaves the database.
      analytics.track('feedback_submitted', { screen: 'S20', feedbackCategory: category });
    } catch (caught) {
      setError(isAppError(caught) ? APP_ERROR_MESSAGES[caught.code] : APP_ERROR_MESSAGES.UNKNOWN);
    } finally {
      setBusy(false);
    }
  };

  /** §S20: the reference is the receipt. Shown on its own so it cannot be missed. */
  if (reference !== undefined) {
    return (
      <AppScreen testID="feedback-sent">
        <View style={styles.body}>
          <AppHeader
            eyebrow="Thank you"
            title="We have got it."
            subtitle="Someone reads every one of these."
          />

          <View style={[styles.referenceCard, { backgroundColor: theme.backgroundElevated }]}>
            <Text style={[typography.label, { color: theme.textSecondary }]}>Your reference</Text>
            <Text
              style={[typography.display, { color: theme.accent }]}
              accessibilityLabel={`Your reference is ${reference.split('').join(' ')}`}
              testID="feedback-reference"
            >
              {reference}
            </Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              Quote this if you contact us about it.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Back to KyaScene"
            onPress={() => router.back()}
            testID="feedback-done"
          />
          <PoweredBy1818 />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable testID="feedback-screen">
      <View style={styles.body}>
        <AppHeader
          title="Tell us what you think"
          subtitle="This is a beta. Knowing what is wrong is the whole point of it."
          onBack={() => router.back()}
        />

        <SelectField
          label="What is this about?"
          value={category}
          options={CATEGORIES}
          onChange={(next) => setCategory(next as FeedbackCategory)}
          placeholder="Choose one"
          testID="feedback-category"
        />

        <RatingField
          label="How is KyaScene going for you? (optional)"
          value={rating}
          onChange={setRating}
          testID="feedback-rating"
        />

        {/* §S20: the warning goes above the field. Read afterwards, it is read too late. */}
        <Text style={[typography.caption, { color: theme.cautionText }]}>
          Please do not include passwords, bank details or photos of identity documents.
        </Text>

        <TextField
          label="What happened?"
          value={comment}
          onChangeText={(next) => {
            setComment(next);
            if (error !== undefined) setError(undefined);
          }}
          placeholder="The more specific, the more useful."
          multiline
          maxLength={4000}
          error={error}
          testID="feedback-comment"
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Send feedback"
          onPress={() => void submit()}
          loading={busy}
          disabled={category === undefined || comment.trim() === ''}
          testID="feedback-submit"
        />
        <TextButton label="Not now" onPress={() => router.back()} testID="feedback-cancel" />
        <PoweredBy1818 />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, flexGrow: 1 },
  referenceCard: { alignItems: 'center', gap: spacing.sm, borderRadius: 24, padding: 24 },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
