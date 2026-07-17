/**
 * Card — compound surface container.
 *
 *   <Card>
 *     <Card.Header><Text variant="headline">Renewals</Text></Card.Header>
 *     <Card.Body padding="lg">{children}</Card.Body>
 *   </Card>
 *
 * Skill rules followed:
 *  - `ui-styling`: `borderCurve: 'continuous'`, `box-shadow` CSS syntax,
 *    `gap` (not margin on children).
 *  - compound components over polymorphic props (skill §10.1).
 */

import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '@/design/theme';
import { layout, spacing, type SpacingValue } from '@/design/tokens';

type Elevation = 'flat' | 'low' | 'high';

export interface CardProps extends ComponentProps<typeof View> {
  /** Elevation preset. 'flat' = no shadow, 'low' = md, 'high' = lg. */
  elevation?: Elevation;
  /** Padding (in dp) from the spacing scale. Defaults to `spacing.lg` (16). */
  padding?: SpacingValue;
}

const elevationName = { flat: undefined, low: 'md', high: 'lg' } as const;

export const Card = forwardRef<View, CardProps>(function Card(
  { elevation = 'low', padding = spacing.lg, style, children, ...rest },
  ref,
) {
  const { colors, shadow } = useTheme();
  const shadowName = elevationName[elevation];

  return (
    <View
      ref={ref}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: layout.cardRadius,
          padding,
        },
        shadowName ? { boxShadow: shadow(shadowName) } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
});

function CardHeader({ children, style, ...rest }: ComponentProps<typeof View>) {
  return (
    <View style={[styles.header, style]} {...rest}>
      {children}
    </View>
  );
}

function CardBody({ children, style, ...rest }: ComponentProps<typeof View> & { children?: ReactNode }) {
  return (
    <View style={[styles.body, style]} {...rest}>
      {children}
    </View>
  );
}

function CardFooter({ children, style, ...rest }: ComponentProps<typeof View>) {
  return (
    <View style={[styles.footer, style]} {...rest}>
      {children}
    </View>
  );
}

// Attach sub-components for the compound API.
const CardNamespace = Object.assign(Card, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export default CardNamespace;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  body: {
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 0,
  },
});