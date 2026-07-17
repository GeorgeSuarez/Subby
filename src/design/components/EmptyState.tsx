/**
 * EmptyState — full-card placeholder when a list has no items.
 *
 *   <EmptyState
 *     title="No subscriptions yet"
 *     body="Track recurring expenses by adding your first one."
 *     actionLabel="Add"
 *     onAction={handleAdd}
 *   />
 *
 * Skill rule `rendering-no-falsy-and`: ternary only for conditional actions.
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design/components/Button';
import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { spacing, type Palette } from '@/design/tokens';

export interface EmptyStateProps {
  /** Headline. */
  title: string;
  /** Secondary description. Optional. */
  body?: string;
  /** Primary CTA label. Optional. */
  actionLabel?: string;
  /** CTA handler. */
  onAction?: () => void;
  /** Optional custom accessory node rendered above the title. */
  decoration?: ReactNode;
  /** Tone for the decoration backdrop (defaults to 'accentSoft'). */
  decorationTone?: keyof Palette;
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  decoration,
  decorationTone = 'accentSoft',
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {decoration ? (
        <View
          style={[
            styles.decoration,
            { backgroundColor: colors[decorationTone], borderColor: colors.border },
          ]}
        >
          {decoration}
        </View>
      ) : null}

      <Text variant="title" color="textPrimary" align="center">
        {title}
      </Text>

      {body ? (
        <Text variant="body" color="textSecondary" align="center">
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="primary" size="lg">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  decoration: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});