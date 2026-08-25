# Validation matrix

Run checks from the repository root with Node.js 20 or newer.

## Fast checks by change

| Change | Start with | Add before handoff |
| --- | --- | --- |
| Markdown/link parser or rewrite | `npm test -- tests/markdownLinks.test.ts tests/linkGraph.test.ts tests/rewriteLinks.test.ts` | `npm test`, demo-vault `links --check` |
| Vault path or Git behavior | `npm test -- tests/gitBoundary.test.ts tests/safeOpenNote.test.ts` | full tests and an isolated temporary Git fixture when needed |
| Doctor, review, or graph | matching `tests/*.test.ts` file | full tests and relevant demo-vault command |
| Web server/data | `npm test -- tests/webData.test.ts` | typecheck, build, HTTP GET/HEAD or browser flow |
| React WebUI | `npm run typecheck` | build and browser flow at a disposable port |
| CLI options/help | `npm run typecheck && npm run build` | `node dist/cli.js --help` and affected command help/smoke |
| Documentation only | inspect referenced source and `git diff --check` | test commands only when examples or behavior claims changed |

## Full development gate

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

`npm run verify` adds `node dist/cli.js links --check`; run it only when its configured/default vault target is available and intentional. Do not mistake a missing local vault for a product regression.

Use `examples/demo-vault/notes` for reproducible runtime checks:

```bash
node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" links --check --stats --orphans
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web -p 3740
```

Do not mutate the checked-in demo vault during a write-path test. Copy it to a disposable temporary directory first.

## Release gate

Follow `docs/RELEASING.md`. At minimum run tests, typecheck, build, `npm audit --omit=dev`, and `npm pack --dry-run`; then install the produced tarball into a disposable temporary directory and verify version, doctor, init, explicit `--vault`, and WebUI startup. Publishing, tagging, and pushing always require explicit authorization.
