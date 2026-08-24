# 🧠 2ndBrain CLI

**English** · [简体中文](https://github.com/tangquanwei/brain-cli/blob/main/docs/README_ZH.md)

> A local-first toolkit for keeping Markdown vaults healthy: safe refactors, link checks, Git backups, and an instant knowledge graph.

[![CI](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@qwtang/brain-cli)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

![2ndBrain CLI: dashboard, link health, safe rename preview, and graph](https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/overview.gif)

2ndBrain CLI works on ordinary Markdown files. It does not require a hosted account, a proprietary database, or a specific editor. Your notes stay in a directory you control.

## Why use it?

- **Refactor safely.** Rename or move notes while updating relative Markdown links and matching image directories.
- **Catch decay early.** Find broken links, missing headings or blocks, missing embeds, ambiguous WikiLinks, backlinks, and orphan notes.
- **Keep recoverable history.** Commit and optionally push only the configured notes repository.
- **See the structure.** Browse notes, link health, reviews, and a local knowledge graph in one WebUI.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install -g @qwtang/brain-cli

mkdir my-brain
cd my-brain
brain init
brain web --open
```

A global installation treats the current working directory as the workspace. Run `brain` inside the workspace that contains your notes and optional `.env`.

For an existing Markdown or Obsidian vault, inspect it directly—no initialization or migration required:

```bash
brain doctor /absolute/path/to/your/notes
brain --vault /absolute/path/to/your/notes web --open
```

Both `doctor` and link checks are read-only by default:

```bash
brain --vault /absolute/path/to/your/notes links --stats --orphans
```

## Reproducible demo Vault

The repository includes a small, fictional vault with no personal content. Use it to evaluate the scanner and WebUI before pointing the CLI at your own notes.

```bash
git clone https://github.com/tangquanwei/brain-cli.git
cd brain-cli
npm install
npm run build

node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

Verified scan result:

```text
Notes:                  10
Internal links:         16
Broken links:            0
Missing headings/blocks: 0
Missing images/assets:   0
Ambiguous WikiLinks:     0
Orphans:                 0
```

See [the demo Vault README](examples/demo-vault/README.md) for its structure and expected relationships.

## Works alongside your tools

| Tool | Primary responsibility |
| --- | --- |
| Obsidian | Write and browse Markdown with an editor-first experience |
| VS Code | Edit files, scripts, templates, and Git changes |
| Git | Store version history and synchronize a repository |
| **2ndBrain CLI** | Capture notes, safely refactor links, inspect vault health, automate notes-only backups, and open a local graph |

2ndBrain CLI does not try to replace your editor or Git client. It handles maintenance tasks that become risky or repetitive as a Markdown vault grows.

## Core commands

| Command | What it does | Writes files? |
| --- | --- | --- |
| `brain doctor <path>` | Inspect an existing vault without initialization | No |
| `brain init` | Create the default workspace and PARA directories | Yes |
| `brain capture <title>` | Create a Markdown note with frontmatter | Yes |
| `brain links --stats --orphans` | Inspect links and orphan notes | No |
| `brain backlinks <note>` | List notes linking to a note | No |
| `brain rename <old> <new> --dry-run` | Preview a safe rename and link updates | No |
| `brain rename <old> <new>` | Rename a note and update links/images | Yes |
| `brain move <old> <new> --dry-run` | Preview a move and relative-link updates | No |
| `brain backup [--push]` | Commit, and optionally push, the notes repository | Git only |
| `brain review` | Review notes using local metadata | No |
| `brain web --open` | Start the local dashboard, editor, checks, and graph | Only when you use an editing action |
| `brain watch start` | Start background notes maintenance | Yes |

Run `brain <command> --help` for all options.

## Configuration

Use the global `--vault <path>` option for one-off or existing vaults. Create a workspace-level `.env` when you want a persistent default (see `.env.example`). Resolution order is `--vault`, then `NOTES_DIR`, then `notes`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NOTES_DIR` | `notes` | Markdown vault path, relative to the workspace or absolute |
| `GIT_AUTO_COMMIT` | `true` | Automatically commit after supported write operations |
| `COMMIT_INTERVAL` | `30` | Watcher commit interval in seconds |
| `PUSH_INTERVAL` | `900` | Watcher push interval in seconds |
| `WATCH_ENABLED` | `true` | Enable watcher behavior |

## Safety boundaries

- `brain web` listens only on `127.0.0.1`; it is not exposed to the network by default.
- `doctor`, link scans, backlinks, status, reviews, and `--dry-run` refactor previews are read-only.
- `brain backup` and the watcher operate only on the Git repository at `NOTES_DIR`.
- Rename and move operations update standard relative Markdown links and resolved WikiLinks. Check the dry run and keep Git history before a large refactor.
- Obsidian note links, aliases, note embeds, image embeds, headings, and block references are supported. Duplicate short note names are reported as ambiguous; use a vault-relative WikiLink path to disambiguate.

## Documentation

- [Quick start](docs/guide/01-快速开始.md)
- [CLI reference](docs/guide/02-CLI命令参考.md)
- [Configuration](docs/guide/04-配置参考.md)
- [Link-scan benchmark](docs/benchmarks/link-scan.md)
- [Watcher](docs/guide/05-Watcher守护进程.md)
- [Daily workflow](docs/guide/06-日常工作流.md)
- [Roadmap](TODO.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Release process](docs/RELEASING.md)

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Issues and focused pull requests are welcome. If you are trying the project with a real vault, please share the editor, operating system, note count, and the first point of friction—without sharing private note content.

## License

[Apache-2.0](LICENSE)
