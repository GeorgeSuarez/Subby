/**
 * UnverifiedEmailBanner — persistent nudge while the account is still an
 * anonymous bridge awaiting email confirmation.
 *
 * Sits at the top of the dashboard so the pending state is impossible to
 * miss without blocking anything. Tapping through opens the verify-account
 * screen where the confirmation email can be sent.
 *
 * Skill rules:
 *  - `react-state-minimize`: visibility derives from the auth store via the
 *    pure `needsDeferredVerification` predicate; no local state.
 *  - `animation-gpu-properties`: entrance animates opacity/translate only.
 */

import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Pressable } from 'react-native';
import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { needsDeferredVerification } from '@/features/auth/auth-helpers';
import { useAuthStore } from '@/store/useAuthStore';

export function UnverifiedEmailBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const pendingVerificationEmail = useAuthStore(
    (s) => s.pendingVerificationEmail,
  );

  if (
    !needsDeferredVerification({
      isSignedIn,
      isAnonymous,
      pendingVerificationEmail,
    })
  ) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(160)}>
      {' '}
      // quieter for Quiet Ledger
      <Pressable
        onPress={() => router.push('/verify-account')}
        style={({ pressed }) => [
          styles.banner,
          { backgroundColor: colors.warningSoft, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Verify your email ${pendingVerificationEmail ?? ''}`}
      >
        <Ionicons name="mail-outline" size={18} color={colors.textPrimary} />
        <View style={styles.copy}>
          <Text variant="caption" weight="600">
            Verify your email
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            Confirm {pendingVerificationEmail} to secure your account.
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 1,
  },
});
