/**
 * PaywallScreen — Pro upgrade modal.
 *
 * Guideline 3.1.2 compliant: shows price + period + renewal + trial,
 * Privacy/Terms links, Restore. Yearly is hero (pre-selected, Save 44%
 * + 7-day free trial badge), plus Monthly and Lifetime.
 */

import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { usePaywall } from '@/features/paywall/usePaywall';
import { PlanToggle } from '@/features/paywall/components/PlanToggle';
import { FeatureBullet } from '@/features/paywall/components/FeatureBullet';
import { notifySuccess } from '@/utils/haptics';

const PRIVACY_URL = 'https://subby.app/privacy';
const TERMS_URL = 'https://subby.app/terms';

export function PaywallScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isPro = useEntitlementStore((s) => s.isPro);
  const {
    products,
    selected,
    setSelected,
    selectedProduct,
    status,
    error,
    purchase,
    restore,
  } = usePaywall();

  const isLoading =
    status === 'loading' || status === 'purchasing' || status === 'restoring';

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onPurchase = async () => {
    await purchase();
    if (useEntitlementStore.getState().isPro) {
      void notifySuccess();
    }
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
        contentContainerStyle={styles.content}
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

        <View style={styles.hero}>
          <View
            style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons name="star" size={32} color={colors.accent} />
          </View>
          <Text variant="title" weight="700" color="textPrimary">
            Unlock Subby Pro
          </Text>
          <Text variant="body" color="textSecondary" style={styles.heroSub}>
            Free plans track up to 5 subscriptions. Pro unlocks unlimited
            tracking and other power features.
          </Text>
        </View>

        <View style={styles.bullets}>
          <FeatureBullet
            icon="pie-chart-outline"
            title="Category insights"
            desc="Breakdown + pie chart of spend by category"
          />
          <FeatureBullet
            icon="wallet-outline"
            title="Budget & forecast"
            desc="Monthly budget progress & forecast"
          />
          <FeatureBullet
            icon="notifications-outline"
            title="Advanced reminders"
            desc="1 day / 3 days / 7 days before renewal"
          />
          <FeatureBullet
            icon="infinite-outline"
            title="Unlimited tracking"
            desc="Track more than 5 subscriptions"
          />
          <FeatureBullet
            icon="gift-outline"
            title="Trials nudges"
            desc="Push before trials convert"
          />
        </View>

        <Card padding={spacing.lg} elevation="low">
          <Text variant="headline" weight="600" color="textPrimary">
            Choose your plan
          </Text>
          {status === 'loading' ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <PlanToggle
              products={products}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {selectedProduct ? (
            <Text variant="caption" color="textTertiary" style={styles.legal}>
              {selected === 'subby_pro_yearly'
                ? `7-day free trial, then ${selectedProduct.price} per year. Auto-renews unless canceled 24h before period end.`
                : selected === 'subby_pro_monthly'
                  ? `${selectedProduct.price} per month. Auto-renews monthly.`
                  : `${selectedProduct.price} one-time. No expiry.`}
            </Text>
          ) : null}
        </Card>

        {error ? (
          <Card
            padding={spacing.md}
            elevation="flat"
            style={{ borderColor: colors.negative }}
          >
            <Text variant="body" color="negative">
              {error}
            </Text>
          </Card>
        ) : null}

        <Button
          onPress={onPurchase}
          variant="primary"
          size="lg"
          disabled={isLoading}
          style={styles.cta}
        >
          {status === 'purchasing' ? 'Processing…' : 'Continue'}
        </Button>

        <View style={styles.links}>
          <Pressable onPress={restore} disabled={isLoading}>
            <Text variant="body" weight="600" color="accent">
              Restore Purchases
            </Text>
          </Pressable>
          <View style={styles.linkRow}>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
              <Text variant="caption" color="textTertiary">
                Privacy Policy
              </Text>
            </Pressable>
            <Text variant="caption" color="textTertiary">
              {' · '}
            </Text>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)}>
              <Text variant="caption" color="textTertiary">
                Terms of Use
              </Text>
            </Pressable>
          </View>
          <Text
            variant="caption"
            color="textTertiary"
            style={styles.centerText}
          >
            Subscriptions auto-renew via the App Store / Play Store. Cancel
            anytime in store settings.
          </Text>
        </View>
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
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  close: {
    alignSelf: 'flex-end',
    padding: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSub: {
    textAlign: 'center',
  },
  bullets: {
    gap: spacing.md,
  },
  loader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  legal: {
    paddingTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.sm,
  },
  links: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
