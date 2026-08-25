---
name: operate-brain-vault
description: Safely operate Markdown or Obsidian vaults with 2ndBrain CLI. Use when Codex needs to inspect vault health, find links or backlinks, review notes, capture a note, preview or perform a rename or move, start the local WebUI, or back up a vault Git repository with the `brain` command.
---

# Operate Brain Vault

Use the narrowest `brain` command that satisfies the request. Keep diagnostics read-only by default and make every write boundary visible before execution.

## Establish the target

1. Locate the vault from an explicit user path, the global `--vault <path>` option, `NOTES_DIR`, or the default `notes` directory, in that order.
2. Prefer an explicit absolute vault path when the current working directory is ambiguous.
3. Confirm that an existing vault is a directory before operating on it. Do not run `init` unless the user asks to create or initialize a vault.
4. Use `brain` when the package is installed. Inside this source repository, build first when needed and use `node dist/cli.js`.

Place the global vault option before the command:

```bash
brain --vault /absolute/path/to/vault doctor
```

## Start read-only

Use read-only commands to understand current state before proposing mutations:

```bash
brain doctor /absolute/path/to/vault --json
brain --vault /absolute/path/to/vault status
brain --vault /absolute/path/to/vault links --check --stats --orphans
brain --vault /absolute/path/to/vault backlinks "areas/Example.md"
```

Treat `links --check` exit code `1` as detected vault-integrity problems, not automatically as a CLI crash. Report broken links, missing anchors or assets, ambiguous WikiLinks, and orphans separately.

Read [references/command-boundaries.md](references/command-boundaries.md) before using a command that can write files, create Git commits, push, run continuously, or expose the WebUI.

## Apply changes safely

- Run `rename` and `move` with `--dry-run` first. Show the planned note, attachment-directory, and inbound-link changes before removing `--dry-run`.
- Keep source and destination paths vault-relative when practical. Reject path traversal, absolute destinations, and targets outside the configured vault.
- Run `capture`, `init`, non-dry-run refactors, `links --write`, or WebUI editing actions only when the user requested the corresponding mutation.
- Inspect the vault repository status before Git operations. `backup` stages and commits all vault changes, so summarize unrelated changes and ask before including them when scope is unclear.
- Add `--push` only when the user explicitly requests a remote push.
- Start the Watcher only when persistent automatic commits or pushes are intended. Check its status and configuration first.

## Verify the outcome

After a mutation, rerun the smallest relevant checks:

- For capture: confirm the created Markdown file and frontmatter.
- For rename or move: rerun `links --check` and inspect `git diff` in the vault when available.
- For backup: confirm the vault repository status and new commit; confirm the remote branch only if pushed.
- For WebUI: verify it listens on `127.0.0.1` and test the requested route or flow.

Never expose private note contents in logs, fixtures, screenshots, or reports. Reproduce bugs with `examples/demo-vault/notes` or another synthetic vault.
