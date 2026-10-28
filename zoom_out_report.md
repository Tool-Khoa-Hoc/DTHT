# Stage 5: Initial Zoom Out Review Report

**Target Document**: `E:\dtht\docs\designs\web_performance_optimization.md`
**Standard**: Zoom Out Standard (High-altitude simplicity, YAGNI, Codebase Reuse, Self-Consistency)

---

## Executive Verdict
The core problem framing and remediation vectors (purging phantom dependencies `pdfjs-dist`, `react-pdf`, `katex`, deleting unreferenced `public/pdf.worker.min.mjs`, and eliminating the dead `unpkg.com` preconnect) are high-impact, sound, and strictly necessary.

However, the design exhibits scope creep by bundling unrelated architectural refactoring (`Admin.jsx` monolithic decomposition) under a "Web Performance Optimization" design without measuring its transfer or execution performance impact.

---

## Findings

### 1. Scope Creep: Unmotivated Admin Monolith Refactoring
- **Severity**: 🟡 Major
- **Section**: `Technical Plan > 4. Component Lifecycle & Boundary Hardening` & `Detailed Implementation`
- **Rationale**:
  The document packages a refactor of `src/pages/Admin.jsx` (extracting inline tabs into `src/components/admin/`) as part of a performance optimization initiative. However:
  1. `/admin` is an authenticated, role-gated admin route already isolated in a lazy-loaded dynamic chunk (`routeModuleLoaders.Admin`). Its size does not affect public users, students on cellular connections, or initial page load (FCP/TTI).
  2. The refactor does not actually reduce overall JavaScript payload or parse time unless the tabs themselves are lazy-loaded via `React.lazy` inside `Admin.jsx` (which the design does not specify; it merely proposes standard imports).
  3. Reconciling three disconnected component replicas (`AdminLibrary.jsx`, `AdminCollaborator.jsx`, `AdminThongSoai.jsx`) introduces regression risks to admin moderation without advancing the primary goal of cutting public transfer size.
- **Remediation**:
  Either:
  - Drop the `Admin.jsx` refactor from this performance design to keep the scope clean and YAGNI-compliant (defer to a dedicated code cleanup task).
  - OR, explicitly justify it by making the three admin tabs individually lazy-loaded (`React.lazy()` + `Suspense`), demonstrating measurable chunk reduction for the primary `/admin` shell.

### 2. Speculative Policy vs Concrete Action: KaTeX Subsetting Policy
- **Severity**: 🟢 Nit
- **Section**: `Technical Plan > 3. Font Asset Subsetting Policy`
- **Rationale**:
  The design acknowledges that KaTeX is not currently imported or used anywhere in `src/`, yet devotes significant specification space to defining a forward-looking "Font Asset Subsetting Policy" for hypothetical future LaTeX rendering. While preserving `src/styles/katex-minimal.css` is harmless, treating speculative future feature rules as active technical plan deliverables violates YAGNI minimalism.
- **Remediation**:
  Retain `src/styles/katex-minimal.css` as a static asset, but reframe Section 3 from an active implementation task to a brief architectural invariant/note: "If LaTeX typesetting is re-introduced, consumers must import `src/styles/katex-minimal.css`."

### 3. Self-Consistency in Target Transfer Savings
- **Severity**: 🟢 Nit
- **Section**: `Goals` vs `Detailed Implementation`
- **Rationale**:
  The goals section sets a target of "at least 300 kB (compressed)". In reality, removing `public/pdf.worker.min.mjs` alone eliminates **1.37 MB raw / ~399 kB gzip** of transfer, and removing `pdfjs-dist`, `react-pdf`, and `katex` prevents accidental vendor bundling. The design exceeds its conservative target by a factor of 4x. Clarify that the goal is easily met primarily through static asset elimination.

---

## Traceability Summary

| ID | Category | Severity | Description | Recommended Fix |
|---|---|---|---|---|
| ZO-01 | YAGNI / Scope | 🟡 Major | Admin tab refactor is bundled without lazy chunking and does not impact public student FCP/TTI. | Drop from performance scope or specify `React.lazy` tab splitting. |
| ZO-02 | Speculative Logic | 🟢 Nit | KaTeX font subsetting is framed as active work for an unused capability. | Reframe as an architectural invariant note. |
| ZO-03 | Metric Alignment | 🟢 Nit | Transfer savings target (300 kB) understates the actual 1.37 MB / 400 kB static reduction. | Align metric statement with actual savings. |
