/**
 * VerifyAccountScreen — converts a deferred (anonymous bridge) account into
 * a real one by confirming the sign-up email.
 *
 * Reached from Settings' account row or the dashboard banner while
 * `needsDeferredVerification` is true. Two phases:
 *   intro → explains what's pending; "Send verification email" fires
 *           `beginAccountVerification` (updateUser with the stashed
 *           credentials — same uid, so all data stays put)
 *   sent  → polls `checkAccountVerified` every few seconds; the moment the
 *           confirmation lands the store flips and we route home.
 *
 * Skill rules:
 *  - `react-state-dispatcher`: all actions go through the auth store.
 *  - `rendering-no-falsy-and`: phase is a two-value union, not booleans.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { layout, spacing } from '@/design/tokens';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { needsDeferredVerification } from '@/features/auth/auth-helpers';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { notifyError, notifySuccess, notifyWarning } from '@/utils/haptics';

const POLL_INTERVAL_MS = 5000;

type VerifyPhase = 'intro' | 'sent';

export function VerifyAccountScreen() {
  const router = useRouter();
  const pendingEmail = useAuthStore((s) => s.pendingVerificationEmail);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const pendingVerificationEmail = useAuthStore(
    (s) => s.pendingVerificationEmail,
  );
  const beginAccountVerification = useAuthStore(
    (s) => s.beginAccountVerification,
  );
  const checkAccountVerified = useAuthStore((s) => s.checkAccountVerified);

  const [phase, setPhase] = useState<VerifyPhase>(() =>
    // Auto-send at sign-up means the email is usually already out — skip
    // the intro unless that send failed (or the stash was rehydrated cold).
    useAuthStore.getState().verificationEmailSent ? 'sent' : 'intro',
  );
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Not on a deferred account? Nothing to convert here.
  const needsVerification = needsDeferredVerification({
    isSignedIn,
    isAnonymous,
    pendingVerificationEmail,
  });

  const finish = useCallback(() => {
    void notifySuccess();
    toast('Account verified');
    router.replace('/(tabs)');
  }, [router]);

  // Already confirmed out-of-band (link tapped before this screen opened)?
  const settleIfVerified = useCallback(async (): Promise<boolean> => {
    const verified = await checkAccountVerified();
    if (verified) finish();
    return verified;
  }, [checkAccountVerified, finish]);

  // Poll while waiting for the confirmation tap.
  useEffect(() => {
    if (phase !== 'sent') return;
    let cancelled = false;
    const tick = async () => {
      const verified = await checkAccountVerified();
      if (verified && !cancelled) finish();
    };
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phase, checkAccountVerified, finish]);

  if (!needsVerification) {
    return <Redirect href="/(tabs)" />;
  }

  const sendEmail = useCallback(async () => {
    setBusy(true);
    setInlineError(null);
    try {
      await beginAccountVerification();
      setPhase('sent');
      void notifySuccess();
    } catch (e) {
      void notifyError();
      setInlineError(
        e instanceof Error ? e.message : 'Could not send the email.',
      );
    } finally {
      setBusy(false);
    }
  }, [beginAccountVerification]);

  const onContinue = useCallback(async () => {
    setBusy(true);
    setInlineError(null);
    try {
      const verified = await settleIfVerified();
      if (!verified) {
        void notifyWarning();
        setInlineError('Not confirmed yet — tap the link in the email first.');
      }
    } finally {
      setBusy(false);
    }
  }, [settleIfVerified]);

  const onResend = useCallback(async () => {
    setInlineError(null);
    try {
      // A resend can be a silent no-op when confirmation already landed
      // outside the app — settle instead of claiming an email was sent.
      if (await settleIfVerified()) return;
      await beginAccountVerification();
      void notifySuccess();
      toast('Confirmation link sent');
    } catch (e) {
      void notifyError();
      setInlineError(
        e instanceof Error ? e.message : 'Could not resend the email.',
      );
    }
  }, [settleIfVerified, beginAccountVerification]);

  return (
    <Surface background="surface" style={styles.root}>
      <View style={styles.content}>
        <BrandLockup />

        {phase === 'intro' ? (
          <>
            <View style={styles.copy}>
              <Text variant="title" align="center">
                Verify your email
              </Text>
              <Text variant="body" color="textSecondary" align="center">
                Finish securing your account. We&apos;ll send a confirmation
                link to {pendingEmail}.
              </Text>
            </View>
            <View style={styles.actions}>
              <Button
                variant="primary"
                size="lg"
                disabled={busy}
                onPress={sendEmail}
              >
                {busy ? 'Sending…' : 'Send verification email'}
              </Button>
              {inlineError ? (
                <Text variant="caption" color="negative" align="center">
                  {inlineError}
                </Text>
              ) : null}
              <Text variant="caption" color="textTertiary" align="center">
                Your subscriptions are safe meanwhile.
              </Text>
            </View>
          </>
        ) : null}

        {phase === 'sent' ? (
          <>
            <View style={styles.copy}>
              <Text variant="title" align="center">
                Check your inbox
              </Text>
              <Text variant="body" color="textSecondary" align="center">
                We sent a confirmation link to {pendingEmail}. Tap it, then come
                back here.
              </Text>
            </View>
            <View style={styles.actions}>
              <Button
                variant="primary"
                size="lg"
                disabled={busy}
                onPress={onContinue}
              >
                {"I've verified — continue"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                disabled={busy}
                onPress={onResend}
              >
                Resend email
              </Button>
              {inlineError ? (
                <Text variant="caption" color="negative" align="center">
                  {inlineError}
                </Text>
              ) : null}
              <Text variant="caption" color="textTertiary" align="center">
                Checking automatically — no need to wait here.
              </Text>
            </View>
          </>
        ) : null}
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
