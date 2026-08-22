/**
 * usePaywall — product loading + purchase + restore.
 *
 * Separated from the screen so it can be unit-tested without expo-router.
 * No analytics in v1 (deferred per feedback); only __DEV__ console logs.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/useAuthStore';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import {
  getProducts,
  requestPurchase,
  restorePurchases,
  type IAPProduct,
} from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { PRO_PRODUCT_IDS, type ProProductId } from '@/utils/limits';

type Status =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'purchasing'
  | 'restoring'
  | 'error';

export function usePaywall() {
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [selected, setSelected] = useState<ProProductId>('subby_pro_yearly');
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  const hydrate = useEntitlementStore((s) => s.hydrate);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const prods = await getProducts(PRO_PRODUCT_IDS);
      setProducts(prods);
      setStatus('ready');
      if (__DEV__)
        console.log(
          '[paywall] products',
          prods.map((p) => p.id),
        );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProduct = products.find((p) => p.id === selected) ?? null;

  const purchase = useCallback(async () => {
    setStatus('purchasing');
    setError(null);
    try {
      const userId = useAuthStore.getState().userId ?? undefined;
      await requestPurchase(selected, userId);
      // Result comes via purchaseUpdatedListener in _layout; wait a moment then hydrate.
      setTimeout(() => void hydrate(), 1500);
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
      if (__DEV__) console.log('[paywall] purchase failed', e);
    }
  }, [selected, hydrate]);

  const restore = useCallback(async () => {
    setStatus('restoring');
    setError(null);
    try {
      await restorePurchases();
      // After restore, try verify-purchase for each available purchase
      const { getAvailablePurchases } = await import('@/lib/purchases');
      const available = await getAvailablePurchases();
      for (const p of available) {
        const pid = String(
          (p as unknown as Record<string, unknown>).productId ??
            (p as unknown as Record<string, unknown>).id ??
            '',
        );
        if (!pid) continue;
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) continue;
        await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              productId: pid,
              platform: (p as unknown as Record<string, unknown>).platform,
            }),
          },
        );
      }
      await hydrate();
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus('error');
    }
  }, [hydrate]);

  return {
    products,
    selected,
    setSelected,
    selectedProduct,
    status,
    error,
    purchase,
    restore,
    reload: load,
  };
}
