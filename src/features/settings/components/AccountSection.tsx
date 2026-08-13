/**
 * AccountSection — mock account summary and sign-out.
 *
 * Skill rules:
 *  - `react-state-minimize`: the email and session facts are read straight
 *    from the auth store; nothing local.
 *  - `react-state-dispatcher`: signing out goes through the store's `signOut`;
 *    the root layout's `Stack.Protected` gate flips and the auth screen
 *    reappears automatically.
 *  - `ui-pressable`: design-system Button (Pressable-based).
 */

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useAuthStore } from '@/store/useAuthStore';
import { notifySuccess } from '@/utils/haptics';

export function AccountSection() {
  const { colors } = useTheme();
  const router = useRouter();
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);

  const onSignOut = useCallback(() => {
    signOut();
    void notifySuccess();
  }, [signOut]);

  return (
    <Card padding={spacing.lg} elevation="flat">
      <Card.Header>
        <Text variant="headline" weight="600">Account</Text>
        <Text variant="caption" color="textSecondary">
          Signed in with {email ?? 'your account'}.
        </Text>
      </Card.Header>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">Signed in as</Text>
          <Text variant="caption" color="textSecondary">{email ?? 'Unknown user'}</Text>
        </View>
        <Button onPress={onSignOut} variant="ghost" size="sm">Sign out</Button>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.meta}>
          <Text variant="body" weight="600" color="textPrimary">Reset password</Text>
          <Text variant="caption" color="textSecondary">Verify your current password and set a new one</Text>
        </View>
        <Button onPress={() => router.push('/verify-password')} variant="ghost" size="sm">
          Change
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: spacing.xs / 2,
  },
});
