/**
 * RenewalsList — upcoming renewals for the dashboard.
 *
 * Shows the top N renewals (within the next 30 days), sorted by soonest.
 * Each row leads with the subscription's brand icon tile; urgency reads in
 * the trailing countdown text only. Long-press opens the native quick-actions sheet.
 *
 * Skill rule `react-state-minimize`: the upcoming list is derived during
 * render from the active-subscriptions selector via `renewalsWithin`.
 *
 * Per-row interactions route to the detail modal (`/subscription/[id]`);
 * long-press opens a native `Alert.alert` action sheet (skill `ui-menus`).
 * Skill `list-performance-callbacks`: single stable `onRowPress`/
 * `onRowLongPress` instances created at the component root.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { brandBackground, brandIconColor } from '@/utils/brand';
import {
  useActiveSubscriptions,
  useSubscriptionsStore,
} from '@/store/useSubscriptionsStore';
import { toast } from '@/store/useToastStore';
import {
  daysUntilRenewal,
  nextRenewalAfter,
  renewalsWithin,
  renewalUrgencyTone,
  type RenewalUrgency,
} from '@/utils/billing';
import {
  formatCurrency,
  formatMonthDay,
  formatRenewalIn,
} from '@/utils/format';
import { impactLight } from '@/utils/haptics';
import {
  confirmDelete,
  openRowActions,
} from '@/features/subscriptions/row-actions';

/** Maximum rows shown on the Dashboard before "View all" takes the user to the list tab. */
const MAX_ROWS = 5;
/** Renewal window (days). */
const RENEWAL_WINDOW_DAYS = 30;

export function RenewalsList() {
  const subs = useActiveSubscriptions();
  const router = useRouter();
  const { colors } = useTheme();
  const archive = useSubscriptionsStore((s) => s.archive);
  const remove = useSubscriptionsStore((s) => s.remove);

  // Derive upcoming renewals during render (skill `react-state-minimize`).
  const upcoming = renewalsWithin(subs, RENEWAL_WINDOW_DAYS).slice(0, MAX_ROWS);

  // Single stable callback instances — each row just calls them with its id.
  // Skill `list-performance-callbacks`: never create a new function per row.
  const onRowPress = useCallback(
    (id: string) => {
      router.push(`/subscription/${id}`);
    },
    [router],
  );

  // Archive/delete with the offline-queue toast, mirroring the detail screen.
  const runArchive = useCallback(
    async (id: string, archived: boolean) => {
      await archive(id, archived);
      const state = useSubscriptionsStore.getState();
      if (state.queuedChange) {
        toast("Saved — will sync when you're online");
      } else if (!state.error) {
        toast(archived ? 'Subscription archived' : 'Subscription unarchived');
      }
    },
    [archive],
  );

  const runDelete = useCallback(
    async (id: string) => {
      await remove(id);
      if (useSubscriptionsStore.getState().queuedChange) {
        toast("Saved — will sync when you're online");
      }
    },
    [remove],
  );

  const onRowLongPress = useCallback(
    (id: string) => {
      const target = subs.find((s) => s.id === id);
      if (!target) return;
      void impactLight(); // quieter for Quiet Ledger
      openRowActions({
        name: target.name,
        archived: target.archived,
        onEdit: () => router.push(`/subscription/${id}`),
        onArchive: () => void runArchive(id, !target.archived),
        onDelete: () => confirmDelete(target.name, () => void runDelete(id)),
      });
    },
    [subs, router, runArchive, runDelete],
  );

  return (
    <Card padding={spacing.md} elevation="low">
      <Card.Header>
        <Text variant="caption" color="textSecondary" weight="600">
          Upcoming renewals · next {RENEWAL_WINDOW_DAYS} days
        </Text>
      </Card.Header>

      <Card.Body>
        {upcoming.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="caption" color="textSecondary">
              No renewals in the next {RENEWAL_WINDOW_DAYS} days
            </Text>
          </View>
        ) : (
          <View>
            {upcoming.map((s) => {
              const nextISO = nextRenewalAfter(s);
              const days = daysUntilRenewal(s);
              const tone = renewalUrgencyTone(days);
              const bg = brandBackground(s.name, s.category);
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => onRowPress(s.id)}
                  onLongPress={() => onRowLongPress(s.id)}
                  delayLongPress={400}
                  style={({ pressed }) => [
                    styles.row,
                    pressed ? { opacity: 0.6 } : null,
                  ]}
                >
                  <Avatar
                    icon={s.icon}
                    backgroundColor={bg}
                    iconColor={brandIconColor(bg)}
                    size="sm"
                  />
                  <View style={styles.rowBody}>
                    <Text
                      variant="body"
                      weight={tone === 'critical' ? '700' : '600'}
                      color="textPrimary"
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    <Text
                      variant="caption"
                      color="textSecondary"
                      numberOfLines={1}
                    >
                      {formatMonthDay(nextISO)}
                    </Text>
                  </View>
                  <View style={styles.rowTrailing}>
                    <Text
                      variant="body"
                      weight="600"
                      color="textPrimary"
                      numberOfLines={1}
                    >
                      {formatCurrency(s.amount, s.currency)}
                    </Text>
                    <Text
                      variant="caption"
                      color={toneTextColor(tone)}
                      numberOfLines={1}
                      align="right"
                    >
                      {formatRenewalIn(days)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card.Body>

      <FooterLink
        label={`View all ${subs.length}`}
        onPress={() => router.push('/subscriptions')}
        borderColor={colors.hairline}
      />
    </Card>
  );
}

// --- Sub-components ---------------------------------------------------------

/** Map an urgency band to a text color token (pure; color is presentation). */
function toneTextColor(
  tone: RenewalUrgency,
): 'negative' | 'accent' | 'textSecondary' {
  switch (tone) {
    case 'critical':
      return 'negative';
    case 'soon':
      return 'accent';
    case 'calm':
      return 'textSecondary';
  }
}

function FooterLink({
  label,
  onPress,
  borderColor,
}: {
  label: string;
  onPress: PressableProps['onPress'];
  borderColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.footer,
        { borderTopColor: borderColor },
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      <Text variant="caption" weight="600" color="accent">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md, // tighter for Quiet Ledger (16→12)
    paddingVertical: spacing.xs + 2, // 4→6 tighter
    minHeight: 56,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
  },
  footer: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
});
