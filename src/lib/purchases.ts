/**
 * IAP wrapper around `expo-iap` (OpenIAP / Open Store).
 *
 * This module is the only place that imports `expo-iap` so the rest of the
 * app stays testable and Expo-Go-safe (the native module throws in Expo Go).
 * Every export guards `Platform.OS === 'web'` and falls back to a mock when
 * `ENABLE_PAYWALL_MOCK` is on.
 *
 * API mapping (expo-iap v5 / OpenIAP):
 *   initConnection()                     → must be called once on mount
 *   fetchProducts({ skus, type })        → products/prices (type: 'subs'|'in-app'|'all')
 *   requestPurchase({ request, type })   → event-based (listen via purchaseUpdatedListener)
 *   finishTransaction({ purchase, isConsumable })
 *   getAvailablePurchases()
 *   restorePurchases()
 *   purchaseUpdatedListener / purchaseErrorListener
 *
 * Product IDs are defined in `src/utils/limits.ts` (`PRO_PRODUCT_IDS`).
 */

import { Platform } from 'react-native';

import { ENABLE_PAYWALL_MOCK } from '@/utils/environment';
import { PRO_PRODUCT_IDS } from '@/utils/limits';

// ---------------------------------------------------------------------------
// Types (re-export friendly)
// ---------------------------------------------------------------------------

export interface IAPPurchase {
  id?: string;
  productId: string;
  transactionId?: string;
  transactionDate?: number;
  purchaseToken?: string;
  // platform-specific JWS / receipt string when available
  transactionReceipt?: string;
  /** Store that issued the purchase ("IOS" | "ANDROID"), when expo-iap reports it. */
  platform?: string;
  // expo-iap Purchase type is open; keep index signature
  [key: string]: unknown;
}

export interface IAPProduct {
  id: string;
  productId?: string;
  title: string;
  description: string;
  price: string; // localized, e.g. "$2.99"
  currency?: string;
  type: 'subs' | 'in-app' | string;
  // subscription period when available
  subscriptionPeriod?: string;
  introductoryPrice?: string | null;
  // raw expo-iap product passthrough
  raw?: unknown;
}

export interface PurchaseError {
  code: string;
  message: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lazy expo-iap loader (keeps Jest + Expo Go from crashing on import)
// ---------------------------------------------------------------------------

type ExpoIapModule = typeof import('expo-iap');

let expoIap: ExpoIapModule | null = null;
let loadFailed = false;

function getExpoIap(): ExpoIapModule | null {
  if (Platform.OS === 'web') return null;
  if (ENABLE_PAYWALL_MOCK) return null;
  if (expoIap) return expoIap;
  if (loadFailed) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoIap = require('expo-iap') as ExpoIapModule;
    return expoIap;
  } catch {
    loadFailed = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mock products (used when ENABLE_PAYWALL_MOCK=1 or expo-iap unavailable)
// ---------------------------------------------------------------------------

const MOCK_PRODUCTS: IAPProduct[] = [
  {
    id: 'subby_pro_monthly',
    productId: 'subby_pro_monthly',
    title: 'Subby Pro Monthly',
    description: 'Unlock all Pro features, billed monthly.',
    price: '$2.99',
    currency: 'USD',
    type: 'subs',
  },
  {
    id: 'subby_pro_yearly',
    productId: 'subby_pro_yearly',
    title: 'Subby Pro Yearly',
    description: 'Best value — save 44%, 7-day free trial.',
    price: '$19.99',
    currency: 'USD',
    type: 'subs',
    introductoryPrice: '7-day free trial',
  },
  {
    id: 'subby_pro_lifetime',
    productId: 'subby_pro_lifetime',
    title: 'Subby Pro Lifetime',
    description: 'Pay once, Pro forever.',
    price: '$49.99',
    currency: 'USD',
    type: 'in-app',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialize the IAP connection. Call once on app mount. */
export async function initIAP(): Promise<void> {
  const mod = getExpoIap();
  if (!mod) return;
  try {
    await mod.initConnection();
  } catch (e) {
    if (__DEV__) console.log('[purchases] initConnection failed', e);
  }
}

/** End the IAP connection (call on unmount if needed). */
export async function endIAP(): Promise<void> {
  const mod = getExpoIap();
  if (!mod) return;
  try {
    // Some expo-iap versions expose endConnection; guard.
    const maybe = mod as unknown as { endConnection?: () => Promise<void> };
    if (maybe.endConnection) await maybe.endConnection();
  } catch {
    // ignore
  }
}

/**
 * Fetch products for the given SKUs. Returns localized products or mocks
 * when in mock mode / store unavailable.
 */
export async function getProducts(
  skus: readonly string[] = PRO_PRODUCT_IDS,
): Promise<IAPProduct[]> {
  if (ENABLE_PAYWALL_MOCK)
    return MOCK_PRODUCTS.filter((p) => skus.includes(p.id));
  const mod = getExpoIap();
  if (!mod) return MOCK_PRODUCTS.filter((p) => skus.includes(p.id));

  try {
    // expo-iap v5 uses fetchProducts({ skus, type })
    // We need both subs and in-app (lifetime). Use 'all'.
    const result = await mod.fetchProducts({
      skus: [...skus],
      type: 'all',
    });
    // result is Product[] / ProductSubscription[] with varying shapes; normalize.
    const arr = Array.isArray(result) ? result : [];
    if (arr.length === 0)
      return MOCK_PRODUCTS.filter((p) => skus.includes(p.id));
    return arr.map((p: unknown) => normalizeProduct(p));
  } catch (e) {
    if (__DEV__)
      console.log('[purchases] fetchProducts failed, using mocks', e);
    return MOCK_PRODUCTS.filter((p) => skus.includes(p.id));
  }
}

/**
 * Request a purchase. Result is delivered via `purchaseUpdatedListener` — this
 * promise only indicates the purchase sheet was shown (or threw synchronously).
 *
 * `appAccountToken` is set to the Supabase userId so the server can map
 * `verify-purchase` → `user_entitlements.user_id`.
 */
export async function requestPurchase(
  productId: string,
  appAccountToken?: string,
): Promise<void> {
  if (ENABLE_PAYWALL_MOCK) {
    if (__DEV__) console.log('[purchases mock] requestPurchase', productId);
    return;
  }
  const mod = getExpoIap();
  if (!mod) throw new Error('In-app purchases not available on this device.');

  const isLifetime = productId === 'subby_pro_lifetime';
  const type = isLifetime ? 'in-app' : 'subs';

  // OpenIAP shape: { request: { apple: { sku }, google: { skus: [] } }, type }
  // Some builds accept appAccountToken via request.apple.appAccountToken
  const requestPayload: unknown = {
    request: {
      apple: {
        sku: productId,
        ...(appAccountToken ? { appAccountToken } : null),
      },
      google: {
        skus: [productId],
        // For subs, google needs subscriptionOffers; if we don't have offerToken,
        // let the store pick the default offer. expo-iap handles it when omitted.
        ...(appAccountToken ? { obfuscatedAccountId: appAccountToken } : null),
      },
    },
    type,
  };

  await mod.requestPurchase(requestPayload as never);
}

/** Purchases that have not been finished (active subs + non-consumables). */
export async function getAvailablePurchases(): Promise<IAPPurchase[]> {
  if (ENABLE_PAYWALL_MOCK) return [];
  const mod = getExpoIap();
  if (!mod) return [];
  try {
    const purchases = await mod.getAvailablePurchases();
    return (purchases as unknown as IAPPurchase[]) ?? [];
  } catch (e) {
    if (__DEV__) console.log('[purchases] getAvailablePurchases failed', e);
    return [];
  }
}

/** Trigger a store restore (iOS asks for credentials, Android queries purchases). */
export async function restorePurchases(): Promise<void> {
  if (ENABLE_PAYWALL_MOCK) return;
  const mod = getExpoIap();
  if (!mod) return;
  try {
    await mod.restorePurchases();
  } catch (e) {
    if (__DEV__) console.log('[purchases] restorePurchases failed', e);
  }
}

/**
 * Finish a transaction after server verification. Must be called within 3 days
 * on Android or Google auto-refunds.
 */
export async function finishTransaction(
  purchase: IAPPurchase,
  isConsumable = false,
): Promise<void> {
  if (ENABLE_PAYWALL_MOCK) return;
  const mod = getExpoIap();
  if (!mod) return;
  try {
    await mod.finishTransaction({
      purchase: purchase as never,
      isConsumable,
    });
  } catch (e) {
    if (__DEV__) console.log('[purchases] finishTransaction failed', e);
    throw e as Error;
  }
}

// ---------------------------------------------------------------------------
// Listeners (thin wrappers)
// ---------------------------------------------------------------------------

export function addPurchaseUpdatedListener(
  cb: (purchase: IAPPurchase) => void,
): { remove: () => void } {
  const mod = getExpoIap();
  if (!mod) return { remove: () => {} };
  return mod.purchaseUpdatedListener((p) => cb(p as unknown as IAPPurchase));
}

export function addPurchaseErrorListener(cb: (error: PurchaseError) => void): {
  remove: () => void;
} {
  const mod = getExpoIap();
  if (!mod) return { remove: () => {} };
  return mod.purchaseErrorListener((e) => cb(e as unknown as PurchaseError));
}

// ---------------------------------------------------------------------------
// Server verification (used by the _layout listener and paywall restore)
// ---------------------------------------------------------------------------

/** One purchase the verify-purchase edge function verified successfully.
 * Unverifiable purchases (no id, no session, failed request) are omitted. */
export interface VerifiedPurchase {
  productId: string;
  isPro: boolean;
  expiresAt: number | null;
}

export async function verifyPurchases(
  purchases: IAPPurchase[],
): Promise<VerifiedPurchase[]> {
  const valid = purchases.filter(
    (p): p is IAPPurchase & { productId: string } =>
      typeof p.productId === 'string' && p.productId !== '',
  );
  if (valid.length === 0) return [];
  // Lazy import to avoid cycle
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!token || !url) return [];

  const results = await Promise.all(
    valid.map(async (purchase): Promise<VerifiedPurchase | null> => {
      try {
        const res = await fetch(`${url}/functions/v1/verify-purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            transactionId: purchase.transactionId,
            platform: purchase.platform,
          }),
        });
        const body: unknown = await res.json().catch(() => null);
        if (typeof body !== 'object' || body === null || !('ok' in body))
          return null;
        // SAFETY: verify-purchase edge-function contract — a reply carrying
        // ok:true is the server's verdict for this purchase and carries the
        // entitlement fields below.
        const json = body as {
          ok?: boolean;
          isPro?: boolean;
          productId?: string;
          expiresAt?: number | null;
        };
        if (json.ok !== true) return null;
        return {
          productId: json.productId ?? purchase.productId,
          isPro: Boolean(json.isPro),
          expiresAt: json.expiresAt ?? null,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is VerifiedPurchase => r !== null);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeProduct(raw: unknown): IAPProduct {
  const r = raw as Record<string, unknown>;
  const id =
    (r.productId as string) ??
    (r.id as string) ??
    (r.sku as string) ??
    String(r.id ?? 'unknown');
  // expo-iap product shapes vary; best-effort normalize.
  const price =
    (r.displayPrice as string) ??
    (r.localizedPrice as string) ??
    (r.price as string) ??
    '';
  const title = (r.title as string) ?? (r.displayName as string) ?? id;
  const description = (r.description as string) ?? '';
  const currency = (r.currency as string) ?? undefined;
  const type = (r.type as string) ?? 'subs';

  return {
    id,
    productId: id,
    title,
    description,
    price: price || (r as { priceString?: string }).priceString || '',
    currency,
    type,
    raw,
  };
}
