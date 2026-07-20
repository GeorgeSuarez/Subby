/**
 * AboutSection — footer card with app name, version, license attribution.
 * Pure static content, no store dependencies.
 */

import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';

export function AboutSection() {
  const { colors } = useTheme();
  return (
    <Card padding={spacing.lg} elevation="flat">
      <Text variant="headline" weight="600" color="textPrimary">About</Text>
      <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
      <View style={styles.row}>
        <Text variant="caption" color="textSecondary">App</Text>
        <Text variant="caption" weight="600" color="textPrimary">Subby</Text>
      </View>
      <View style={styles.row}>
        <Text variant="caption" color="textSecondary">Version</Text>
        <Text variant="caption" weight="600" color="textPrimary">1.0.0</Text>
      </View>
      <View style={styles.row}>
        <Text variant="caption" color="textSecondary">Built with</Text>
        <Text variant="caption" weight="600" color="textPrimary">Expo · React Native</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
});