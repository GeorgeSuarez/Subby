/**
 * RenewalsList — upcoming renewals as a timeline for the dashboard.
 *
 * Shows the top N renewals (within the next 30 days) on a vertical hairline,
 * sorted by soonest. The leading dot encodes urgency: critical (today) is
 * negative, the soonest upcoming renewal glows accent, calm renewals sit
 * quiet. Long-press opens the native quick-actions sheet.
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

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
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
import { impactMedium } from '@/utils/haptics';
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
  const { colors, shadow } = useTheme();
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
      if (useSubscriptionsStore.getState().queuedChange) {
        toast("Saved — will sync when you're online");
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
      void impactMedium();
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
          <View style={styles.timeline}>
            <View style={[styles.rail, { backgroundColor: colors.border }]} />
            {upcoming.map((s, i) => {
              const nextISO = nextRenewalAfter(s);
              const days = daysUntilRenewal(s);
              const tone = renewalUrgencyTone(days);
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
                  <View
                    style={[
                      styles.dot,
                      dotStyle(tone, i === 0, colors, shadow),
                    ]}
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

/** Named owner contract for the timeline dot's dynamic style. */
type DotStyle = {
  backgroundColor: string;
  boxShadow?: string;
  borderWidth?: number;
  borderColor?: string;
};

/** Timeline dot colors — critical reads negative, the soonest glows accent. */
function dotStyle(
  tone: RenewalUrgency,
  isSoonest: boolean,
  colors: ReturnType<typeof useTheme>['colors'],
  shadow: ReturnType<typeof useTheme>['shadow'],
): DotStyle {
  if (tone === 'critical') {
    return { backgroundColor: colors.negative };
  }
  if (isSoonest) {
    return { backgroundColor: colors.accent, boxShadow: shadow('glowAccent') };
  }
  if (tone === 'soon') {
    return { backgroundColor: colors.accentMuted };
  }
  return {
    backgroundColor: colors.surfaceHigher,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

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
  timeline: {
    position: 'relative',
  },
  rail: {
    position: 'absolute',
    left: 5,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 2,
    borderRadius: radius.pill,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderCurve: 'continuous',
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
