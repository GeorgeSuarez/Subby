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
import { StyleSheet, Switch, View } from 'react-native';
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
import { CURRENCIES } from '@/utils/constants';
import { impactLight, notifySuccess, selection } from '@/utils/haptics';
import { useAuthStore } from '@/store/useAuthStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { useUIStore } from '@/store/useUIStore';
import type { CurrencyCode } from '@/types/subscription';
import { FeatureBullet } from '@/features/paywall/components/FeatureBullet';
import {
  initialDraft,
  nextStep,
  prevStep,
  ONBOARDING_STEPS,
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
  reminders: {
    title: 'Renewal reminders',
    body: 'Get a notification before a subscription renews. You can change this anytime in Settings.',
  },
  pro: {
    title: 'Subby Pro',
    body: 'Go beyond the free tier — or skip for now and upgrade anytime from Settings.',
  },
} satisfies Record<OnboardingStep, { title: string; body: string }>;

type StepIconName = React.ComponentProps<typeof Ionicons>['name'];

const STEP_ICONS = {
  welcome: 'sparkles-outline',
  currency: 'cash-outline',
  reminders: 'notifications-outline',
  pro: 'star-outline',
} satisfies Record<OnboardingStep, StepIconName>;

/** Same pitch as the paywall — one source of truth per bullet. */
const PRO_BULLETS = [
  {
    icon: 'pie-chart-outline' as const,
    title: 'Category insights',
    desc: 'Breakdown + pie chart of spend by category',
  },
  {
    icon: 'wallet-outline' as const,
    title: 'Budget & forecast',
    desc: 'Monthly budget progress & forecast',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Advanced reminders',
    desc: '1 day / 3 days / 7 days before renewal',
  },
  {
    icon: 'infinite-outline' as const,
    title: 'Unlimited tracking',
    desc: 'Track more than 5 subscriptions',
  },
  {
    icon: 'gift-outline' as const,
    title: 'Trials nudges',
    desc: 'Push before trials convert',
  },
];

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
  const isPro = useEntitlementStore((s) => s.isPro);

  const isLast = nextStep(step) === null;
  const hasBack = prevStep(step) !== null;

  /** Apply nothing — record completion and enter the app. */
  const skip = useCallback(() => {
    if (userId !== null) completeOnboarding(userId);
    router.replace('/(tabs)');
  }, [completeOnboarding, router, userId]);

  /**
   * Advance one step; on the last step apply the draft through the existing
   * pref setters (they own the Supabase sync), mark completion, route home —
   * through the paywall on the pro step so buying is one tap away. Skipping
   * (top-right) lands in the app where Settings → Subby Pro sells later.
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
    if (store.remindersEnabled !== draft.remindersEnabled) {
      store.setRemindersEnabled(draft.remindersEnabled);
    }
    if (userId !== null) completeOnboarding(userId);
    if (!isPro) {
      router.replace('/(tabs)');
      router.push('/subscription/paywall');
      return;
    }
    void notifySuccess().then(() => router.replace('/(tabs)'));
  }, [completeOnboarding, draft, isPro, router, step, userId]);

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
        entering={FadeInDown.duration(160)} // quieter for Quiet Ledger
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

        {step === 'reminders' ? (
          <RemindersToggle
            value={draft.remindersEnabled}
            onChange={(remindersEnabled) =>
              setDraft((d) => ({ ...d, remindersEnabled }))
            }
          />
        ) : null}

        {step === 'pro' ? (
          <View style={styles.proBullets}>
            {isPro ? (
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={colors.positive}
              />
            ) : (
              PRO_BULLETS.map((b) => (
                <FeatureBullet
                  key={b.title}
                  icon={b.icon}
                  title={b.title}
                  desc={b.desc}
                />
              ))
            )}
          </View>
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
          style={styles.primaryCta}
        >
          {isLast ? (isPro ? 'Finish' : 'Upgrade to Pro') : 'Continue'}
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

/** Step order for the progress indicator — straight from the machine. */
const ONBOARDING_ORDER = ONBOARDING_STEPS;

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
  proBullets: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
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
