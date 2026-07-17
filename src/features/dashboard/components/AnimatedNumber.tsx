/**
 * AnimatedNumber — count-up helper that bridges a Reanimated shared value
 * into a React state string for display.
 *
 * Skill rules followed:
 *  - §3.1: only animates a numeric shared value (no layout/DOM writes per
 *    frame on the layout side; we serialize the value to a React state string
 *    which commits at most ~60Hz).
 *  - §3.2: side-effect text rendering (Reanimated can't animate text content
 *    directly) uses `useAnimatedReaction` + `runOnJS` — this is the correct
 *    tool for side-effects, not `useDerivedValue` (which is for derivations).
 *  - §8.2: uses `.get()`/`.set()` for React Compiler compatibility.
 *  - `react-state-dispatcher`: state updater is a pure function of the
 *    incoming value — no state read in the callback.
 *
 * Usage:
 *   <AnimatedNumber value={monthly} format={(n) => formatCurrency(n, 'USD')} />
 */

import { useCallback, useEffect, useState } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  withDelay,
} from 'react-native-reanimated';

export interface AnimatedNumberProps {
  value: number;
  /** Format the current numeric value into a display string. */
  format: (n: number) => string;
  /** Animation duration in ms. Default 800. */
  duration?: number;
  /** Delay before the count-up starts (ms). Default 0. */
  delayMs?: number;
}

export function AnimatedNumber({
  value,
  format,
  duration = 800,
  delayMs = 0,
}: AnimatedNumberProps) {
  const sv = useSharedValue(0);
  const [display, setDisplay] = useState<string>(format(0));

  // Stable updater so it can be safely listed in effect dependencies.
  const push = useCallback((n: number) => {
    setDisplay(() => format(n));
  }, [format]);

  // Drive the animation whenever `value` changes. `withTiming` is a no-op when
  // the current value is already at the target, so we don't need to short-circuit.
  useEffect(() => {
    sv.set(withDelay(delayMs, withTiming(value, { duration })));
  }, [value, duration, delayMs, sv]);

  // Bridge shared-value → JS via an animated reaction (side-effect channel).
  useAnimatedReaction(
    () => sv.get(),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(push)(current);
      }
    },
    [push],
  );

  return <>{display}</>;
}