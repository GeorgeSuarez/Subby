/**
 * BudgetSection — monthly budget setting for the dashboard hero.
 *
 * 0 (or empty) means "no budget" — the dashboard hides the progress line.
 * The raw input string is the component's only local state; every commit is
 * dispatched to the persisted UI store.
 *
 * Skill rules:
 *  - `react-state-dispatcher`: `setBudget` goes through the store action.
 *  - `react-state-minimize`: the persisted number is ground truth; the text
 *    field mirrors it lazily.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Button, Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import { AmountInput } from '@/features/add-subscription/components/AmountInput';
import { useBudget, useCurrency, useUIStore } from '@/store/useUIStore';
import { formatCurrency } from '@/utils/format';
import { useCanUse } from '@/store/useEntitlementStore';

export function BudgetSection() {
  const budget = useBudget();
  const currency = useCurrency();
  const setBudget = useUIStore((s) => s.setBudget);
  const canUseBudget = useCanUse('budget');
  const router = useRouter();

  // Raw input text — lazily seeded from the persisted value.
  const [text, setText] = useState(() => (budget > 0 ? String(budget) : ''));

  const onChange = (raw: string) => {
    setText(raw);
    setBudget(raw.length === 0 ? 0 : Number(raw));
  };

  const onClear = () => {
    setText('');
    setBudget(0);
  };

  if (!canUseBudget) {
    return (
      <View>
        <View style={styles.header}>
          <Text variant="headline" color="textPrimary">
            Set a monthly budget to help optimze your spending habits.
          </Text>
          <Text variant="caption" color="textSecondary">
            Adds a progress bar in your dashboard to help visualize your budget.
          </Text>
        </View>
        <Button
          onPress={() => router.push('/subscription/paywall')}
          variant="primary"
          size="sm"
        >
          Unlock with Pro
        </Button>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <Text variant="headline" weight="600">
          Budget
        </Text>
        <Text variant="caption" color="textSecondary">
          {budget > 0
            ? `Dashboard shows progress against ${formatCurrency(budget, currency)}/mo`
            : 'No budget set — the dashboard hero stays clean.'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.input}>
          <AmountInput
            currency={currency}
            value={text}
            onChangeText={onChange}
          />
        </View>
        {budget > 0 ? (
          <Button onPress={onClear} variant="ghost" size="sm">
            Clear
          </Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
  },
});
