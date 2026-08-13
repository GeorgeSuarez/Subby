/**
 * CurrencySection — current default currency row + opens a native Sheet
 * listing all supported currencies.
 *
 * Skill rules:
 *  - `ui-native-modals`: uses the design-system `Sheet` (RN `Modal` backed by
 *    native platform modals), never a JS-only bottom-sheet lib.
 *  - `ui-pressable`: each currency row in the sheet is a Pressable.
 *  - `react-state-minimize`: the chosen currency is store-owned; only the
 *    sheet's open/closed boolean is local state.
 *  - `list-performance-callbacks`: a single onSelect handler drives every row.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Sheet, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { CURRENCIES, currencyMeta } from '@/utils/constants';
import { useUIStore } from '@/store/useUIStore';
import type { CurrencyCode } from '@/types/subscription';

export function CurrencySection() {
  const { colors } = useTheme();
  const currency = useUIStore((s) => s.currency);
  const setCurrency = useUIStore((s) => s.setCurrency);
  const [open, setOpen] = useState(false);

  const onSelect = useCallback(
    (code: CurrencyCode) => {
      setCurrency(code);
      setOpen(false);
    },
    [setCurrency],
  );

  const meta = currencyMeta(currency);

  return (
    <>
      <Card padding={spacing.lg} elevation="low">
        <Card.Header>
          <Text variant="headline" weight="600" color="textPrimary">
            Currency
          </Text>
          <Text variant="caption" color="textSecondary">
            Default for new subscriptions
          </Text>
        </Card.Header>

        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.row,
            { borderColor: colors.border },
            pressed ? { opacity: 0.6 } : null,
          ]}
        >
          <Text variant="body" weight="600" color="textPrimary">
            {meta.symbol} {currency}
          </Text>
          <Text variant="caption" color="textTertiary">
            Tap to change
          </Text>
        </Pressable>
      </Card>

      <Sheet visible={open} onDismiss={() => setOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="headline" weight="600" color="textPrimary">
            Choose currency
          </Text>
          <Text variant="caption" color="textSecondary">
            Used as the default for new subscriptions
          </Text>
        </View>
        <View style={styles.currencyList}>
          {CURRENCIES.map((c) => {
            const selected = c.code === currency;
            return (
              <Pressable
                key={c.code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(c.code)}
                style={({ pressed }) => [
                  styles.currencyRow,
                  {
                    backgroundColor: selected
                      ? colors.accentSoft
                      : colors.surfaceHigher,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                  pressed ? { opacity: 0.6 } : null,
                ]}
              >
                <Text
                  variant="body"
                  weight={selected ? '700' : '500'}
                  color={selected ? 'accent' : 'textPrimary'}
                >
                  {c.symbol}
                </Text>
                <Text
                  variant="body"
                  weight={selected ? '700' : '500'}
                  color={selected ? 'accent' : 'textPrimary'}
                >
                  {c.code}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {fractionDigitsLabel(c.fractionDigits)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

function fractionDigitsLabel(d: number): string {
  return `${d} decimal${d === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sheetHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  currencyList: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.sm,
  },
});
