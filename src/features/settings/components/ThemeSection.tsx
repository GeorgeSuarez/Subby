/**
 * ThemeSection — System / Light / Dark SegmentedControl.
 *
 * Skill rules followed:
 *  - `react-state-minimize`: preference is read from the persisted theme store;
 *    no local state. Active scheme is derived for display only.
 *  - `react-state-dispatcher`: the setter comes straight from the store.
 *  - `list-performance-callbacks`: onSelect is `useCallback`-memoized.
 */

import { useCallback } from 'react';

import { Card, SegmentedControl, Text } from '@/design/components';
import { useColorMode, useThemeStore } from '@/design/theme';
import { type ThemePreference } from '@/design/theme-resolve';
import { spacing } from '@/design/tokens';
import { selection } from '@/utils/haptics';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function ThemeSection() {
  const colorMode = useColorMode();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const resolved = preference ?? 'system';
  const onSelect = useCallback(
    (i: number) => {
      void selection();
      setPreference(PREFERENCES[i] ?? 'system');
    },
    [setPreference],
  );

  return (
    <Card padding={spacing.lg} elevation="low">
      <Card.Header>
        <Text variant="headline" weight="600" color="textPrimary">
          Theme
        </Text>
        <Text variant="caption" color="textSecondary">
          Active scheme: {colorMode}
        </Text>
      </Card.Header>

      <SegmentedControl
        segments={['System', 'Light', 'Dark']}
        selectedIndex={PREFERENCES.indexOf(resolved)}
        onSelect={onSelect}
      />
    </Card>
  );
}
