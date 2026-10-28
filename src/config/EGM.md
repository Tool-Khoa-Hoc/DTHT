# Static Configuration (`src/config`)

## Overview

Build-time configuration data for the online-learning catalogue. The subject
and teacher roster lives in a generated JSON seed; `onlineLearning.js` derives
the render-ready list from it and owns the URL-building rules for embedded
Google Sheets. This directory has no runtime dependencies on Supabase — it is
the offline, versioned copy of the teacher/sheet mapping.

## Interface

- `teachers.seed.json` — generated seed, top-level shape:
  `{ version: string, source: string, subjects: Array<{ id, label, shortLabel, icon, color }>, teachers: Array<{ subjectId, title, sheetId, url }> }`.
  `version` is a date stamp (`"2026-10-22"`), `source` records the generator
  input (`tool/all-pairs.json`, 47 teacher/subject pairs).
- `ONLINE_SHEET_TITLE` — heading string for the online-learning sheet gallery.
- `ONLINE_SUBJECTS` — `Array<{ id, label, shortLabel, icon, color, teachers: Array<{ title, sheetId, url }> }>`,
  produced by joining `teachers.seed.json` subjects with their teachers.
- `ONLINE_TEACHER_COUNT` — total number of teachers across all subjects.
- `getTeacherKey(subjectId, teacher, index)` — stable React key
  (`${subjectId}-${teacher.sheetId || index}-${index}`).
- `getSheetGid(teacher)` — extracts the `gid` query/fragment parameter from
  `teacher.url`, defaulting to `'0'`.
- `buildSheetEmbedUrl(teacher, refreshToken = '')` — Google Sheets `/preview`
  iframe URL with `widget=true&headers=false` and an optional `_` cache-buster.
- `buildSheetOpenUrl(teacher)` — prefers `teacher.url`, otherwise constructs an
  `/edit` URL, otherwise `'#'`.

## Invariants

- The seed is **generated**: the header comment forbids hand-editing the teacher
  list; regenerate with `node scripts/generate-teachers-seed.mjs` and commit the
  seed instead.
- `teachers` entries are matched to subjects by exact `subjectId`; a teacher with
  an unknown `subjectId` is silently dropped from `ONLINE_SUBJECTS`, and
  `ONLINE_TEACHER_COUNT` therefore counts only joined entries.
- `buildSheetEmbedUrl` returns `''` when `sheetId` is missing — callers must
  treat the empty string as "no embeddable sheet", not as a valid URL.
- `buildSheetOpenUrl` always returns a usable href (`'#'` worst case), so it can
  be bound directly to an anchor without a null check.
- Subject `icon` values are Material Symbols names consumed by the inline SVG
  map in `src/components/ui/SubjectCard.jsx`; adding an icon requires adding a
  path there too.
- `color` is a hex string used directly as an inline background colour.
- Teacher ordering follows the seed order; the course page relies on that
  ordering being stable across builds.

## Side Effects

- None at runtime: static imports only, no network, storage, timers, or global
  mutation. The JSON import uses `with { type: 'json' }`, so the Vite build
  inlines the seed into the bundle.

## Verification

- Run: `npm run lint && npm run build`
