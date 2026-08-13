/**
 * SubscriptionsScreen — full subscription list with sort, filter, and search.
 *
 * Skill rules:
 *  - `list-performance-virtualize`: uses FlashList for any sized collection.
 *  - `list-performance-callbacks`: `onRowPress` and `onRowLongPress` are single
 *    stable instances at the screen root, passed to every row via
 *    `onPressWithId`/`onLongPressWithId`. Rows stay `memo()`-effective.
 *  - `react-state-minimize`: derived list computed during render via
 *    `useMemo` over the filter/sort helper; no list state stored.
 *  - `list-performance-item-memo`: each row is the memoized `ListRow` from
 *    the design system, receiving only primitive props.
 *  - `ui-menus`: long-press opens a native `Alert.alert` action sheet (iOS
 *    UIAlertController / Android material dialog) — never a JS dropdown.
 *  - `ui-pressable`: search field + chips + segmented all already use Pressable.
 *  - `rendering-no-falsy-and`: ternaries everywhere.
 */

import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import {
  EmptyState,
  ListRow,
  SearchField,
  SearchHint,
  Text,
} from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { radius, spacing } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { SortFilterBar } from '@/features/subscriptions/components/SortFilterBar';
import { filterAndSortSubs } from '@/features/subscriptions/subscriptions-filter';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
  useIsOffline,
  usePendingCount,
  useSubscriptionsError,
  useSubscriptionsStore,
  useSyncError,
} from '@/store/useSubscriptionsStore';
import { useFilter, useSort, useUIStore } from '@/store/useUIStore';
import { daysUntilRenewal, nextRenewalAfter } from '@/utils/billing';
import {
  formatCurrency,
  formatMonthDay,
  formatRenewalIn,
} from '@/utils/format';
import { selection, impactMedium } from '@/utils/haptics';
import type { Subscription } from '@/types/subscription';

type FlashListProps = ComponentProps<typeof FlashList<Subscription>>;

export function SubscriptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const subs = useSubscriptionsStore((s) => s.subs);
  const activeSubs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const error = useSubscriptionsError();
  const isOffline = useIsOffline();
  const pendingCount = usePendingCount();
  const syncError = useSyncError();
  const sort = useSort();
  const filter = useFilter();
  const setSort = useUIStore((s) => s.setSort);
  const setFilter = useUIStore((s) => s.setFilter);
  const archive = useSubscriptionsStore((s) => s.archive);
  const remove = useSubscriptionsStore((s) => s.remove);
  const flushPending = useSubscriptionsStore((s) => s.flushPending);

  // Local UI state: just the search query (single-line text input).
  const [query, setQuery] = useState('');

  // Derive the visible list during render (skill `react-state-minimize`).
  const visible = useMemo(
    () => filterAndSortSubs(subs, { query, sort, filter }),
    [subs, query, sort, filter],
  );

  // For quick membership checks inside row renderers (avoids N² lookups in
  // heterogeneous mode, though the trace is O(N·FilterPass)=O(N) here).
  const activeIdSet = useMemo(
    () => new Set(activeSubs.map((s) => s.id)),
    [activeSubs],
  );

  // Stable handlers — passed to every row. Skill `list-performance-callbacks`.
  const onRowPress = useCallback(
    (id: string) => {
      void selection();
      router.push(`/subscription/${id}`);
    },
    [router],
  );

  const onRowLongPress = useCallback(
    (id: string) => {
      const target = subs.find((s) => s.id === id);
      if (!target) return;
      void impactMedium();
      openRowActions({
        name: target.name,
        archived: target.archived,
        onEdit: () => router.push(`/subscription/${id}`),
        onArchive: () => archive(id, !target.archived),
        onDelete: () => confirmDelete(target.name, () => remove(id)),
      });
    },
    [subs, router, archive, remove],
  );

  const hasAnySubs = subs.length > 0;
  const filteredToZero = visible.length === 0;

  // First-launch empty state — no subs at all, offer the add CTA.
  if (!isLoading && !hasAnySubs) {
    return (
      <Surface background="surface" style={styles.empty}>
        <EmptyState
          title="No subscriptions yet"
          body="Add your first recurring expense to start tracking."
          actionLabel="Add subscription"
          onAction={() => router.push('/subscription/add')}
        />
      </Surface>
    );
  }

  // Header rendered as ListHeaderComponent so it scrolls with the list and
  // stays out of the recycling cell pool (skill `list-performance-item-expensive`).
  const header = (
    <View style={styles.header}>
      {isOffline || pendingCount > 0 || syncError ? (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: colors.surfaceHigher,
              borderColor: colors.border,
            },
          ]}
        >
          <Text variant="caption" color="textSecondary">
            {syncError
              ? `Sync paused — ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting`
              : isOffline
                ? `Offline — showing saved data${pendingCount > 0 ? ` · ${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting` : ''}`
                : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`}
          </Text>
          {isOffline || syncError ? (
            <Pressable
              onPress={() => void flushPending()}
              accessibilityRole="button"
              accessibilityLabel="Retry sync"
              hitSlop={8}
            >
              <Text variant="caption" color="accent" weight="600">
                Retry
              </Text>
            </Pressable>
          ) : pendingCount > 0 ? (
            <Pressable
              onPress={() => void flushPending()}
              accessibilityRole="button"
              accessibilityLabel="Sync now"
              hitSlop={8}
            >
              <Text variant="caption" color="accent" weight="600">
                Sync now
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search subscriptions"
      />

      <SortFilterBar
        sort={sort}
        filter={filter}
        onSort={setSort}
        onFilter={setFilter}
      />

      <View style={styles.countRow}>
        <Text variant="caption" color="textSecondary" weight="600">
          {visible.length} shown
        </Text>
        {error ? (
          <Text variant="caption" color="negative">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const footer: FlashListProps['ListFooterComponent'] = filteredToZero ? (
    <View style={styles.footerEmpty}>
      <SearchHint message="No subscriptions match your filters." />
    </View>
  ) : null;

  return (
    <Surface background="surface" style={styles.root}>
      <FlashList
        data={visible}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <ListRow
            id={item.id}
            title={item.name}
            subtitle={rowSubtitle(item)}
            trailingTitle={formatCurrency(item.amount, item.currency)}
            trailingSubtitle={rowTrailingSubtitle(item, activeIdSet)}
            icon={item.icon}
            avatarBackground="surfaceHigher"
            onPressWithId={onRowPress}
            onLongPressWithId={onRowLongPress}
            disabled={item.archived}
            style={item.archived ? styles.archivedRow : undefined}
          />
        )}
      />
    </Surface>
  );
}

// --- Helpers ----------------------------------------------------------------

function rowSubtitle(sub: Subscription): string {
  // For archived subs, show the archived status instead of a renewal date
  // (a "next renewal" label would be misleading once archived).
  if (sub.archived) return 'Archived';
  return formatMonthDay(nextRenewalAfter(sub));
}

function rowTrailingSubtitle(
  sub: Subscription,
  activeIdSet: Set<string>,
): string {
  if (sub.archived) return sub.category;
  // Only compute days-until for active subs — `daysUntilRenewal` walks forward
  // from `nextRenewal`, but archived subs don't need that visual urgency.
  void activeIdSet; // reserved for future selection-state accessories (Step 8).
  return formatRenewalIn(daysUntilRenewal(sub));
}

/**
 * Open a NATIVE action sheet via `Alert.alert` — iOS renders a UIAlertController,
 * Android renders a material dialog. Both are platform-native, not JS modals.
 * Skill `ui-menus`: native context menus for destructive/non-destructive row actions.
 */
function openRowActions(args: {
  name: string;
  archived: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}): void {
  const archiveLabel = args.archived ? 'Unarchive' : 'Archive';
  Alert.alert(
    args.name,
    undefined,
    [
      { text: 'Edit', onPress: args.onEdit },
      { text: archiveLabel, onPress: args.onArchive },
      { text: 'Delete', style: 'destructive', onPress: args.onDelete },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

/** Two-step delete: confirm via a second native dialog before removing. */
function confirmDelete(name: string, onConfirm: () => void): void {
  Alert.alert(
    `Delete ${name}?`,
    'This cannot be undone.',
    [
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    padding: spacing.lg,
    gap: spacing.md,
    // Pad bottom so the last sort-row chip clears the first row beneath it.
    paddingBottom: spacing.sm,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerEmpty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  archivedRow: {
    opacity: 0.5,
  },
});
