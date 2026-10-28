# Stage 9: Implementation Readiness Report

**Target Document**: `E:\dtht\docs\designs\web_performance_optimization.md`
**Reviewers**: `egm-implementation-readiness`, `egm-codebase-details`
**Scope**: `DetailedRange` (lines 113..159)

---

## Executive Verdict
Steps 1 through 5 (package removal, static file deletion, and Vite chunk rule reconfiguration) are concrete, topologically sound, and straightforward to execute.

However, the plan has two critical blockers: a literal tag mismatch in `index.html` (`preconnect` vs `dns-prefetch`) and an actionable ambiguity in Step 6 (`Admin Tab Decoupling`), alongside orphaned maintenance tooling (`scripts/generate-katex-minimal.mjs`).

---

## Findings

### 1. Literal Mismatch in `index.html` Target String (Blocker)
- **Severity**: 🔴 Blocker
- **Section**: `Step 3` (line 125) & File Matrix (line 149)
- **Rationale**:
  The plan specifies removing `<link rel="preconnect" href="https://unpkg.com">`. In `index.html` line 50, the literal tag is:
  ```html
  <link rel="dns-prefetch" href="https://unpkg.com" />
  ```
  An automated patcher or developer executing search-and-replace will fail to match the string.
- **Remediation**:
  Update Step 3 and the matrix to cite `<link rel="dns-prefetch" href="https://unpkg.com" />`.

### 2. Under-specified Contract for Step 6 Admin Tab Decoupling (Blocker)
- **Severity**: 🔴 Blocker
- **Section**: `Step 6` (lines 135-138) & File Matrix (lines 152-155)
- **Rationale**:
  Step 6 leaves component props, callback handlers, and state interfaces completely undefined. Furthermore, as established across Stages 5, 7, and 8, the `/admin` view is an authenticated, lazy-loaded route whose refactoring does not improve student mobile latency or reduce initial FCP/TTI.
- **Remediation**:
  Strip Step 6 and lines 152-155 from this performance design completely.

### 3. Orphaned Build Tooling on KaTeX Removal (Major)
- **Severity**: 🟡 Major
- **Section**: `Step 1` & File Matrix (lines 147, 156)
- **Rationale**:
  `scripts/generate-katex-minimal.mjs` directly reads `node_modules/katex/dist/katex.min.css`. Uninstalling `katex` in Step 1 will cause this maintenance script to fail with `ENOENT`.
- **Remediation**:
  Move `katex` to `devDependencies` if the generation script is preserved, or add `scripts/generate-katex-minimal.mjs` to the File Impact Matrix with action `ARCHIVE`.

### 4. Verification Command Inadequacy for Dynamic Route Health (Major)
- **Severity**: 🟡 Major
- **Section**: `Step 7` (lines 139-140)
- **Rationale**:
  `npm run lint && npm run build` only verifies build-time bundling. Latent dynamic imports inside async route chunks require runtime verification.
- **Remediation**:
  Add an explicit route traversal verification requirement: boot dev server and mount all 15 routes in `src/App.jsx` to ensure zero runtime chunk loading errors.

---

## Final Readiness Traceability Matrix

| ID | Category | Severity | Finding | Actionable Fix |
|---|---|---|---|---|
| IR-01 | Code Fidelity | 🔴 Blocker | `index.html` tag cited as `preconnect` instead of `dns-prefetch`. | Change target string to `<link rel="dns-prefetch" href="https://unpkg.com" />`. |
| IR-02 | Actionability / YAGNI | 🔴 Blocker | Step 6 lacks prop contracts and inflates performance scope. | Remove Step 6 and admin tab components from scope. |
| IR-03 | Build Tooling | 🟡 Major | `generate-katex-minimal.mjs` breaks if `katex` is purged from node_modules. | Move `katex` to `devDependencies` or archive the script. |
| IR-04 | Verification | 🟡 Major | `npm run build` does not catch runtime chunk 404s. | Add 15-route dynamic mount smoke test. |
