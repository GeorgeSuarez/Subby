/**
 * CurrencySheet — native bottom sheet listing every supported currency.
 *
 * Opened directly from the Settings hub's Currency row (no drill-down
 * screen): one tap on the hub → options. `SettingsScreen` owns visibility.
 *
 * Skill rules:
 *  - `ui-native-modals`: uses the design-system `Sheet` (RN `Modal` backed by
 *    native platform modals), never a JS-only bottom-sheet lib.
 *  - `ui-pressable`: each currency row in the sheet is a Pressable.
 *  - `react-state-minimize`: the chosen currency is store-owned; only the
 *    sheet's open/closed boolean is local state (in `SettingsScreen`).
 *  - `list-performance-callbacks`: a single onSelect handler drives every row.
 */

import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';
import { CURRENCIES } from '@/utils/constants';
import { useUIStore } from '@/store/useUIStore';
import type { CurrencyCode } from '@/types/subscription';

export interface CurrencySheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CurrencySheet({ visible, onClose }: CurrencySheetProps) {
  const { colors } = useTheme();
  const currency = useUIStore((s) => s.currency);
  const setCurrency = useUIStore((s) => s.setCurrency);

  const onSelect = useCallback(
    (code: CurrencyCode) => {
      setCurrency(code);
      onClose();
    },
    [setCurrency, onClose],
  );

  return (
    <Sheet visible={visible} onDismiss={onClose}>
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
  );
}

function fractionDigitsLabel(d: number): string {
  return `${d} decimal${d === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
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
