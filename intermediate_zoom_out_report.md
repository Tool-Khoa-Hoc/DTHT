# Stage 8: Intermediate Zoom Out Review Report

**Target Document**: `E:\dtht\docs\designs\web_performance_optimization.md`
**Prior Inputs**: `zoom_out_report.md` (Stage 5), `comprehension_report.md` (Stage 6), `critic_report.md` (Stage 7)
**Standard**: Zoom Out Standard (Architecture Integrity, Scope Discipline, Anti-YAGNI)

---

## Executive Architectural Synthesis
Across the Comprehension and Critic stages, the core premise of this design remains valid: removing unreferenced dead packages (`pdfjs-dist`, `react-pdf`, `katex`), deleting `public/pdf.worker.min.mjs` (1.37 MB), and stripping the dead `unpkg.com` DNS prefetch provides verified, high-impact payload reductions.

However, the design document has accumulated architectural contradictions, ungrounded ghost requirements, and scope creep that must be resolved before proceeding to implementation readiness.

---

## Consolidated Intermediate Findings

### 1. Architectural Contradiction: Deferral vs. Permanent Deletion (Blocker)
- **Category**: Structural & Architectural Integrity
- **Impact**: Lines 14, 20, and 25 frame the PDF strategy as "deferring the PDF worker script until document viewing is requested" and cite "migrating away from pdfjs-dist" as a non-goal. In contrast, the Technical Plan and Implementation Matrix explicitly establish that the PDF viewer UI was already decommissioned from `src/`, that `pdfjs-dist` and `react-pdf` are dead packages being uninstalled, and that `public/pdf.worker.min.mjs` is being permanently deleted.
- **Architectural Decision**: A system cannot defer a worker that it deletes. The document must cleanly adopt the **permanent deletion model**, eliminating all claims of runtime worker deferral.

### 2. Scope Creep: Unrelated Admin Subsystem Refactoring (Major)
- **Category**: Scope Discipline & Anti-YAGNI
- **Impact**: Bundling the decomposition of `src/pages/Admin.jsx` (748 lines) into modular components (`src/components/admin/`) inflates the scope of a mobile student performance ticket. The `/admin` view is strictly role-gated to administrators and already isolated in a lazy-loaded route chunk (`routeModuleLoaders.Admin`). Refactoring it produces 0 kB savings for mobile students on cellular connections and introduces regression risks to admin directory fallback RPCs.
- **Architectural Decision**: Remove the `Admin.jsx` refactor from this design. Track admin UI modularization in a dedicated maintainability ticket.

### 3. Ghost Scope: Dangling Exam Question List Memoization (Major)
- **Category**: Grounded Requirements
- **Impact**: Goal 5 mandates eliminating "redundant re-renders in exam question lists through component memoization and helper function hoisting". No exam question list components exist in `src/`, and no implementation steps address this goal. It is an ungrounded ghost requirement carried over from legacy notes.
- **Architectural Decision**: Strike out Goal 5 and corresponding mentions in the Overview.

### 4. Broken Asset Resolution Chain for KaTeX Removal (Major)
- **Category**: Build Stability & Anti-YAGNI
- **Impact**: The design uninstalls `katex` from `package.json` while specifying `src/styles/katex-minimal.css` as a reference fallback for future LaTeX typesetting. However, `katex-minimal.css` contains 11 `@font-face` rules pointing to relative font binaries (`url(fonts/KaTeX_*.woff2)`). No font files exist in `src/styles/fonts/` or `public/fonts/`; they were previously resolved via `node_modules/katex/dist/fonts/`. If any component ever imports `katex-minimal.css`, the Vite build will fail with unresolvable asset errors.
- **Architectural Decision**: Do not specify speculative font fallback stylesheets for dead dependencies. Either remove `src/styles/katex-minimal.css` or demote KaTeX to an optional `devDependency` strictly for out-of-band scripts.

### 5. Missing Runtime Verification Safety Net (Major)
- **Category**: Verification Completeness
- **Impact**: Static grep confirms zero static imports, but Vite resolves routes dynamically via `import()`. A route traversal smoke test (mounting all 15 routes in `App.jsx` in development to ensure zero runtime chunk 404s) is required to guarantee that no latent dynamic imports break post-pruning.
- **Architectural Decision**: Add a 15-route dynamic mount smoke test to the verification plan.

### 6. Factual Inaccuracies in Manifest & HTML Analysis (Nit)
- **Category**: Factual Accuracy
- **Impact**: `package.json` does not contain `lucide-react`, `dotenv`, or `react-katex` (they are already absent). `index.html` line 50 contains `<link rel="dns-prefetch" href="https://unpkg.com" />`, which is a DNS prefetch, not a TCP/TLS preconnect.
- **Architectural Decision**: Correct package names and tag references to match the actual repository files.

---

## Final Reviewer Alignment Matrix

| ID | Issue | Severity | Status | Target Action |
|---|---|---|---|---|
| IZO-01 | PDF Deferral vs Deletion contradiction | 🔴 Blocker | Open | Align Overview & Goals with complete deletion. |
| IZO-02 | Admin tab refactor scope creep | 🟡 Major | Open | Strip Admin.jsx refactoring from scope. |
| IZO-03 | Exam question memoization ghost goal | 🟡 Major | Open | Purge ungrounded goal from document. |
| IZO-04 | Broken font asset path chain in KaTeX minimal | 🟡 Major | Open | Drop speculative font fallback architecture. |
| IZO-05 | Missing dynamic route smoke test | 🟡 Major | Open | Add 15-route mount verification requirement. |
| IZO-06 | Manifest & HTML tag naming inaccuracies | 🟢 Nit | Open | Correct package and `dns-prefetch` references. |
