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

import { Button, Card, Text } from '@/design/components';
import { spacing } from '@/design/tokens';
import { AmountInput } from '@/features/add-subscription/components/AmountInput';
import { useBudget, useCurrency, useUIStore } from '@/store/useUIStore';
import { formatCurrency } from '@/utils/format';

export function BudgetSection() {
  const budget = useBudget();
  const currency = useCurrency();
  const setBudget = useUIStore((s) => s.setBudget);

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

  return (
    <Card padding={spacing.lg} elevation="flat">
      <Card.Header>
        <Text variant="headline" weight="600">Budget</Text>
        <Text variant="caption" color="textSecondary">
          {budget > 0
            ? `Dashboard shows progress against ${formatCurrency(budget, currency)}/mo`
            : 'No budget set — the dashboard hero stays clean.'}
        </Text>
      </Card.Header>

      <View style={styles.row}>
        <View style={styles.input}>
          <AmountInput currency={currency} value={text} onChangeText={onChange} />
        </View>
        {budget > 0 ? (
          <Button onPress={onClear} variant="ghost" size="sm">Clear</Button>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
  },
});
