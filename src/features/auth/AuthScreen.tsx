/**
 * AuthScreen — shared sign-in / sign-up shell.
 *
 * Renders the brand lockup, a two-field form (email + password), the primary
 * CTA, and a mode-switch link. All copy and validation rules come from
 * `auth-helpers`; the screen only owns the form's interaction state.
 *
 * Skill rules:
 *  - `react-state-minimize`: a single `draft` object, not N fields; validation
 *    errors are DERIVED each render, never cached.
 *  - `react-state-dispatcher`: field updaters use the dispatch form
 *    `setDraft((prev) => …)`, never read state directly in a closure.
 *  - `react-state-fallback`: the draft initializes lazily via `useState(() => …)`.
 *  - `rendering-no-falsy-and`: ternaries only — no `value && <X />`.
 *  - `ui-pressable`: mode-switch link is a Pressable, never Touchable*.
 *  - `ui-safe-area-scroll`: ScrollView honors safe areas via
 *    `contentInsetAdjustmentBehavior`.
 *  - All strings live inside <Text> — never as direct View children.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useTheme } from '@/design/theme';
import { layout, spacing } from '@/design/tokens';
import { isSupabaseConfigured } from '@/lib/supabase';
import { TextField } from '@/features/add-subscription/components/TextField';
import { BrandLockup } from '@/features/auth/components/BrandLockup';
import { PasswordField } from '@/features/auth/components/PasswordField';
import {
  copyByMode,
  defaultDraft,
  validateDraft,
  type AuthDraft,
  type AuthFieldKey,
  type AuthMode,
} from '@/features/auth/auth-helpers';
import { useAuthStore } from '@/store/useAuthStore';
import { authRedirectUrl } from '@/features/auth/auth-redirect';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { loadSeedData } from '@/db/seed';
import { isTestAccountEmail } from '@/utils/constants';
import { ENABLE_DEMO_DATA } from '@/utils/environment';
import { notifyError, notifySuccess, notifyWarning } from '@/utils/haptics';

export interface AuthScreenProps {
  mode: AuthMode;
}

export function AuthScreen({ mode }: AuthScreenProps) {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const isLoadingSession = useAuthStore((s) => s.isLoading);

  const copy = copyByMode[mode];

  // Single draft object; lazy init per `react-state-fallback`.
  const [draft, setDraft] = useState<AuthDraft>(defaultDraft);
  const [touched, setTouched] = useState<ReadonlySet<AuthFieldKey>>(new Set());
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const { colors } = useTheme();

  // Errors are derived from the draft every render — never stored.
  const errors = useMemo(() => validateDraft(draft, mode), [draft, mode]);
  const hasErrors = Object.keys(errors).length > 0;
  const canSubmit = !submitting && !hasErrors;

  const showError = (key: AuthFieldKey): string | undefined => {
    if (attemptedSubmit || touched.has(key)) {
      return errors[key];
    }
    return undefined;
  };

  const update = useCallback((key: AuthFieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }, []);

  const markTouched = useCallback((key: AuthFieldKey) => {
    setTouched((prev) => new Set(prev).add(key));
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    setAttemptedSubmit(true);
    if (hasErrors) {
      void notifyWarning();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const email = draft.email.trim();
      if (mode === 'signIn') {
        await signIn(email, draft.password);
      } else {
        await signUp(email, draft.password, authRedirectUrl());
        // Confirmation enabled AND the anonymous bridge unavailable — fall
        // back to the blocking verify screen (no session means no app).
        if (!useAuthStore.getState().isSignedIn) {
          router.replace('/auth/verify-email');
          return;
        }
      }
      // Rule: demo (seeded) data loads automatically, but only for the test
      // account, and only in development builds. `loadSeedData` re-checks the
      // email and no-ops otherwise. Runs whenever a session exists — a
      // deferred sign-up seeds under its bridge uid, and the rows survive
      // conversion since the uid never changes.
      if (ENABLE_DEMO_DATA && isTestAccountEmail(email)) {
        await loadSeedData(email);
        await useSubscriptionsStore.getState().hydrate();
      }
      // Deferred sign-up: the conversion email just auto-sent — show the
      // "check your inbox" interstitial before Getting Started. (With
      // confirmations off there is nothing pending; skip straight in.)
      if (
        mode === 'signUp' &&
        useAuthStore.getState().pendingVerificationEmail !== null
      ) {
        void notifySuccess();
        router.replace('/welcome');
        return;
      }
      void notifySuccess();
      router.replace('/');
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
      void notifyError();
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    hasErrors,
    mode,
    draft.email,
    draft.password,
    signIn,
    signUp,
    router,
  ]);

  const switchMode = useCallback(() => {
    router.push(mode === 'signIn' ? '/auth/sign-up' : '/auth/sign-in');
  }, [mode, router]);

  // The initial session restore happens behind the splash screen; guard the
  // brief window before it settles so the form never flashes.
  if (isLoadingSession) {
    return (
      <Surface background="surface" style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
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
            <Text variant="title" align="center">
              {copy.headline}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {copy.subline}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text variant="caption" color="textSecondary" weight="600">
                Email
              </Text>
              <TextField
                value={draft.email}
                onChangeText={(value) => update('email', value)}
                onBlur={() => markTouched('email')}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {showError('email') ? (
                <Text variant="caption" color="negative">
                  {showError('email')}
                </Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text variant="caption" color="textSecondary" weight="600">
                Password
              </Text>
              <PasswordField
                ref={passwordRef}
                value={draft.password}
                onChangeText={(value) => update('password', value)}
                onBlur={() => markTouched('password')}
                placeholder={
                  mode === 'signUp' ? 'At least 8 characters' : 'Your password'
                }
                textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                autoComplete={
                  mode === 'signUp' ? 'new-password' : 'current-password'
                }
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              {showError('password') ? (
                <Text variant="caption" color="negative">
                  {showError('password')}
                </Text>
              ) : null}
            </View>

            <Button
              testID="auth-submit"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              onPress={onSubmit}
            >
              {copy.cta}
            </Button>

            {submitError ? (
              <Text variant="caption" color="negative" align="center">
                {submitError}
              </Text>
            ) : null}

            {!isSupabaseConfigured ? (
              <Text variant="caption" color="textTertiary" align="center">
                Supabase is not configured — add EXPO_PUBLIC_SUPABASE_URL and
                EXPO_PUBLIC_SUPABASE_ANON_KEY to .env
              </Text>
            ) : null}
          </View>

          {mode === 'signIn' ? (
            <Pressable
              onPress={() => router.push('/auth/forgot-password')}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              style={styles.switchLink}
            >
              <Text variant="body" color="accent" weight="600">
                Forgot password?
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={switchMode}
            accessibilityRole="link"
            accessibilityLabel={`${copy.switchPrompt} ${copy.switchAction}`}
            style={styles.switchLink}
          >
            <Text variant="body" color="textSecondary">
              {copy.switchPrompt}{' '}
            </Text>
            <Text variant="body" color="accent" weight="600">
              {copy.switchAction}
            </Text>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.xs,
  },
  form: {
    gap: spacing.md, // tighter for Quiet Ledger
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
