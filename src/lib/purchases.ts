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

// Type-only import: erased at build time, so the native module stays lazily
// loaded via require() below.
import type { RequestPurchaseProps } from 'expo-iap';
import { ENABLE_PAYWALL_MOCK } from '@/utils/environment';
import { PRO_PRODUCT_IDS } from '@/utils/limits';

// ---------------------------------------------------------------------------
// Types (re-export friendly)
// ---------------------------------------------------------------------------

export interface IAPPurchase {
  id?: string | null;
  productId: string;
  transactionId?: string | null;
  transactionDate?: number | null;
  purchaseToken?: string | null;
  // platform-specific JWS / receipt string when available
  transactionReceipt?: string | null;
  /** Store that issued the purchase ("IOS" | "ANDROID"), when expo-iap reports it. */
  platform?: string | null;
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
}

/** Cancellation handle returned by the listener wrappers. */
export interface IAPSubscription {
  remove: () => void;
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
    // SAFETY: require() returns `any`; the module shape is pinned by the
    // ExpoIapModule type above and exercised by initIAP on first use.
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
    await mod.endConnection();
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
    return arr.map((p) => normalizeProduct(p));
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
  const requestPayload = {
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
  } satisfies RequestPurchaseProps;

  await mod.requestPurchase(requestPayload);
}

/** Purchases that have not been finished (active subs + non-consumables). */
export async function getAvailablePurchases(): Promise<IAPPurchase[]> {
  if (ENABLE_PAYWALL_MOCK) return [];
  const mod = getExpoIap();
  if (!mod) return [];
  try {
    const purchases = await mod.getAvailablePurchases();
    return purchases ?? [];
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
    // SAFETY: our IAPPurchase wrapper is structurally the store Purchase we
    // received from expo-iap listeners; finishTransaction re-validates the
    // fields natively before acknowledging.
    await mod.finishTransaction({
      purchase: purchase as never,
      isConsumable,
    });
  } catch (e) {
    if (__DEV__) console.log('[purchases] finishTransaction failed', e);
    throw e; // preserve the original error for callers
  }
}

// ---------------------------------------------------------------------------
// Listeners (thin wrappers)
// ---------------------------------------------------------------------------

export function addPurchaseUpdatedListener(
  cb: (purchase: IAPPurchase) => void,
): IAPSubscription {
  const mod = getExpoIap();
  if (!mod) return { remove: () => {} };
  // expo-iap Purchase is assignable field-for-field to our open IAPPurchase
  // contract (all fields optional or compatible).
  return mod.purchaseUpdatedListener((p) => cb(p));
}

export function addPurchaseErrorListener(
  cb: (error: PurchaseError) => void,
): IAPSubscription {
  const mod = getExpoIap();
  if (!mod) return { remove: () => {} };
  // SAFETY: expo-iap types code as its own ErrorCode enum; normalize it to a
  // plain string so callers get our PurchaseError contract.
  return mod.purchaseErrorListener((e) =>
    cb({ code: String(e.code), message: e.message }),
  );
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
  const valid = purchases.filter((p) => p.productId !== '');
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
        // SAFETY: verify-purchase edge-function contract — a reply carrying
        // ok:true is the server's verdict for this purchase and carries the
        // entitlement fields below. Any other shape (error JSON, null) fails
        // the ok !== true check below, so untrusted payloads stay inert.
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          isPro?: boolean;
          productId?: string;
          expiresAt?: number | null;
        } | null;
        if (json?.ok !== true) return null;
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

/** Keys normalizeProduct reads off an expo-iap / OpenIAP product payload.
 * Everything is optional because shapes vary across stores and versions;
 * missing keys fall back below (id 'unknown', empty price). */
interface RawProduct {
  productId?: string | null;
  id?: string | null;
  sku?: string | null;
  displayPrice?: string | null;
  localizedPrice?: string | null;
  price?: string | number | null;
  priceString?: string | null;
  title?: string | null;
  displayName?: string | null;
  description?: string | null;
  currency?: string | null;
  type?: string | null;
}

function normalizeProduct(raw: RawProduct): IAPProduct {
  const r = raw;
  const id = String(r.productId ?? r.id ?? r.sku ?? 'unknown');
  // expo-iap product shapes vary; best-effort normalize.
  const price =
    r.displayPrice ??
    r.localizedPrice ??
    (r.price != null ? String(r.price) : '');
  const title = r.title ?? r.displayName ?? id;
  const description = r.description ?? '';
  const currency = r.currency ?? undefined;
  const type = r.type ?? 'subs';

  return {
    id,
    productId: id,
    title,
    description,
    price: price || r.priceString || '',
    currency,
    type,
    raw,
  };
}
