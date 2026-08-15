/**
 * Shared row action sheet helpers.
 *
 * Skill rule `ui-menus` / `ui-native-modals`: destructive and contextual row
 * actions use NATIVE dialogs (iOS UIAlertController / Android material dialog)
 * — never JS dropdowns. Shared by the subscriptions list and the dashboard's
 * renewals + trials cards so every row's menu stays identical.
 */

import { Alert } from 'react-native';

export interface RowActionTarget {
  name: string;
  archived: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/** Open a native action sheet (Edit / Archive / Delete / Cancel). */
export function openRowActions(target: RowActionTarget): void {
  const archiveLabel = target.archived ? 'Unarchive' : 'Archive';
  Alert.alert(
    target.name,
    undefined,
    [
      { text: 'Edit', onPress: target.onEdit },
      { text: archiveLabel, onPress: target.onArchive },
      { text: 'Delete', style: 'destructive', onPress: target.onDelete },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

/** Two-step delete: confirm via a second native dialog before removing. */
export function confirmDelete(name: string, onConfirm: () => void): void {
  Alert.alert(
    `Delete ${name}?`,
    'This cannot be undone.',
    [
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
      { text: 'Cancel', style: 'cancel' },
    ],
    { cancelable: true },
  );
}
