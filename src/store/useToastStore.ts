/**
 * Toast store — transient in-app notifications.
 *
 * Holds a single message + a nonce so repeated identical messages re-trigger
 * the entrance animation. `show` auto-hides after `TOAST_DURATION_MS`; a
 * pending timer is cancelled when a new toast replaces the current one.
 *
 * Skill rules:
 *  - `react-state-minimize`: the store holds only the current toast facts;
 *    presentation (colors, layout) lives in the Toast component.
 *  - `react-state-dispatcher`: `show`/`hide` are the only mutators.
 */

import { create } from 'zustand';

const TOAST_DURATION_MS = 2200;

interface ToastState {
  /** Nonce — changes every show so the same message re-animates. */
  id: number;
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>()((set) => ({
  id: 0,
  message: null,
  show: (message) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ id: Date.now(), message });
    hideTimer = setTimeout(() => set({ message: null }), TOAST_DURATION_MS);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ message: null });
  },
}));

/** Convenience — fire a toast from anywhere (event handlers, store actions). */
export function toast(message: string): void {
  useToastStore.getState().show(message);
}
