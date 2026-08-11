/**
 * Subscription detail screen.
 *
 * Presented as a native modal via the parent `subscription/` group's
 * `presentation: 'formSheet'` (iOS) / native dialog (Android).
 *
 * Skill rules:
 *  - `react-state-minimize`: expiry dates, monthly/yearly equivalents, and
 *    renewal tones are derived DURING render from the subscription prop. We
 *    do not store any of them in state.
 *  - `ui-pressable`: ActionBar uses Button (Pressable-based).
 *  - `ui-menus` / `ui-native-modals`: destructive confirmations via
 *    `Alert.alert` (platform-native dialog).
 *  - `rendering-no-falsy-and`: ternaries everywhere; early return for not-found.
 */

import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyState, IconButton, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import { DetailHero } from '@/features/subscription-detail/components/DetailHero';
import { RenewalCountdown } from '@/features/subscription-detail/components/RenewalCountdown';
import { EffectiveCostCard } from '@/features/subscription-detail/components/EffectiveCostCard';
import { DetailActionBar, confirmDelete } from '@/features/subscription-detail/components/DetailActionBar';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import type { Subscription } from '@/types/subscription';

export interface DetailScreenProps {
  /** Subscription to render. Pass null/undefined to render the not-found state. */
  sub: Subscription | null | undefined;
  /** ID used for the not-found fallback's identifier display. */
  id: string;
  /** Edit handler — navigates to `/subscription/add?id=<this id>`. */
  onEdit: () => void;
  /** Dismiss the modal after an action invalidates the row. */
  onDismiss: () => void;
}

export function DetailScreen({ sub, id, onEdit, onDismiss }: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  // Mutators from the store are stable references (Zustand).
  const archive = useSubscriptionsStore((s) => s.archive);
  const remove = useSubscriptionsStore((s) => s.remove);

  const onArchive = useCallback(async () => {
    if (!sub) return;
    await archive(sub.id, !sub.archived);
    onDismiss();
  }, [sub, archive, onDismiss]);

  const onDelete = useCallback(async () => {
    if (!sub) return;
    await remove(sub.id);
    onDismiss();
  }, [sub, remove, onDismiss]);

  const onEditHandler = useCallback(() => {
    onEdit();
  }, [onEdit]);

  // Not-found — early return (skill `rendering-no-falsy-and`).
  if (!sub) {
    return (
      <Surface background="surface" style={styles.root}>
        <BackButton top={insets.top} onPress={onDismiss} />
        <View style={styles.notFound}>
          <EmptyState
            title="Subscription not found"
            body={`This subscription may have been deleted. id: ${id}`}
            actionLabel="Close"
            onAction={onDismiss}
          />
        </View>
      </Surface>
    );
  }

  return (
    <Surface background="surface" style={styles.root}>
      <BackButton top={insets.top} onPress={onDismiss} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DetailHero sub={sub} />
        <RenewalCountdown sub={sub} />
        <EffectiveCostCard sub={sub} notes={sub.notes} />

        <Card padding={spacing.lg} elevation="flat">
          <Text variant="caption" color="textTertiary">
            {
              `Added ${formatTimestamp(sub.createdAt)} · ` +
              `Updated ${formatTimestamp(sub.updatedAt)}`
            }
          </Text>
        </Card>

        <DetailActionBar
          sub={sub}
          onEdit={onEditHandler}
          onArchive={onArchive}
          onDelete={() => confirmDelete(sub.name, onDelete)}
        />
      </ScrollView>
    </Surface>
  );
}

function formatTimestamp(ms: number): string {
  // Locale-aware short date — Intl under the hood via Date.
  return new Date(ms).toLocaleDateString();
}

/**
 * Floating back arrow overlaid top-left, safe-area aware. The detail screen is
 * a formSheet whose native header is just a grabber, so it needs an explicit
 * in-page affordance to return to the previous screen.
 */
function BackButton({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <View style={[styles.backButton, { top: top + spacing.xs }]}>
      <IconButton
        name="chevron-back"
        size={24}
        color="textPrimary"
        variant="solid"
        backgroundColor="surfaceHigher"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  notFound: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});