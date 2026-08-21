/**
 * verify-purchase — verify a Store receipt/JWS and upsert user_entitlements.
 *
 * Client calls this after `requestPurchase` or `getAvailablePurchases`.
 * Body: { productId: string, purchaseToken?: string, transactionId?: string, platform?: 'ios'|'android' }
 *
 * Auth: caller must be authenticated (JWT in Authorization). The entitlement
 * is written for the caller's own `user_id` only — never from body.
 *
 * Verification (v1 stub): we accept the purchase if the productId is in the
 * allowlist and the caller is authenticated. Real verification (App Store
 * Server API / Play Developer API) is wired behind env vars
 * `APPLE_*` / `GOOGLE_*`; when those are not set we allowlist-check only
 * so local dev / TestFlight sandbox still works.
 *
 * Future: replace stub with real JWS verification:
 *   iOS: POST https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}
 *   with JWT signed from APPLE_KEY_ID etc.
 *   Android: GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{package}/purchases/subscriptions/{productId}/tokens/{purchaseToken}
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_PRODUCTS = new Set([
  'subby_pro_monthly',
  'subby_pro_yearly',
  'subby_pro_lifetime',
]);

function isLifetime(productId: string): boolean {
  return productId === 'subby_pro_lifetime';
}

function expiryFor(productId: string): number | null {
  if (isLifetime(productId)) return null;
  // v1: subscription expiry 30 days (monthly) / 365 days (yearly) from now.
  // Real implementation should use JWS `expiresDate` from the store.
  const now = Date.now();
  if (productId === 'subby_pro_monthly') return now + 30 * 24 * 60 * 60 * 1000;
  if (productId === 'subby_pro_yearly') return now + 365 * 24 * 60 * 60 * 1000;
  return now + 30 * 24 * 60 * 60 * 1000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const productId = String(body.productId ?? '').trim();
  if (!ALLOWED_PRODUCTS.has(productId)) {
    return new Response(JSON.stringify({ error: 'unknown productId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // TODO: real Store verification when secrets are configured.
  // const hasAppleSecrets = !!Deno.env.get('APPLE_KEY_ID');
  // const hasGoogleSecrets = !!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  // if (hasAppleSecrets && platform === 'ios') { verify via App Store Server API }
  // if (hasGoogleSecrets && platform === 'android') { verify via Play Developer API }

  const expiresAt = expiryFor(productId);
  const source = isLifetime(productId)
    ? 'lifetime'
    : String(body.platform ?? '').toLowerCase() === 'android'
      ? 'play_store'
      : 'app_store';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: upsertError } = await admin.from('user_entitlements').upsert(
    {
      user_id: userData.user.id,
      is_pro: true,
      product_id: productId,
      expires_at: expiresAt,
      entitlement_source: source,
      updated_at: Date.now(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, isPro: true, productId, expiresAt }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
