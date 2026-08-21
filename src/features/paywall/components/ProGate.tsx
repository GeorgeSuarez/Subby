import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useIsPro } from '@/store/useEntitlementStore';

interface ProGateProps {
  feature: string;
  children: React.ReactNode;
  /** Compact pill instead of full card */
  compact?: boolean;
}

export function ProGate({
  feature: _feature,
  children,
  compact = false,
}: ProGateProps) {
  const isPro = useIsPro();
  const router = useRouter();
  const { colors } = useTheme();

  if (isPro) return <>{children}</>;

  const onUnlock = () => router.push('/subscription/paywall');

  if (compact) {
    return (
      <Pressable
        onPress={onUnlock}
        accessibilityRole="button"
        accessibilityLabel="Unlock with Pro"
        style={[
          styles.pill,
          { borderColor: colors.accent, backgroundColor: colors.accentSoft },
        ]}
      >
        <Text variant="caption" weight="700" color="accent">
          Unlock with Pro
        </Text>
      </Pressable>
    );
  }

  return (
    <Card padding={spacing.lg} elevation="low">
      <View style={styles.content}>
        <View
          style={[
            styles.blur,
            { backgroundColor: colors.surfaceElevated, opacity: 0.45 },
          ]}
        >
          {children}
        </View>
        <View style={styles.overlay}>
          <Text variant="body" weight="700" color="textPrimary">
            Pro feature
          </Text>
          <Text
            variant="caption"
            color="textSecondary"
            style={styles.centerText}
          >
            Unlock Category insights, Budget, Forecast and more.
          </Text>
          <Button onPress={onUnlock} variant="primary" size="sm">
            Unlock with Pro
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  content: {
    gap: spacing.sm,
  },
  blur: {
    // keep children mounted but visually deemphasized under overlay
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  centerText: {
    textAlign: 'center',
  },
});
