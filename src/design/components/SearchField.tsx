/**
 * SearchField — accessible, themed search input.
 *
 * Wraps React Native's native `TextInput` (the platform-native text control).
 * For v1 cross-platform parity we render a styled rounded field with a leading
 * magnifier glyph. Step 12 polish may swap to iOS `headerSearchBarOptions`
 * (UIAlertController searchBar) for the iOS-specific native feel while keeping
 * this component for non-header usage.
 *
 * Skill rule `ui-styling`: borderCurve 'continuous', boxShadow string, gap.
 * Skill rule `ui-pressable` (analog): taps to focus should use the native
 * TextInput focus affordance, not a custom Pressable wrapper.
 */

import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';

export interface SearchFieldProps extends Omit<TextInputProps, 'placeholderTextColor'> {
  /** Override the placeholder color token. Defaults to textTertiary. */
  placeholderColor?: 'textTertiary' | 'textSecondary';
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  {
    placeholder = 'Search',
    placeholderColor = 'textTertiary',
    style,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceHigher,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name="search" size={18} color={colors[placeholderColor]} />
      <TextInput
        ref={ref}
        placeholder={placeholder}
        placeholderTextColor={colors[placeholderColor]}
        returnKeyType="search"
        autoCorrect={false}
        spellCheck={false}
        style={[styles.input, { color: colors.textPrimary }, style]}
        {...rest}
      />
    </View>
  );
});

/** Lightweight hint row for "no results" inside search-filtered lists. */
export function SearchHint({ message }: { message: string }) {
  return (
    <View style={styles.hint}>
      <Text variant="caption" color="textTertiary">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 40,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    includeFontPadding: false,
  },
  hint: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
});