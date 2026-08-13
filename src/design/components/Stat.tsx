/**
 * Stat — compact metric block (label + value + optional delta).
 *
 *   <Stat label="Monthly" value="$412" delta="+3%" deltaTone="negative" />
 *
 * Skill rule `rendering-no-falsy-and`: ternary for conditionals.
 * Skill rule `ui-styling`: gap, no inline child margins.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design/components/Text';
import { Badge, type BadgeTone } from '@/design/components/Badge';
import { spacing, type Palette } from '@/design/tokens';

export interface StatProps {
  label: string;
  value: string;
  /** Optional delta indicator below the value. */
  delta?: string;
  /** Tone for the delta chip. Defaults to 'neutral'. */
  deltaTone?: BadgeTone;
  /** Render the value in stat size (oversized) instead of display. Defaults to true. */
  oversize?: boolean;
  /** Override the value color token. Defaults to 'textPrimary'. */
  valueColor?: keyof Palette;
  /** Optional trailing accessory (an icon button). */
  accessoryRight?: ReactNode;
}

const toneForDelta = {
  'up-good': 'positive',
  'up-bad': 'negative',
  'down-good': 'positive',
  'down-bad': 'negative',
} as const;

export function Stat({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  oversize = false,
  valueColor = 'textPrimary',
  accessoryRight,
}: StatProps) {
  void toneForDelta; // reserved for future auto-tone logic based on delta sign

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text
          variant={oversize ? 'stat' : 'display'}
          weight="700"
          color={valueColor}
        >
          {value}
        </Text>
        {accessoryRight ? (
          <View style={styles.accessory}>{accessoryRight}</View>
        ) : null}
      </View>
      {delta ? <Badge tone={deltaTone}>{delta}</Badge> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  accessory: {
    marginBottom: spacing.xs,
  },
});
