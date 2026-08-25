/**
 * SignUpEmailSentScreen — post-sign-up interstitial for deferred
 * verification.
 *
 * Shown once right after a deferred sign-up bridges onto its anonymous
 * session: the conversion email has just been auto-sent, so this screen says
 * exactly that and hands the user on to Getting Started. Purely informative
 * — no polling, no blocking; verification itself lives in Settings /
 * `/verify-account` whenever the user is ready.
 *
 * Skill rules:
 *  - `rendering-no-falsy-and`: guard via early redirect, ternaries elsewhere.
 *  - `animation-gpu-properties`: entrance animates opacity/translate only.
 */

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/design/components/Button';
import { Surface } from '@/design/components/Surface';
import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { impactLight, notifySuccess } from '@/utils/haptics';
import { useAuthStore } from '@/store/useAuthStore';

export function SignUpEmailSentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const pendingVerificationEmail = useAuthStore(
    (s) => s.pendingVerificationEmail,
  );

  // Reachable only in the window where a deferred sign-up just happened.
  if (pendingVerificationEmail === null) {
    return <Redirect href="/(tabs)" />;
  }

  const onContinue = useCallback(() => {
    void impactLight();
    void notifySuccess();
    // The dashboard's own gates take it from here — a fresh account gets
    // routed into the Getting Started wizard automatically.
    router.replace('/(tabs)');
  }, [router]);

  return (
    <Surface background="surface" style={styles.root}>
      <Animated.View
        entering={FadeInDown.duration(280)}
        style={[styles.content, { paddingTop: insets.top + spacing['3xl'] }]}
      >
        <View
          style={[styles.iconRing, { borderColor: colors.accentSoftStrong }]}
        >
          <Ionicons name="mail-outline" size={40} color={colors.accent} />
        </View>
        <Text variant="title" weight="700" align="center">
          Check your inbox
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={styles.copy}
        >
          {`We sent a confirmation link to ${pendingVerificationEmail}. Tap it anytime to secure your account.`}
        </Text>
        <Text variant="caption" color="textTertiary" align="center">
          You can also resend it or verify later from Settings.
        </Text>
      </Animated.View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <Button variant="primary" size="lg" onPress={onContinue}>
          Get started
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  copy: {
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
});
