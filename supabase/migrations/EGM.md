# migrations — Supabase Schema & DDL Contract Surface

## Overview

This directory is the **authoritative ordered DDL history** for the Supabase
Postgres project backing the DTHT SPA (`tram_hs_sv`). It contains **69**
forward-only migration files, timestamp-prefixed, spanning
**2026-03-09 → 2026-10-22**.

Three facts shape everything below:

1. **It is not a from-scratch schema source.** The core tables — `profiles`,
   `documents`, `subjects`, `semesters`, `school_scores`, `user_notes` — were
   created outside this chain (dashboard / early setup). Migrations `ALTER`,
   harden, and index them; they never `CREATE` them. A fresh database built from
   these files alone will not match production.
2. **A quarter of the files are history placeholders, not DDL.** 25 of the 69
   files contain only comments (22 × 88 B `*_remote_history_placeholder.sql`
   from 2026-03-09→03-13, plus 3 June 2026 placeholders). They exist solely so
   the local migration ledger can line up with a remote project that had already
   received those changes out-of-band.
3. **The exam subsystem was built and then deliberately deleted.** Roughly half
   the substantive files (2026-03-13 → 2026-04-20) construct a full exam engine;
   `20260613000000_drop_exam_system.sql` and `20260614064500_drop_remaining_exam_functions.sql`
   remove all of it. Documentation of those files is **history only** — do not
   treat any `exam_*` object as part of the live interface.

What remains live is the platform's real domain: profiles/VIP billing, a
document library, campaigns + roadmap milestones, study-time EXP, and an
admissions score database.

## Interface

### Live tables (post-2026-06 state)

| Table | Ownership model | Purpose |
| --- | --- | --- |
| `public.profiles` | 1:1 with `auth.users.id`; own-row or admin RLS | Identity, `role` (`user`/`collaborator`/`admin`), VIP state (`is_vip`, `vip_expired_at`), study targets (`user_mode`, `target_thpt`, `target_dgnl`, `target_gpa`), badges (`is_approved_bang_chu`), EXP state (`exp`, `study_seconds`, `study_streak`, `last_study_date`, `last_exp_award_at`), JSON payloads (`admission_scores`, `roadmap_data`) |
| `public.documents` | public-read if `is_public`; staff insert; owner/admin update+delete | Library. Columns extended here: `publish_date`, `major`, `uploaded_at` (NOT NULL, defaulted) |
| `public.document_reports` | reporter own-row read; insert self only | Report queue feeding `notifications`; FK → `documents` |
| `public.notifications` | own-row select/update; insert admin-only | Per-user inbox (`title`, `message`, `link`, `is_read`) |
| `public.follows` | authenticated read; self insert/delete | Social graph (`follower_id` → `following_id`) |
| `public.campaigns` | public-read if `is_public`, else owner; owner write | Habit/goal campaigns (Danh Hiệu ladder input) |
| `public.roadmap_milestones` | own-row CRUD | Ordered roadmap steps; `status ∈ {done, active, locked}`, `progress 0..100` |
| `public.orders` | own-or-admin select; self insert; admin update/delete | VIP purchases. `transfer_code` is unique and DB-generated; `status` starts `pending`, flips to `paid` by reconciliation |
| `public.payment_logs` | admin-only select/insert | Provider webhook/audit trail (`payload jsonb`) |
| `public.transactions` | admin-only select/insert | Matched bank transfer ledger; `transaction_code` is the idempotency key |
| `public.study_daily` | SELECT-own only; **no client write path** | Per-user, per-day verified study seconds + EXP (daily cap ledger). PK `(user_id, study_date)` |
| `public.study_sessions` | SELECT-own only; **no client write path** | EXP v2 heartbeated sessions (`sheet_id`, `started_at`, `last_heartbeat_at`, `ended_at`, `credited_seconds`) |
| `public.admission_schools` | public read; admin write | School catalogue (`code` PK, `name_vi`, `region ∈ {bac,trung,nam}`) |
| `public.admission_cutoffs` | public read; admin write | Cutoff points per school × major × method × year × segment |
| `public.admission_conversion_anchors` | public read; admin write | Percentile conversion anchors between exam scales |
| `public.admission_score_distributions` | public read; admin write | Score distributions per exam × year × session |
| `public.admission_wishlists` | own-row CRUD | Candidate wishlist: school × major × method + `rank` + `estimate_snapshot jsonb` |
| `public.public_profile_view` | `security_invoker = false` view, `SELECT` to `anon, authenticated` | The **only** sanctioned cross-user read path; exposes a safe column subset |

Pre-existing, referenced but not created here: `public.subjects`,
`public.semesters`, `public.school_scores`, `public.user_notes`. Their RLS is
rewritten by migrations in this directory.

### Live functions & RPCs

| Signature | Class | Contract |
| --- | --- | --- |
| `public.is_admin(user_id uuid DEFAULT auth.uid()) → boolean` | `SECURITY DEFINER`, `STABLE`, `search_path = public` | `EXISTS(profiles WHERE id = user_id AND role = 'admin')`. Defined as a definer helper specifically so policies can call it without self-referencing `profiles` RLS. `EXECUTE`: `authenticated` + `service_role` only. |
| `public.is_staff(p_uid uuid) → boolean` | `SECURITY DEFINER`, `STABLE` | `role IN ('admin','collaborator')`. Gates document upload. |
| `public.is_active_vip(p_user_id uuid) → boolean` | `SECURITY DEFINER`, `STABLE` | `is_vip AND vip_expired_at > now()`. `EXECUTE`: `service_role` only (deliberately not callable from the browser). |
| `public.reconcile_vip_payment(p_order_id uuid) → jsonb` | `SECURITY DEFINER`, `search_path = public, auth, extensions` | Pulls bank history from `thueapibank.vn`, matches **amount + transfer_code**, records `transactions` + `payment_logs`, flips `orders.status = 'paid'`, extends `profiles.vip_expired_at`. Returns `{ok, status, …}` with `status ∈ {paid, already_paid, pending, not_found, config_error, transaction_already_used}`. |
| `public.admin_user_directory(p_search, p_role, p_ids, p_limit) → table` | `SECURITY DEFINER`, `search_path = public, auth` | Admin-only user search joining `auth.users` for email/metadata. `p_limit` clamped to `1..200`. |
| `public.award_study_exp(p_seconds integer) → jsonb` | `SECURITY DEFINER`, `search_path = public` | **Only** path that may write EXP columns. Clamps chunk to ≤120 s and to wall-clock elapsed since last award; enforces 5 h/day cap; applies streak bonus. |
| `public.start_study_session(p_sheet_id text, p_subject_id text DEFAULT NULL) → uuid` | `SECURITY DEFINER` | Opens a session for the caller, auto-closing any stale open session (one open per user). |
| `public.heartbeat_study_session(p_session_id uuid, p_credit boolean DEFAULT true) → jsonb` | `SECURITY DEFINER` | Credits server-computed elapsed time (≤90 s/beat) **through** `award_study_exp()`, then updates `credited_seconds`. |
| `public.end_study_session(p_session_id uuid) → jsonb` | `SECURITY DEFINER` | Final heartbeat + close; idempotent (already-ended sessions return totals instead of raising). |
| `public.order_transfer_code_from_uuid(uuid) → text` | `IMMUTABLE` | `'DH' || 12 hex chars`. `EXECUTE`: `service_role`. |
| `public.parse_money_to_bigint(text) → bigint` | `IMMUTABLE` | Strips non-digits; returns `NULL` on garbage. Used by payment matching. |
| `public.set_updated_at() → trigger` | plain `plpgsql` | Generic `NEW.updated_at = now()`. |
| `public.set_order_transfer_code() → trigger` | `SECURITY DEFINER` | `BEFORE INSERT OR UPDATE ON orders`; defaults id + transfer code. |
| `public.enforce_order_package_catalog() → trigger` | plain `plpgsql` | `BEFORE INSERT OR UPDATE ON orders`; **overwrites** `amount`/`vip_days` from `package_id` and raises on unknown ids. |
| `public.protect_profile_fields() → trigger` | `SECURITY DEFINER` | `BEFORE UPDATE ON profiles`; blocks non-admin changes to `role`, `is_vip`, `vip_expired_at`, `is_approved_bang_chu`; bypassed by `service_role` or `app.allow_protected_profile_update = 'on'`. |
| `public.protect_exp_columns() → trigger` | plain `plpgsql` | `BEFORE UPDATE ON profiles`; raises unless `app.exp_ctx = 'on'` when any EXP column changes. |
| `public.notify_document_owner_on_report() → trigger` | `SECURITY DEFINER` | `AFTER INSERT ON document_reports`; inserts a `notifications` row for the document owner (skips self-reports). |
| `public.admin_get_thongsoai_candidates(...)` | live-only | Referenced by the client and explicitly preserved by the exam drop, but **not defined in any file here** — it exists only in the remote database. |

### Migration set (69 files, ordered)

**Phase A — placeholders & early domain (2026-03-09 → 2026-03-13, 28 files)**

- 22 × `20260309*`–`20260313*_remote_history_placeholder.sql` (88 B, comment-only).
- `20260309124317_add_admin_role.sql` — adds `profiles.role`; admins-only
  document write policies.
- `20260310111740_create_campaigns.sql` — `campaigns` + owner/public RLS.
- `20260310183000_add_profile_mode_targets.sql` — `user_mode`, `target_thpt`,
  `target_dgnl`.
- `20260312125000_add_publish_date_to_documents.sql`, `20260312210000_add_major_to_documents.sql`.
- `20260313190000_add_vip_to_profiles.sql` — `is_vip`, `vip_expired_at`.

**Phase B — security baseline & payments (2026-03-13 → 2026-03-17, 8 files)**

- `20260313191000_create_exam_tables.sql` — *retired* (`user_access_log`, `exam_progress`, `exam_results`).
- `20260313192000_create_payment_tables.sql` — `orders`, `payment_logs`,
  `transactions`, `set_updated_at()`.
- `20260315110000_harden_security_and_indexes.sql` — drop-and-recreate all
  policies on 11 tables; `is_admin`/`is_staff`; `protect_profile_fields`;
  `public_profile_view`; documents/reports policies.
- `20260315123000_sync_security_schema.sql` — idempotent re-sync of the same
  surface plus `enforce_order_package_catalog()` and `notify_document_owner_on_report()`.
- `20260315160000_add_admin_user_directory_rpc.sql` — `admin_user_directory`.
- `20260316150000_create_secure_exam_infrastructure.sql` — *retired*.
- `20260316153000_fix_exam_review_and_scoring.sql` — *retired*.
- `20260317120000_create_roadmap_milestones.sql` — `roadmap_milestones` +
  status/progress CHECKs + own-row RLS.

**Phase C — exam engine (2026-03-18 → 2026-04-20, 17 files, ALL RETIRED)**

`20260318000000_admin_exam_answers`, `20260319000000_create_exam_composer_tables`,
`20260319120000_create_exam_review_workflow_tables`,
`20260320103000_add_import_meta_and_short_answer_arrays`,
`20260322_add_sync_logs`, `20260324123000_fix_exam_scoring_rules_2025_2026`,
`20260325162000_handle_pending_exam_scoring`, `20260326170000_admin_exam_key_upload_support`,
`20260327093000_fix_admin_exam_key_consistency`,
`20260327120000_fix_answer_key_normalization_and_scoring_lookup`,
`20260327123000_rescore_existing_results_after_answer_key_normalization`,
`20260327150000_add_public_exam_index_and_admin_bundle_delete`,
`20260327173000_fix_exam_lookup_by_exam_path`, `20260409194500_add_deleted_exam_tombstones`,
`20260409231400_sync_exam_title_to_results`, `20260410103000_fix_exam_identity_aliases`,
`20260420000000_setup_flat_exam_keys`.

**Phase D — surviving payment automation & documents (2026-03-26, 2026-04-10, 2026-04-21)**

- `20260326103000_auto_reconcile_vip_payment.sql` — **live**: transfer codes,
  `parse_money_to_bigint`, `reconcile_vip_payment`, hardened
  `protect_profile_fields`.
- `20260410133000_secure_exam_access_rpc.sql` — `is_active_vip` +
  `check_and_log_exam_access` (the latter later dropped; the former survives).
- `20260421072956_add_document_uploaded_at.sql` — `documents.uploaded_at`
  backfill + four library indexes.

**Phase E — exam subsystem teardown (2026-06-13 → 2026-06-14, 9 files)**

- `20260613000000_drop_exam_system.sql` — **DESTRUCTIVE**: drops 17 tables
  `CASCADE` and every exam RPC by name, in a `DO` loop.
- `20260614064500_drop_remaining_exam_functions.sql` — drops the stragglers
  (`calculate_exam_score`, `submit_exam_securely`, `get_exam_resources`, …).
- `20260614120000_perf_rls_initplan_remaining.sql` — rewrites `user_notes` +
  `school_scores` policies into `(SELECT …)` InitPlan form.
- `20260614130000_harden_profiles_read_and_drop_unused_idx.sql` — closes a
  **data exposure**: `profiles` was `USING(true)` for SELECT (emails, VIP
  billing, `admission_scores` readable by anyone including `anon`). Locks the
  table to own-row/admin, makes `public_profile_view` the only cross-user path.
- `20260614133000_fix_profiles_policy_recursion.sql` — fixes the infinite
  recursion the previous file introduced, by routing admin checks through the
  definer `is_admin()`.
- `20260614134000_revoke_is_admin_direct_execute.sql` — pulls `EXECUTE` on
  `is_admin(uuid)` from `PUBLIC`/`anon`, keeps `authenticated` + `service_role`.
- 3 × `2026061405*_remote_history_placeholder*.sql` (comment-only).

**Phase F — study EXP & admissions (2026-07-26 → 2026-10-22, 4 files)**

- `20260726120000_add_study_exp_system.sql` — EXP/level columns on `profiles`,
  `study_daily`, `protect_exp_columns`, `award_study_exp`, re-published
  `public_profile_view`.
- `20261022090000_study_sessions.sql` — `study_sessions` + start/heartbeat/end
  RPCs (EXP v2, replaces the visibility-gated tracker).
- `20261022100000_admission_wishlists.sql` — `admission_wishlists` + own-row RLS.
- `20261022110000_admission_cutoffs.sql` — `admission_schools`,
  `admission_cutoffs`, `admission_conversion_anchors`,
  `admission_score_distributions` + public-read/admin-write RLS.

## Invariants

- **Forward-only and immutable.** Timestamp prefixes are the ordering key; an
  applied file is never edited, only superseded by a later file. Corrections
  arrive as new migrations (`fix_*`, `harden_*`, `drop_*`).
- **Every DDL statement is re-runnable.** `CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`,
  `CREATE OR REPLACE FUNCTION`, `CREATE INDEX IF NOT EXISTS`. Re-running a file
  is expected to be a no-op, not an error.
- **RLS is mandatory on every user-facing table.** `ALTER TABLE … ENABLE ROW
  LEVEL SECURITY` accompanies creation; a newcomer table without RLS is a bug.
- **Policy predicates use the InitPlan form.** `(SELECT auth.uid())` and
  `(SELECT public.is_admin((SELECT auth.uid())))`, never bare `auth.uid()` in a
  hot policy — the bare form re-evaluates per row. `20260614120000` exists purely
  to retrofit the two tables that were missed.
- **Admin authorization is always `public.is_admin(auth.uid())`.** It is never
  inlined as a `profiles` subquery inside a `profiles` policy — that is exactly
  the recursion bug fixed by `20260614133000`. `is_admin` must stay
  `SECURITY DEFINER` with a pinned `search_path`.
- **`SECURITY DEFINER` ⇒ pinned `search_path`.** Every such function sets
  `search_path = public` (or `public, auth[, storage, extensions]`). Functions
  that must not be browser-callable are revoked from `anon`/`authenticated` and
  granted to `service_role` only (`is_active_vip`,
  `order_transfer_code_from_uuid`).
- **Protected profile columns are write-once-per-role.** `role`, `is_vip`,
  `vip_expired_at`, `is_approved_bang_chu` cannot be changed by a non-admin
  client, enforced by trigger — not by client discipline or column grants.
- **EXP is unforgeable from the client.** EXP columns are read-only outside
  `award_study_exp()`; the guard is a transaction-local GUC (`app.exp_ctx`),
  not a role check. `award_study_exp` clamps to ≤120 s per call, to real
  wall-clock elapsed since the previous award (+5 s grace), and to a
  **18 000 s/day (5 h)** cap. One heartbeat ≤90 s.
- **One open study session per user.** `start_study_session` closes stale
  sessions before inserting; `heartbeat` rejects ended sessions; `end` is
  idempotent.
- **Money is server-priced.** `orders.amount` and `orders.vip_days` are
  **overwritten** by `enforce_order_package_catalog` from `package_id`
  (`1m` → 39 000 / 30 d, `3m` → 79 000 / 90 d, `1y` → 149 000 / 365 d). Any
  other `package_id` raises. Client-supplied prices are never trusted.
- **Payment matching is amount + transfer code, and idempotent.** A
  `transaction_code` already bound to another order returns
  `transaction_already_used`; a `paid` order short-circuits to `already_paid`.
  VIP extension stacks on `max(vip_expired_at, now())`, never from today.
- **Admissions data is public-read, admin-write.** All four `admission_*`
  tables grant `SELECT` to `anon`/`authenticated` and route writes through
  `is_admin` policies. `admission_cutoffs.cutoff` is `NULL` when unverified —
  never an estimate — and `verified`/`reliability ∈ {A,B,C}` carry provenance.
  `source_url` is `NOT NULL` on every admissions row: unprovenanced data is
  rejected at the schema level.
- **Exam objects are gone.** No `exam_*`, `deleted_exam_tombstones`,
  `sync_logs`, `user_access_log`, `exam_results`, `exam_progress` table may be
  reintroduced without a new migration; any reference to them in docs or code
  is stale.

## Side Effects

- **Destructive DDL.** `20260613000000` drops 17 tables `CASCADE`; together with
  `20260614064500` it irreversibly removes every exam RPC, policy and trigger.
  Both must never be re-run casually against a database that still holds exam
  data.
- **Cross-schema reach.** `reconcile_vip_payment` reads `vault.decrypted_secrets`
  (`payment_account_no`, `payment_api_password`, `payment_api_token`) with a
  graceful `undefined_table` fallback, and makes an outbound HTTPS call to
  `https://thueapibank.vn/...`. It writes `orders`, `transactions`,
  `payment_logs`, and `profiles` — four tables in one transaction.
- **Backfills.** `orders.transfer_code` (twice: §20260326 and the archived
  hardening file), `documents.uploaded_at = COALESCE(uploaded_at, created_at, now())`,
  `roadmap_milestones.subtitle/status/progress` null repairs.
- **Privilege churn.** Repeated `REVOKE ALL` / `GRANT` loops over table and
  function name lists; `public_profile_view` grants toggled `anon`+`authenticated`
  on `SELECT` only.
- **Index lifecycle.** Created for library filters, notifications, roadmap
  lookup, study sessions, admissions lookups (incl. a GIN `to_tsvector` index on
  `major_name || school_code`); dropped `idx_school_scores_method_year`,
  `idx_school_scores_year`, `idx_user_access_log_user_date`.
- **Trigger fan-out.** A single `document_reports` insert writes a
  `notifications` row for the document owner; a single `profiles` update passes
  through both `protect_profile_fields` and `protect_exp_columns`.
- **Ledger writes.** `study_daily` and `study_sessions` are write-only through
  definer RPCs; clients hold `SELECT` and nothing else.

## Verification

Migrations are applied **out-of-band** (Supabase dashboard SQL editor / MCP),
not by in-repo tooling: there is **no `config.toml`** in `../` (the `supabase`
directory), so `supabase db push` and `supabase migration up` are **not** valid
commands in this repository and must not be cited as verification.

Repository-level checks (run from `E:\DTHT`):

- Run: `npm run lint`
- Run: `npm run build`

Schema-shape checks are manual: confirm the live interface against the tables
and functions listed above, and confirm no `exam_*` relation remains.
