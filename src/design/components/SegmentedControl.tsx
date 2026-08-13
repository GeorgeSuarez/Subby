/**
 * SegmentedControl — N-segment selector for sort/period toggles.
 *
 *   <SegmentedControl
 *     segments={['Monthly', 'Yearly']}
 *     selectedIndex={0}
 *     onSelect={(i) => setIndex(i)}
 *   />
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only.
 *  - `list-performance-callbacks`: a single onSelect callback instance; each
 *    segment calls it with its index rather than capturing its own closure.
 *  - `react-state-dispatcher`: derive selected from `selectedIndex`, never store.
 */

import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

export interface SegmentedControlProps {
  /** Labels shown in each segment, in order. */
  segments: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Optional testID forscreen-readers / tests. */
  testID?: string;
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onSelect,
  testID,
}: SegmentedControlProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.container,
        { backgroundColor: colors.surfaceHigher, borderColor: colors.border },
      ]}
    >
      {segments.map((label, index) => {
        const selected = index === selectedIndex;
        const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
          styles.segment,
          selected ? { backgroundColor: colors.accentSoft } : null,
          pressed ? { opacity: 0.6 } : null,
        ];
        return (
          <Pressable
            key={`${label}-${index}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={pressableStyle}
            onPress={() => onSelect(index)}
          >
            <Text
              variant="caption"
              weight={selected ? '600' : '500'}
              color={selected ? 'accent' : 'textSecondary'}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
