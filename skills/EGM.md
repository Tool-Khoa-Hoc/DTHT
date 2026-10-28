# Agent Skills Library (`skills`)

## System Overview

`skills/` is a modular library of Agent Skills designed to work with the Stitch MCP server and compatible AI coding agents (Antigravity, Gemini CLI, Claude Code, Cursor). Each skill package implements the Agent Skills open standard, packaging instructions, executable scripts, knowledge resources, and syntactically valid references.

These packages provide tooling and workflow guidance for UI/UX prompt enhancement, design system synthesis, React component generation, video walkthrough generation, and component library integration.

## Subdirectories & Boundaries

- **design-md**: [`./design-md/SKILL.md`](./design-md/SKILL.md) — Analyzes Stitch projects and generates comprehensive `DESIGN.md` design system documentation in semantic natural language.
- **enhance-prompt**: [`./enhance-prompt/SKILL.md`](./enhance-prompt/SKILL.md) — Transforms UI concepts into structured, Stitch-optimized prompts with UI/UX keywords and design system context.
- **react-components**: [`./react-components/SKILL.md`](./react-components/SKILL.md) (identifier: `react:components`) — Converts Stitch screens into modular React component systems with token consistency and automated validation.
- **remotion**: [`./remotion/SKILL.md`](./remotion/SKILL.md) — Generates programmatic walkthrough videos of UI screens using Remotion with transitions and callouts.
- **shadcn-ui**: [`./shadcn-ui/SKILL.md`](./shadcn-ui/SKILL.md) — Guidelines and patterns for integrating and customizing shadcn/ui components in React applications.
- **stitch-loop**: [`./stitch-loop/SKILL.md`](./stitch-loop/SKILL.md) — Multi-page website generation workflow from a single prompt using Stitch with automated file organization.

## Global Invariants

- **Agent Skills Standard**: Each skill package must maintain a root `SKILL.md` with YAML frontmatter specifying its identifier, description, and agent instructions.
- **Isolation from Application Runtime**: Skills in this directory provide agent execution guidance and auxiliary scripts; they are not imported or bundled by the web application in `src/`.
- **Deterministic Structure**: Complex skills follow the standard directory layout containing `scripts/`, `resources/`, and `examples/`.

## Global Side Effects

- **Agent Workspace Alterations**: When invoked by an agent, skills execute generation or conversion scripts that create or edit project files within targeted workspaces.
- **External Network Access**: Certain skill scripts interact with Stitch MCP servers or fetch external design tokens when explicitly invoked.

## Verification

- Lint and build verification for the project: `npm run lint && npm run build`
