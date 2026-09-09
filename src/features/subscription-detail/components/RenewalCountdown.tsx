/**
 * RenewalCountdown — large renewal date + countdown label.
 *
 * Skill rules:
 *  - `react-state-minimize`: derives a {@link RenewalStatus} from the
 *    subscription prop each render — never stored as state.
 *  - `rendering-no-falsy-and`: ternaries only.
 *  - `ui-styling`: tokens only; CSS box-shadow string.
 *  - Tone comes from semantic palette tokens (positive/negative/warning/neutral)
 *    so the date naturally adapts to the dark/light theme.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { getRenewalStatus } from '@/features/subscription-detail/detail-helpers';
import { getTrialStatus, type RenewalTone } from '@/utils/billing';
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
  // Tone tints the date itself; the countdown label stays quieter below it.
  const toneText = toneTextColor(status.tone, colors);

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        {trial ? 'Free trial' : 'Next renewal'}
      </Text>

      <Text
        variant="title"
        weight="700"
        color={toneText}
        style={styles.date}
        numberOfLines={1}
      >
        {formatDate(endISO)}
      </Text>

      <Text variant="caption" color="textSecondary" style={styles.countdown}>
        {status.label}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
    </Card>
  );
}

// --- Helpers ----------------------------------------------------------------

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
  date: {
    marginTop: spacing.xs,
  },
  countdown: {
    marginTop: spacing.xs / 2,
  },
  divider: {
    height: 1,
    marginTop: spacing.md,
  },
});
