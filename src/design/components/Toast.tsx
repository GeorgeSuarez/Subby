/**
 * Toast — transient success notification pill.
 *
 * Rendered once in the root layout inside a transparent native `Modal`, so it
 * floats ABOVE every layer — including native formSheet screens (e.g. the
 * detail screen the user lands on after saving an edit). The pill animates in
 * with Reanimated (opacity + translateY — GPU-friendly per skill rule
 * `animation-gpu-properties`); the modal fades out on dismiss. Touches pass
 * through everywhere except the pill, and tapping the pill dismisses early.
 */

import { StyleSheet, View, Pressable, Modal } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { useToastStore } from '@/store/useToastStore';

export function Toast() {
  const id = useToastStore((s) => s.id);
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();

  return (
    <Modal
      visible={message !== null}
      transparent
      animationType="fade"
      onRequestClose={hide}
      statusBarTranslucent
    >
      <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 88 }]}>
        {message ? (
          <Animated.View
            key={id}
            entering={FadeInDown.duration(220).springify().damping(16)}
            style={[
              styles.pill,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                boxShadow: shadow('md'),
              },
            ]}
          >
            <Pressable
              onPress={hide}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              style={styles.pressable}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              <Text variant="body" weight="600" color="textPrimary" numberOfLines={1} style={styles.label}>
                {message}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    maxWidth: '85%',
    borderWidth: 1,
    borderCurve: 'continuous',
    borderRadius: radius.pill,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  label: {
    flexShrink: 1,
  },
});
