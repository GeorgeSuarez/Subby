/**
 * ResetPasswordScreen — set a new password after a recovery link.
 *
 * Two entry paths:
 *  - A recovery session is active (the email link opened the app on this
 *    device, or the store received PASSWORD_RECOVERY) → show the password
 *    form directly.
 *  - No session (dev: the link was opened in a browser, e.g. Mailpit on a
 *    Mac) → paste the recovery link; the store verifies its token and opens
 *    the session, then the form appears.
 *
 * Rendered at the root of the router (outside the auth gate) so a signed-in
 * recovery session can reach it.
 *
 * Skill rules:
 *  - `react-state-dispatcher`: all actions go through the auth store.
 *  - `ui-pressable`: design-system buttons / Pressable links only.
 *  - `react-state-minimize`: errors are derived each render, never cached.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { layout, spacing } from '@/design/tokens';
import { TextField } from '@/features/add-subscription/components/TextField';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { notifyError, notifySuccess } from '@/utils/haptics';

const PASSWORD_MIN = 8;

export function ResetPasswordScreen() {
  const router = useRouter();
  const recoveryPending = useAuthStore((s) => s.recoveryPending);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const handleAuthUrl = useAuthStore((s) => s.handleAuthUrl);
  const verifyRecoveryLink = useAuthStore((s) => s.verifyRecoveryLink);
  const updatePassword = useAuthStore((s) => s.updatePassword);

  // Two change paths land on this screen:
  //  - recovery (code/link): `recoveryPending` — no current-password check.
  //  - Settings (verified): `/reset-password?from=settings&verified=1` — the
  //    verify-password screen already checked the current password.
  // Any other signed-in visit goes through the verify-password screen first.
  const { from, verified } = useLocalSearchParams<{ from?: string; verified?: string }>();
  const fromSettingsVerified = from === 'settings' && verified === '1';
  const isRecovery = recoveryPending && !fromSettingsVerified;
  const isChangeMode = fromSettingsVerified;
  const [urlChecked, setUrlChecked] = useState(fromSettingsVerified);
  const needsVerify = urlChecked && isSignedIn && !isRecovery && !fromSettingsVerified;

  // The recovery deep link carries the session in the URL fragment —
  // supabase-js can't detect it on RN, so we parse it ourselves (cold start
  // and while running). `urlChecked` gates the verify-redirect below: a
  // signed-in user opening a recovery link must NOT be sent to the
  // current-password step just because the async URL processing hasn't set
  // `recoveryPending` yet.
  //
  // Skipped entirely on the Settings flow: that path already has a verified
  // session and must not touch the URL machinery (a getSession on a stale
  // stored session there can fail a refresh and emit SIGNED_OUT).
  useEffect(() => {
    if (fromSettingsVerified) {
      return;
    }
    let cancelled = false;
    void Linking.getInitialURL().then(async (url) => {
      if (url && !cancelled) {
        await handleAuthUrl(url);
      }
      if (!cancelled) setUrlChecked(true);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [fromSettingsVerified, handleAuthUrl]);

  // Recovery-entry (no session yet): code from the email (primary) or a
  // pasted link (fallback).
  const recoveryEmail = useAuthStore((s) => s.recoveryEmail);
  const verifyRecoveryCode = useAuthStore((s) => s.verifyRecoveryCode);
  const [email, setEmail] = useState(recoveryEmail ?? '');
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  // Settings flow: return to Settings explicitly — never through stack
  // history, which can land outside the tabs (or on a remounted gate).
  const backToSettings = useCallback(() => {
    router.dismissTo('/(tabs)/settings');
  }, [router]);

  const canEnter =
    !entering &&
    email.trim().length > 0 &&
    (code.trim().length > 0 || link.trim().length > 0);

  const onEnter = useCallback(async () => {
    if (entering) return;
    setLinkError(null);
    setEntering(true);
    try {
      if (code.trim().length > 0) {
        await verifyRecoveryCode(email, code);
      } else {
        const trimmed = link.trim();
        // Accept both a raw email link (token) and a deep link (session).
        const handled = await handleAuthUrl(trimmed);
        if (!handled) {
          await verifyRecoveryLink(trimmed);
        }
      }
      void notifySuccess();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Could not use that code.');
      void notifyError();
    } finally {
      setEntering(false);
    }
  }, [entering, code, link, email, handleAuthUrl, verifyRecoveryCode, verifyRecoveryLink]);

  // Password-form entry.
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const confirmRef = useRef<TextInput>(null);

  // Signed-in without a recovery session and without having just verified —
  // demand the current password before showing the change form.
  useEffect(() => {
    if (needsVerify) {
      router.replace('/verify-password');
    }
  }, [needsVerify, router]);

  const canReset = isRecovery || isChangeMode;

  // Derived validation — never stored (skill `react-state-minimize`).
  const passwordError = useMemo(() => {
    if (!touched) return null;
    if (!password) return 'Enter a new password.';
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (confirm && password !== confirm) return 'Passwords do not match.';
    return null;
  }, [touched, password, confirm]);

  const canSubmit =
    passwordError === null &&
    password.length >= PASSWORD_MIN &&
    password === confirm &&
    !submitting;

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    setTouched(true);
    setSubmitError(null);
    if (passwordError) {
      void notifyError();
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      void notifySuccess();
      toast('Password updated');
      if (isChangeMode) {
        // Settings flow: land back on Settings, never on a fresh stack.
        backToSettings();
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not update the password.');
      void notifyError();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, passwordError, password, updatePassword, router, isChangeMode, backToSettings]);

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
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <BrandLockup />

          <View style={styles.copy}>
            <Text variant="title" align="center">Set a new password</Text>
            <Text variant="body" color="textSecondary" align="center">
              {canReset
                ? 'Choose a new password for your account.'
                : 'Enter the code from the email to continue.'}
            </Text>
          </View>

          {canReset ? (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text variant="caption" color="textSecondary" weight="600">New password</Text>
                <PasswordField
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setTouched(true)}
                  placeholder={`At least ${PASSWORD_MIN} characters`}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text variant="caption" color="textSecondary" weight="600">Confirm password</Text>
                <PasswordField
                  ref={confirmRef}
                  value={confirm}
                  onChangeText={setConfirm}
                  onBlur={() => setTouched(true)}
                  placeholder="Repeat the password"
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                />
              </View>

              {passwordError ? (
                <Text variant="caption" color="negative">{passwordError}</Text>
              ) : null}

              <Button testID="reset-submit" variant="primary" size="lg" disabled={!canSubmit} onPress={onSubmit}>
                {isChangeMode ? 'Update password' : 'Set new password'}
              </Button>

              {submitError ? (
                <Text variant="caption" color="negative" align="center">{submitError}</Text>
              ) : null}

              <Pressable
                onPress={() => {
                  if (isChangeMode) {
                    backToSettings();
                  } else if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace(isSignedIn ? '/' : '/auth/sign-in');
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel="Back"
                style={styles.switchLink}
              >
                <Text variant="body" color="textSecondary">Back</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text variant="caption" color="textSecondary" weight="600">Email</Text>
                <TextField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text variant="caption" color="textSecondary" weight="600">Code from the email</Text>
                <TextField
                  value={code}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={onEnter}
                />
              </View>

              <Button testID="reset-code-submit" variant="primary" size="lg" disabled={!canEnter} onPress={onEnter}>
                Continue
              </Button>

              <Text variant="caption" color="textTertiary" align="center">
                Or paste the reset link from the email instead
              </Text>

              <View style={styles.fieldGroup}>
                <TextField
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://…/auth/v1/verify?token=…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={onEnter}
                />
              </View>

              {linkError ? (
                <Text variant="caption" color="negative" align="center">{linkError}</Text>
              ) : null}

              <Pressable
                onPress={() => router.replace('/auth/forgot-password')}
                accessibilityRole="link"
                accessibilityLabel="Send a new reset code"
                style={styles.switchLink}
              >
                <Text variant="body" color="accent" weight="600">Send a new reset code</Text>
              </Pressable>
            </View>
          )}
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
