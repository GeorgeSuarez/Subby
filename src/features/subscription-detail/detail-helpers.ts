/**
 * Pure helpers for the subscription detail screen.
 *
 * No React / RN imports so this module is fully Jest-testable in plain Node.
 * Skill rules:
 *  - `react-state-minimize`: derived during render — every value here is a pure
 *    function of the subscription prop.
 *  - `js-hoist-intl`: formatter instances live in utils/format.
 */

import type { Subscription } from '@/types/subscription';
import {
  daysBetween,
  daysUntilRenewal,
  monthlyEquivalent,
  nextRenewalAfter,
  parseDate,
  todayUTC,
  yearlyEquivalent,
} from '@/utils/billing';

/** Tone that maps to semantic palette tokens (mirrors Badge's tone union). */
export type RenewalTone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface RenewalStatus {
  /** Days until the next renewal; negative if overdue. */
  days: number;
  /** ISO date string for the next renewal. */
  nextISO: string;
  /** Tone for the status badge. */
  tone: RenewalTone;
  /** Short label for the status badge (e.g. "Tomorrow", "In 3 days", "Overdue"). */
  label: string;
}

/** Bucket-by-tone thresholds (in days). */
export function renewalToneFor(days: number): RenewalTone {
  if (days < 0) return 'negative';
  if (days <= 3) return 'warning';
  if (days <= 30) return 'positive';
  return 'neutral';
}

/** Build the structured renewal status from a subscription. */
export function getRenewalStatus(sub: Subscription): RenewalStatus {
  const days = daysUntilRenewal(sub);
  const nextISO = nextRenewalAfter(sub);
  return {
    days,
    nextISO,
    tone: renewalToneFor(days),
    label: statusLabel(days),
  };
}

function statusLabel(days: number): string {
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `In ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.floor(days / 30);
  return `In ${months} ${months === 1 ? 'month' : 'months'}`;
}

/** Derived effective monthly cost (already exposed via billing.ts). */
export function getMonthlyCost(sub: Subscription): number {
  return monthlyEquivalent(sub);
}

/** Derived effective yearly cost. */
export function getYearlyCost(sub: Subscription): number {
  return yearlyEquivalent(sub);
}

// --- Trial status ------------------------------------------------------------

export interface TrialStatus {
  /** Days until the trial ends; negative if it already ended. */
  days: number;
  /** ISO date of the trial end. */
  endISO: string;
  tone: RenewalTone;
  label: string;
}

/** Trial countdown — null when the subscription has no trial end date. */
export function getTrialStatus(sub: Subscription): TrialStatus | null {
  if (!sub.trialEnds) return null;
  const end = parseDate(sub.trialEnds);
  const days = daysBetween(todayUTC(), end);
  return {
    days,
    endISO: sub.trialEnds,
    tone: days < 0 ? 'negative' : days <= 3 ? 'warning' : 'positive',
    label: trialLabel(days),
  };
}

function trialLabel(days: number): string {
  if (days < 0) return 'Trial ended';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  return `Ends in ${days} days`;
}
