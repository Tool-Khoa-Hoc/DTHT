# Consolidated Review Report: Web Performance Optimization

**Document Under Review**: [`docs/designs/web_performance_optimization.md`](./docs/designs/web_performance_optimization.md)  
**Pipeline**: Full EGM Antagonistic Review Loop (Stages 5–9)  
**Date**: 2026-10-28  

---

## Executive Summary
The technical design document underwent full-spectrum review by specialized reviewer personas:
- **Stage 5 (Initial Zoom Out)**: High-altitude architecture, minimalism, and YAGNI evaluation.
- **Stage 6 (Comprehension Test)**: Re-implementation viability and zero-context readability.
- **Stage 7 (Critic Review)**: Antagonistic design, structural layout, and style audit.
- **Stage 8 (Intermediate Zoom Out)**: Scope convergence and architectural trade-off synthesis.
- **Stage 9 (Implementation Readiness Test)**: Codebase fidelity, contract actionability, and verification completeness.

The review confirmed the core value proposition: purging dead dependencies (`pdfjs-dist`, `react-pdf`, `katex`), deleting `public/pdf.worker.min.mjs` (1.37 MB static transfer), and removing the unneeded `unpkg.com` DNS prefetch delivers significant, verified payload savings for mobile users.

The review flagged several key remediation targets to address during execution:
1. Reconcile the architectural contradiction between worker deferral and permanent deletion.
2. Strip unrelated `Admin.jsx` refactoring from this mobile performance scope. Code audit revealed that existing components in `src/components/admin/` are outdated replicas with client-side query bottlenecks (unindexed full-table scan in `AdminThongSoai.jsx`), missing fallback handlers, and blocking `window.alert()` calls that would cause regressions if swapped in.
3. Fix the `index.html` tag literal (`dns-prefetch` vs `preconnect`).
4. Keep `katex` in `devDependencies` to prevent breaking out-of-band maintenance scripts like `scripts/generate-katex-minimal.mjs`.
5. Remove stale comments in `vite.config.js` (line 41).
6. Add runtime route traversal testing to catch dynamic import chunk errors.

---

## Consolidated Traceability Matrix

| ID | Originating Stage | Category | Severity | Finding Summary | Recommended Action |
|---|---|---|---|---|---|
| **CR-01** | Stage 7, 8 | Architecture | 🔴 Blocker | Deferral vs. deletion contradiction in Overview/Goals vs. Plan. | Standardize document on complete deletion model. |
| **CR-02** | Stage 9 | Codebase Fidelity | 🔴 Blocker | `index.html` cited as `preconnect` instead of literal `dns-prefetch`. | Update target string to `<link rel="dns-prefetch" href="https://unpkg.com" />`. |
| **CR-03** | Stage 5, 7, 8, 9 | Scope / Regression | 🔴 Blocker | `Admin.jsx` refactor introduces severe regressions (unindexed scans in `AdminThongSoai`, blocking alerts, missing RPC fallbacks). | Strip Admin tab refactoring from this performance plan completely. |
| **CR-04** | Stage 7, 8 | Grounding | 🟡 Major | Dangling goal for exam question list memoization lacks code backing. | Remove ungrounded memoization goal. |
| **CR-05** | Stage 8, 9 | Build Tooling | 🟡 Major | `scripts/generate-katex-minimal.mjs` fails if `katex` is deleted. | Keep `katex` in `devDependencies` or archive the script. |
| **CR-06** | Stage 7, 8, 9 | Verification | 🟡 Major | `npm run build` misses runtime chunk 404s on dynamic routes. | Add 15-route dynamic mount smoke test. |
| **CR-07** | Stage 6 | Comprehension | 🟢 Nit | Domain acronyms (`THPTQG`, `FCP`, `TTI`, `cmaps`) lack initial expansion. | Expand acronyms on first occurrence. |
| **CR-08** | Stage 7 | Factual Accuracy | 🟢 Nit | Problem statement cites absent packages (`lucide-react`, etc.). | Cite actual lingering dependencies (`pdfjs-dist`, `react-pdf`, `katex`). |
| **CR-09** | Stage 9 | Stale Code | 🟢 Nit | Line 41 of `vite.config.js` contains stale comment about `pdf.worker`. | Remove stale comment during threshold update. |

---

## Review Artifacts Index
- [Stage 5 Report (zoom_out_report.md)](./zoom_out_report.md)
- [Stage 6 Report (comprehension_report.md)](./comprehension_report.md)
- [Stage 7 Report (critic_report.md)](./critic_report.md)
- [Stage 8 Report (intermediate_zoom_out_report.md)](./intermediate_zoom_out_report.md)
- [Stage 9 Report (implementation_readiness_report.md)](./implementation_readiness_report.md)
