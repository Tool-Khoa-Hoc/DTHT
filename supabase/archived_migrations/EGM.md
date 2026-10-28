# archived_migrations — Retired Supabase Migration Archive

## Overview

This directory holds SQL migrations that have been **retired from the active
migration chain**. Files here are archival records only: they sit outside
`supabase/migrations`, so the Supabase CLI never applies them and they are not
part of the ordered forward-only history.

Currently one file: `20260608111229_harden_access_payment_rpc.sql` (~16 KB).
It was a security hardening pass over three surfaces — exam access gating,
payment order transfer-code metadata, and RLS/function privilege cleanup — and
its exam-related half is now **dead code**: every `exam_*`,
`deleted_exam_tombstones` and `sync_logs` object it touches was dropped by
`../migrations/20260613000000_drop_exam_system.sql`. The payment and profile
helpers it defines (`order_transfer_code_from_uuid`, `set_order_transfer_code`)
survived and are still live.

Treat this file as documentation of *why* the live schema looks the way it
does. Do not re-apply it: re-running the `DROP POLICY` / `CREATE POLICY` blocks
against today's schema would recreate policies for tables that no longer exist
and fail.

## Interface

### Functions defined

| Signature | Kind | Notes |
| --- | --- | --- |
| `public.is_active_vip(p_user_id uuid) → boolean` | `SECURITY DEFINER`, `STABLE`, `search_path = public` | `EXISTS` over `profiles` where `is_vip = true` **and** `vip_expired_at > now()`. `EXECUTE` granted to `service_role` only. |
| `public.check_and_log_exam_access(p_exam_id text) → jsonb` | `SECURITY DEFINER`, `search_path = public, auth` | Derives the actor from `auth.uid()`; returns `{allowed, isRevisit, reason}`. `EXECUTE` to `authenticated`. |
| `public.check_and_log_exam_access(p_user_id uuid, p_exam_id text) → jsonb` | `SECURITY DEFINER` | Legacy-compat overload kept "while the API cache/client rollout settles". Rejects `p_user_id` that differs from `auth.uid()` unless the caller `is_admin`. |
| `public.order_transfer_code_from_uuid(p_id uuid) → text` | `IMMUTABLE`, `search_path = public` | `'DH' || upper(substr(<uuid without dashes>, 1, 12))`. `EXECUTE` to `service_role`. |
| `public.set_order_transfer_code() → trigger` | `SECURITY DEFINER`, `search_path = public` | `BEFORE` trigger body: defaults `NEW.id` to `gen_random_uuid()` and fills a blank `NEW.transfer_code`. `EXECUTE` to `service_role`. |

### Database objects touched

- `public.user_access_log` — read for revisit/quota checks, appended on first access.
- `public.orders` — backfilled `transfer_code`; unique index created.
- Policies recreated: `exam_keys` (`*_admin` set), `exam_subjects`, `school_scores`,
  `user_notes`, `deleted_exam_tombstones`, `sync_logs`, `orders`, `payment_logs`,
  `transactions`.
- Indexes: created `idx_orders_transfer_code_unique`,
  `idx_deleted_exam_tombstones_deleted_by`; dropped `idx_user_access_log_user_date`.

## Invariants

- **The browser never supplies identity.** Every entitlement decision derives
  the actor from `auth.uid()`; the two-argument overload exists only to reject a
  mismatched `p_user_id`, never to trust it.
- **Access precedence**: not-logged-in → deny; `profiles.role = 'admin'` →
  allow; active VIP → allow; exam already present in `user_access_log` for this
  user → allow as `isRevisit`; otherwise free tier of **3 distinct exams per
  calendar day** applies.
- **Free-tier window is `CURRENT_DATE` → `CURRENT_DATE + 1`** on
  `user_access_log.created_at`, i.e. server-local day boundaries, not UTC.
- **`transfer_code` is DB-generated and unique.** It is never accepted from the
  client; the trigger and the unique index together make it a stable payment
  reference (`DH…`).
- **Every `SECURITY DEFINER` function pins `search_path`.** No exception in this
  file.
- **Admin RPCs are granted to `authenticated` but gate internally** on
  `public.is_admin(auth.uid())`; the grant alone is not an authorization.
- Policy predicates use `(SELECT auth.uid())` / `(SELECT public.is_admin(...))`
  so Postgres evaluates them once per query (InitPlan) rather than per row.

## Side Effects

- **Writes**: `INSERT INTO public.user_access_log` (append-only daily quota
  ledger, `ON CONFLICT DO NOTHING`); `UPDATE public.orders` backfilling
  `transfer_code`; `CREATE UNIQUE INDEX` on `orders.transfer_code`.
- **Privilege changes**: `REVOKE ALL` / `GRANT EXECUTE` across
  `is_active_vip`, `check_and_log_exam_access` (both overloads),
  `order_transfer_code_from_uuid`, `set_order_transfer_code`; batch
  `REVOKE`/`GRANT` loops over exam/admin RPC name lists.
- **Schema churn**: `DROP POLICY` + `CREATE POLICY` on nine tables,
  `DROP INDEX`, `CREATE INDEX`. Several blocks are wrapped in
  `to_regclass(...) IS NOT NULL` guards so they no-op when the table is absent.
- **Error handling**: the quota RPC catches `WHEN OTHERS`, emits a `WARNING`,
  and returns `{allowed: false, reason: 'error'}` — it fails closed and never
  raises into the client.

## Status & Supersession

| Object family | Live today? | Superseded by |
| --- | --- | --- |
| `is_active_vip`, `order_transfer_code_from_uuid`, `set_order_transfer_code` | Yes | — (still referenced by `../migrations/20260326103000_auto_reconcile_vip_payment.sql`) |
| `check_and_log_exam_access` (both overloads) | No | Dropped with the exam subsystem (`../migrations/20260613000000_drop_exam_system.sql`) |
| `exam_keys` / `exam_subjects` / `deleted_exam_tombstones` / `sync_logs` policies | No | Tables dropped in the same migration |

## Verification

Documentation requires no test run. The repository-level checks apply to the
whole project (run from `E:\DTHT`):

- Run: `npm run lint`
- Run: `npm run build`

There is no `config.toml` in `../` (the `supabase` directory), so
`supabase db push` is **not** a valid command for this repo and must not be used
as a verification step. SQL in this directory is not applied by any in-repo
tooling.
