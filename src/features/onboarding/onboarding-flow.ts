/**
 * Getting Started flow — the first-run wizard's state machine.
 *
 * Answers "which step may this user see, and can they move on" for the
 * onboarding screen. Purely derived: inputs are session facts (from
 * `useAuthStore`), store prefs, and the raw form draft. No React, no router,
 * no RN — the interface is the test surface.
 *
 * The wizard is a linear sequence of steps ending in a synthetic `done`
 * marker; `nextStep` returns null past the end so the screen can commit and
 * route to the tabs. The final step pitches Subby Pro (budget is a Pro
 * feature, so there is no budget step here) and routes to the paywall —
 * skipping lands in the app where Settings → Subby Pro sells later.
 *
 * The show-gate (`shouldShowOnboarding`) is deliberately conservative: it
 * only fires for a signed-in account with zero synced subscriptions whose
 * user id hasn't completed the flow before — upgrading users with data are
 * never interrupted.
 */

import type { CurrencyCode } from '@/types/subscription';

export type OnboardingStep = 'welcome' | 'currency' | 'reminders' | 'pro';

/** Ordered interactive steps; `done` is reached via nextStep(pro) === null. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'welcome',
  'currency',
  'reminders',
  'pro',
] as const;

/** The wizard draft — mirrors what each step edits, in raw form-field shape. */
export interface OnboardingDraft {
  currency: CurrencyCode;
  remindersEnabled: boolean;
}

/** Step forward; null when the current step is the last one. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  if (i === -1 || i === ONBOARDING_STEPS.length - 1) return null;
  // SAFETY: i is a valid index strictly below length-1, so i+1 is in bounds.
  return ONBOARDING_STEPS[i + 1] ?? null;
}

/** Step back; null from the first step (nothing before welcome). */
export function prevStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  if (i <= 0) return null;
  // SAFETY: i > 0 here, so i-1 is a valid index.
  return ONBOARDING_STEPS[i - 1] ?? null;
}

/** Defaults for a brand-new account. */
export function initialDraft(currency: CurrencyCode): OnboardingDraft {
  return { currency, remindersEnabled: true };
}

/** Inputs for the show-gate, all cheaply available at render time. */
export interface ShowGateInput {
  isSignedIn: boolean;
  /** Supabase user id — completions are keyed per account. */
  userId: string | null;
  completedUserIds: readonly string[];
  /** Count of synced subscriptions visible to this account. */
  subscriptionCount: number;
}

/**
 * True only for a signed-in, never-onboarded account with zero subscriptions.
 * Existing accounts with data are untouched by app updates; a queued-only
 * (offline) change leaves local state empty, matching the sync coordinator's
 * queue-invisible design.
 */
export function shouldShowOnboarding(input: ShowGateInput): boolean {
  if (!input.isSignedIn) return false;
  if (input.userId === null) return false;
  if (input.completedUserIds.includes(input.userId)) return false;
  // Exactly zero — any other value counts as content so a miscomputed or
  // negative count can never trigger an unwanted interruption.
  return input.subscriptionCount === 0;
}
