/**
 * ForecastCard — actual charges per month for the next 12 months.
 *
 * Meaningful-at-a-glance: every month gets a labeled bar (month name beneath,
 * amount above when it's a peak), the current month is highlighted in accent,
 * quiet months stay visibly empty. Bars grow in with a stagger on mount
 * (scaleY from the track bottom — transform only, GPU). When a budget is set,
 * a hairline crosses the bars at the budget height and over-budget months tint
 * negative. The footer states the average, the biggest month-over-month swing,
 * and the yearly total.
 *
 * Skill rules:
 *  - `ui-styling`: tokens only; bar track/fill from palette + radius.
 *  - `react-state-minimize`: derived in render via `monthlyForecast` — no state.
 *  - `animation-gpu-properties`: bar growth animates `transform: scaleY` with
 *    `transformOrigin: 'bottom'` — never height.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Card, Text } from '@/design/components';
import type { TextColor } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { useActiveSubscriptions } from '@/store/useSubscriptionsStore';
import { useBudget, useCurrency } from '@/store/useUIStore';
import { monthlyForecast } from '@/utils/billing';
import { formatCurrency, formatMonthShort } from '@/utils/format';

const FORECAST_MONTHS = 12;
const TRACK_HEIGHT = 88;

export function ForecastCard() {
  const subs = useActiveSubscriptions();
  const currency = useCurrency();
  const budget = useBudget();
  const { colors } = useTheme();

  const forecast = monthlyForecast(subs, FORECAST_MONTHS);
  const peakTotal = Math.max(...forecast.map((m) => m.total), 0);
  const total = forecast.reduce((sum, m) => sum + m.total, 0);
  const average = total / FORECAST_MONTHS;

  const peak = forecast.find((m) => m.total === peakTotal && m.total > 0);
  const hasBudget = budget > 0 && peakTotal > 0;
  // Height of the budget line relative to the tallest bar (clamped 0..1).
  const budgetLineBottom =
    (budget > 0 && peakTotal > 0 ? Math.min(1, budget / peakTotal) : 0) *
    TRACK_HEIGHT;

  // Biggest month-over-month swing, for the footer ("Aug +$40 vs Jul").
  const swing = biggestSwing(forecast);
  const swingCopy = swing
    ? ` · ${formatMonthShort(swing.currentMonth)} ${
        swing.diff >= 0 ? '+' : '−'
      }${formatCurrency(Math.abs(swing.diff), currency)} vs ${formatMonthShort(swing.previousMonth)}`
    : '';

  return (
    <Card padding={spacing.lg} elevation="low">
      <Text variant="caption" color="textSecondary" weight="600">
        Next {FORECAST_MONTHS} months
      </Text>

      <View style={styles.chart}>
        <View style={styles.bars}>
          {forecast.map((m, i) => {
            const isCurrent = i === 0;
            const isPeak = peakTotal > 0 && m.total === peakTotal;
            const isOver = hasBudget && m.total > budget;
            return (
              <ForecastBar
                key={m.month}
                total={m.total}
                peakTotal={peakTotal}
                isCurrent={isCurrent}
                isPeak={isPeak}
                isOver={isOver}
                chipText={
                  isPeak ? formatCurrency(m.total, currency) : undefined
                }
                chipColor={isPeak && isOver ? 'negative' : 'accent'}
                delayMs={i * 45}
              />
            );
          })}

          {hasBudget ? (
            <View
              style={[
                styles.budgetLine,
                { backgroundColor: colors.border, bottom: budgetLineBottom },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.labels}>
          {forecast.map((m, i) => (
            <Text
              key={m.month}
              variant="caption"
              color={i === 0 ? 'accent' : 'textTertiary'}
              weight={i === 0 ? '700' : '400'}
              numberOfLines={1}
              style={styles.monthLabel}
            >
              {formatMonthShort(m.month)}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          Avg {formatCurrency(average, currency)}/mo
          {peak ? ` · Peak ${formatMonthShort(peak.month)}` : ''}
          {swingCopy}
          {hasBudget ? ` · Budget ${formatCurrency(budget, currency)}` : ''}
        </Text>
        <Text variant="caption" color="textSecondary" weight="600">
          {formatCurrency(total, currency)} due
        </Text>
      </View>
    </Card>
  );
}

// --- Sub-components ---------------------------------------------------------

/** One forecast bar — owns its grow-in animation (transform-only). */
function ForecastBar({
  total,
  peakTotal,
  isCurrent,
  isPeak,
  isOver,
  chipText,
  chipColor,
  delayMs,
}: {
  total: number;
  peakTotal: number;
  isCurrent: boolean;
  isPeak: boolean;
  isOver: boolean;
  chipText?: string;
  chipColor: TextColor;
  delayMs: number;
}) {
  const { colors } = useTheme();
  // Ground truth: 0 = collapsed, 1 = full height. Skill §7.1.
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.set(
      withDelay(
        delayMs,
        withSpring(1, { damping: 15, stiffness: 90, mass: 1 }),
      ),
    );
  }, [grow, delayMs]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.get() }],
  }));

  const fillColor = isOver
    ? colors.negative
    : isCurrent
      ? colors.accent
      : isPeak
        ? colors.accentMuted
        : colors.accentSoftStrong;

  return (
    <View style={styles.column}>
      {/* Value chip — only on peak months, so the eye lands on the spike. */}
      <View style={styles.chipSlot}>
        {chipText ? (
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
              color={chipColor}
              numberOfLines={1}
            >
              {chipText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height:
                total === 0
                  ? 0
                  : `${Math.max(8, (total / (peakTotal || 1)) * 100)}%`,
              backgroundColor: fillColor,
            },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

// --- Helpers ----------------------------------------------------------------

/** Biggest month-over-month swing (null when the series is flat). */
function biggestSwing(
  forecast: { month: string; total: number }[],
): { currentMonth: string; previousMonth: string; diff: number } | null {
  let best: {
    currentMonth: string;
    previousMonth: string;
    diff: number;
  } | null = null;
  let bestAbs = 0;
  for (let i = 1; i < forecast.length; i++) {
    const prev = forecast[i - 1];
    const cur = forecast[i];
    if (!prev || !cur) continue;
    const diff = cur.total - prev.total;
    if (Math.abs(diff) > bestAbs) {
      bestAbs = Math.abs(diff);
      best = { currentMonth: cur.month, previousMonth: prev.month, diff };
    }
  }
  return best;
}

const styles = StyleSheet.create({
  chart: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    position: 'relative',
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
    height: TRACK_HEIGHT,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: radius.sm,
    transformOrigin: 'bottom',
  },
  budgetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  labels: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthLabel: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});
