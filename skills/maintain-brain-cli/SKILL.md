---
name: maintain-brain-cli
description: Develop, debug, test, document, and release the 2ndBrain CLI TypeScript and React codebase. Use when Codex works in the brain-cli repository on CLI commands, Markdown or Obsidian link handling, vault path safety, notes-only Git backup, Watcher behavior, WebUI APIs or views, tests, packaging, or release preparation.
---

# Maintain Brain CLI

Implement focused changes while preserving the project's local-first and vault-scoped safety contracts.

## Orient before editing

1. Confirm the repository root and inspect `git status --short --branch`. Preserve unrelated worktree changes.
2. Read the nearest project instructions, the relevant command or module, and its tests.
3. Use [references/architecture.md](references/architecture.md) to locate ownership and trace the full path from CLI or HTTP input to filesystem or Git effects.
4. State whether the requested behavior is read-only, file-writing, Git-writing, process-controlling, or mixed.

## Preserve safety contracts

- Keep diagnostics and previews read-only by default.
- Resolve vault file operations against `settings.notesDir`; reject traversal and targets outside the vault.
- Require the configured vault itself to be the Git worktree root before adding, committing, or pushing. Never let Git fall back to a parent repository.
- Keep `backup`, automatic commits, pushes, and Watcher automation scoped to the vault repository. Do not update a parent repository or sibling project.
- Keep WebUI listening on `127.0.0.1` unless an authenticated network design is explicitly requested and documented.
- Limit request bodies and validate note identifiers at the server boundary before reading, launching, or editing a file.
- Use fictional Markdown fixtures. Never copy a private vault into tests, screenshots, issues, or documentation.

Add or adjust boundary-focused tests whenever changing rename, move, Git, Watcher, WebUI write APIs, path resolution, link parsing, or link rewriting.

## Implement coherently

- Keep command registration and help text in `src/cli.ts`; put behavior in the matching `src/commands/` module.
- Put reusable Markdown, link, path, Git, and UI logic under `src/utils/`; keep graph projections under `src/graph/`.
- Update the server/API and `web-ui/` consumer together when a WebUI contract changes.
- Update the CLI reference, configuration reference, README, or changelog only when observable behavior changes. Describe verified behavior, not roadmap intent.
- Follow the existing strict TypeScript, ESM, React, Vitest, and Prettier conventions.

## Validate proportionally

Read [references/validation.md](references/validation.md), then run the narrowest relevant test first. Before handing off a normal code change, run the full applicable gate when the environment permits:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Use the synthetic demo vault for command and WebUI smoke checks. Report static inspection, automated tests, builds, and runtime checks as separate evidence; do not describe one as proof of another.

## Release only on explicit request

Read `docs/RELEASING.md` and the current `CHANGELOG.md`. Verify versions, tests, types, build output, audit, package contents, and a clean tarball installation before publishing. Never commit, tag, push, publish, or handle an npm credential unless the user explicitly authorizes that action.
