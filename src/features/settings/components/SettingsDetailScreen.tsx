/**
 * SettingsDetailScreen — shared shell for every Settings drill-down screen.
 *
 * The route files under `src/app/settings/` stay thin (no logic, no styles):
 * each one renders this shell around its existing section component.
 *
 * Skill rules:
 *  - `ui-safe-area-scroll`: ScrollView uses `contentInsetAdjustmentBehavior`
 *    so the native stack header's safe area is honored automatically.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Surface } from '@/design/components/Surface';
import { spacing } from '@/design/tokens';

export interface SettingsDetailScreenProps {
  children: ReactNode;
}

export function SettingsDetailScreen({ children }: SettingsDetailScreenProps) {
  return (
    <Surface background="surface" style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
});
