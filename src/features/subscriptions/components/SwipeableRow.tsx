/**
 * SwipeableRow — swipe-left-to-reveal row action wrapper (used by FlashList).
 *
 * Swiping left reveals an Archive / Unarchive action behind the row; the
 * gesture runs on the UI thread (transform-only translateX, spring snap).
 * Tapping the row while open closes it instead of navigating; a recycled row
 * (new `id`) snaps shut. Renders the memoized `ListRow` itself so the wrapped
 * press handlers stay stable (skill `list-performance-item-memo`).
 *
 * Skill rules:
 *  - §3.1 (`animation-gpu-properties`): animates only `transform: translateX`.
 *  - §8.2 (`react-compiler-reanimated-shared-values`): `.get()`/`.set()`.
 *  - §7.1 (`state-ground-truth`): the shared value holds the row's open state
 *    (0 = closed, -ACTION_WIDTH = open); the reveal is derived from it.
 */

import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { ListRow, Text } from '@/design/components';
import type { ListRowProps } from '@/design/components/ListRow';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';

/** Revealed action width in dp. */
const ACTION_WIDTH = 84;
/** Spring used for both snap-open and close. */
const SNAP = { damping: 20, stiffness: 220 } as const;

export interface SwipeableRowProps extends Omit<
  ListRowProps,
  'id' | 'onPressWithId' | 'onLongPressWithId'
> {
  /** Row id — also used to reset the swipe when FlashList recycles the cell. */
  id: string;
  /** Current archive state (drives the action label). */
  archived: boolean;
  /** Called with the row id when the revealed action is tapped. */
  onAction: (id: string) => void;
  /** Tap handler; ignored while the row is open (tap closes instead). */
  onPressWithId?: (id: string) => void;
  /** Long-press handler; ignored while the row is open. */
  onLongPressWithId?: (id: string) => void;
}

export function SwipeableRow({
  id,
  archived,
  onAction,
  onPressWithId,
  onLongPressWithId,
  ...rowProps
}: SwipeableRowProps) {
  const { colors } = useTheme();
  // Ground truth: 0 = closed, -ACTION_WIDTH = open. Skill §7.1.
  const tx = useSharedValue(0);

  // Recycle safety: a cell reused for a different row starts closed.
  useEffect(() => {
    tx.set(0);
  }, [id, tx]);

  const close = useCallback(() => {
    tx.set(withSpring(0, SNAP));
  }, [tx]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      tx.set(Math.max(-ACTION_WIDTH, Math.min(0, e.translationX)));
    })
    .onEnd(() => {
      const destination = tx.get() < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
      tx.set(withSpring(destination, SNAP));
    });

  // Stable handlers passed to the memoized ListRow child.
  const handlePress = useCallback(
    (pressedId: string) => {
      if (tx.get() < 0) {
        close();
        return;
      }
      onPressWithId?.(pressedId);
    },
    [tx, close, onPressWithId],
  );

  const handleLongPress = useCallback(
    (pressedId: string) => {
      if (tx.get() < 0) {
        close();
        return;
      }
      onLongPressWithId?.(pressedId);
    },
    [tx, close, onLongPressWithId],
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }],
  }));

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.action,
          {
            backgroundColor: colors.surfaceHigher,
            borderLeftColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={archived ? 'Unarchive' : 'Archive'}
          onPress={() => onAction(id)}
          style={({ pressed }) => [
            styles.actionPressable,
            pressed ? { opacity: 0.6 } : null,
          ]}
        >
          <Text variant="caption" weight="600" color="accent">
            {archived ? 'Unarchive' : 'Archive'}
          </Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={contentStyle}>
          <ListRow
            id={id}
            onPressWithId={handlePress}
            onLongPressWithId={handleLongPress}
            {...rowProps}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderCurve: 'continuous',
  },
  actionPressable: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
