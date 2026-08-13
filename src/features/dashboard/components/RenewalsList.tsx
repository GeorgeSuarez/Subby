/**
 * RenewalsList — upcoming renewals card for the dashboard.
 *
 * Shows the top N renewals (within the next 30 days), sorted by soonest.
 * The dashboard shows up to `MAX_ROWS` items; "View all" navigates to the
 * Subscriptions tab so users can see every active sub.
 *
 * Skill rule `react-state-minimize`: the upcoming list is derived during
 * render from the active-subscriptions selector via `renewalsWithin`.
 *
 * Per-row interactions route to the detail modal (`/subscription/[id]`).
 * Per skill `list-performance-callbacks`, a single `onRowPress` instance is
 * created at the component root and called with each row's id; rows are
 * memoized inside `ListRow` and receive only primitive props.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, ListRow, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
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
import type { TextColor } from '@/design/components/Text';

/** Maximum rows shown on the Dashboard before "View all" takes the user to the list tab. */
const MAX_ROWS = 5;
/** Renewal window (days). */
const RENEWAL_WINDOW_DAYS = 30;

export function RenewalsList() {
  const subs = useActiveSubscriptions();
  const router = useRouter();
  const { colors } = useTheme();

  // Derive upcoming renewals during render (skill `react-state-minimize`).
  const upcoming = renewalsWithin(subs, RENEWAL_WINDOW_DAYS).slice(0, MAX_ROWS);

  // Single stable callback instance — each row just calls it with its id.
  // Skill `list-performance-callbacks`: never create a new function per row.
  const onRowPress = useCallback(
    (id: string) => {
      router.push(`/subscription/${id}`);
    },
    [router],
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
          upcoming.map((s) => {
            const nextISO = nextRenewalAfter(s);
            const days = daysUntilRenewal(s);
            const tone = renewalUrgencyTone(days);
            return (
              <ListRow
                key={s.id}
                id={s.id}
                title={s.name}
                subtitle={formatMonthDay(nextISO)}
                trailingTitle={formatCurrency(s.amount, s.currency)}
                trailingSubtitle={formatRenewalIn(days)}
                trailingSubtitleColor={toneColor(tone)}
                icon={s.icon}
                avatarBackground="surfaceHigher"
                onPressWithId={onRowPress}
              />
            );
          })
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
function toneColor(tone: RenewalUrgency): TextColor {
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
  footer: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
});
