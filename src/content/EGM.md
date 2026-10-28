# Editorial Content (`src/content`)

## Overview

Copy-only content models for marketing/informational pages. `courseCatalog.js`
holds the entire structured content of the HS12 combo-course landing page
(title, subtitle, five learning packages, outcomes, phases, timeline), keeping
Vietnamese marketing copy out of the React component so the page stays a pure
renderer.

## Interface

- `comboHs12Course` — a single frozen-by-convention content object with:
  - Identity and SEO copy: `id`, `path`, `audience`, `title`, `subtitle`,
    `summary`, `packageIntro`, `highlights[]`.
  - `metrics` — `Array<{ value, label }>` headline statistics.
  - `learningPackages` — five ordered entries
    (`single-course`, `one-subject-full`, `exam-cluster`, `national-exam`,
    `full-combo`) each with `label`, `name`, `subtitle`, `goal`, `bestFor`,
    `action`, `icon`, `tags[]`.
  - `outcomes[]`, `modules` (`{ phase, title, copy, tags[] }`),
    `timeline` (`{ label, text }`), `surfaces[]`.

## Invariants

- `learningPackages` is ordered from smallest commitment to broadest and the
  page renders it in array order; do not reorder without updating the visual
  variants array in `src/pages/CourseComboHs12.jsx`, which is index-aligned with
  it (five entries, five visual presets).
- `icon` values are Material Symbols names that the page maps to its icon set;
  an unknown name degrades the card header.
- `path` must stay in sync with the route registered in `src/App.jsx`
  (`courses/combo-dtht-hs12-2k9-chinh-phuc-dai-hoc`) and with the nav links in
  `src/components/RootLayout.jsx`.
- Every package carries all four decision fields (`goal`, `bestFor`, `action`,
  `tags`) — the layout assumes none are missing.
- This module is data only: no functions, no imports, no derived state.

## Side Effects

- None. Pure static export; importing it performs no I/O and mutates no global
  state.

## Verification

- Run: `npm run lint && npm run build`
