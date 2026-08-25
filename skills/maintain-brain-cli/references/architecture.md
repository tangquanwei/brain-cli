# Architecture map

## Runtime flow

```text
src/cli.ts
  -> src/config.ts
  -> src/commands/*
       -> src/utils/* or src/graph/*
       -> vault filesystem / vault Git repository

brain web
  -> src/commands/web.ts
  -> src/web/server.ts + src/web/data.ts + src/web/http.ts
  -> compiled web-ui/* assets
  -> loopback HTTP server
```

## Ownership

| Area | Primary files | Tests or checks |
| --- | --- | --- |
| CLI grammar and help | `src/cli.ts` | build plus command smoke checks |
| Vault selection and defaults | `src/config.ts`, `src/utils/paths.ts` | `tests/gitBoundary.test.ts`, command smoke checks |
| Capture, refactors, checks, reviews | `src/commands/` | matching tests plus demo-vault checks |
| Markdown and WikiLink parsing | `src/utils/markdownLinks.ts`, `src/utils/linkGraph.ts`, `src/utils/rewriteLinks.ts` | `markdownLinks`, `linkGraph`, `rewriteLinks` tests |
| Filesystem boundary | `src/utils/noteIndex.ts`, `src/utils/safeOpenNote.ts`, command modules | `safeOpenNote`, `webData`, refactor tests |
| Notes-only Git behavior | `src/utils/git.ts`, `src/commands/backup.ts`, Watcher modules | `tests/gitBoundary.test.ts` |
| Graph data and filtering | `src/graph/` | `graphTree`, `graphProjection`, `graphFilters` tests |
| Web server and APIs | `src/web/` | `tests/webData.test.ts` plus HTTP smoke checks |
| Web client | `web-ui/` | `npm run typecheck`, `npm run build`, browser smoke checks |
| User documentation | `README.md`, `docs/guide/`, `docs/README_ZH.md` | compare with `src/cli.ts` and runtime help |
| Packaging and release | `package.json`, `tsup.config.ts`, `.github/workflows/release.yml` | pack preview and clean-install smoke checks |

## Important boundaries

- `src/utils/paths.ts` derives the workspace from the current working directory, not the globally installed package path.
- `src/config.ts` resolves vault configuration in this order: `--vault`, environment or `.env` `NOTES_DIR`, then `notes`.
- `src/utils/git.ts` requires the vault to be the exact Git worktree root. This prevents an uninitialized `notes/` directory from mutating a parent repository.
- Web note ids are vault-relative and must be looked up or validated before file access.
- Source and WebUI compile under separate TypeScript configurations; validate both.
