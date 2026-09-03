/**
 * ListRow — a single row optimized for FlashList.
 *
 * Skill rules:
 *  - `list-performance-item-memo`: wraps in `React.memo'; re-renders only when
 *    primitive props change (skill §2.5).
 *  - `list-performance-item-expensive`: receives only primitives as props and
 *    derives visuals internally. No hooks beyond theme (skill §2.3).
 *  - `list-performance-inline-objects`: static styles hoisted to module scope;
 *    dynamic colors derived inside the component using the palette (skill §2.1).
 *  - `ui-pressable`: Pressable only, with `pressed` opacity feedback.
 *
 * Designed to take PRIMITIVES from the parent's renderItem. The parent passes
 * exactly what's needed (no full subscription object).
 */

import { memo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Avatar } from '@/design/components/Avatar';
import { Text, type TextColor } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { spacing } from '@/design/tokens';

export interface ListRowProps extends Omit<
  PressableProps,
  'style' | 'children' | 'onPress' | 'onLongPress'
> {
  /** Primary label (e.g. subscription name). */
  title: string;
  /** Optional secondary line (e.g. category, cycle). */
  subtitle?: string;
  /** Right-side detail (e.g. amount + renewal date). Passed as a primitive string. */
  trailingTitle?: string;
  /** Optional sub-detail below the trailing title. */
  trailingSubtitle?: string;
  /** Override the trailing subtitle color token (e.g. urgency tinting). */
  trailingSubtitleColor?: TextColor;
  /** Avatar source URL, or undefined to use `icon`. */
  avatarSource?: string;
  /** Ionicons glyph name when no avatar URL is supplied. */
  icon?: string;
  /** Background — palette token or raw hex (brand color). */
  avatarBackground?: string;
  /** Icon color override — palette token or raw hex. */
  avatarIconColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Optional leading badge chip rendered before the title. */
  leading?: ReactNode;
  /**
   * Optional row id. When provided alongside `onPressWithId`/`onLongPressWithId`,
   * a single callback instance can be reused for all rows in the list (skill
   * `list-performance-callbacks`), preserving `memo()` effectiveness.
   */
  id?: string;
  /** Stable press handler invoked with the row's `id`. Omit to disable press. */
  onPressWithId?: (id: string) => void;
  /** Stable long-press handler invoked with the row's `id` (skill `ui-menus`). */
  onLongPressWithId?: (id: string) => void;
  /** Long-press threshold in ms. Default 400. */
  delayLongPress?: number;
}

function ListRowInner({
  title,
  subtitle,
  trailingTitle,
  trailingSubtitle,
  trailingSubtitleColor = 'textSecondary',
  avatarSource,
  icon = 'Cube',
  avatarBackground = 'surfaceHigher',
  avatarIconColor,
  leading,
  id,
  onPressWithId,
  onLongPressWithId,
  delayLongPress,
  disabled,
  style,
  ...rest
}: ListRowProps) {
  const { colors } = useTheme();

  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.row,
    pressed ? { backgroundColor: colors.surfaceHigher } : null,
    disabled ? { opacity: 0.5 } : null,
    style,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPressWithId && id ? () => onPressWithId(id) : undefined}
      onLongPress={
        onLongPressWithId && id ? () => onLongPressWithId(id) : undefined
      }
      delayLongPress={delayLongPress ?? 400}
      style={pressableStyle}
      {...rest}
    >
      <Avatar
        source={avatarSource}
        icon={icon}
        backgroundColor={avatarBackground}
        iconColor={avatarIconColor}
        size="md"
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {leading}
          <Text
            variant="body"
            weight="600"
            color="textPrimary"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {(trailingTitle ?? trailingSubtitle) ? (
        <View style={styles.trailing}>
          {trailingTitle ? (
            <Text
              variant="body"
              weight="600"
              color="textPrimary"
              align="right"
              numberOfLines={1}
            >
              {trailingTitle}
            </Text>
          ) : null}
          {trailingSubtitle ? (
            <Text
              variant="caption"
              color={trailingSubtitleColor}
              align="right"
              numberOfLines={1}
            >
              {trailingSubtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export const ListRow = memo(ListRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  body: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
  },
});
