/**
 * PaywallScreen — Pro upgrade modal.
 *
 * Modal chrome (close button, Pro confirmation) + the shared `ProPlans`
 * body, also rendered by the Settings Subby Pro screen.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { ProPlans } from '@/features/paywall/components/ProPlans';

export function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isPro = useEntitlementStore((s) => s.isPro);

  const onClose = () => {
    if (router.canGoBack()) router.back();
    // No '/' route exists — land on the tabs, never a dead end.
    else router.replace('/(tabs)');
  };

  if (isPro) {
    return (
      <Surface background="surface" style={styles.root}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={56} color={colors.positive} />
          <Text variant="title" weight="700" color="textPrimary">
            You&apos;re Pro
          </Text>
          <Text variant="body" color="textSecondary" style={styles.centerText}>
            All features unlocked. Manage your subscription in the App Store /
            Play Store settings.
          </Text>
          <Button onPress={onClose} variant="primary">
            Done
          </Button>
        </View>
      </Surface>
    );
  }

  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          // Keep the close button clear of the status bar (no header here).
          { paddingTop: insets.top + spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onClose}
          style={styles.close}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        <ProPlans />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md, // tighter for Quiet Ledger
    paddingBottom: spacing['3xl'],
  },
  close: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  centerText: {
    textAlign: 'center',
  },
});
