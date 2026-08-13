/**
 * ForecastCard — actual charges per month for the next 12 months.
 *
 * Meaningful-at-a-glance: every month gets a labeled bar (month name beneath,
 * amount above when it's a peak), the current month is highlighted in accent,
 * quiet months stay visibly empty, and the footer states the average and the
 * peak so the shape of the year reads without squinting.
 *
 * Skill rules:
 *  - `ui-styling`: tokens only; bar track/fill from palette + radius.
 *  - `react-state-minimize`: derived in render via `monthlyForecast` — no state.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useCurrency } from '@/store/useUIStore';
import { monthlyForecast } from '@/utils/billing';
import { formatCurrency, formatMonthShort } from '@/utils/format';

const FORECAST_MONTHS = 12;

export function ForecastCard() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const { colors } = useTheme();

  const forecast = monthlyForecast(subs, FORECAST_MONTHS);
  const peakTotal = Math.max(...forecast.map((m) => m.total), 0);
  const total = forecast.reduce((sum, m) => sum + m.total, 0);
  const average = total / FORECAST_MONTHS;

  const peak = forecast.find((m) => m.total === peakTotal && m.total > 0);

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        Next {FORECAST_MONTHS} months
      </Text>

      <View style={styles.chart}>
        {forecast.map((m, i) => {
          const isCurrent = i === 0;
          const isPeak = peakTotal > 0 && m.total === peakTotal;
          return (
            <View key={m.month} style={styles.column}>
              {/* Value chip — only on peak months, so the eye lands on the spike. */}
              <View style={styles.chipSlot}>
                {isPeak ? (
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: colors.surfaceHigher,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight="700"
                      color="accent"
                      numberOfLines={1}
                    >
                      {formatCurrency(m.total, currency)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={[styles.track, { backgroundColor: colors.accentSoft }]}
              >
                <View
                  style={[
                    styles.fill,
                    {
                      height:
                        m.total === 0
                          ? 0
                          : `${Math.max(8, (m.total / (peakTotal || 1)) * 100)}%`,
                      backgroundColor: isCurrent
                        ? colors.accent
                        : isPeak
                          ? colors.accentMuted
                          : colors.accentSoftStrong,
                    },
                  ]}
                />
              </View>

              <Text
                variant="caption"
                color={isCurrent ? 'accent' : 'textTertiary'}
                weight={isCurrent ? '700' : '400'}
                numberOfLines={1}
                style={styles.monthLabel}
              >
                {formatMonthShort(m.month)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
        <Text variant="caption" color="textSecondary">
          Avg {formatCurrency(average, currency)}/mo
          {peak ? ` · Peak ${formatMonthShort(peak.month)}` : ''}
        </Text>
        <Text variant="caption" color="textSecondary" weight="600">
          {formatCurrency(total, currency)} due
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  chipSlot: {
    height: 22,
    justifyContent: 'flex-end',
  },
  chip: {
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  track: {
    width: '100%',
    height: 88,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: radius.sm,
  },
  monthLabel: {
    fontSize: 9,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});
