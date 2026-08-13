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

const SORT_LABELS: Record<SubscriptionSort, string> = {
  name: 'Name',
  amount: 'Cost',
  nextRenewal: 'Renewal',
};

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
  const sortKeys = Object.keys(SORT_LABELS) as SubscriptionSort[];
  const selectedIndex = sortKeys.indexOf(sort);

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textTertiary" weight="600">
        Sort by
      </Text>
      <SegmentedControl
        segments={sortKeys.map((k) => SORT_LABELS[k])}
        selectedIndex={selectedIndex}
        onSelect={(i) => {
          void selection();
          onSort(sortKeys[i] ?? 'nextRenewal');
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
