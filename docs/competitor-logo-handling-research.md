# How competitors handle brand logos — research

> Researched 2026-09-03. Question: how do competitors like Rocket Money show
> other brands' logos without building their own icon library?

## TL;DR

They don't fetch brand icons at all. Competitors with bank sync get logos
**as a field on every transaction from their data aggregator** (Plaid/MX/
Finicity) — `logo_url`, a hosted 100×100 PNG, riding alongside the merchant
name. The aggregator owns the logo library, the licensing, and the
name→merchant matching. Apps just render the URL, with a category icon or
monogram fallback when it's null, and (Monarch) a user override in Settings.

Subby has no bank sync (manual entry, Supabase source of truth), so there is
no aggregator to inherit logos from. The analogue is the hybrid in
`docs/subscription-icons-research.md`: bundled icons + favicon fallback +
user-chosen icon — which is exactly the manual-entry version of the same
three-layer pattern competitors get from Plaid/MX.

## Rocket Money: Plaid supplies the logos

- Bank/credit-card linking goes through **Plaid** ("your sensitive information
  is sent directly to Plaid, our trusted account connection partner… Plaid
  receives a secure, encrypted token. That token is what allows Rocket Money
  to view your transaction data").
  (`https://www.rocketmoney.com/security`)
- The help center describes the linker only as "our third-party linking
  provider" (Plaid named on the security page; Akoya for some Fidelity
  accounts).
  (`https://help.rocketmoney.com/en/articles/934328-connecting-bank-accounts-and-credit-cards`;
  `https://help.rocketmoney.com/en/articles/931156-i-can-t-find-my-bank` —
  "We rely on our secure linking provider, Plaid")
- Every Plaid transaction carries enrichment including **`logo_url`: "The URL
  of a logo associated with this transaction, if available. The logo will
  always be a 100×100 pixel PNG file"**, plus per-counterparty `logo_url`,
  `merchant_name`, `website`, and a stable `merchant_entity_id`.
  (`https://plaid.com/docs/api/products/transactions/`; example hosts:
  `plaid-merchant-logos.plaid.com`, `plaid-counterparty-logos.plaid.com`)
- So Rocket Money's subscription/merchant rows render `logo_url` when present
  and fall back when null (checks/transfers have no meaningful merchant —
  Plaid returns null there). No brand-icon fetching, no per-brand deals: logo
  coverage = Plaid's merchant-library coverage, licensed through the Plaid
  contract.

## Monarch Money: three aggregators + user overrides

- Monarch connects via **three data providers — Plaid, Finicity (Mastercard),
  and MX** — and lets users switch providers per account when one fails.
  (`https://help.monarch.com/hc/en-us/articles/33707613533972-Understanding-Data-Providers-and-Connections`;
  `https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch`)
- Same mechanism as Rocket Money: whichever aggregator syncs the account
  supplies merchant names + logos with the transactions.
- Notable extra: **Settings > Merchants — "Update merchant names and icons"**,
  i.e. the user can fix a wrong/missing logo themselves. This is the escape
  hatch for aggregator gaps, and it's the one piece directly portable to Subby
  (the Add/Edit form already has `IconColorPicker`; a name→icon override is
  the same idea).
- YNAB (Plaid + MX) and Copilot (Plaid + proprietary aggregator) work the same
  way; aggregator choice is about connection reliability, logos come along for
  free.
  (`https://earnifyhub.com/finance-money/ynab-vs-monarch-vs-copilot-2026`)

## MX: the other logo pipeline (and a subscription detector)

- MX merchants expose **`logo_url`: "The URL for a 100px x 100px logo for the
  merchant"**, e.g. `https://content.mx.com/logos/merchants/MCH-….png`,
  reachable via `merchant_guid` on any enhanced transaction or the
  `GET /merchants/{merchant_guid}` endpoint.
  (`https://docs.mx.com/api-reference/platform-api/reference/transactions`,
  "Merchant Fields"; `…/reference/read-merchant`)
- Directly relevant to a subscription app: MX's repeating-transaction detection
  flags **`repeating_transaction_type: SUBSCRIPTION`** (vs BILL/INCOME) —
  competitors with MX don't just get logos, they get *subscription detection*.
  (`https://docs.mx.com/api-reference/platform-api-2026/reference/read-transaction`)
- Plaid's equivalent is the standalone **Enrich** product (US/CA): send any
  transaction descriptions, get back merchant names, `logo_url`s, and category
  icons (`plaid-category-icons.plaid.com/PFC_*.png`) — usable even on
  non-Plaid-synced data.
  (`https://plaid.com/docs/enrich/`)

## What this means for Subby

| Competitor layer | Aggregator version | Subby (manual entry) analogue |
|---|---|---|
| Logo per merchant | `logo_url` on each transaction | Bundled Simple Icons + favicon fallback (`docs/subscription-icons-research.md`) |
| Coverage gaps | `logo_url: null` (checks, transfers, unknown) | Ionicon + brand-color tile (today's `Avatar` fallback) |
| Wrong logo fix | Monarch Settings > Merchants override | Extend `IconColorPicker` → icon + color choice per subscription (already have the form seam) |
| Subscription detection | MX `SUBSCRIPTION` repeating type / Plaid categorization | Manual `cycle` + `nextRenewal` (today); revisit if bank sync ever lands |

If Subby ever adds bank sync, logo strategy flips to the competitor model:
pick Plaid (or MX) and logos arrive with the transactions — plus Plaid Enrich
could backfill merchant names/logos for manually entered subs without a full
sync integration. Until then, don't chase per-brand licensing: aggregators
license their logo libraries centrally, which is precisely the cost competitors
pay them for.
