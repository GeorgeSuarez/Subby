/**
 * ProPlans — Pro details + plan options + purchase.
 *
 * Shared body: the paywall modal and the Settings Subby Pro screen render
 * the same UX, so neither drifts. Covers Guideline 3.1.2: price + period +
 * renewal + trial, Privacy/Terms links, Restore. Yearly is hero
 * (pre-selected, Save 44% + 7-day free trial badge), plus Monthly and
 * Lifetime.
 */

import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { usePaywall } from '@/features/paywall/usePaywall';
import { PlanToggle } from '@/features/paywall/components/PlanToggle';
import { FeatureBullet } from '@/features/paywall/components/FeatureBullet';
import { notifySuccess } from '@/utils/haptics';

const PRIVACY_URL = 'https://subby.app/privacy';
const TERMS_URL = 'https://subby.app/terms';

export function ProPlans() {
  const { colors } = useTheme();
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

  const onPurchase = async () => {
    await purchase();
    if (useEntitlementStore.getState().isPro) {
      void notifySuccess();
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.accentSoft }]}>
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
        <Text variant="caption" color="textTertiary" style={styles.centerText}>
          Subscriptions auto-renew via the App Store / Play Store. Cancel
          anytime in store settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
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
  centerText: {
    textAlign: 'center',
  },
});
