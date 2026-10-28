# Stage 7: Critic Review Report

**Target Document**: `E:\dtht\docs\designs\web_performance_optimization.md`
**Reviewers**: `egm-design`, `egm-structural`, `egm-style`, `egm-zoom-out`
**Scope**: `FeatureRange` (lines 1..112)

---

## Executive Verdict
The core performance thesis—removing unused PDF and KaTeX packages, deleting the 1.37 MB static worker, and stripping the dead unpkg prefetch—is technically validated.

However, the feature specification suffers from internal architectural contradictions (deferral vs. outright deletion), scope inflation (internal admin tab refactoring), and ghost requirements carried over from legacy notes.

---

## Findings

### 1. Architectural Contradiction: Deferring vs. Outright Deleting PDF Infrastructure
- **Severity**: 🔴 Blocker
- **Section**: `Overview` (line 14), `Goals` (line 20) vs. `Technical Plan` (lines 64-67) & `Detailed Implementation`
- **Rationale**:
  The Overview and Goals claim the feature will "defer loading of `pdf.worker.min.mjs` until a user navigates to an exam result or document preview view". Conversely, the Technical Plan and Implementation Matrix establish that the PDF viewer subsystem has been decommissioned from `src/`, and mandate deleting `public/pdf.worker.min.mjs` (1.37 MB) and uninstalling `pdfjs-dist` and `react-pdf`.
- **Remediation**:
  Reconcile Overview and Goals to state complete elimination of dead PDF infrastructure rather than runtime deferral.

### 2. Scope Creep: Unmotivated Admin Monolith Refactoring
- **Severity**: 🟡 Major
- **Section**: `Technical Plan > 4. Component Lifecycle & Boundary Hardening` & `Detailed Implementation`
- **Rationale**:
  `/admin` is an authenticated, role-gated route isolated in its own dynamic chunk (`routeModuleLoaders.Admin`). It has zero impact on mobile students, FCP, or public bandwidth. Furthermore, the disconnected components in `src/components/admin/` lack the RPC fallbacks present in `Admin.jsx`. Bundling this refactor into a mobile performance ticket inflates scope and introduces regression risk.
- **Remediation**:
  Remove `Admin.jsx` refactoring from this specification; defer to a dedicated code cleanup issue.

### 3. Ghost Scope: Dangling Exam Question List Re-renders
- **Severity**: 🟡 Major
- **Section**: `Overview` (line 14), `Goals` (line 21)
- **Rationale**:
  The Goals section mandates eliminating "redundant re-renders in exam question lists through component memoization and helper function hoisting". However, no exam question list component exists in `src/`, nor is any implementation planned in the technical plan.
- **Remediation**:
  Purge this legacy goal from the document.

### 4. Speculative Logic & YAGNI: KaTeX Font Subsetting Policy
- **Severity**: 🟡 Major
- **Section**: `Technical Plan > 3. Font Asset Subsetting Policy`
- **Rationale**:
  Section 3 defines rules for hypothetical future math rendering ("If mathematical typesetting is reintroduced in the future..."). Designing font-face fallback matrices for a dead dependency being uninstalled violates YAGNI.
- **Remediation**:
  Demote to a brief one-line architectural invariant note.

### 5. Incomplete Verification Safety Net for Dynamic Imports
- **Severity**: 🟡 Major
- **Section**: `Goals` & `Detailed Implementation`
- **Rationale**:
  Static greps verify zero imports, but dynamic imports via `routeModuleLoaders` require a dynamic smoke check across all 15 routes to guarantee zero missing module errors at runtime.
- **Remediation**:
  Add an explicit requirement for a 15-route dynamic mount smoke verification test.

### 6. Hallucinated Packages in Problem Statement
- **Severity**: 🟢 Nit
- **Section**: `Problem Statement` (line 9)
- **Rationale**:
  Claims `lucide-react`, `dotenv`, and `react-katex` remain in `package.json`, but direct inspection confirms they are already absent.
- **Remediation**:
  Correct the text to reference the actual lingering dependencies: `pdfjs-dist`, `react-pdf`, and `katex`.

### 7. HTML Protocol Inaccuracy
- **Severity**: 🟢 Nit
- **Section**: `Architectural Audit` (line 36) & `Technical Plan > 1` (line 69)
- **Rationale**:
  The document claims `index.html` has a `preconnect` tag; line 50 of `index.html` actually contains `<link rel="dns-prefetch" href="https://unpkg.com" />`.
- **Remediation**:
  Correct the reference to `dns-prefetch`.

---

## Traceability Summary

| ID | Category | Severity | Description | Recommended Fix |
|---|---|---|---|---|
| CRT-01 | Architecture | 🔴 Blocker | Deferral vs. deletion contradiction in PDF subsystem. | Align Overview & Goals with complete deletion. |
| CRT-02 | YAGNI / Scope | 🟡 Major | Admin tab refactor bundled into mobile performance ticket. | Drop Admin refactor from this design. |
| CRT-03 | Ghost Scope | 🟡 Major | Exam question list memoization goal has no implementation. | Remove ungrounded goal. |
| CRT-04 | Speculative Logic | 🟡 Major | KaTeX font subsetting policy designed for unused capability. | Demote to concise invariant note. |
| CRT-05 | Verification | 🟡 Major | Lack of runtime route mount smoke test for dynamic imports. | Add 15-route dynamic mount verification gate. |
| CRT-06 | Factual Accuracy | 🟢 Nit | Problem statement cites absent packages (`lucide-react`, etc.). | State verified packages (`pdfjs-dist`, etc.). |
| CRT-07 | Factual Accuracy | 🟢 Nit | `dns-prefetch` mislabeled as `preconnect`. | Correct tag description. |
