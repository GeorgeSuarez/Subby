/**
 * Sheet — native-backed modal sheet.
 *
 * Wraps React Native's `Modal`, which presents a platform-native modal
 * (formSheet on iOS 16+, dialog on Android). Skill rule `ui-native-modals`:
 * prefer_NATIVE_ modal presentation over JS-only bottom sheets.
 *
 * For the Subby project, add/edit flows will be presented as route-style
 * modals in Step 5 (expo-router `presentation: 'formSheet'`). This component
 * is kept for ad-hoc modal usage (filters, confirmation dialogs) where we
 * need imperative control.
 *
 * Skill rule `animation-gpu-properties`: enter/exit animations use opacity
 * only — RN Modal's built-in `animationType="fade"` already does this.
 */

import { type ReactNode } from 'react';
import { Modal, StyleSheet, View, Pressable } from 'react-native';

import { useTheme } from '@/design/theme';
import { radius, spacing, type Palette } from '@/design/tokens';

export interface SheetProps {
  /** Whether the sheet is visible. Derived state from parent (skill §6.1). */
  visible: boolean;
  /** Called when the user requests dismissal (backdrop tap or close button). */
  onDismiss: () => void;
  children: ReactNode;
  /** Backdrop opacity token (defaults to 'scrim'). */
  backdropTone?: keyof Palette;
  /** Container max width on tablet (defaults to layout.content width). */
  maxWidth?: number;
}

export function Sheet({
  visible,
  onDismiss,
  children,
  backdropTone = 'scrim',
}: SheetProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      {/* Backdrop: taps anywhere dismiss. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        style={[styles.backdrop, { backgroundColor: colors[backdropTone] }]}
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          // Stop taps on the sheet itself from dismissing.
          onStartShouldSetResponder={() => true}
        >
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderCurve: 'continuous',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});