/**
 * OnboardingScreen — the first-run Getting Started wizard.
 *
 * One step per screen from the pure machine in `onboarding-flow.ts`: welcome
 * → currency → budget (optional) → reminders → commit. The screen owns no
 * domain logic — it renders the current step, edits a local draft, and on
 * finish commits through the existing `useUIStore` actions (which sync to
 * Supabase user_prefs via the sync coordinator) and marks the flow complete
 * per user id before routing to the tabs.
 *
 * Skip is always reachable (top-right) and applies nothing — just records
 * completion so the gate never re-triggers for this account.
 *
 * Skill rules:
 *  - `animation-gpu-properties`: step transitions animate opacity + translate
 *    only (FadeInDown), keyed remount per step.
 *  - `react-state-minimize`: draft + step are the only local state; prefs
 *    live in the store the moment they're committed.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/design/components/Button';
import { Chip } from '@/design/components/Chip';
import { Surface } from '@/design/components/Surface';
import { Text } from '@/design/components/Text';
import { useTheme } from '@/design/theme';
import { radius, spacing } from '@/design/tokens';
import { CURRENCIES, currencyMeta } from '@/utils/constants';
import { impactLight, notifySuccess, selection } from '@/utils/haptics';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import type { CurrencyCode } from '@/types/subscription';
import {
  canAdvance,
  initialDraft,
  nextStep,
  prevStep,
  validateBudget,
  type OnboardingDraft,
  type OnboardingStep,
} from './onboarding-flow';

/** Per-step headline + supporting copy (satisfies keeps literal inference). */
const STEP_COPY = {
  welcome: {
    title: 'Welcome to Subby',
    body: 'See every subscription you pay for in one place — what it costs, when it renews, and what it adds up to.',
  },
  currency: {
    title: 'Pick your currency',
    body: 'Amounts are shown in this currency across the app.',
  },
  budget: {
    title: 'Set a monthly budget',
    body: 'Optional — Subby warns you when subscriptions pass this line.',
  },
  reminders: {
    title: 'Renewal reminders',
    body: 'Get a notification before a subscription renews. You can change this anytime in Settings.',
  },
} satisfies Record<OnboardingStep, { title: string; body: string }>;

type StepIconName = React.ComponentProps<typeof Ionicons>['name'];

const STEP_ICONS = {
  welcome: 'sparkles-outline',
  currency: 'cash-outline',
  budget: 'speedometer-outline',
  reminders: 'notifications-outline',
} satisfies Record<OnboardingStep, StepIconName>;

export function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  // Seed from the store's current prefs (defaults for a fresh account).
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    initialDraft(useUIStore.getState().currency),
  );

  const completeOnboarding = useUIStore((s) => s.completeOnboarding);
  const userId = useAuthStore((s) => s.userId);

  const isLast = nextStep(step) === null;
  const hasBack = prevStep(step) !== null;
  const canContinue = canAdvance(step, draft);

  /** Apply nothing — record completion and enter the app. */
  const skip = useCallback(() => {
    if (userId !== null) completeOnboarding(userId);
    router.replace('/(tabs)');
  }, [completeOnboarding, router, userId]);

  /**
   * Advance one step; on the last step apply the draft through the existing
   * pref setters (they own the Supabase sync), mark completion, route home.
   */
  const continueFlow = useCallback(() => {
    const target = nextStep(step);
    if (target !== null) {
      void impactLight();
      setStep(target);
      return;
    }
    const store = useUIStore.getState();
    if (store.currency !== draft.currency) store.setCurrency(draft.currency);
    const budget = validateBudget(draft.budget);
    if (budget.ok && budget.value !== store.budget) {
      store.setBudget(budget.value);
    }
    if (store.remindersEnabled !== draft.remindersEnabled) {
      store.setRemindersEnabled(draft.remindersEnabled);
    }
    if (userId !== null) completeOnboarding(userId);
    void notifySuccess().then(() => router.replace('/(tabs)'));
  }, [completeOnboarding, draft, router, step, userId]);

  return (
    <Surface background="surface" style={styles.root}>
      {/* Top bar — Skip sits apart so there's always an out of the flow. */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topSpacer} />
        <ProgressDots step={step} />
        <Button variant="ghost" size="sm" onPress={skip} style={styles.skip}>
          Skip
        </Button>
      </View>

      {/* Keyed remount per step — FadeInDown slides each screen in. */}
      <Animated.View
        key={step}
        entering={FadeInDown.duration(280)}
        style={styles.content}
      >
        <View
          style={[styles.iconRing, { borderColor: colors.accentSoftStrong }]}
        >
          <Ionicons name={STEP_ICONS[step]} size={40} color={colors.accent} />
        </View>
        <Text variant="title" weight="700" align="center">
          {STEP_COPY[step].title}
        </Text>
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={styles.bodyCopy}
        >
          {STEP_COPY[step].body}
        </Text>

        {step === 'currency' ? (
          <CurrencyPicker
            value={draft.currency}
            onSelect={(currency) => {
              void selection();
              setDraft((d) => ({ ...d, currency }));
            }}
          />
        ) : null}

        {step === 'budget' ? (
          <BudgetField
            value={draft.budget}
            currency={draft.currency}
            invalid={!canContinue}
            onChangeText={(budget) => setDraft((d) => ({ ...d, budget }))}
          />
        ) : null}

        {step === 'reminders' ? (
          <RemindersToggle
            value={draft.remindersEnabled}
            onChange={(remindersEnabled) =>
              setDraft((d) => ({ ...d, remindersEnabled }))
            }
          />
        ) : null}
      </Animated.View>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        {hasBack ? (
          <Button
            variant="ghost"
            size="lg"
            onPress={() => {
              void impactLight();
              const back = prevStep(step);
              if (back !== null) setStep(back);
            }}
          >
            Back
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="lg"
          onPress={continueFlow}
          disabled={!canContinue}
          style={styles.primaryCta}
        >
          {isLast ? 'Finish' : 'Continue'}
        </Button>
      </View>
    </Surface>
  );
}

function ProgressDots({ step }: { step: OnboardingStep }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.dots}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${ONBOARDING_ORDER.indexOf(step) + 1} of ${ONBOARDING_ORDER.length}`}
    >
      {ONBOARDING_ORDER.map((s, i) => (
        <View
          key={s}
          style={[
            styles.dot,
            {
              backgroundColor:
                i <= ONBOARDING_ORDER.indexOf(step)
                  ? colors.accent
                  : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

function CurrencyPicker({
  value,
  onSelect,
}: {
  value: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {CURRENCIES.map((c) => (
        <Chip
          key={c.code}
          selected={value === c.code}
          onPress={() => onSelect(c.code)}
        >
          {`${c.symbol} ${c.code}`}
        </Chip>
      ))}
    </View>
  );
}

function BudgetField({
  value,
  currency,
  invalid,
  onChangeText,
}: {
  value: string;
  currency: CurrencyCode;
  invalid: boolean;
  onChangeText: (t: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surfaceHigher,
            borderColor: invalid ? colors.negative : colors.border,
          },
        ]}
      >
        <Text variant="headline" color="textSecondary">
          {currencyMeta(currency).symbol}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary }]}
          accessibilityLabel="Monthly budget"
        />
      </View>
      {invalid ? (
        <Text variant="caption" color="negative">
          Enter a valid non-negative amount
        </Text>
      ) : null}
    </View>
  );
}

function RemindersToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.toggleCard, { backgroundColor: colors.surfaceHigher }]}
    >
      <View style={styles.toggleCopy}>
        <Text variant="body" weight="600">
          Notify me before renewals
        </Text>
        <Text variant="caption" color="textSecondary">
          {value
            ? 'On — scheduled per subscription'
            : 'Off — silent tracking only'}
        </Text>
      </View>
      {/* Native switch with Settings' RemindersSection track/thumb colors. */}
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.surfaceElevated}
        ios_backgroundColor={colors.border}
        accessibilityRole="switch"
        accessibilityLabel="Renewal reminders"
      />
    </View>
  );
}

/** Step order for the progress indicator (mirrors onboarding-flow's steps). */
const ONBOARDING_ORDER: readonly OnboardingStep[] = [
  'welcome',
  'currency',
  'budget',
  'reminders',
] as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topSpacer: {
    width: 64,
  },
  skip: {
    minWidth: 64,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  bodyCopy: {
    maxWidth: 300,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  fieldWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 200,
  },
  input: {
    fontSize: 24,
    fontWeight: '600',
    padding: 0,
    minWidth: 100,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  primaryCta: {
    flex: 1,
  },
});
