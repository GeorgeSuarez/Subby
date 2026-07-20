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
 * Skill rules:
 *  - `rendering-no-falsy-and`: ternary only for conditional actions.
 *  - `animation-gpu-properties`: entrance uses only `opacity` + `transform:
 *    scale` via Reanimated's `entering` API (§3.1).
 */

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

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
  /** Ionicons name shown inside the default decoration tile.
   *  Defaults to 'Cube'. */
  decorationIcon?: string;
  /** Tone for the decoration backdrop (defaults to 'accentSoft'). */
  decorationTone?: keyof Palette;
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  decoration,
  decorationIcon = 'cube-outline',
  decorationTone = 'accentSoft',
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Animated.View
        entering={ZoomIn.springify().damping(14).stiffness(180).delay(120)}
        style={[
          styles.decoration,
          {
            backgroundColor: colors[decorationTone],
            borderColor: colors.border,
          },
        ]}
      >
        {decoration ? (
          decoration
        ) : (
          <Ionicons name={decorationIcon as never} size={36} color={colors.accent} />
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(280).springify().damping(16).stiffness(200).delay(180)}
        style={styles.copy}
      >
        <Text variant="title" color="textPrimary" align="center">
          {title}
        </Text>

        {body ? (
          <Text variant="body" color="textSecondary" align="center">
            {body}
          </Text>
        ) : null}
      </Animated.View>

      {actionLabel && onAction ? (
        <Animated.View entering={FadeInDown.duration(260).delay(260)}>
          <Button onPress={onAction} variant="primary" size="lg">
            {actionLabel}
          </Button>
        </Animated.View>
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
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});