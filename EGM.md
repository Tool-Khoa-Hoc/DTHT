# DTHT Platform Blueprint (Trạm Học Sinh Sinh Viên)

## System Overview

DTHT (Trạm Học Sinh Sinh Viên) is an educational technology web platform designed for Vietnamese high school and university students. The repository encompasses:
1. A modern Single Page Application (React 19, Vite, Tailwind CSS v4) offering study timers, gamified study progression (Đấu Trường EXP and rankings), GPA calculators, university admissions cutoff analytics, and a community document library.
2. A serverless PostgreSQL database boundary powered by Supabase, managed through timestamped migrations, Row-Level Security (RLS) policies, and database functions.
3. Python and Node.js operational toolkits for admissions data crawling and ingestion, exam document parsing and KaTeX math sanitization, and administrative database synchronisation.
4. An Agent Skills library implementing the open Agent Skills standard for coding assistants and automation workflows.

### Legacy Context & Template Notes

This project was bootstrapped using React and Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`. Fast refresh is powered by Babel/Vite plugins.

### Canonical Exam Resources Schema

For long-term maintenance, every `exam.json` stores external and internal exam assets in a single canonical block:

```json
{
  "resources": {
    "exam_file_url": null,
    "answer_file_url": null,
    "answer_file_name": null,
    "video_url": null,
    "edit_link": null
  }
}
```

Rules:
- Put all exam assets under `resources`, do not scatter fields like `video_url` or `edit_link` at the root for new data.
- Use `snake_case` keys only.
- Use full `https://...` URLs for external resources.
- Use relative file names such as `de-goc.pdf` or `dap-an.pdf` for files stored inside the exam folder.
- Keep `index.json` lean; exam resources should primarily live in each `exam.json`.

Current canonical meanings:
- `resources.exam_file_url`: file/link of the original exam
- `resources.answer_file_url`: answer file or official solutions
- `resources.answer_file_name`: preferred download file name for the answer file
- `resources.video_url`: video explanation for VIP users
- `resources.edit_link`: internal editing/review link for admins or collaborators

## Local Interface & Invariants

### `dtht.py`
CLI for exam document discovery, metadata inspection, sanitization, and remote Supabase synchronization.
- **Commands**:
  - `status` — Lists active exam manifests, question counts, and local answer/link states. Supports `--source {public,source,both}`.
  - `sync` — Sanitizes local `exam.json` files by stripping answers/resources and generating clean public variants.
  - `sync-db` — Pushes answer keys and resource URLs to remote Supabase tables (`exam_keys`, `exams`).
  - `delete-keys` — Destructive removal of exam keys from remote Supabase tables.
  - `logs` — Displays recent sync audit records from the `sync_logs` table.
  - `build` — Runs `npm run build` and logs build status.
  - `push` — Automates git commit and push for exam catalog updates.
  - `backup` — Creates localized timestamped zip archives of exam datasets.
- `collect_exam_files(source="public")` — Discovers active exam JSON manifests under `public/data/exams` and/or `data-source`, ignoring `.temp` and backup directories.

### `vite.config.js`
- Build pipeline configured with React Fast Refresh, Tailwind CSS v4, and dual Gzip / Brotli asset compression for bundles over 1KB.
- Custom `manualChunks` splitting into `vendor-react` (`react`, `react-dom`, `react-router-dom`, `scheduler`) and `vendor-supabase` (`@supabase`).
- Target: `es2020` with `esbuild` minification and 600kB warning threshold.

### `eslint.config.js`
- Flat config configuring `@eslint/js` recommendations, React hooks rules, and React Refresh plugins for `.js` and `.jsx` sources.

## Subdirectories & System Boundaries

- **src**: [`./src/EGM.md`](./src/EGM.md) — Single Page Application (React 19, Vite, Tailwind CSS v4), including component UI hierarchy, context providers, custom hooks, route pages, and the admissions engine.
- **supabase**: [`./supabase/EGM.md`](./supabase/EGM.md) — Database boundary: PostgreSQL DDL migration ledger, RLS policies, security definer RPC functions, and bulk admissions seed data.
- **lib**: [`./lib/EGM.md`](./lib/EGM.md) — Shared Python utility package for exam JSON parsing, Word-to-Markdown AI pipeline (Gemini), and Supabase service-role client.
- **scripts**: [`./scripts/EGM.md`](./scripts/EGM.md) — Administrative and build CLI scripts: exam authoring, admissions data crawling and merge pipeline, schema introspection, and PDF image extraction.
- **skills**: [`./skills/EGM.md`](./skills/EGM.md) — Catalog of Agent Skills (`SKILL.md` packages) for UI prompt generation, Remotion video walkthroughs, and design systems.

## Global Invariants

- **Separation of Front-end and Tooling**: Browser code under `src/` never imports from `scripts/`, `lib/`, or `supabase/`. Tooling scripts communicate with Supabase via the service role key or REST API, while browser code uses the public anon key with strict RLS enforcement.
- **Security Definer Database Access**: User mutations on sensitive progression data (EXP, VIP status, session tracking) are guarded by PostgreSQL `SECURITY DEFINER` RPCs with pinned search paths; direct table writes from the browser are blocked by RLS.
- **Immutable Asset Hashing**: Production client builds enforce content hashing on all CSS/JS bundles (`assets/[name]-[hash].[ext]`), allowing aggressive long-term HTTP caching headers on CDN edge nodes.
- **Lean Production Runtime Manifest**: Runtime dependencies exclude decommissioned PDF rendering packages (`pdfjs-dist`, `react-pdf`) and isolate out-of-band tools (`katex`) to `devDependencies`; static distribution excludes unreferenced worker assets (`public/pdf.worker.min.mjs` pruned by 1.37 MB).
- **Unified Exam Asset Schema**: All exam definitions follow the single canonical `resources` block layout specified above.

## Global Side Effects

- **Supabase Cloud State**: Modifies tables and storage buckets in the remote Supabase project during script migrations, seed data loading, and client interactions.
- **Local File System**: `scripts/` and `dtht.py` read, mutate, and generate JSON files, cropped question images, and KaTeX CSS bundles.
- **External AI Services**: Document extraction pipelines in `lib/raw_extractor.py` make outbound API calls to Google Gemini when AI cleaning is enabled.

## System Verification

- Run: `npm run lint && npm run build`
