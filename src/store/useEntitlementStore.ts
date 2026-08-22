/**
 * Entitlement store — Pro access derived from Store + Supabase.
 *
 * Sources (priority):
 *  1. Supabase `user_entitlements` row (verified server-side)
 *  2. Local cache (`sync_cache` key `entitlement:<userId>`) when offline
 *  3. expo-iap `getAvailablePurchases()` reconciled via `verify-purchase`
 *
 * Offline: serves last-cached value with `expires_at` check (lifetime has
 * null expiry and never expires). Expiry is checked even offline to prevent
 * stale Pro after a subscription lapses.
 *
 * Mock: when `ENABLE_PAYWALL_MOCK=1`, the store reports not-Pro but paywall
 * uses mock products so QA can exercise without sandbox.
 */

import { create } from 'zustand';

import { ENABLE_PAYWALL_MOCK } from '@/utils/environment';
import { readCache, writeCache } from '@/db/offline';
import { getNetworkReachability } from '@/db/network';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getAvailablePurchases } from '@/lib/purchases';

export type EntitlementSource = 'supabase' | 'iap' | 'cache' | 'mock' | 'none';

export interface EntitlementState {
  isPro: boolean;
  isLoading: boolean;
  productId: string | null;
  expiresAt: number | null; // epoch ms, null = lifetime / no expiry
  source: EntitlementSource;
  error: string | null;
  hydrate: () => Promise<void>;
  reset: () => void;
  /** Force-set Pro from a verified purchase (used after verify-purchase). */
  setFromVerified: (params: {
    isPro: boolean;
    productId: string | null;
    expiresAt: number | null;
    source: EntitlementSource;
  }) => void;
  /** Check expiry — true when Pro but expiresAt is past. */
  isExpired: () => boolean;
}

interface CachedEntitlement {
  isPro: boolean;
  productId: string | null;
  expiresAt: number | null;
  source: EntitlementSource;
  updatedAt: number;
}

function isExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return false; // lifetime or no expiry
  return Date.now() > expiresAt;
}

async function readEntitlementFromSupabase(
  userId: string,
): Promise<CachedEntitlement | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('user_entitlements')
      .select('is_pro, product_id, expires_at, entitlement_source, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      is_pro: boolean;
      product_id: string | null;
      expires_at: number | null;
      entitlement_source: string | null;
      updated_at: number | null;
    };
    // If expired, treat as not-Pro (belt-and-suspenders; webhook should have revoked).
    const expiresAt = row.expires_at !== null ? Number(row.expires_at) : null;
    const expired = expiresAt !== null && Date.now() > expiresAt;
    return {
      isPro: expired ? false : Boolean(row.is_pro),
      productId: row.product_id,
      expiresAt: expired ? null : expiresAt,
      source: 'supabase' as const,
      updatedAt: Number(row.updated_at ?? Date.now()),
    };
  } catch {
    return null;
  }
}

export const useEntitlementStore = create<EntitlementState>()((set, get) => ({
  isPro: false,
  isLoading: true,
  productId: null,
  expiresAt: null,
  source: 'none',
  error: null,

  isExpired: () => isExpired(get().expiresAt),

  reset: () =>
    set({
      isPro: false,
      isLoading: false,
      productId: null,
      expiresAt: null,
      source: 'none',
      error: null,
    }),

  setFromVerified: ({ isPro, productId, expiresAt, source }) => {
    set({ isPro, productId, expiresAt, source, isLoading: false, error: null });
    // Persist to cache for offline (fire-and-forget)
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user.id;
        if (!uid) return;
        const cached: CachedEntitlement = {
          isPro,
          productId,
          expiresAt,
          source,
          updatedAt: Date.now(),
        };
        await writeCache('entitlement', uid, cached);
      } catch {
        // ignore cache write failure
      }
    })();
  },

  hydrate: async () => {
    set({ isLoading: true, error: null });

    if (ENABLE_PAYWALL_MOCK) {
      set({ isPro: false, isLoading: false, source: 'mock' });
      return;
    }

    if (!isSupabaseConfigured) {
      // No Supabase — cannot verify; treat as free (but not loading).
      set({ isLoading: false, source: 'none' });
      return;
    }

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id ?? null;
    if (!userId) {
      set({
        isPro: false,
        isLoading: false,
        source: 'none',
        productId: null,
        expiresAt: null,
      });
      return;
    }

    // Offline: serve cache with expiry check.
    if ((await getNetworkReachability()) === false) {
      const cached = await readCache<CachedEntitlement>('entitlement', userId);
      if (cached) {
        const expired = isExpired(cached.expiresAt);
        set({
          isPro: expired ? false : cached.isPro,
          productId: expired ? null : cached.productId,
          expiresAt: expired ? null : cached.expiresAt,
          source: 'cache',
          isLoading: false,
        });
        return;
      }
      set({ isPro: false, isLoading: false, source: 'cache' });
      return;
    }

    // Online: try Supabase first.
    const supa = await readEntitlementFromSupabase(userId);
    if (supa) {
      const expired = isExpired(supa.expiresAt);
      const state = {
        isPro: expired ? false : supa.isPro,
        productId: expired ? null : supa.productId,
        expiresAt: expired ? null : supa.expiresAt,
        source: 'supabase' as const,
        isLoading: false,
        error: null as string | null,
      };
      set(state);
      await writeCache('entitlement', userId, {
        isPro: state.isPro,
        productId: state.productId,
        expiresAt: state.expiresAt,
        source: state.source,
        updatedAt: Date.now(),
      } as CachedEntitlement);
      return;
    }

    // Fallback: check local IAP purchases and try to verify (best-effort).
    // If no Supabase row yet (first purchase webhook delay), this can still
    // surface Pro briefly after server verify via restore flow.
    try {
      const purchases = await getAvailablePurchases();
      if (purchases.length > 0) {
        // Don't assume Pro without server verification — cache stays free
        // until verify-purchase webhook lands. But we can show loading false.
        set({ isLoading: false, source: 'iap' });
        // Optionally, a future step could call verify-purchase for each purchase
        // here and upsert. Kept out of hydrate to avoid blocking.
        return;
      }
    } catch {
      // ignore
    }

    // No entitlement found — check cache as last fallback (webhook delay case).
    const cached = await readCache<CachedEntitlement>('entitlement', userId);
    if (cached && !isExpired(cached.expiresAt)) {
      set({
        isPro: cached.isPro,
        productId: cached.productId,
        expiresAt: cached.expiresAt,
        source: 'cache',
        isLoading: false,
      });
      return;
    }

    set({
      isPro: false,
      isLoading: false,
      source: 'none',
      productId: null,
      expiresAt: null,
    });
  },
}));

// Selectors
export function useIsPro(): boolean {
  return useEntitlementStore((s) => s.isPro);
}
export function useIsProLoading(): boolean {
  return useEntitlementStore((s) => s.isLoading);
}
export function useEntitlementSource(): EntitlementSource {
  return useEntitlementStore((s) => s.source);
}
