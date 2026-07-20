/**
 * DetailActionBar — final-row action stack: Edit (primary), Archive (ghost),
 * Delete (danger).
 *
 * Skill rule `ui-pressable`: all buttons come from the design system's Button
 * primitive which is Pressable-based (never Touchable).
 *
 * Skill rule `ui-menus` / `ui-native-modals`: destructive confirmations use
 * `Alert.alert` (the platform-native dialog) — no JS modal.
 *
 * Skill rule `react-state-dispatcher`: callbacks are owned by the parent and
 * stable (`useCallback`) so the bar never re-renders on parent state churn.
 * This component owns zero state.
 *
 * Skill rule `list-performance-callbacks`: equivalent principle — handlers are
 * stable references passed downward.
 */

import { StyleSheet, View, Alert } from 'react-native';

import { Button } from '@/design/components';
import { spacing } from '@/design/tokens';
import type { Subscription } from '@/types/subscription';
import { impactLight, notifyWarning, selection } from '@/utils/haptics';

export interface DetailActionBarProps {
  sub: Subscription;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function DetailActionBar({ sub, onEdit, onArchive, onDelete }: DetailActionBarProps) {
  return (
    <View style={styles.container}>
      <Button
        onPress={() => { void impactLight(); onEdit(); }}
        variant="primary"
        size="lg"
      >
        Edit subscription
      </Button>

      <Button
        onPress={() => { void selection(); onArchive(); }}
        variant="ghost"
        size="lg"
      >
        {sub.archived ? 'Unarchive' : 'Archive'}
      </Button>

      <Button
        onPress={() => {
          void notifyWarning();
          confirmDelete(sub.name, onDelete);
        }}
        variant="danger"
        size="lg"
      >
        Delete
      </Button>
    </View>
  );
}

/** Native destructive-action confirm bridge (skill `ui-menus`). */
export function confirmDelete(name: string, onConfirm: () => void): void {
  Alert.alert(
    `Delete ${name}?`,
    'This permanently removes the subscription from your data. This cannot be undone.',
    [
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
});