# supabase — Database Boundary Blueprint

## System Overview

This directory is the **database boundary** of the DTHT platform: every object
the React SPA reads or writes through `@supabase/supabase-js` is defined,
hardened, or seeded from here. It holds no application TypeScript/JavaScript —
only SQL and its ordered history.

Two horizontally distinct concerns live side by side:

- **Schema evolution** (`./migrations/`, `./archived_migrations/`) — a
  forward-only, timestamp-ordered DDL ledger for a Supabase Postgres project.
- **Data seeding** (`./seed_admission_cutoffs.sql`) — a generated,
  transaction-wrapped bulk upsert of the admissions dataset.

The live database is **not** reproducible from this directory alone. Base
relations (`profiles`, `documents`, `subjects`, `semesters`, `school_scores`,
`user_notes`) were created outside the migration chain, and the real deployment
path is the Supabase dashboard/SQL editor, not a local CLI — there is **no
`config.toml`** here. That absence is itself a contract: nothing in this repo
can `supabase db push`.

The application talks to this boundary in two ways: PostgREST table/view
access (`documents`, `campaigns`, `profiles`, `roadmap_milestones`, `subjects`,
`follows`, `semesters`, `user_notes`, `public_profile_view`,
`admission_wishlists`, `notifications`, `document_reports`) and RPC calls
(`start_study_session`, `heartbeat_study_session`, `end_study_session`,
`award_study_exp`, `admin_user_directory`, `admin_get_thongsoai_candidates`).

## Local Interface & Invariants

### `./schema.sql`

An **empty (0-byte) placeholder**. It is not a schema source, not a dump, and
not importable. Any tooling or document that points at it for table definitions
is wrong — `./migrations/` and the live database are the sources of truth.

### `./seed_admission_cutoffs.sql`

Generated data seed for the `score-v3` admissions dataset (1 442 lines, 1 434
`INSERT` statements, one `BEGIN; … COMMIT;` transaction).

| Property | Contract |
| --- | --- |
| Origin | Machine-generated from `../public/data/admissions/cutoffs.json` by `../scripts/merge-admissions-data.mjs` — **never hand-edit**; fix the source data under `../data/admissions-source/` and regenerate |
| Precondition | `../migrations/20261022110000_admission_cutoffs.sql` must already be applied |
| Targets | `public.admission_schools`, `public.admission_cutoffs`, `public.admission_conversion_anchors`, `public.admission_score_distributions` |
| Idempotency | `admission_schools` upserts (`ON CONFLICT (code) DO UPDATE SET name_vi`); the three detail tables use `ON CONFLICT ON CONSTRAINT … DO NOTHING` — re-running never duplicates, but also never corrects an existing row |
| Atomicity | Single transaction: either the whole seed lands or none of it does |
| Alternative path | `../scripts/ingest-admissions-supabase.mjs --apply` (service-role REST upsert, with dry-run and reporting) is the "official" ingest; this seed is the offline/CI equivalent |

Invariants carried by the seed payload — these are data-correctness rules, not
style preferences:

- **`cutoff IS NULL` means "not verifiable", never "estimated".** Rows with
  unproven figures keep `NULL` and say so in `note`. Interpolating or guessing a
  cutoff is a data defect.
- **`source_url` is mandatory on every row**; `reliability ∈ {A,B,C}` records
  provenance quality (A = official, B = major press, C = secondary).
- **`note` is human prose only** — no machine-readable anchors or ranges hidden
  in free text; those belong in `admission_conversion_anchors`.
- **Segments are not merged.** `segment` separates `chung` / `nu` / `nam` /
  `vung-1`…, and multi-session exams (e.g. V-ACT) keep their sessions distinct.

## Subdirectories & System Boundaries

- **migrations**: [`./migrations/EGM.md`](./migrations/EGM.md) — 69-file ordered
  DDL ledger (2026-03-09 → 2026-10-22). Defines the live schema: profiles/VIP
  billing, document library, campaigns/roadmap, study-time EXP, and the
  admissions score database. Also the record of the **retired** exam subsystem,
  built through 2026-04 and dropped in 2026-06.
- **archived_migrations**: [`./archived_migrations/EGM.md`](./archived_migrations/EGM.md)
  — retired migrations kept for provenance. One file
  (`20260608111229_harden_access_payment_rpc.sql`) hardening exam access and
  payment transfer codes. Not applied by any tooling; its exam half is dead,
  its payment/profile helpers are live.

Related file outside this subsystem: `../supabase_setup.sql` — legacy
hand-run bootstrap that created `exam_keys`/`exams` and the original
`is_admin()`. Both tables were dropped in 2026-06; treat the file as
archaeology, not a setup step.

## Global Invariants

- **RLS on every user-facing table, with no client write path where a definer
  RPC exists.** Users hold `SELECT` only on `study_daily` and `study_sessions`;
  every write goes through a `SECURITY DEFINER` function.
- **Admin checks go through `public.is_admin(auth.uid())`** — a `SECURITY
  DEFINER` helper with pinned `search_path`. Never inline a `profiles` subquery
  inside a `profiles` policy (recursion), and never expose `is_admin` to `anon`.
- **Policy predicates are wrapped as `(SELECT auth.uid())`** so Postgres
  evaluates them once per query (InitPlan), not once per row.
- **`SECURITY DEFINER` requires a pinned `search_path`,** and capabilities that
  must not be browser-reachable are granted to `service_role` only.
- **Client input is never authoritative for money, identity, or progression.**
  Order prices/durations are overwritten from `package_id`; VIP entitlement is
  derived from `auth.uid()` + `vip_expired_at`; EXP is written only by
  `award_study_exp()` under a transaction-local GUC guard.
- **Additive-first migrations.** `IF NOT EXISTS` / `IF EXISTS` / `DO $$` guards
  everywhere, so an already-applied file can be re-run without error. The three
  destructive files (`20260613000000`, `20260614064500`, and the archived
  hardening pass) are the documented exceptions and must be treated as
  one-shot.
- **Placeholders are legitimate history.** 25 of the 69 migration files are
  comment-only, anchoring local ledger timestamps to changes the remote project
  received out-of-band. They carry no DDL and must not be "fixed" by adding
  statements.

## Global Side Effects

- **Irreversible data loss on exam teardown.** `20260613000000` +
  `20260614064500` drop 17 tables `CASCADE` and every exam RPC. A database that
  still holds exam data must be exported first.
- **Outbound network call from inside Postgres.** `reconcile_vip_payment`
  reads provider secrets from `vault.decrypted_secrets` and calls
  `https://thueapibank.vn/...`; it writes `orders`, `transactions`,
  `payment_logs`, and `profiles` in one transaction. Payment correctness
  therefore depends on an external service being reachable and on Vault (or
  `app.payment_*` settings) being populated.
- **Bulk dataset mutation.** The admissions seed writes ~1.4 k rows across four
  public tables in a single transaction; it is idempotent for schools but
  "insert-if-absent" for cutoffs, anchors, and distributions, so corrections
  require deleting the stale row or using the REST ingest script.
- **Trigger fan-out on ordinary app writes.** Reporting a document inserts into
  `notifications`; updating a profile passes two guard triggers; inserting an
  order is repriced by `enforce_order_package_catalog`.
- **Privilege surface churn.** Repeated `REVOKE ALL` / `GRANT` passes over tables
  and functions, plus an `anon`-reachable `public_profile_view` (a
  `security_invoker = false` view over a safe column subset).

## System Verification

Run from the repository root `E:\DTHT`:

- Run: `npm run lint`
- Run: `npm run build`

**Not available:** `supabase db push` / `supabase migration up`. There is no
`config.toml` in this directory, so these commands cannot run here and must not
be documented as a verification step. Migrations are applied through the
Supabase dashboard or MCP, and schema conformance is checked manually against
the live object list in `./migrations/EGM.md`.
