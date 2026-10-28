# Admission Engine (`src/lib/admission`)

## Overview

The pure-logic core of the university-admission feature set: exam registry,
subject/combination catalogues, score-profile schema and migration, historical
cutoff loading, equipercentile conversion anchors, school-specific formulas, and
the statistical admission-probability model. Pages are expected to call these
modules rather than re-implement any of the rules; several files explicitly
document themselves as the single source of truth after previous duplication
bugs (swapped HSA/V-ACT labels, a bad BKHCM denominator, a linear cross-scale
conversion used as a primary path).

## Interface

- `combos.js`
  - `COMBOS` — `{ [comboCode]: { subjects: string[], weights?: number[] } }`.
  - `COMBO_CODES` — `Object.keys(COMBOS)`.
  - `comboScore(subjects, comboCode, { weights } = {})`,
    `comboRawScore(subjects, comboCode, { weights } = {})`.
  - `allComboScores(subjects)` — every combo the candidate can form.
  - `bestComboFor(subjects, allowedCombos)`.
  - `parseComboField(raw)` — normalises free-text combo fields from crawled data.
- `conversions.js`
  - `equipercentile(score, anchors)` → `{ value, extrapolated }`.
  - `validateAnchorSet(set)` → `{ ok, reason }`.
  - `CONVERSION_SETS` — anchor sets keyed by `fromExam`/`toExam`/`combo`/`year`
    with `framework`, `scope`, `status`, `sourceUrl`.
  - `findAnchorSet({ fromExam, toExam = 'thpt', combo, year = 2025, scope = 'national' })`.
  - `convertScore(score, opts)` → value plus provenance/reason.
  - `anchorStatus(fromExam, year)`.
- `cutoffs.js`
  - `loadCutoffsFromSupabase(supabaseClient)`,
    `loadCutoffs(fetchFn = fetch, supabaseClient = null)`.
  - `clearCutoffCache()`, `normalizeRecord(r)`, `groupHistories(records)`.
- `distributions.js`
  - `SCORE_DISTRIBUTIONS` — official score-spectrum rows per exam/year/session.
  - `getDistribution(exam, year, session = 'chung', extra = [])`,
    `spectrumEvidence(exam, year, extra)` → `'official' | 'press' | 'none'`.
  - `zOf(score, dist)`, `percentileOf(exam, year, score, extra)`,
    `comboMean(exam, year, combo, extra)`.
- `exams.js`
  - `EXAMS` — registry with `code`, `label`, `full`, `org`, `scale`, `unit`,
    `sigmaFloor`, optional `parts`/`subParts`, `noCrossConvert`.
  - `normalizeMethodCode(raw)`, `getExam(code)`.
  - `REGION_PRIORITY` (`KV1 0.75`, `KV2-NT 0.5`, `KV2 0.25`, `KV3 0`),
    `CATEGORY_PRIORITY` (`UT1 2.0`, `UT2 1.0`, `NONE 0`),
    `PRIORITY_TAPER_START = 22.5`, `PRIORITY_TAPER_SPAN = 7.5`.
- `format.js` — `fmt(n, digits = 2)`, `digitsForScale(scale)`.
- `formulas.js`
  - `bcaCombinedScore({ thptComboScore, bcaExamScore, bonus, region, category })`,
    `hcmutCombinedScore(input)`, `hscaComboScore({ monChinh, hb1, hb2 })`,
    `sptComboScore(subjectScores, comboCode, { weights })`,
    `vsatComboScore(subjectScores150)`.
  - `INTEGRATED_FORMULAS`, `integrated100Score(schoolCode, input)`,
    `uehIntegratedScore(input)`.
- `gpa.js`
  - `GPA_SCALES` (`vn-common` step table), `getGpaScale(scaleId)`,
    `convertTo4(grade10, scaleId)`, `toGpa4(grade10, scaleId)`,
    `gpaSemester(subjects, scaleId)`, `gpaCumulative(semesters, scaleId)`,
    `gpa10Average(subjects)`.
- `predict.js`
  - Re-exports `equipercentile` for backward compatibility.
  - Constants `WEIGHTS_3Y = [0.5, 0.3, 0.2]`, `SIGMA_CAP = 2.5`,
    `SIGMA_DEFAULT_1Y = 1.1`, `DATA_FACTOR = { 3: 1.0, 2: 1.25, 1: 1.6 }`, `clamp`.
  - `phi(z)`, `priorityApplied(raw30, region, category)`,
    `priorityAppliedForScale(rawOnScale, scale, region, category)`,
    `normalizeMarginTo30(value, scale)`.
  - `forecastCutoff(history, quotaNext, specShift)`,
    `sigmaFloorFor(methodCode)`, `sigmaEff(history, methodCode, opts)`,
    `computeConfidence(history, ctx)`, `bandOf(p)`.
  - `estimateChannel(candidate, history, methodCode, ctx)`,
    `portfolioHealth(list)`, `DISCLAIMER`.
- `schools.js` — `REGION_LABELS`, `SCHOOL_REGIONS`, `regionOfSchool(code)`.
- `scores.js`
  - `SCORES_VERSION = 3`, `emptyScoreProfile()`.
  - `migrateLegacyScores(legacy, local)`, `migrateToV3(profile, local)`.
  - `getScore(profileV3, methodCode)`, `saveScoreEntry(profileV3, code, entry)`.
  - `validateEntry(code, entry)`, `validateScoreInput(code, total)`.
- `subjects.js` — `SUBJECTS`, `SUBJECT_KEYS`, `SUBJECT_LABEL`, `normalizeText`,
  `canonicalSubjectKey(rawKey)`, `canonicalSubjects(subjects)`.

## Invariants

- `exams.js` is the only source of exam labels and scales: THPT / học bạ = 30,
  HSA = 150 (ĐHQG Hà Nội), V-ACT = 1200 (ĐHQG TP.HCM), TSA = 100 (BKHN),
  BCA = 100. Never hardcode these on a page.
- Points fed to `estimateChannel` must already be on a 30-equivalent scale and
  share the scale of every `history[].cutoff`.
- Cross-exam conversion may use **only** `equipercentile` anchors of the matching
  year. Linear scale-ratio conversion is forbidden as a primary path;
  `normalizeMarginTo30` exists for margins only, never for candidate scores.
- Missing anchors return `{ value: null, reason: 'no-anchor' }`; out-of-range
  scores clamp to the edge anchor and set `extrapolated`, never extrapolate.
- Anchor sets need ≥ 3 points, strictly descending `src` and non-increasing
  `dst`; a 1–2 point set is `'khoang-tham-khao'` and is not interpolable.
- Cutoff history is grouped by `(schoolCode, majorCode, combo, method, segment)`,
  never by display name, and `reliability` is preserved so `predict.js` can
  discount secondary sources.
- `forecastCutoff` weights 0.5/0.3/0.2 for three years, 0.65/0.35 for two, 1.0
  for one; the trend adjustment is clamped to ±0.75 and the quota adjustment to
  ±1.
- `sigmaEff` never drops below the method's `sigmaFloor` and never exceeds
  `SIGMA_CAP = 2.5`, widening by `DATA_FACTOR` when history is short or the
  current spectrum is missing.
- Confidence below 50 triggers shrinkage of the probability toward 0.5 and
  `showPercent: false`; `reliability === 'C'` subtracts 10 confidence points and
  must surface `reliabilityWarning`.
- Priority bonus tapers linearly from 22.5 to 30 total points and is applied on a
  30 scale then rescaled — the only permitted priority path.
- `saveScoreEntry` is the sole write path for `profiles.admission_scores` (deep
  merge + `updatedAt`). Pages must never spread the profile JSON themselves.
- Score entry `status` is one of `actual | mock | target | none`.
- Migration is lossless: unknown legacy shapes are parked in
  `legacy_unverified` rather than silently re-labelled onto an exam.
- Subject keys are lowercase, diacritic-free canonical strings; `canonicalSubjects`
  must be used on any externally sourced subject names.
- GPA: a subject with `grade === null/undefined/''` is excluded from the average,
  while a genuine `0` counts. `fmt()` returns `'—'` for non-finite input and
  `digitsForScale` prints 0 decimals for the 1200/450 scales.
- V-ACT sessions are never merged (retake cohorts differ); TSA IRT spectra are
  descriptive only and must not be inverted to raw scores.

## Side Effects

- `cutoffs.js` performs network I/O: Supabase reads of `admission_cutoffs`
  (paged, 1000 rows per request) and `admission_schools`, with a static JSON
  fallback via `fetch` when Supabase is unavailable.
- `cutoffs.js` holds a module-level `cache` shared by all callers; `clearCutoffCache()`
  is the only way to invalidate it.
- No React state, storage, or timers in this directory — all other modules are
  pure functions over their arguments.

## Verification

- Run: `npm run lint && npm run build`
