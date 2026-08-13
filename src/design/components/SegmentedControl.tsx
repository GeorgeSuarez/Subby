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

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

export interface SegmentedOption {
  /** Native label shown in the segment. */
  label: string;
  /** Optional leading icon (Ionicons name). */
  icon?: string;
}

export interface SegmentedControlProps {
  /** Either an array of strings, or {@link SegmentedOption} objects for icons. */
  segments: string[] | SegmentedOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Optional testID forscreen-readers / tests. */
  testID?: string;
}

function normalizeSegments(
  segments: string[] | SegmentedOption[],
): SegmentedOption[] {
  return segments.map((s) => (typeof s === 'string' ? { label: s } : s));
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onSelect,
  testID,
}: SegmentedControlProps) {
  const { colors } = useTheme();
  const options = normalizeSegments(segments);

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[
        styles.container,
        { backgroundColor: colors.surfaceHigher, borderColor: colors.border },
      ]}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
          styles.segment,
          selected ? { backgroundColor: colors.accentSoft } : null,
          pressed ? { opacity: 0.6 } : null,
        ];
        return (
          <Pressable
            key={`${option.label}-${index}`}
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
              {option.label}
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

// Keep the `ReactNode` import in scope for parity with sibling components.
export type { ReactNode };
