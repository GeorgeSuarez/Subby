/**
 * AddFab — floating add-subscription button.
 *
 * Skill rule §3.3 (`animation-gesture-detector-press`): use `GestureDetector`
 * with `Gesture.Tap()` rather than Pressable's onPressIn/onPressOut for UI
 * thread-locked press animations. Press feedback runs entirely on the UI
 * thread (worklets) — no JS round-trip per press frame.
 *
 * Skill rule §8.2 (`react-compiler-reanimated-shared-values`): uses
 * `.set()` / `.get()` on the shared value (React Compiler compatibility).
 *
 * Skill rule §7.1 (`state-ground-truth`): the shared value stores the press
 * *state* (0 = idle, 1 = pressed); the scale is derived via `interpolate`.
 * That way we can reuse the same value to drive opacity, rotation, etc.
 *
 * Skill rule §3.1 (`animation-gpu-properties`): only `transform: scale`
 * (GPU-accelerated) is animated; no layout properties touched.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  runOnJS,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { AccessibilityRole, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/design/theme';
import { layout, spacing } from '@/design/tokens';
import { impactLight } from '@/utils/haptics';

export interface AddFabProps {
  onPress: () => void;
  /** Optional accessibility label; defaults to "Add subscription". */
  label?: string;
}

export function AddFab({ onPress, label = 'Add subscription' }: AddFabProps) {
  const { colors, shadow } = useTheme();

  // Ground truth state shared values (skill §7.1):
  //   pressed: 0 = idle, 1 = pressed  (gesture-driven)
  //   entrance: 0 → 1 on mount (entrance spring)
  // Both drive `transform: scale`, multiplied together for the final visual.
  const pressed = useSharedValue(0);
  const entrance = useSharedValue(0);

  // Entrance animation: spring scale/opacity from 0 → 1 once on mount.
  // Skill §3.1: only `transform` and `opacity`.
  useEffect(() => {
    // Delay slightly so the dashboard cards settle before the FAB pops in.
    entrance.set(withDelay(140, withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 })));
  }, [entrance]);

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: 90 }));
    })
    .onFinalize(() => {
      pressed.set(withSpring(0, { damping: 14, stiffness: 220 }));
    })
    .onEnd(() => {
      runOnJS(onPress)();
      runOnJS(impactLight)();
    });

  const animatedStyle = useAnimatedStyle(() => {
    // Combine entrance + press scales. Both 0..1 ranges combined multiplicatively.
    const s = interpolate(pressed.get(), [0, 1], [1, 0.92]) * entrance.get();
    const o = entrance.get(); // opacity only follows entrance
    return { transform: [{ scale: s }], opacity: o };
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={tap}>
        <AnimatedFab
          accessibilityRole="button"
          accessibilityLabel={label}
          shadow={shadow('glowAccent')}
          accent={colors.accent}
          fg={colors.textOnAccent}
          animatedStyle={animatedStyle}
        />
      </GestureDetector>
    </View>
  );
}

// Animated FAB surface — left as a separate component so the worklet-driven
// style stays out of the React render scope.
function AnimatedFab({
  shadow,
  accent,
  fg,
  animatedStyle,
  ...rest
}: {
  shadow: string;
  accent: string;
  fg: string;
  animatedStyle: AnimatedStyle<ViewStyle>;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
}) {
  return (
    <Animated.View
      style={[styles.fab, { backgroundColor: accent, boxShadow: shadow }, animatedStyle]}
      {...rest}
    >
      <Ionicons name="add" size={28} color={fg} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    zIndex: 10,
  },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});