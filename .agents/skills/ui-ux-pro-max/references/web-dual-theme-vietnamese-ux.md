# Dual-Theme Web SPA & Vietnamese Typography UX Guide

> **Scope:** Production Web SPAs built with **Tailwind CSS v4** (`@theme` + `html.dark`), cultural/scholarly Dual-Theme palettes, high-density Vietnamese academic content, and competitive live metrics.

---

## 1. Tailwind v4 CSS-First Semantic Token Architecture (`@theme` + `html.dark`)

Hardcoding twin utilities (`bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100`) across dozens of JSX components causes visual drift, missed dark-mode states, and bloated markup. Instead, define **one semantic token layer** in `src/index.css` using Tailwind v4's `@theme` block for Light Mode defaults and override the underlying CSS custom properties inside `html.dark`.

### Canonical CSS Setup (`src/index.css`)

```css
@import "tailwindcss";

/* Enable class-driven dark variant alongside semantic CSS variables */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Light Theme Defaults — Warm Rice-Paper (Thư Phòng Sáng) */
  --color-background: #FAF7F0;
  --color-paper: #FDFBF6;
  --color-surface: #FFFFFF;
  --color-surface-alt: #F3EDE2;

  --color-foreground: #1C1917;         /* Contrast vs #FAF7F0: ~15.4:1 (AAA) */
  --color-secondary-text: #57534E;     /* Contrast vs #FFFFFF: ~7.5:1  (AAA) */
  --color-muted-foreground: #78716C;   /* Contrast vs #FFFFFF: ~4.8:1  (AA)  */

  --color-primary: #B91C1C;            /* Vermilion / Chu Sa */
  --color-primary-hover: #991B1B;
  --color-accent: #B45309;             /* Imperial Gold (readable on light) */
  --color-gold: #C9A227;               /* Decorative seal / border gold */
  --color-jade: #0F766E;               /* Jade progress / active learning */
  --color-completed: #15803D;          /* Completed milestone */
  --color-border: #E7E0D2;             /* Warm parchment hairline */

  /* Self-hosted Vietnamese-safe Typography */
  --font-display: "Spectral", Georgia, serif;
  --font-arena: "Spectral", Georgia, serif;
  --font-sans: "Be Vietnam Pro", system-ui, -apple-system, sans-serif;
  --font-han: "Noto Serif SC", "Songti SC", "SimSun", serif;
}

/* Dark Theme Overrides — Inkstone & Sandalwood (Mặc Dạ Tối) */
html.dark {
  color-scheme: dark;

  --color-background: #12100E;
  --color-paper: #1A1714;
  --color-surface: #221E1A;
  --color-surface-alt: #2B2521;

  --color-foreground: #F5EFE6;         /* Moonlight Jade vs #12100E: ~15.8:1 (AAA) */
  --color-secondary-text: #BDB4A5;     /* Contrast vs #221E1A: ~7.6:1 (AAA) */
  --color-muted-foreground: #8C8275;   /* Contrast vs #221E1A: ~4.6:1 (AA)  */

  --color-primary: #DC2626;
  --color-primary-hover: #EF4444;
  --color-accent: #E5B842;
  --color-gold: #E5B842;
  --color-jade: #14B8A6;
  --color-completed: #22C55E;
  --color-border: #332B24;
}
```

### Component Consumption Rule
- **DO:** `className="bg-surface text-foreground border border-border hover:border-gold"`
- **DON'T:** `className="bg-[#150a0d] text-ember-400"` or `className="bg-ink-950 text-white"` (fails completely in Light Mode and triggers `legacy-dark-only-token` in `audit_ui_ux.py`).

---

## 2. FOUC-Free Theme Bootstrapping

A Web SPA that renders Light Mode for 120ms before React mounts in Dark Mode blinds nighttime learners with a white flash (**Flash of Unstyled Content — FOUC**). Prevent FOUC with a synchronous inline `<script>` inside `<head>` in `index.html` *before* stylesheets and module scripts finish executing:

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('dtht_theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = saved === 'dark' || (!saved && prefersDark);
      var root = document.documentElement;
      root.classList.toggle('dark', isDark);
      root.style.colorScheme = isDark ? 'dark' : 'light';
    } catch (e) {}
  })();
</script>
```

### ThemeToggle UX Requirements
1. **State Persistence:** Read/write `localStorage('dtht_theme')` via a centralized `ThemeProvider` + `useTheme()` hook, listening to `matchMedia('(prefers-color-scheme: dark)')` when no explicit override exists.
2. **Accessible Control:** Every `ThemeToggle` button MUST expose a clear dynamic `aria-label` (e.g., `aria-label={isDark ? "Chuyển sang giao diện Thư Phòng Sáng" : "Chuyển sang giao diện Mặc Dạ Tối"}`) and hide its sun/moon icon glyph from screen readers (`aria-hidden="true"`).
3. **Cross-Viewport Placement:** Keep `ThemeToggle` reachable within 1 click on Desktop (Sidebar footer) and Mobile (Top Header bar + Mobile Drawer).

---

## 3. Avoiding OLED-Black & Neon Anti-Patterns

Long-session reading and exam-prep platforms must protect visual comfort across multi-hour study blocks:

| Anti-Pattern | Visual Defect | Professional Dual-Theme Replacement |
| :--- | :--- | :--- |
| **Pure OLED Black (`#000000`) + Pure White (`#FFFFFF`)** | Extreme 21:1 luminance jump causes **halation** (glowing/blurring letter edges), especially for ~40% of users with mild astigmatism. | Warm Inkstone `#12100E` canvas + Sandalwood `#221E1A` cards + Moonlight Ivory `#F5EFE6` text (~15.8:1 contrast, zero halation). |
| **Stark `#FFFFFF` Page Background in Light Mode** | Clinical glare on large desktop monitors during daytime reading. | Warm Rice-Paper `#FAF7F0` page canvas paired with crisp `#FFFFFF` elevated content cards for natural depth without heavy drop shadows. |
| **Oversaturated Neon Accents (`#00FFFF`, `#FF0055`)** | Chromatic aberration ("vibrating edges") against dark surfaces and poor WCAG contrast on light surfaces. | Culturally grounded, luminance-calibrated pairs: Vermilion (`#B91C1C` light / `#DC2626` dark), Imperial Gold (`#B45309` light / `#E5B842` dark), Jade (`#0F766E` light / `#14B8A6` dark). |
| **Translucent Glass Cards without Opacity Floor** | Text contrast collapses unpredictably when scrolled over patterned backgrounds or watermarks. | Enforce solid or >=92% opaque semantic surfaces (`bg-surface`, `bg-paper`) and keep decorative watermarks (`aria-hidden="true"`) below 4–6% opacity. |

---

## 4. Vietnamese Typography & Diacritic Harmony

Vietnamese Latin script stacks **vowel circumflex/breve/horn modifiers** AND **tone marks** vertically (`ấ`, `ầ`, `ẩ`, `ẫ`, `ắ`, `ằ`, `ẳ`, `ẵ`, `ế`, `ề`, `ể`, `ễ`, `ố`, `ồ`, `ổ`, `ỗ`, `ớ`, `ờ`, `ở`, `ỡ`, `ứ`, `ừ`, `ử`, `ữ`) while placing **under-dots** below baseline (`ậ`, `ặ`, `ệ`, `ộ`, `ợ`, `ự`). Vertical ascender/descender excursions are **22–28% taller** than English ASCII text.

### Mandatory Vietnamese Font & Layout Rules

1. **Complete Subset Loading (`vietnamese` + `latin`):**
   - Self-host `@fontsource/spectral` (weights `500`, `600`, `700`, `800`) and `@fontsource/be-vietnam-pro` (weights `400`, `500`, `600`, `700`), importing **both** `vietnamese` and `latin` subsets.
   - Never use display fonts that lack precomposed Vietnamese glyphs (causes jarring mid-word fallback to system serif/sans).
2. **Diacritic-Safe Line Height (`line-height`):**
   - **Display Headings (`Spectral`):** Never apply `leading-none` (`1.0`) or `leading-tight` (`1.125`) to multi-line Vietnamese titles. Use `leading-snug` (`1.3`–`1.375`) for `h1`/`h2` and `leading-normal` (`1.45`–`1.5`) for `h3`/`h4`.
   - **Body Copy, Exam Passages & Explanations (`Be Vietnam Pro`):** Use `leading-relaxed` (`1.625`–`1.75`) and constrain reading width to `max-w-[68ch]` so stacked diacritics never collide between adjacent lines.
3. **Prevent Vertical Clipping on Clamped/Gradient Text:**
   - Combining `bg-clip-text text-transparent` or `line-clamp-*` with zero vertical padding slices off the top of `ẫ` / `ử` and bottom of `ệ` / `ự`. Always add `py-0.5` or `leading-snug` on clipped headings.
4. **Restrained Letter-Spacing on Uppercase Vietnamese:**
   - Uppercase Vietnamese labels (e.g., `ĐẤU TRƯỜNG HỌC TẬP`, `THỐNG SOÁI`) lose word-shape cohesion when tracked wider than `0.15em`. Cap eyebrow/badge tracking at `tracking-[0.06em]`–`tracking-[0.12em]`.

---

## 5. Tabular Numerals (`tabular-nums`) for Scores, GPA & Timers

Proportional numerals have unequal widths (`1` is narrower than `8`), causing countdown timers to shudder every second and table columns to misalign vertically.

```css
.tabular {
  font-variant-numeric: tabular-nums lining-nums;
}
```

Apply `.tabular` (or Tailwind `tabular-nums`) **mandatorily** to:
- Live exam/arena countdown clocks (`45:00`, `00:59`)
- GPA calculators and transcript tables (`3.82 / 4.00`, `8.75 / 10`)
- EXP progress counters (`1,250 / 2,000 EXP`), streak counters, and leaderboard ranks (`#01`, `#12`)
- Admin user statistics, pagination totals, and timestamp columns

---

## 6. Responsive SPA Viewport Matrix

Every Web SPA view must be verified across four canonical viewports without horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`):

| Viewport | Breakpoint Class | Layout Adaptation |
| :--- | :--- | :--- |
| **`375px` (Small Mobile)** | Base (mobile-first) | Single-column cards, sticky compact top bar (`h-14`), slide-over Navigation Drawer with focus trap, touch targets `>= 44×44px`, tables converted to stacked summary cards or wrapped in explicit `overflow-x-auto` containers. |
| **`768px` (Tablet)** | `md:` | 2-column card grids, inline filter toolbars, comfortable `px-6` gutters. |
| **`1024px` (Laptop)** | `lg:` | Persistent left Sidebar (`w-64`) + scrollable main workspace, split master-detail panels for Notes/Roadmap. |
| **`1440px` (Desktop)** | `xl:` / `2xl:` | Centered max-width container (`max-w-7xl mx-auto px-8`) preventing overly wide unreadable lines, multi-panel dashboards with sticky summary rails. |
