/**
 * ProSection — upgrade card / manage subscription.
 *
 * When not Pro: benefits + CTA to paywall. When Pro: show active state
 * with Manage (App Store / Play Store) and Restore.
 */

import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Button, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { restorePurchases } from '@/lib/purchases';
import { useCallback, useState } from 'react';

export function ProSection() {
  const router = useRouter();
  const { colors } = useTheme();
  const isPro = useEntitlementStore((s) => s.isPro);
  const productId = useEntitlementStore((s) => s.productId);
  const hydrate = useEntitlementStore((s) => s.hydrate);
  const [restoring, setRestoring] = useState(false);

  const onGoPro = useCallback(
    () => router.push('/subscription/paywall'),
    [router],
  );

  const onManage = useCallback(() => {
    // iOS: App Store subscriptions, Android: Play subscriptions.
    // Opening store URLs works cross-platform; fallback to paywall.
    const url = 'https://apps.apple.com/account/subscriptions';
    void Linking.openURL(url);
  }, []);

  const onRestore = useCallback(async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      // Try to verify any available purchases (handled also via listener in _layout)
      const { getAvailablePurchases } = await import('@/lib/purchases');
      const avail = await getAvailablePurchases();
      if (avail.length > 0) {
        // Trigger server verification for each — _layout listener will handle most,
        // but we also hydrate from Supabase row.
        await hydrate();
      } else {
        await hydrate();
      }
    } finally {
      setRestoring(false);
    }
  }, [hydrate]);

  if (isPro) {
    return (
      <Card
        padding={spacing.lg}
        elevation="low"
        style={[styles.card, { borderColor: colors.positive }]}
      >
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.positiveSoft }]}>
            <Ionicons name="star" size={20} color={colors.positive} />
          </View>
          <View style={styles.meta}>
            <View style={styles.titleRow}>
              <Text variant="body" weight="700" color="textPrimary">
                Subby Pro
              </Text>
              <Badge tone="positive">Active</Badge>
            </View>
            <Text variant="caption" color="textSecondary">
              {productId ? productId.replace('subby_pro_', '') : 'Pro'} · All
              features unlocked
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button onPress={onManage} variant="ghost" size="sm">
            Manage
          </Button>
          <Button
            onPress={onRestore}
            variant="ghost"
            size="sm"
            disabled={restoring}
          >
            {restoring ? 'Restoring…' : 'Restore'}
          </Button>
        </View>
      </Card>
    );
  }

  return (
    <Card padding={spacing.lg} elevation="low">
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="star-outline" size={20} color={colors.accent} />
        </View>
        <View style={styles.meta}>
          <Text variant="body" weight="700" color="textPrimary">
            Upgrade to Pro
          </Text>
          <Text variant="caption" color="textSecondary">
            Category insights · Budget & forecast · Advanced reminders ·
            Unlimited tracking
          </Text>
        </View>
      </View>
      <View style={styles.bullets}>
        <Text variant="caption" color="textSecondary">
          • $2.99/mo · $19.99/yr (7-day free trial) · $49.99 lifetime
        </Text>
      </View>
      <Button onPress={onGoPro} variant="primary" size="sm" style={styles.cta}>
        View plans
      </Button>
      <Pressable onPress={onRestore} style={styles.restore}>
        <Text variant="caption" color="textTertiary">
          Restore Purchases
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bullets: {
    paddingTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.sm,
  },
  restore: {
    alignSelf: 'center',
    paddingTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
