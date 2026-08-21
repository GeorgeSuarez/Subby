/**
 * iap-webhook — receive App Store Server Notifications V2 + Play RTDN and
 * upsert `user_entitlements`.
 *
 * This is the server-driven revocation/renewal path. The `verify-purchase`
 * function is primary (client-initiated after purchase); this webhook handles
 * async events: DID_RENEW, EXPIRED, DID_FAIL_TO_RENEW, REFUND, REVOKE,
 * SUBSCRIPTION_EXPIRED, etc.
 *
 * Security (v1):
 *  - App Store: JWS signature verification requires Apple certs + APPLE_KEY_ID.
 *    When not configured, we fall back to checking a shared secret header
 *    `x-webhook-secret` against `IAP_WEBHOOK_SECRET` so the endpoint is not
 *    fully open in dev.
 *  - Play: Pub/Sub push verification similarly falls back to shared secret.
 * In production, replace the fallback with real JWS / Pub/Sub signature
 * verification.
 *
 * Body shapes:
 *  App Store V2 (signedPayload is JWS): { signedPayload: string, ... }
 *  Play RTDN (Pub/Sub): { message: { data: base64(JSON) } }  where JSON is
 *  { subscriptionNotification: { purchaseToken, subscriptionId, notificationType } }
 *
 * Mapping: notificationType / subtype → is_pro / expires_at.
 *  For v1 we revoke on REFUND/REVOKE/EXPIRED and renew on DID_RENEW/SUBSCRIBED.
 *
 * IMPORTANT: The webhook must map the Store transaction to a Supabase user_id
 * via `appAccountToken` / `obfuscatedAccountId` (set by client on requestPurchase).
 * In the App Store JWS that token is `appAccountToken` inside `transactionInfo`.
 * In Play RTDN it is `obfuscatedExternalAccountId` on the purchase. We parse it
 * from the decoded payload and use it as user_id when present; otherwise we
 * attempt to read `userId` / `appAccountToken` from the JSON body directly
 * (useful for manual testing).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

function b64Decode(s: string): string {
  try {
    return atob(s);
  } catch {
    // URL-safe base64 fallback
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return atob(b64);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });

  // Shared-secret gate when real JWS verification is not configured.
  const expected = Deno.env.get('IAP_WEBHOOK_SECRET');
  if (expected) {
    const got = req.headers.get('x-webhook-secret') ?? '';
    // Also allow Authorization: Bearer <secret> for manual curl tests.
    const auth = req.headers.get('Authorization') ?? '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (got !== expected && bearer !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true }), {
      headers: corsHeaders,
      status: 200,
    });
  }

  // Extract userId + event from either App Store or Play shape, or direct test shape.
  let userId: string | null =
    (body.userId as string) ??
    (body.appAccountToken as string) ??
    (body.app_account_token as string) ??
    null;
  let productId: string | null =
    (body.productId as string) ?? (body.product_id as string) ?? null;
  let event: string = String(
    body.event ?? body.notificationType ?? body.type ?? '',
  ).toUpperCase();
  let isPro: boolean | null = null;
  let expiresAt: number | null | undefined;

  // App Store V2: signedPayload is JWS (header.payload.signature). Decode payload.
  const signedPayload = body.signedPayload as string | undefined;
  if (
    signedPayload &&
    typeof signedPayload === 'string' &&
    signedPayload.includes('.')
  ) {
    try {
      const parts = signedPayload.split('.');
      const payloadJson = b64Decode(parts[1] ?? '');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      // Inside payload.data.signedTransactionInfo etc. — best-effort extract.
      const data = (payload.data as Record<string, unknown>) ?? payload;
      const txnInfoB64 =
        (data.signedTransactionInfo as string) ??
        (payload.signedTransactionInfo as string);
      if (
        txnInfoB64 &&
        typeof txnInfoB64 === 'string' &&
        txnInfoB64.includes('.')
      ) {
        const txnPayload = JSON.parse(
          b64Decode(txnInfoB64.split('.')[1] ?? ''),
        ) as Record<string, unknown>;
        userId = (txnPayload.appAccountToken as string) ?? userId;
        productId = (txnPayload.productId as string) ?? productId;
        // expiresDate in StoreKit is ms since epoch
        if (typeof txnPayload.expiresDate === 'number')
          expiresAt = Number(txnPayload.expiresDate);
      }
      event = String(
        (payload.notificationType as string) ??
          (payload.subtype as string) ??
          event,
      ).toUpperCase();
    } catch {
      // fall through to direct body parsing
    }
  }

  // Play RTDN: message.data is base64 JSON
  const msg = body.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.data === 'string') {
    try {
      const decoded = JSON.parse(b64Decode(msg.data as string)) as Record<
        string,
        unknown
      >;
      const subNotif =
        (decoded.subscriptionNotification as Record<string, unknown>) ??
        decoded;
      productId = (subNotif.subscriptionId as string) ?? productId;
      // notificationType: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 4=PURCHASED, 5=ON_HOLD, 6=IN_GRACE, 7=RESTARTED, 8=PRICE_CHANGE, 12=REVOKED, 13=EXPIRED
      const nt = Number(
        subNotif.notificationType ?? subNotif.notification_type ?? 0,
      );
      if ([2, 4, 7].includes(nt)) event = 'DID_RENEW';
      else if ([3, 12, 13].includes(nt)) event = 'EXPIRED';
      else event = String(nt);
      // obfuscatedExternalAccountId is user mapping; if present in decoded, use it
      // (Play publisher API would need to fetch it from purchaseToken; we read from body fallback in dev)
      userId = (decoded.obfuscatedExternalAccountId as string) ?? userId;
    } catch {
      // ignore
    }
  }

  if (!userId) {
    // No user mapping — cannot securely upsert. Acknowledge but do nothing
    // so the Store doesn't retry indefinitely; log for operator.
    console.log(
      '[iap-webhook] no userId mapping in payload',
      JSON.stringify(body).slice(0, 1000),
    );
    return new Response(JSON.stringify({ ok: true, note: 'no userId' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Event → isPro / expiresAt
  const renewEvents = new Set([
    'DID_RENEW',
    'SUBSCRIBED',
    'RENEWED',
    'DID_RECOVER',
    'RECOVERED',
    'RESUBSCRIBE',
  ]);
  const expireEvents = new Set([
    'EXPIRED',
    'REFUND',
    'REVOKE',
    'REVOKED',
    'CANCELED',
    'DID_FAIL_TO_RENEW',
  ]);
  // Also treat numeric Play types already mapped above.

  if (
    renewEvents.has(event) ||
    event === '4' ||
    event === '2' ||
    event === '7'
  ) {
    isPro = true;
    // renew extends expiry; if we didn't parse expiresAt, set +30/365 days
    if (expiresAt === undefined) {
      const pid = productId ?? 'subby_pro_monthly';
      if (pid === 'subby_pro_yearly')
        expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
      else if (pid === 'subby_pro_lifetime') expiresAt = null;
      else expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }
  } else if (
    expireEvents.has(event) ||
    event === '3' ||
    event === '12' ||
    event === '13'
  ) {
    isPro = false;
    expiresAt = null;
    productId = productId ?? null;
  } else if (event) {
    // Unknown event — log and ack (don't upsert)
    console.log('[iap-webhook] unknown event', event, 'product', productId);
    return new Response(JSON.stringify({ ok: true, note: 'unknown event' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (isPro === null) {
    return new Response(JSON.stringify({ ok: true, note: 'no action' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await admin.from('user_entitlements').upsert(
    {
      user_id: userId,
      is_pro: isPro,
      product_id: isPro ? productId : null,
      expires_at: isPro ? expiresAt : null,
      entitlement_source: isPro
        ? productId === 'subby_pro_lifetime'
          ? 'lifetime'
          : event.includes('PLAY')
            ? 'play_store'
            : 'app_store'
        : null,
      updated_at: Date.now(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.log('[iap-webhook] upsert error', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, isPro, productId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
