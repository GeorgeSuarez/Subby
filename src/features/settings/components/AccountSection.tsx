/**
 * AccountSection — mock account summary and sign-out.
 *
 * Skill rules:
 *  - `react-state-minimize`: the session facts are read straight
 *    from the auth store; nothing local.
 *  - `react-state-dispatcher`: signing out goes through the store's `signOut`;
 *    the root layout's `Stack.Protected` gate flips and the auth screen
 *    reappears automatically.
 *  - `ui-pressable`: design-system Button (Pressable-based).
 */

import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import {
  accountLabelFor,
  needsDeferredVerification,
} from '@/features/auth/auth-helpers';
import { useAuthStore } from '@/store/useAuthStore';
import { notifyError, notifySuccess } from '@/utils/haptics';

export function AccountSection() {
  const { colors } = useTheme();
  const router = useRouter();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const pendingVerificationEmail = useAuthStore(
    (s) => s.pendingVerificationEmail,
  );
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [deleting, setDeleting] = useState(false);

  const verificationState = {
    isSignedIn,
    isAnonymous,
    pendingVerificationEmail,
  };
  const unverified = needsDeferredVerification(verificationState);

  const proceedSignOut = useCallback(() => {
    signOut();
    void notifySuccess();
  }, [signOut]);

  const onSignOut = useCallback(() => {
    // Deferred-verification guard: GoTrue blocks password sign-in for
    // unconfirmed emails, so signing out of a bridge account means the user
    // cannot get back in until they confirm. Make that cost explicit.
    if (
      needsDeferredVerification({
        isSignedIn,
        isAnonymous,
        pendingVerificationEmail,
      })
    ) {
      Alert.alert(
        'Verify your email first?',
        `Until ${pendingVerificationEmail} is confirmed, you won't be able to sign back in.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out anyway',
            style: 'destructive',
            onPress: proceedSignOut,
          },
          { text: 'Verify now', onPress: () => router.push('/verify-account') },
        ],
      );
      return;
    }
    proceedSignOut();
  }, [
    isAnonymous,
    isSignedIn,
    pendingVerificationEmail,
    proceedSignOut,
    router,
  ]);

  const onDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account, subscriptions, and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void deleteAccount()
              .then(() => notifySuccess())
              .catch((e) => {
                void notifyError();
                Alert.alert(
                  'Could not delete account',
                  e instanceof Error ? e.message : 'Please try again.',
                );
              })
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  }, [deleteAccount]);

  return (
    <View>
      {unverified ? (
        <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
          <View style={styles.meta}>
            <Text variant="body" weight="600" color="warning">
              Email not verified
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              Confirm {pendingVerificationEmail} to secure this account
            </Text>
          </View>
          <Button
            onPress={() => router.push('/verify-account')}
            variant="primary"
            size="sm"
          >
            Verify
          </Button>
        </View>
      ) : null}

      <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">
            Signed in as
          </Text>
          <Text variant="caption" color="textSecondary">
            {accountLabelFor(verificationState)}
          </Text>
        </View>
        <Button onPress={onSignOut} variant="ghost" size="sm">
          {' '}
          Sign out
        </Button>
      </View>

      <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">
            Reset password
          </Text>
        </View>
        <Button
          onPress={() => router.push('/verify-password')}
          variant="ghost"
          size="sm"
        >
          Change
        </Button>
      </View>

      <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="negative">
            Delete account
          </Text>
        </View>
        <Button
          onPress={onDeleteAccount}
          variant="ghost"
          size="sm"
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
