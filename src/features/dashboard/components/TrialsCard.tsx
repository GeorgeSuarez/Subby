/**
 * TrialsCard — free-trial tracker for the dashboard.
 *
 * Leads with the count of active trials, lists them soonest-ending first,
 * then surfaces any trials that have already ended (most recently first).
 * "View all" opens the full trials screen (`/trials`); rows open the
 * subscription's detail modal.
 *
 * Skill rules:
 *  - `react-state-minimize`: every value is derived during render from the
 *    active-subscriptions selector via `activeTrials`/`expiredTrials`.
 *  - `list-performance-callbacks`: single stable `onRowPress` instance passed
 *    to every row via `onPressWithId`; rows are the memoized `ListRow` with
 *    primitive props only.
 *  - `rendering-no-falsy-and`: ternaries everywhere.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Card, ListRow, Text } from '@/design/components';
import type { TextColor } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { activeTrials, expiredTrials, type RenewalTone } from '@/utils/billing';
import { formatMonthDay } from '@/utils/format';

/** Maximum rows shown per section before "View all" takes the user to /trials. */
const MAX_ROWS = 5;

export function TrialsCard() {
  const subs = useActiveSubscriptions();
  const router = useRouter();
  const { colors } = useTheme();

  // Derived during render (skill `react-state-minimize`) — nothing cached.
  const allActive = activeTrials(subs);
  const allEnded = expiredTrials(subs);
  const active = allActive.slice(0, MAX_ROWS);
  const ended = allEnded.slice(0, MAX_ROWS);
  const activeCount = allActive.length;
  const endedCount = allEnded.length;
  const hasAny = activeCount + endedCount > 0;

  // Single stable callback instance — each row just calls it with its id.
  const onRowPress = useCallback(
    (id: string) => {
      router.push(`/subscription/${id}`);
    },
    [router],
  );

  const onViewAll = useCallback(() => {
    router.push('/trials');
  }, [router]);

  return (
    <Card padding={spacing.md} elevation="low">
      <Card.Header>
        <Text variant="caption" color="textSecondary" weight="600">
          Free trials
        </Text>
      </Card.Header>

      <Card.Body>
        {hasAny ? (
          <View style={styles.countRow}>
            <Ionicons name="gift-outline" size={16} color={colors.accent} />
            <Text variant="headline" weight="700" color="textPrimary">
              {activeCount} active
            </Text>
            {endedCount > 0 ? (
              <Text variant="caption" color="negative" weight="600">
                · {endedCount} ended
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text variant="caption" color="textSecondary">
              No active trials
            </Text>
          </View>
        )}

        {active.map((t) => (
          <ListRow
            key={t.id}
            id={t.id}
            title={t.name}
            subtitle={`Free trial · ends ${formatMonthDay(t.endISO)}`}
            trailingSubtitle={t.label}
            trailingSubtitleColor={toneTextColor(t.tone)}
            icon={t.icon}
            avatarBackground="surfaceHigher"
            onPressWithId={onRowPress}
          />
        ))}

        {ended.length > 0 ? (
          <View style={styles.section}>
            <Text variant="caption" color="textTertiary" weight="600">
              Ended
            </Text>
            {ended.map((t) => (
              <ListRow
                key={t.id}
                id={t.id}
                title={t.name}
                subtitle={`Free trial · ended ${formatMonthDay(t.endISO)}`}
                trailingSubtitle={endedLabel(t.days)}
                trailingSubtitleColor="negative"
                icon={t.icon}
                avatarBackground="surfaceHigher"
                onPressWithId={onRowPress}
              />
            ))}
          </View>
        ) : null}
      </Card.Body>

      {hasAny ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewAll}
          style={({ pressed }) => [
            styles.footer,
            { borderTopColor: colors.hairline },
            pressed ? { opacity: 0.6 } : null,
          ]}
        >
          <Text variant="caption" weight="600" color="accent">
            View all {activeCount + endedCount}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

// --- Helpers ----------------------------------------------------------------

/** Map a trial tone to a text color token (mirrors the trials screen). */
function toneTextColor(tone: RenewalTone): TextColor {
  switch (tone) {
    case 'warning':
      return 'warning';
    case 'negative':
      return 'negative';
    case 'positive':
    case 'neutral':
    default:
      return 'accent';
  }
}

/** "Ended 1 day ago" / "Ended 6 days ago" — `days` is negative when ended. */
function endedLabel(days: number): string {
  const n = -days;
  return `Ended ${n} day${n === 1 ? '' : 's'} ago`;
}

const styles = StyleSheet.create({
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
});
