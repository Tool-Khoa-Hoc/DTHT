# Design Documents Sitemap

| Design Document | Date | Author | Components | Description |
| --- | --- | --- | --- | --- |
| [Web Performance Optimization](./web_performance_optimization.md) | 2026-10-28 | bebebe | `package.json`, `package-lock.json`, `public/`, `index.html`, `vite.config.js`, `src/components/ErrorBoundary.jsx` | Prunes dead PDF/KaTeX runtime dependencies and static worker assets (1.37 MB), removes unneeded unpkg DNS prefetch, optimizes bundler thresholds, and adds dynamic route verification. |
