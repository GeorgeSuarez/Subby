/**
 * DateInput — native date picker for the "Next renewal" field.
 *
 * Replaces the manual YYYY-MM-DD text field with a Pressable field row that
 * opens the platform's native date picker:
 *  - iOS: a bottom `Sheet` with a spinner picker (Cancel / Done commit).
 *  - Android: the native calendar dialog, committed on selection.
 *
 * The component stays controlled (`value` ISO YYYY-MM-DD, `onChange` on
 * commit) so the parent's draft remains the single source of truth.
 *
 * Skill rules:
 *  - `ui-pressable`: Pressable only, never Touchable*.
 *  - `ui-native-modals`: iOS uses the design-system `Sheet` (native Modal).
 *  - `rendering-no-falsy-and`: ternaries only.
 */

import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { Button, Text } from '@/design/components';
import { Sheet } from '@/design/components/Sheet';
import { useColorMode, useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { addMonths, todayUTC } from '@/utils/billing';
import { formatDate } from '@/utils/format';

export interface DateInputProps {
  /** ISO YYYY-MM-DD, or '' when not picked yet. */
  value: string;
  /** Called with the committed ISO date when the user picks one. */
  onChange: (iso: string) => void;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD → local-midnight Date (the picker works in local time). */
function isoToLocalDate(iso: string): Date | null {
  if (!ISO_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
}

/** Local Date → YYYY-MM-DD (mirrors `toISODate` but without the UTC shift). */
function localDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Sensible initial picker value: today + 1 month (matches `defaultDraft`). */
function defaultDate(): Date {
  const utc = addMonths(todayUTC(), 1);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Today at local midnight — renewals can't be in the past. */
function minDate(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function DateInput({ value, onChange }: DateInputProps) {
  const { colors } = useTheme();
  const scheme = useColorMode();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<Date>(
    () => isoToLocalDate(value) ?? defaultDate(),
  );

  const current = useMemo(() => isoToLocalDate(value), [value]);
  const minimumDate = useMemo(() => minDate(), []);

  const open = useCallback(() => {
    setPending(current ?? defaultDate());
    setVisible(true);
  }, [current]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const commit = useCallback(
    (date: Date) => {
      onChange(localDateToISO(date));
    },
    [onChange],
  );

  // iOS: spinner updates a pending value; Done commits it.
  const done = useCallback(() => {
    close();
    commit(pending);
  }, [close, commit, pending]);

  // Android: the native dialog now uses split callbacks instead of the
  // deprecated `onChange` (which reported set/dismissed via event.type).
  const onAndroidValueChange = useCallback(
    (_event: DateTimePickerChangeEvent, date: Date) => {
      close();
      commit(date);
    },
    [close, commit],
  );

  const onAndroidDismiss = useCallback(() => {
    close();
  }, [close]);

  return (
    <View>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Pick the next renewal date"
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surfaceHigher,
            borderColor: colors.border,
          },
          pressed ? styles.pressed : null,
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.textTertiary}
        />
        <Text
          variant="body"
          color={value ? 'textPrimary' : 'textTertiary'}
          numberOfLines={1}
          style={styles.value}
        >
          {value ? formatDate(value) : 'Pick a date'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Sheet visible={visible} onDismiss={close}>
          <View style={styles.sheetHeader}>
            <Button variant="ghost" size="sm" onPress={close}>
              Cancel
            </Button>
            <Text variant="headline" weight="600">
              Next renewal
            </Text>
            <Button variant="primary" size="sm" onPress={done}>
              Done
            </Button>
          </View>
          <DateTimePicker
            value={pending}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            themeVariant={scheme}
            onValueChange={(_event: DateTimePickerChangeEvent, date: Date) =>
              setPending(date)
            }
            style={styles.picker}
          />
        </Sheet>
      ) : visible ? (
        <DateTimePicker
          value={pending}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onValueChange={onAndroidValueChange}
          onDismiss={onAndroidDismiss}
          onNeutralButtonPress={onAndroidDismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  picker: {
    alignSelf: 'stretch',
  },
});
