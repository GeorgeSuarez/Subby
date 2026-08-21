import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/components';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';

interface FeatureBulletProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}

export function FeatureBullet({ icon, title, desc }: FeatureBulletProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <Text variant="body" weight="600" color="textPrimary">
          {title}
        </Text>
        <Text variant="caption" color="textSecondary">
          {desc}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
