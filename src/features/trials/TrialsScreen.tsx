/**
 * TrialsScreen — every active free trial, soonest-ending first.
 *
 * Pushed from the dashboard's HeroSpend trial chip. Each row opens the
 * subscription's detail screen.
 *
 * Skill rules:
 *  - `list-performance-virtualize`: FlashList for any sized collection.
 *  - `list-performance-callbacks`: `onRowPress` is a single stable instance at
 *    the screen root, passed to every row via `onPressWithId`.
 *  - `list-performance-item-memo`: rows are the memoized `ListRow`, primitives
 *    only.
 *  - `react-state-minimize`: `trials` is derived during render from the store's
 *    subscriptions via `activeTrials` — nothing cached, no effect to sync it.
 *  - `rendering-no-falsy-and`: ternaries everywhere.
 */

import { useCallback, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';

import { EmptyState, ListRow, Text } from '@/design/components';
import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';
import {
  useActiveSubscriptions,
  useIsLoadingSubscriptions,
  useSubscriptionsError,
} from '@/store/useSubscriptionsStore';
import {
  activeTrials,
  type ActiveTrial,
  type RenewalTone,
} from '@/utils/billing';
import { formatMonthDay } from '@/utils/format';
import { selection } from '@/utils/haptics';

type FlashListProps = ComponentProps<typeof FlashList<ActiveTrial>>;

export function TrialsScreen() {
  const router = useRouter();
  const subs = useActiveSubscriptions();
  const isLoading = useIsLoadingSubscriptions();
  const error = useSubscriptionsError();

  // Derived during render — `activeTrials` keeps non-archived subs whose trial
  // ends today or later, sorted soonest-first.
  const trials = activeTrials(subs);

  const onRowPress = useCallback(
    (id: string) => {
      void selection();
      router.push(`/subscription/${id}`);
    },
    [router],
  );

  if (!isLoading && trials.length === 0) {
    return (
      <Surface background="surface" style={styles.empty}>
        <EmptyState
          title="No active trials"
          body="Free trials running on your subscriptions show up here."
          decorationIcon="gift-outline"
        />
      </Surface>
    );
  }

  const header: FlashListProps['ListHeaderComponent'] = (
    <View style={styles.header}>
      <Text variant="caption" color="textSecondary" weight="600">
        {isLoading
          ? '…'
          : `${trials.length} active trial${trials.length === 1 ? '' : 's'}`}
      </Text>
      {error ? (
        <Text variant="caption" color="negative">
          {error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Surface background="surface" style={styles.root}>
      <FlashList
        data={trials}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <ListRow
            id={item.id}
            title={item.name}
            subtitle={`Free trial · ends ${formatMonthDay(item.endISO)}`}
            trailingSubtitle={item.label}
            trailingSubtitleColor={trialTextColor(item.tone)}
            icon={item.icon}
            avatarBackground="surfaceHigher"
            onPressWithId={onRowPress}
          />
        )}
      />
    </Surface>
  );
}

// --- Helpers ----------------------------------------------------------------

function trialTextColor(tone: RenewalTone): 'warning' | 'negative' | 'accent' {
  switch (tone) {
    case 'warning':
      return 'warning';
    case 'negative':
      return 'negative';
    case 'positive':
    case 'neutral':
    default:
      return 'accent';
  }
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
    paddingBottom: spacing.sm,
  },
});
