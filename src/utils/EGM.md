# Utilities (`src/utils`)

## Overview

Small, dependency-light helpers shared across pages: gamification maths
(EXP → level, rank ladder), safe URL/media handling, duration formatting, and a
browser-side `.docx` reader that converts Word XML into Markdown-ish token lines
with embedded base64 images and LaTeX maths. Everything here is framework-free
except the DOMParser/JSZip usage in the docx parser, so it can be imported by
React components and plain modules alike.

## Interface

- `levelHelper.js`
  - `EXP_PER_MINUTE = 10`, `DAILY_STUDY_EXP_CAP = 3000`,
    `DAILY_STUDY_SECONDS_CAP = 18000`.
  - `minExpForLevel(level)` — `50 * L * (L - 1)`.
  - `getLevelFromExp(exp)` → `{ level, exp, currentLevelMinExp, nextLevelMinExp,
    expForThisLevel, expIntoLevel, expToNext, progressPct }`.
  - `getLevelAccent(level)` → `{ text, ring, bar, glow }` Tailwind token bundle.
  - `formatStudyTime(totalSeconds)` → e.g. `"12 giờ 30 phút"`.
- `rankHelper.js`
  - `RANK_TIERS` — ordered `{ name, min, color, bg, border, icon, requiresApproval? }`
    (`Tân Binh` 0 → `Bang Chủ` 50, approval-gated).
  - `getUserRank(completedCount, role, isApprovedBangChu)` → current rank plus
    `nextRank`, `isMax`, and a `progress` block.
- `urlSecurity.js` — `sanitizeExternalUrl(input)` → normalised `http(s)` URL or
  `null`; `assertSafeExternalUrl(input, fallbackMessage)` → URL or throws.
- `mediaPath.js` — `resolveMediaPath(input, basePath)`; leaves absolute URLs and
  URI schemes untouched, normalises Windows back-slashes, prefixes relative
  paths.
- `timeFormat.js` — `formatTime(seconds)` → `HH:MM:SS`, or `MM:SS` under an hour.
- `docxParser.js` — `parseDocx(fileBlob)` (async) → `{ lines, assets }`, where
  `lines` are Markdown-ish token strings and `assets` is
  `{ images: { [id]: { source: dataUrl, ext } }, math: { [id]: { math: latex, source } } }`.

## Invariants

- The EXP economy in `levelHelper.js` must stay in sync with the
  `award_study_exp()` SQL migration: 10 EXP per verified minute, level L→L+1
  costs `100 * L`, reaching L needs `50 * L * (L - 1)`, and the closed form
  `floor((50 + sqrt(2500 + 200 * exp)) / 100)` is the inverse of that curve.
  Changing one side without the other desynchronises client and server.
- `getLevelFromExp` clamps input to a non-negative integer and always returns
  `progressPct` in `0..100`; `minExpForLevel` floors and clamps level to ≥ 1.
- `RANK_TIERS` is ordered by ascending `min`. `getUserRank` short-circuits first
  for `admin` (`Thống Soái`) and `collaborator`/`editor` (`Truyền Đạo Sư`), then
  walks the ladder. `Bang Chủ` (min 50) is only granted when
  `isApprovedBangChu` is true — otherwise the user stays at `Phó Bang Chủ` and
  `progress.pendingApproval` is set.
- `getUserRank` percentage maths is guarded so `nextRank.min` is never 0 for a
  tier that has one.
- `sanitizeExternalUrl` accepts only absolute `http:`/`https:` URLs; it returns
  `null` for non-strings, empty strings, relative paths, and `javascript:`/`data:`
  schemes. `assertSafeExternalUrl` is the throwing variant and its message
  defaults to `'Link tài liệu không hợp lệ.'`.
- `resolveMediaPath` must be idempotent for absolute URLs and scheme URIs
  (`http:`, `https:`, `data:`, `blob:`, `//`, `/`); with no `basePath` it only
  normalises separators and never invents a prefix.
- `formatTime` assumes a finite non-negative number of seconds and zero-pads each
  field to two digits.
- `parseDocx` requires a valid OOXML package: it throws
  `"Invalid .docx: missing word/document.xml"` when the archive lacks the main
  document part. Every image/maths asset is content-hashed (SHA-1, 12 hex chars)
  and deduplicated, so repeated references share one asset entry.
- Docx output tokens are a private interchange format (`[math:$...$]`,
  `[!b:$...$]`, `[!i:$...$]`, `[!sub:...]`, `[!sup:...]`) — consumers must treat
  them as opaque and not re-parse with ad-hoc regexes.

## Side Effects

- `parseDocx` performs CPU/IO-heavy browser work: `JSZip.loadAsync` on the
  supplied blob, XML parsing with `DOMParser`/`XMLSerializer`, `crypto.subtle.digest`
  hashing, and base64 encoding of embedded images into data URLs (memory grows
  with document size).
- No network access, no localStorage, no timers, no global state mutation in any
  module here.

## Verification

- Run: `npm run lint && npm run build`
