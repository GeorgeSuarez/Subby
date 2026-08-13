/**
 * VerifyPasswordScreen — identity check before changing the password.
 *
 * Settings → Account → Reset password lands here first: the signed-in user
 * must enter their current password (verified via signInWithPassword). On
 * success the change screen (`/reset-password?from=settings&verified=1`)
 * shows the new-password form.
 *
 * Skill rules:
 *  - `react-state-dispatcher`: verification goes through the auth store.
 *  - `ui-pressable`: design-system buttons / Pressable links only.
 *  - `react-state-minimize`: errors are derived, never cached.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { layout, spacing } from '@/design/tokens';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { useAuthStore } from '@/store/useAuthStore';
import { notifyError } from '@/utils/haptics';

export function VerifyPasswordScreen() {
  const router = useRouter();
  const email = useAuthStore((s) => s.email);
  const recoveryPending = useAuthStore((s) => s.recoveryPending);
  const verifyCurrentPassword = useAuthStore((s) => s.verifyCurrentPassword);

  // A recovery session (email link) may arrive while this screen is up (warm
  // deep link) — the forgot-password flow must not ask for the current
  // password, so hand over to the recovery form.
  useEffect(() => {
    if (recoveryPending) {
      router.replace('/reset-password');
    }
  }, [recoveryPending, router]);

  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!touched) return null;
    if (!password) return 'Enter your current password.';
    return null;
  }, [touched, password]);

  const canSubmit = passwordError === null && password.length > 0 && !submitting;

  const onContinue = useCallback(async () => {
    if (submitting) return;
    setTouched(true);
    setSubmitError(null);
    if (passwordError) {
      void notifyError();
      return;
    }
    setSubmitting(true);
    try {
      await verifyCurrentPassword(password);
      router.replace('/reset-password?from=settings&verified=1');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not verify the password.');
      void notifyError();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, passwordError, password, verifyCurrentPassword, router]);

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
            <Text variant="title" align="center">Verify your password</Text>
            <Text variant="body" color="textSecondary" align="center">
              Confirm it&apos;s you before setting a new password{email ? ` for ${email}` : ''}.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="textSecondary" weight="600">Current password</Text>
              <PasswordField
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched(true)}
                placeholder="Your current password"
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={onContinue}
              />
              {passwordError ? (
                <Text variant="caption" color="negative">{passwordError}</Text>
              ) : null}
            </View>

            <Button variant="primary" size="lg" disabled={!canSubmit} onPress={onContinue}>
              Continue
            </Button>

            {submitError ? (
              <Text variant="caption" color="negative" align="center">{submitError}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              // Always from Settings — return there explicitly.
              router.dismissTo('/(tabs)/settings');
            }}
            accessibilityRole="link"
            accessibilityLabel="Back"
            style={styles.switchLink}
          >
            <Text variant="body" color="textSecondary">Back</Text>
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
