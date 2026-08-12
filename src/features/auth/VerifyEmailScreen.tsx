/**
 * VerifyEmailScreen — shown after sign-up when email confirmation is enabled.
 *
 * Explains the confirmation link, offers "Resend email", and polls the session
 * every few seconds — the moment the link is tapped, the auth gate flips and
 * the user lands in the app without pressing anything. A manual "I've
 * verified — continue" button covers the edge case where polling is suspended.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable-based design-system buttons only.
 *  - `react-state-dispatcher`: all actions go through the auth store.
 *  - `react-state-fallback`: the screen is only reachable with a
 *    `verificationEmail`; a missing one falls back to the sign-in screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { layout, spacing } from '@/design/tokens';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { notifyError, notifySuccess, notifyWarning } from '@/utils/haptics';

const POLL_INTERVAL_MS = 5000;

export function VerifyEmailScreen() {
  const router = useRouter();
  const verificationEmail = useAuthStore((s) => s.verificationEmail);
  const checkVerification = useAuthStore((s) => s.checkVerification);
  const resendVerificationEmail = useAuthStore((s) => s.resendVerificationEmail);

  const [checking, setChecking] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const finish = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Poll for the confirmed session; the auth gate also reacts to the
  // onAuthStateChange event the store subscribes to.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const confirmed = await checkVerification();
      if (confirmed && !cancelled) {
        void notifySuccess();
        finish();
      }
    };
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkVerification, finish]);

  const onContinue = useCallback(async () => {
    setChecking(true);
    setInlineError(null);
    try {
      const confirmed = await checkVerification();
      if (confirmed) {
        void notifySuccess();
        finish();
      } else {
        void notifyWarning();
        setInlineError('Not confirmed yet — tap the link in the email first.');
      }
    } finally {
      setChecking(false);
    }
  }, [checkVerification, finish]);

  const onResend = useCallback(async () => {
    setInlineError(null);
    try {
      await resendVerificationEmail();
      void notifySuccess();
      toast('Confirmation link sent');
    } catch (e) {
      void notifyError();
      setInlineError(e instanceof Error ? e.message : 'Could not resend the email.');
    }
  }, [resendVerificationEmail]);

  // No email awaiting verification — nothing to verify; go sign in.
  useEffect(() => {
    if (!verificationEmail) {
      router.replace('/auth/sign-in');
    }
  }, [verificationEmail, router]);

  if (!verificationEmail) return null;

  return (
    <Surface background="surface" style={styles.root}>
      <View style={styles.content}>
        <BrandLockup />

        <View style={styles.copy}>
          <Text variant="title" align="center">Verify your email</Text>
          <Text variant="body" color="textSecondary" align="center">
            We sent a confirmation link to {verificationEmail}. Tap it, then come back here.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button variant="primary" size="lg" disabled={checking} onPress={onContinue}>
            {"I've verified — continue"}
          </Button>
          <Button variant="ghost" size="lg" onPress={onResend}>Resend email</Button>

          {inlineError ? (
            <Text variant="caption" color="negative" align="center">{inlineError}</Text>
          ) : null}

          <Text variant="caption" color="textTertiary" align="center">
            Checking automatically — no need to wait here.
          </Text>
        </View>

        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          Back to sign in
        </Button>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  actions: {
    gap: spacing.sm,
  },
});
