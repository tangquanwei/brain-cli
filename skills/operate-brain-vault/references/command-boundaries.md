# Brain command boundaries

Use `brain --vault <path> <command>` to avoid targeting the wrong vault. The global option must precede the command.

## Read-only commands

| Command | Purpose | Important result |
| --- | --- | --- |
| `doctor [path] [--json]` | Inspect an existing vault without migration | Exit `1` means integrity problems were found |
| `status` | Show vault and Git status | Does not change Git |
| `links [--check] [--json] [--orphans] [--stats] [--scope active\|all]` | Scan Markdown, WikiLinks, embeds, anchors, assets, and orphans | `--check` returns nonzero for integrity failures |
| `backlinks <note>` | List inbound Markdown and WikiLink references | Use a vault-relative note id |
| `review week\|month\|tags <tags>\|random [n]` | Select notes from local metadata | Does not edit notes |
| `rename <old> <new> --dry-run` | Preview rename, attachment, and link updates | Run before a real rename |
| `move <old> <new> --dry-run` | Preview move and relative-link updates | Run before a real move |
| `watch status` | Inspect Watcher state | Does not start or stop it |

`links --write` is not read-only; it writes `<vault>/.brain/links.json`.

## File-writing commands

| Command | Writes |
| --- | --- |
| `init` | Default PARA directories in the vault and workspace templates |
| `capture <title> [--content] [--tags] [--type]` | A Markdown note and, when enabled, a vault Git commit |
| `rename <old> <new>` | The note path, matching attachment directory, and resolved references |
| `move <old> <new>` | The note path, matching attachment directory, and resolved references |
| `links --write` | `.brain/links.json` inside the vault |

Supported capture types are `Fleeting`, `Literature`, `Permanent`, and `Project`.

## Git and continuous operations

- `backup [-m <message>]` stages and commits all current changes in the vault Git repository.
- `backup --push` also pushes the vault's current branch to its configured remote.
- `watch start` can continuously create vault commits and, when configured, push them. Inspect `GIT_AUTO_COMMIT`, `COMMIT_INTERVAL`, `PUSH_INTERVAL`, and `WATCH_ENABLED` first.
- `watch stop` changes process state and Watcher PID/log files.

The vault directory must itself be a Git worktree root. A plain child directory inside another Git repository must be rejected rather than causing a parent-repository commit.

## WebUI

`web [--open] [-p <port>]` listens on `127.0.0.1`; the default port is `3739`. Browsing, search, health checks, and graph views are read-only. Explicit capture, rename, move, or other edit actions write to the vault and need the same authorization and verification as their CLI equivalents.
