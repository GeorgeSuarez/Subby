/**
 * RenewalCountdown — large "days until" + badge + renewal date.
 *
 * Skill rules:
 *  - `react-state-minimize`: derives a {@link RenewalStatus} from the
 *    subscription prop each render — never stored as state.
 *  - `rendering-no-falsy-and`: ternaries only.
 *  - `ui-styling`: tokens only; CSS box-shadow string.
 *  - Tone comes from semantic palette tokens (positive/negative/warning/neutral)
 *    so the badge naturally adapts to the dark/light theme.
 */

import { StyleSheet, View } from 'react-native';

import { Badge, Card, Text, type BadgeTone } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import {
  getRenewalStatus,
  getTrialStatus,
  type RenewalTone,
} from '@/features/subscription-detail/detail-helpers';
import { formatDate } from '@/utils/format';
import type { Subscription } from '@/types/subscription';

export interface RenewalCountdownProps {
  sub: Subscription;
}

export function RenewalCountdown({ sub }: RenewalCountdownProps) {
  const { colors } = useTheme();

  // A free trial outranks the renewal countdown while it's the user's focus.
  const trial = getTrialStatus(sub);
  const renewal = getRenewalStatus(sub);
  const status = trial ?? renewal;
  const endISO = trial ? trial.endISO : renewal.nextISO;
  const tone: BadgeTone = status.tone;
  // Derived background tint via the soft variant of the matching semantic color.
  const toneBackground = toneSoftColor(status.tone, colors);
  const toneText = toneTextColor(status.tone, colors);

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        {trial ? 'Free trial' : 'Next renewal'}
      </Text>

      <View style={styles.bigRow}>
        <Text variant="stat" weight="700" color="textPrimary">
          {status.days < 0 ? Math.abs(status.days) : status.days}
        </Text>
        <Text variant="caption" color="textSecondary" style={styles.daysLabel}>
          {Math.abs(status.days) === 1 ? 'day' : 'days'}
          {status.days < 0 ? ' ago' : ''}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <Badge tone={tone}>{status.label}</Badge>
        <View style={[styles.dateChip, { backgroundColor: toneBackground }]}>
          <Text variant="caption" weight="600" color={toneText}>
            {formatDate(endISO)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
    </Card>
  );
}

// --- Helpers ----------------------------------------------------------------

function toneSoftColor(
  tone: RenewalTone,
  c: ReturnType<typeof useTheme>['colors'],
): string {
  switch (tone) {
    case 'positive':
      return c.positiveSoft;
    case 'negative':
      return c.negativeSoft;
    case 'warning':
      return c.warningSoft;
    case 'neutral':
    default:
      return c.surfaceHigher;
  }
}

function toneTextColor(
  tone: RenewalTone,
  c: ReturnType<typeof useTheme>['colors'],
): 'positive' | 'negative' | 'warning' | 'textPrimary' {
  switch (tone) {
    case 'positive':
      return 'positive';
    case 'negative':
      return 'negative';
    case 'warning':
      return 'warning';
    case 'neutral':
    default:
      return 'textPrimary';
  }
}

const styles = StyleSheet.create({
  bigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  daysLabel: {
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  dateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.xs,
    borderCurve: 'continuous',
  },
  divider: {
    height: 1,
    marginTop: spacing.md,
  },
});
