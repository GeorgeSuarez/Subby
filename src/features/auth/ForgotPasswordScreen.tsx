/**
 * ForgotPasswordScreen — request a password-reset email.
 *
 * Single email field; on submit the store asks Supabase for a recovery email
 * (redirected to the app's deep link). After sending, a "check your inbox"
 * state explains the two ways to continue: open the link on this device, or
 * (dev) paste the link into the reset screen.
 *
 * Skill rules:
 *  - `ui-pressable`: design-system buttons / Pressable links only.
 *  - `react-state-dispatcher`: all actions go through the auth store.
 *  - `react-state-fallback`: `sent` is a local boolean, never derived from
 *    server state.
 */

import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { layout, spacing } from '@/design/tokens';
import { TextField } from '@/features/add-subscription/components/TextField';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { SUPABASE_URL } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { notifyError, notifySuccess } from '@/utils/haptics';
import { isValidEmail } from '@/features/auth/auth-helpers';

/**
 * Where the recovery email redirects after the token is consumed:
 *  - local stack → the handoff page on the dev confirm server (subpath of
 *    site_url, so no allow-list entry needed). The page carries the session
 *    and hands off to the app via a deep link.
 *  - hosted → the app's own deep link (subby:// in builds, exp:// in Expo Go).
 */
const RESET_REDIRECT = /(127\.0\.0\.1|localhost)/.test(SUPABASE_URL)
  ? 'http://127.0.0.1:3000/reset-password'
  : Linking.createURL('reset-password');

export function ForgotPasswordScreen() {
  const router = useRouter();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailError = useMemo(() => {
    if (!touched) return null;
    const value = email.trim();
    if (!value) return 'Enter your email address.';
    if (!isValidEmail(value)) return 'Enter a valid email address.';
    return null;
  }, [touched, email]);

  const canSubmit = emailError === null && email.trim().length > 0 && !submitting;

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    setTouched(true);
    setSubmitError(null);
    if (emailError) {
      void notifyError();
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim(), RESET_REDIRECT);
      void notifySuccess();
      setSent(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not send the reset email.');
      void notifyError();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, emailError, email, requestPasswordReset]);

  if (sent) {
    return (
      <Surface background="surface" style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandLockup />
          <View style={styles.copy}>
            <Text variant="title" align="center">Check your inbox</Text>
            <Text variant="body" color="textSecondary" align="center">
              We sent a 6-digit reset code to {email.trim()}. It expires in 15 minutes — enter
              it to set a new password.
            </Text>
          </View>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.replace('/reset-password')}
          >
            Enter the reset code
          </Button>
          <Button variant="ghost" size="lg" onPress={() => router.replace('/auth/sign-in')}>
            Back to sign in
          </Button>
        </ScrollView>
      </Surface>
    );
  }

  return (
    <Surface background="surface" style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLockup />

          <View style={styles.copy}>
            <Text variant="title" align="center">Reset your password</Text>
            <Text variant="body" color="textSecondary" align="center">
              Enter your account email and we&apos;ll send you a link to set a new password.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="textSecondary" weight="600">Email</Text>
              <TextField
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched(true)}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              {emailError ? (
                <Text variant="caption" color="negative">{emailError}</Text>
              ) : null}
            </View>

            <Button testID="forgot-submit" variant="primary" size="lg" disabled={!canSubmit} onPress={onSubmit}>
              Send reset link
            </Button>

            {submitError ? (
              <Text variant="caption" color="negative" align="center">{submitError}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => router.replace('/auth/sign-in')}
            accessibilityRole="link"
            accessibilityLabel="Back to sign in"
            style={styles.switchLink}
          >
            <Text variant="body" color="accent" weight="600">Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing['3xl'],
    gap: spacing['3xl'],
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  copy: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  switchLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
