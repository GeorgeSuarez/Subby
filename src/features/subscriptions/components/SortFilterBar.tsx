/**
 * SortFilterBar — segmented sort selector + filter chip row.
 *
 * Skills:
 *  - `list-performance-callbacks`: each `onSelect*` is a stable callback passed
 *    in from the parent; the bar re-renders only when sort/filter props change.
 *  - `react-state-dispatcher`: this component holds NO state. The highlight and
 *    pressed states are derived from `selectedIndex` / `selectedFilter`.
 */

import { StyleSheet, View } from 'react-native';

import { Chip, SegmentedControl, Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import { selection } from '@/utils/haptics';
import type {
  SubscriptionFilter,
  SubscriptionSort,
} from '@/types/subscription';

const SORT_OPTIONS: readonly { value: SubscriptionSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'amount', label: 'Cost' },
  { value: 'nextRenewal', label: 'Renewal' },
];

const FILTER_OPTIONS: readonly { value: SubscriptionFilter; label: string }[] =
  [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
  ];

export interface SortFilterBarProps {
  sort: SubscriptionSort;
  filter: SubscriptionFilter;
  onSort: (s: SubscriptionSort) => void;
  onFilter: (f: SubscriptionFilter) => void;
}

export function SortFilterBar({
  sort,
  filter,
  onSort,
  onFilter,
}: SortFilterBarProps) {
  const selectedIndex = SORT_OPTIONS.findIndex((o) => o.value === sort);

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textTertiary" weight="600">
        Sort by
      </Text>
      <SegmentedControl
        segments={SORT_OPTIONS.map((o) => o.label)}
        selectedIndex={selectedIndex}
        onSelect={(i) => {
          void selection();
          onSort(SORT_OPTIONS[i]?.value ?? 'nextRenewal');
        }}
      />

      <View style={styles.chipRow}>
        {FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            selected={filter === opt.value}
            onPress={() => {
              if (filter !== opt.value) void selection();
              onFilter(opt.value);
            }}
          >
            {opt.label}
          </Chip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
