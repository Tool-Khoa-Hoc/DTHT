# Scripts — Exam, Admissions & Supabase Tooling

## Overview

Out-of-band maintenance and authoring toolkit for the DTHT exam web app (Vite + React 19 +
Supabase). Nothing in `src/` imports this directory: these are operator-invoked CLIs, not
bundled code. They fall into six families:

1. **Exam JSON authoring** — scaffold, normalize, index and repair `public/data/exams/**/exam.json`.
2. **Exam assets** — crop question images out of PDFs, delete generated assets, trim KaTeX CSS.
3. **Supabase exam sync** — rewrite `exam_keys.answer_key` / `exam_keys.resources.document_url`.
4. **Admissions data pipeline** — merge crawled cutoff sources into `cutoffs.json`, then load it into Supabase.
5. **Schema documentation** — introspect the linked Supabase project into Markdown + Mermaid ERD.
6. **Python converter shims** — four thin entry points that delegate to an `exam_engine` package
   that is **not present in this repository** (see Invariants).

All scripts are ad hoc: there is no test runner or build step for them. The web app itself is
verified with `npm run lint && npm run build`.

## Interface

### Script inventory

| Script | Purpose | Runtime | Mutating |
| --- | --- | --- | --- |
| `create-exam.js` | Scaffold a new `exam.json` (3 parts, default counts 18/4/6) | node | mutating |
| `exam-utils.js` | Shared library: exam paths, time/subject normalization, question factories, answer-key builder | node (module, no CLI) | read-only |
| `sync-answer-key.js` | Rebuild `answer_key` from `parts` | node | mutating |
| `apply-image-map.js` | Insert image blocks into question `content` from a map file | node | mutating |
| `compact_json.js` | Rewrite one hardcoded exam's rich content into compact inline form (strings + `{math}` blocks) | node | mutating |
| `migrate_exam_ids.js` | Normalize `part.id` / `question.id` / `statement.id` across all exams | node | mutating |
| `migrate_nested.js` | One-off manual rewrite of the 2025 math exam's nested content | node | mutating |
| `normalize-exam-times.mjs` | Force canonical `time` per subject in `public/data/exams` and `output/` | node | mutating |
| `generate-exam-index.mjs` | Rebuild `public/data/exams/index.json` catalog | node | mutating |
| `cleanup-exam-assets.mjs` | Delete every `exam.json` and `.png/.jpg/.jpeg` under exams | node | mutating (destructive) |
| `export-question-images.py` | Crop question regions from a PDF into PNG files | python | mutating |
| `pdf_probe.py` | Diagnostic: import check + text dump/page renders of a PDF | python | read-only (writes only with `--out-dir`) |
| `generate-katex-minimal.mjs` | Generate `src/styles/katex-minimal.css` from `katex.min.css` | node | mutating |
| `migrate-answers-to-supabase.js` | Convert legacy `exam_keys.answer_key` to flat format and upsert | node | mutating |
| `sync-pdf-supabase.mjs` | Set `exam_keys.resources.document_url` from Storage bucket `exams` | node | mutating (with `--apply`) |
| `export-supabase-schema.cjs` | Introspect linked Supabase DB → `DATABASE_SCHEMA.md` + `DATABASE_SCHEMA_ERD.mmd` | node (CJS) | mutating |
| `merge-admissions-data.mjs` | Merge crawled cutoff sources → `public/data/admissions/cutoffs.json` | node | mutating |
| `build-admissions-data.mjs` | Thin wrapper that spawns `merge-admissions-data.mjs` | node | mutating |
| `ingest-admissions-supabase.mjs` | Upsert `cutoffs.json` into four admissions tables over REST | node | mutating (with `--apply`) |
| `test-admission.mjs` | Assertion suite for `src/lib/admission/*` (numeric anchors, regressions) | node | read-only |
| `generate-teachers-seed.mjs` | Regenerate `src/config/teachers.seed.json` from teacher↔sheet pairs | node | mutating |
| `update_biology_exam.js` | One-off: inject a fixed answer key + Drive link into a biology exam | node | mutating |
| `image-map.example.json` | Sample input for `apply-image-map.js` | data | read-only |
| `convert_exam_with_llm.py` | Re-export shim for `exam_engine.convert_exam_with_llm` | python | non-functional here |
| `exam_converter_gui.py` | Shim to `exam_engine.interfaces.cli.run_convert:main` | python | non-functional here |
| `exam_converter_tui.py` | Shim to `exam_engine.interfaces.cli.run_convert:main` | python | non-functional here |
| `run_convert.py` | Shim to `exam_engine.interfaces.cli.run_convert:main` | python | non-functional here |

### Invocation signatures

```text
node scripts/create-exam.js <subjectFolder> <examPath> [--title T] [--subject S]
                            [--description D] [--time MIN]
                            [--part1 N] [--part2 N] [--part3 N] [--force]
node scripts/sync-answer-key.js <subjectFolder> <examPath> [--dry-run]
node scripts/apply-image-map.js <subjectFolder> <examPath> <mapFile> [--dry-run]
node scripts/normalize-exam-times.mjs
node scripts/generate-exam-index.mjs
node scripts/migrate_exam_ids.js [--dry-run]
node scripts/cleanup-exam-assets.mjs [--dry-run]
node scripts/generate-katex-minimal.mjs
node scripts/generate-teachers-seed.mjs [--pairs <all-pairs.json>]

node scripts/migrate-answers-to-supabase.js [--dry-run]      # writes when no flag
node scripts/sync-pdf-supabase.mjs [--apply] [--force]       # dry-run by default
node scripts/merge-admissions-data.mjs [--out <file>]
node scripts/build-admissions-data.mjs
node scripts/ingest-admissions-supabase.mjs [--apply]        # dry-run by default
node scripts/export-supabase-schema.cjs
node scripts/test-admission.mjs

python scripts/export-question-images.py <config.json>
python scripts/pdf_probe.py [pdf_path] [--out-dir DIR] [--page-limit N]
python scripts/run_convert.py | exam_converter_gui.py | exam_converter_tui.py
python scripts/convert_exam_with_llm.py
```

`exam-utils.js` exports: `EXAMS_ROOT`, `DEFAULT_PART_DESCRIPTIONS`, `DEFAULT_EXAM_RESOURCES`,
`resolveExamDir`, `resolveExamJsonPath`, `createDefaultExamResources`, `normalizeSubjectFolder`,
`getCanonicalExamTimeMinutes`, `normalizeExamTimeMinutes`, `loadExamJson`, `saveExamJson`,
`getQuestionKey`, `buildAnswerKeyFromParts`, `createSingleChoiceQuestion`,
`createTrueFalseQuestion`, `getDefaultShortAnswerPoints`, `createShortAnswerQuestion`,
`inferSubjectLabel`, `ensureDirectory`.

Two scripts expose programmatic entry points as well:
`normalize-exam-times.mjs` → `normalizeAllExamTimes({ rootDir, silent })` and
`generate-exam-index.mjs` → `generateExamIndex({ rootDir, silent })`. Both return `{ changed, ... }`
counts and skip the write when the payload is unchanged.

### Environment variables (`.env.example`)

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase scripts | Project URL (ingest also accepts `SUPABASE_URL`) |
| `VITE_SUPABASE_ANON_KEY` | web app only | Public client key |
| `SUPABASE_SECRET_KEY` | Supabase scripts | Service-role key, preferred name |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase scripts | Service-role key fallback |
| `GEMINI_API_KEY` | converter tooling | LLM conversion (not used by any script here) |
| `VITE_API_URL`, `VITE_EXAM_REVIEW_API_BASE`, `ADMIN_TOKEN`, `EXAM_REVIEW_API_PORT` | web app / review API | Frontend and review service config |
| `EXAM_IMPORT_PYTHON_CMD` | importer pipeline | Python executable override (default `python`) |

Service-role credentials bypass RLS. Keep them out of committed files and out of any shared shell
history.

## Invariants

- **Working directory matters.** `exam-utils.js` computes `EXAMS_ROOT` from `process.cwd()` as
  `public/data/exams`. Run `create-exam.js`, `sync-answer-key.js` and `apply-image-map.js` from the
  repository root or they will target a nonexistent tree. Scripts that use `import.meta.url` resolve
  the root from their own location instead.
- **Exam document shape.** `exam.json` = `{ id, title, subject, time, description, resources,
  answer_key, parts[] }`. Each part = `{ id, name, description, questions[] }`.
  `resources` defaults to `{ exam_file_url, answer_file_url, answer_file_name, video_url, edit_link }`,
  all `null`.
- **Question types.** `single_choice` → `options: [[...], [...], [...], [...]]` plus
  `correct_answer` (0–3 index, or letter in legacy data). `true_false` → `statements` with ids
  `a`–`d` and `correct: boolean|null`, `points: [0.1, 0.25, 0.5, 1]`. `short_answer` →
  `correct_answer` string; default points 0.5 for math, 0.25 otherwise.
- **Answer-key keys.** `answer_key` is keyed `${partId}.${questionId}` (for example `part1.q3`).
  Single-choice values are indices, true/false values are `{ "<statementId>": boolean }`, short
  answers are strings. `buildAnswerKeyFromParts` preserves an existing entry when one is present, so
  re-running `sync-answer-key.js` is idempotent.
- **Part-id dialect is not uniform.** `create-exam.js`/`exam-utils.js` and
  `image-map.example.json` use `part1`, `part2`, `part3`; `migrate_exam_ids.js` canonicalizes to
  `part-1`, `part-2`, `part-3`; `migrate-answers-to-supabase.js` parses the legacy `part-1.N` DB
  form. Never assume one spelling — inspect the target file or table before keying into it.
- **Duration is subject-driven.** Canonical minutes are math 90 and physics/chemistry/biology 50;
  `normalizeExamTimeMinutes` returns the canonical value and silently ignores `--time` for known
  subjects. Unknown subjects fall back to the supplied value.
- **Dry-run defaults differ.** `migrate-answers-to-supabase.js` **writes by default** and needs
  `--dry-run` to preview. `sync-pdf-supabase.mjs` and `ingest-admissions-supabase.mjs` are dry-run by
  default and need `--apply`. `sync-answer-key.js`, `apply-image-map.js`, `migrate_exam_ids.js`,
  `cleanup-exam-assets.mjs` write by default and accept `--dry-run`. Confirm the mode before
  invoking anything that touches production data.
- **Admissions merge is fail-closed.** `merge-admissions-data.mjs` aborts when a record lacks
  `source_url`; a `cutoff` above its `scale` is kept verbatim and annotated, never clamped; dedupe is
  by `(school_code, normalized major_name, combo, method, scale, year)` with BCA additionally split
  by `segment`; `__ALL_MAJORS_RANGE__` rows and anchors buried in notes are dropped because anchors
  live in `conversions`.
- **`cutoffs.json` output contract.** `{ meta, records, conversions, score_distributions }`, written
  with 1-space indentation (large file, diff-friendly). `meta` carries counts and generation
  metadata; converters read the file, not the raw crawl sources.
- **Ingest keys.** Upserts target `admission_schools` on `code`, `admission_cutoffs` on
  `(school_code, major_code, major_name, method, year, segment)`, `admission_conversion_anchors` on
  `(from_exam, to_exam, combo, year, framework, scope, school_code, src)` and
  `admission_score_distributions` on `(exam, year, session)`.
- **Schema export scope.** `export-supabase-schema.cjs` excludes `auth`, `storage`, `realtime`,
  `vault`, `graphql*`, `supabase_*`, `pg*` and `pgsodium`; it requires a CLI-linked project
  (`supabase/.temp/project-ref`) and shells out through `cmd.exe`, so it only runs on Windows with
  the Supabase CLI available.
- **Teacher seed is idempotent and path-dependent.** Default source is
  `../agents-claude/tool/all-pairs.json` (a sibling of the repo, not shipped here); override with
  `--pairs`. The script excludes the shared HOCMAI "Nền tảng 12" sheet and reuses existing titles
  from `teachers.seed.json`, so repeated runs converge instead of churning.
- **Python shims are broken in this tree.** All four `.py` entry points import `exam_engine`
  (or `exam_engine.interfaces.cli.run_convert`), and no `exam_engine/` package exists in `E:\DTHT`.
  They fail at import until that package (or a sibling checkout) is on `sys.path`. `pdf_probe.py`
  and `export-question-images.py` additionally need PyMuPDF, optionally vendored in `.vendor/`
  (absent here).
- **Hardcoded machine paths.** `update_biology_exam.js` writes
  `d:\Web sv\tram_hs_sv\public\data\exams\sinh\han-thuyen\exam.json`, `migrate_nested.js` rewrites
  `public/data/exams/toan/thptqg-toan-2025-01/exam.json`, `compact_json.js` targets the same math
  exam, and `pdf_probe.py` defaults to a PDF under `D:\đề thi\`. These are one-off historical
  scripts; do not treat them as general-purpose tools.
- **`dotenv` is not a declared dependency.** `migrate-answers-to-supabase.js` and
  `sync-pdf-supabase.mjs` import `dotenv`, but `package.json` lists only `@supabase/supabase-js`
  among the relevant packages. They may resolve it transitively; verify before relying on them in a
  clean install.
- **`test-admission.mjs` is the only executable check here** and it is read-only: it imports
  `src/lib/admission/*`, reads `src/pages/*.jsx` as text to catch regressions, and exits non-zero on
  the first failed assertion.

## Side Effects

**Supabase (service role, RLS bypassed)**

- `migrate-answers-to-supabase.js` — upserts `exam_keys` in batches of 50 keyed on `exam_id`,
  replacing `answer_key` with the flat `{ "1": "A", "25": { "a": true }, "29": "1.5" }` format.
- `sync-pdf-supabase.mjs` — lists Storage bucket `exams`, reads `exam_keys(exam_id, resources)` and
  updates `exam_keys.resources` with `document_url`. Existing URLs are skipped unless `--force`.
  No file content is uploaded or deleted.
- `ingest-admissions-supabase.mjs` — REST `POST ...?on_conflict=...` into `admission_schools`,
  `admission_cutoffs`, `admission_conversion_anchors`, `admission_score_distributions`. Runs as
  dry-run (report only) unless `--apply`. It never creates tables; a missing table is reported as
  "not loaded", not retried.
- `export-supabase-schema.cjs` — read-only against Postgres, but spawns
  `npx supabase db query --linked` and requires the linked-project state stored under `supabase/`.

**Local files rewritten or generated**

- `public/data/exams/<subject>/<exam>/exam.json` — created by `create-exam.js` (refuses to
  overwrite without `--force`); rewritten by `sync-answer-key.js` (only when the key differs),
  `apply-image-map.js` (unless `--dry-run`), `normalize-exam-times.mjs`, `migrate_exam_ids.js`,
  `compact_json.js`, `migrate_nested.js`, `update_biology_exam.js`.
- `public/data/exams/index.json` — regenerated catalog (`id`, `title`, `subject`, `subjectFolder`,
  `examPath`, `time`, `color`, `icon`, `questions`, `updated_at`). Candidates are deduplicated by
  route and by `(subjectFolder, id)` keeping the freshest file, then sorted by subject folder and
  exam path.
- `public/data/admissions/cutoffs.json` — regenerated by `merge-admissions-data.mjs` (or
  `build-admissions-data.mjs`); overwritten in place, 1-space indent.
- `src/config/teachers.seed.json` — regenerated teacher/subject seed.
- `src/styles/katex-minimal.css` — regenerated from `node_modules/katex/dist/katex.min.css`
  (requires `npm install` first); font families for Caligraphic, Fraktur, Typewriter, Script and
  SansSerif are stripped, with fallback rules appended.
- `DATABASE_SCHEMA.md` and `DATABASE_SCHEMA_ERD.mmd` at the repo root — overwritten by the schema
  exporter.
- `.tmp_schema_introspection.sql` at the repo root — written before the query and deleted in a
  `finally` block; a hard kill can leave it behind.
- PNG crops from `export-question-images.py` and `--out-dir` renders from `pdf_probe.py`.

**Destructive operations**

- `cleanup-exam-assets.mjs` **deletes** every file named `exam.json` and every `.png`, `.jpg`,
  `.jpeg` under `public/data/exams`, recursively, keeping directories and PDFs. There is no backup
  and no undo; `--dry-run` only prints.
- `update_biology_exam.js` overwrites the entire `answer_key` and the `resources.answer_file_url`
  of one biology exam with hardcoded values.

**Process spawning and network**

- `build-admissions-data.mjs` spawns `node scripts/merge-admissions-data.mjs` with inherited stdio
  and propagates a non-zero exit.
- `export-supabase-schema.cjs` spawns `cmd.exe /c npx supabase ...` with a 20 MB output buffer.
- `sync-pdf-supabase.mjs` and `ingest-admissions-supabase.mjs` make outbound HTTPS calls to the
  Supabase project. `sync-pdf-supabase.mjs` paginates Storage listings 100 entries at a time.

**Not performed by any script here**

- No schema migrations, no `git` operations, no bucket creation, no Auth/user mutation, and no
  writes outside the repo (except the hardcoded `D:` targets noted above).

## Verification

- Web application: `npm run lint && npm run build`
- Script-level self-check (read-only, no network): `node scripts/test-admission.mjs`
- The remaining scripts are operator tools invoked ad hoc with `node scripts/<name>` or
  `python scripts/<name>`; they expose no test target. Prefer `--dry-run` where supported, and set
  `VITE_SUPABASE_URL` plus `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) before running any
  Supabase-writing script.
