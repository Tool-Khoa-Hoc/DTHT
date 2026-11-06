# Hybrid Multi-Agent UI/UX Playbook: Argon 4 + DeepSeek V4.1 Flash

> **Architecture Pattern:** High-Reasoning Lead Design Architect (**Argon 4**) + High-Throughput Parallel UI Scanner & Executor (**DeepSeek V4.1 Flash**).
> **Objective:** Deliver WCAG AA/AAA Dual-Theme Web SPAs with zero file collisions, zero token drift from `design-system/MASTER.md`, and deterministic static verification via `scripts/audit_ui_ux.py`.

---

## 1. Cognitive Division of Labor

Modern frontend upgrades require both **deep aesthetic/systemic reasoning** (token hierarchy, contrast math, complex OAuth/RLS state machines, typographic rhythm for Vietnamese diacritics) and **high-speed breadth execution** (auditing 60+ components, running multi-domain BM25 lookups, migrating legacy classes across dozens of pages). Splitting these duties across **Argon 4** and **DeepSeek V4.1 Flash** maximizes both design craftsmanship and engineering velocity.

| Dimension | Argon 4 (Lead Design Architect & Critic) | DeepSeek V4.1 Flash (Parallel Scanner & UI Executor) |
| :--- | :--- | :--- |
| **Primary Role** | System-level token architecture, complex UX state machines, cultural/typographic direction, antagonistic final critique | Fast dataset retrieval, static codebase sweeps, bulk token refactoring, disjoint-shard page implementation |
| **Design System Authority** | Authors & updates `design-system/MASTER.md`, `design-system/pages/*.md`, and root CSS `@theme` + `html.dark` tokens | Reads `MASTER.md` + page overrides strictly as immutable contracts; never invents ad-hoc hex tokens |
| **Complex State Flows** | Architects PKCE Google OAuth callbacks, `ThemeProvider` FOUC prevention, Global Navigation Shell, and Toast/Dialog primitives | Wires existing Toast/Modal primitives into page-level CRUD flows, replacing `window.alert()` / `window.confirm()` |
| **Typography & Contrast** | Tunes WCAG AA/AAA contrast pairs in Light & Dark modes, Vietnamese diacritic line-height (`Spectral` + `Be Vietnam Pro`), and `tabular-nums` rules | Applies approved typography/numeric utility classes consistently across cards, tables, timers, and forms |
| **Tooling Usage** | Synthesizes `--design-system` architecture; reviews `audit_ui_ux.py --strict` output and performs holistic UX critique | Runs parallel `search.py --domain / --stack` queries and `audit_ui_ux.py --json` baseline & post-edit sweeps |

---

## 2. Four-Phase Execution Pipeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: PARALLEL DISCOVERY & BASELINE AUDIT (DeepSeek V4.1 Flash)         │
│  • Run `python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src --json` │
│  • Run targeted `scripts/search.py` domain & stack queries in parallel     │
│  • Emit structured Discovery Brief (violations by file, legacy tokens)     │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: TOKEN ARCHITECTURE & BATON PLANNING (Argon 4)                     │
│  • Update `design-system/MASTER.md` + `design-system/pages/<domain>.md`    │
│  • Lock shared core primitives (`src/index.css` @theme/html.dark, Shell,   │
│    ThemeProvider, Toast/ConfirmDialog primitives)                          │
│  • Partition remaining pages into strictly DISJOINT file shards            │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: SHARDED PARALLEL EXECUTION (N × DeepSeek V4.1 Flash Workers)      │
│  • Worker A (Auth/Profile Shard)   ──┐                                     │
│  • Worker B (Arena/Roadmap/GPA)    ──┼─► Disjoint `exclusive_write` sets   │
│  • Worker C (Library/Notes/Admin)  ──┘   Zero overlapping file edits       │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: STATIC GATE & ANTAGONISTIC CRITIQUE (Flash + Argon 4)             │
│  • DeepSeek V4.1 Flash runs `audit_ui_ux.py src --strict` + viewport sweep │
│  • Argon 4 audits Light/Dark parity, Vietnamese diacritics, OAuth edge     │
│    states, and keyboard focus order; issues micro-fix batons if needed     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Strict Disjoint File-Sharding Rules

Parallel UI agents fail when two workers edit the same file or invent conflicting CSS variables. Enforce these **four invariants** on every multi-agent run:

1. **Single-Writer Lock (`Shard_i ∩ Shard_j = ∅`):** Every file path in the repository may appear in at most **one** active worker's `exclusive_write` list during Phase 3.
2. **Core-First Barrier:** Root token stylesheets (`src/index.css`), global providers (`ThemeProvider`, `AuthContext`, `ToastProvider`), shared layout shells (`RootLayout.jsx`), and `design-system/MASTER.md` MUST be finalized by **Argon 4** in Phase 2 *before* spawning parallel DeepSeek V4.1 Flash page workers. During Phase 3, core files are `shared_readonly`.
3. **Zero Ad-Hoc Palette Rule:** DeepSeek V4.1 Flash workers are prohibited from introducing arbitrary hex utilities (`bg-[#...]`, `text-[#...]`) unless explicitly listed in `MASTER.md` or official third-party brand guidelines (e.g., official 4-color Google `G` SVG paths).
4. **Scoped Verification:** Each DeepSeek V4.1 Flash worker runs `audit_ui_ux.py <owned_file_or_folder> --strict` on its own shard before returning its completion baton.

### Recommended SPA Sharding Topology

| Shard ID | Assigned Model | Exclusive Write Scope (Example) | Design System Contract |
| :--- | :--- | :--- | :--- |
| `core-foundation` | **Argon 4** (Phase 2) | `src/index.css`, `index.html`, `src/components/RootLayout.jsx`, `src/components/ui/Toast.jsx`, `src/components/ui/ConfirmDialog.jsx` | `design-system/MASTER.md` |
| `shard-auth` | **DeepSeek V4.1 Flash** | `src/pages/Login.jsx`, `src/pages/Register.jsx`, `src/pages/AuthCallback.jsx`, `src/pages/Profile.jsx` | `MASTER.md` + `pages/auth.md` |
| `shard-arena` | **DeepSeek V4.1 Flash** | `src/pages/Arena.jsx`, `src/pages/Roadmap.jsx`, `src/pages/GpaCalculator.jsx`, `src/components/ui/SubjectCard.jsx` | `MASTER.md` + `pages/arena-roadmap-gpa.md` |
| `shard-library-admin` | **DeepSeek V4.1 Flash** | `src/pages/Admin.jsx`, `src/pages/Notes.jsx`, `src/pages/OnlineLearning.jsx`, `src/pages/Library.jsx` | `MASTER.md` + `pages/library-admin.md` |

---

## 4. Baton Handoff Contract (JSON / Markdown Schema)

### 4.1 Forward Baton (`Argon 4 -> DeepSeek V4.1 Flash`)

Every task delegated from Argon 4 to a DeepSeek V4.1 Flash worker MUST include this structured contract:

```json
{
  "baton_version": "1.0",
  "baton_id": "dtht-ui-shard-library-admin-01",
  "architect": "argon-4",
  "executor": "deepseek-v4.1-flash",
  "design_system_refs": [
    "design-system/MASTER.md",
    "design-system/pages/library-admin.md"
  ],
  "file_ownership": {
    "exclusive_write": [
      "src/pages/Admin.jsx",
      "src/pages/Notes.jsx",
      "src/pages/OnlineLearning.jsx"
    ],
    "shared_readonly": [
      "src/index.css",
      "src/components/RootLayout.jsx",
      "design-system/MASTER.md"
    ]
  },
  "token_allowlist": [
    "bg-background",
    "bg-paper",
    "bg-surface",
    "bg-surface-alt",
    "text-foreground",
    "text-secondary-text",
    "text-muted-foreground",
    "bg-primary",
    "bg-primary-hover",
    "text-accent",
    "border-gold",
    "bg-jade",
    "text-completed",
    "border-border"
  ],
  "forbidden_patterns": [
    "window.alert(",
    "window.confirm(",
    "window.prompt(",
    "bg-ink-950",
    "text-ember-",
    "bg-[#150a0d]",
    "bg-[#201216]"
  ],
  "ux_and_a11y_gates": [
    "Add aria-hidden=\"true\" to every decorative .material-symbols-outlined span",
    "Add Vietnamese aria-label to every icon-only <button> (pin, delete, edit, close)",
    "Replace all alert/confirm/prompt dialogs with non-blocking Toast and accessible ConfirmDialog (role=\"alertdialog\")",
    "Verify responsive layout at 375px, 768px, 1024px, and 1440px with zero horizontal overflow",
    "Apply .tabular (tabular-nums) to all numeric counts, timestamps, and EXP/score columns"
  ],
  "verification_commands": [
    "python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/Admin.jsx --strict",
    "python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/Notes.jsx --strict",
    "python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/OnlineLearning.jsx --strict"
  ]
}
```

### 4.2 Return Baton (`DeepSeek V4.1 Flash -> Argon 4`)

Upon completing its shard, the DeepSeek V4.1 Flash worker replies with a concise Return Baton:

```json
{
  "baton_id": "dtht-ui-shard-library-admin-01",
  "status": "completed",
  "modified_files": [
    "src/pages/Admin.jsx",
    "src/pages/Notes.jsx",
    "src/pages/OnlineLearning.jsx"
  ],
  "audit_verification": {
    "command": "python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src/pages/Notes.jsx --strict",
    "exit_code": 0,
    "remaining_issues": 0
  },
  "ux_states_covered": [
    "loading_skeleton",
    "empty_state_cta",
    "toast_feedback",
    "confirm_modal_keyboard_escape",
    "rls_permission_fallback"
  ],
  "notes_for_critic": "Replaced 4 blocking dialogs and added aria-label on 3 pin/delete icon buttons in Notes.jsx."
}
```

---

## 5. Subagent Prompt Templates

### Template A — DeepSeek V4.1 Flash: Fast Discovery & Audit Scanner
```markdown
Role: DeepSeek V4.1 Flash UI/UX Scanner (Read-Only Mode).
1. Run `python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src --json`.
2. Run focused `scripts/search.py` queries for the requested UX concerns (1 intent per query, 2–5 keywords):
   - `python .agents/skills/ui-ux-pro-max/scripts/search.py "accessible authentication" --domain ux`
   - `python .agents/skills/ui-ux-pro-max/scripts/search.py "decorative icon aria hidden" --domain icons`
   - `python .agents/skills/ui-ux-pro-max/scripts/search.py "dark mode contrast" --domain style`
3. Group all static violations by file domain so Argon 4 can partition disjoint implementation shards. Do NOT edit any source files.
```

### Template B — DeepSeek V4.1 Flash: Sharded UI Executor
```markdown
Role: DeepSeek V4.1 Flash UI Executor for Shard `[SHARD_NAME]`.
1. Read `design-system/MASTER.md` and `design-system/pages/[PAGE_SPEC].md` before editing.
2. STRICT FILE OWNERSHIP: You may ONLY edit `[EXCLUSIVE_WRITE_FILES]`. Touch NO other files. Never run `git commit` or `npm install`.
3. Enforce Dual-Theme semantic tokens (`bg-background`, `bg-surface`, `text-foreground`, `border-border`, `bg-primary`), Vietnamese diacritic-safe line heights, `.tabular` on numeric metrics, `aria-hidden="true"` on `.material-symbols-outlined`, and `aria-label` on icon-only buttons.
4. Replace every `window.alert`, `window.confirm`, and `window.prompt` in your owned files with non-blocking Toast notifications and accessible Modal dialogs.
5. Run `python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py <your_file> --strict` for each owned file until 0 issues remain, then return your JSON Return Baton.
```

### Template C — Argon 4: Antagonistic Final Critic
```markdown
Role: Argon 4 Antagonistic UI/UX Critic.
1. Run `python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py src --strict` to verify zero static regressions across the entire repository.
2. Audit modified components against `design-system/MASTER.md` and `design-system/pages/*.md`:
   - Contrast parity: Does any badge, border, or muted label lose legibility in either Light (`#FAF7F0`) or Dark (`#12100E`) mode?
   - Vietnamese typography: Could any `leading-tight`, `truncate`, or `overflow-hidden` clip stacked diacritics (`ẫ`, `ệ`, `ử`)?
   - Async completeness: Are loading skeletons, empty states, RLS permission denials, and OAuth error recovery states handled gracefully without layout shift?
3. Either issue `SHIP_APPROVED` or emit targeted micro-batons with exact `file:line` remediation instructions.
```
