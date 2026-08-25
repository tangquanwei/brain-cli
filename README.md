<div align="center">

<img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/social-preview.png" alt="2ndBrain CLI — safe maintenance for Markdown vaults" width="100%">

### Know your vault. Refactor without fear.

**A local-first maintenance toolkit for Markdown and Obsidian vaults.**<br>
Find link rot, rename and move notes safely, keep Git backups, and explore your knowledge graph—without handing your notes to a cloud service.

[![CI](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@qwtang/brain-cli?color=2563eb)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![npm downloads](https://img.shields.io/npm/dm/@qwtang/brain-cli?color=06b6d4)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

[Quick start](#start-in-60-seconds) · [Live walkthrough](#see-it-in-action) · [Demo vault](#try-it-without-using-your-own-notes) · [Documentation](#documentation) · [简体中文](docs/README_ZH.md)

</div>

---

Your notes are already portable, readable files. Keeping them healthy should be just as simple.

2ndBrain CLI adds a careful maintenance layer around ordinary Markdown: it inspects before it changes, previews risky refactors, and keeps note operations inside the vault you choose.

<div align="center">

**No cloud account · No database migration · No editor lock-in**

</div>

## The maintenance layer your vault is missing

| | Capability | What you get |
| --- | --- | --- |
| 🔎 | **Diagnose** | Broken links, missing headings or blocks, missing embeds, ambiguous WikiLinks, backlinks, and orphan notes |
| 🛠️ | **Refactor** | Safe rename and move operations with dry-run previews and automatic link rewriting |
| 🕸️ | **Explore** | A local dashboard, note browser, reviews, link-health view, and interactive knowledge graph |
| 🛡️ | **Protect** | Notes-only Git commits, optional pushes, and a background watcher with strict repository boundaries |
| ✍️ | **Capture & review** | Fast note capture with frontmatter plus weekly, monthly, tag-based, and random reviews |

It works with the Markdown vault you already have—including Obsidian aliases, note embeds, image embeds, headings, and block references.

## See it in action

![2ndBrain CLI walkthrough: diagnose links, preview a rename, and open the local WebUI](https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/overview-en.gif)

<p align="center"><sub>Inspect link health → preview a safe rename → browse the local dashboard and knowledge graph.</sub></p>

## Start in 60 seconds

Requires [Node.js 20 or newer](https://nodejs.org/).

```bash
npm install -g @qwtang/brain-cli

mkdir my-brain && cd my-brain
brain init
brain web --open
```

That creates a local workspace and opens the WebUI at `127.0.0.1`. Your notes remain ordinary Markdown files on disk.

### Already have a Markdown or Obsidian vault?

Point 2ndBrain CLI at it directly—no initialization, import, or migration required:

```bash
# Read-only health check
brain doctor /absolute/path/to/your/notes

# Read-only link and orphan scan
brain --vault /absolute/path/to/your/notes links --stats --orphans

# Open the local WebUI
brain --vault /absolute/path/to/your/notes web --open
```

> **A safe first step:** `doctor` and link scans are read-only. Use `--dry-run` before renaming or moving notes.

## A visual workspace for plain Markdown

The WebUI turns your local files into a focused maintenance workspace while keeping the filesystem as the source of truth.

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/dashboard-en.png" alt="Local dashboard showing vault health and recent notes"></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/graph-en.png" alt="Interactive local knowledge graph"></td>
  </tr>
  <tr>
    <td align="center"><strong>One-glance vault health</strong><br><sub>Notes, PARA areas, link health, Git status, and recent activity.</sub></td>
    <td align="center"><strong>Interactive knowledge graph</strong><br><sub>Explore relationships without uploading your notes.</sub></td>
  </tr>
</table>

## A safer daily loop

1. **Inspect** before making changes.

   ```bash
   brain status
   brain links --check --stats --orphans
   ```

2. **Preview** refactors, then apply them with confidence.

   ```bash
   brain rename "areas/Old name.md" "New name" --dry-run
   brain rename "areas/Old name.md" "New name"
   ```

3. **Preserve** the result in the notes repository.

   ```bash
   brain backup
   brain backup --push
   ```

## Works alongside the tools you already use

| Tool | Primary responsibility |
| --- | --- |
| Obsidian | Write and browse Markdown with an editor-first experience |
| VS Code | Edit files, scripts, templates, and Git changes |
| Git | Store version history and synchronize a repository |
| **2ndBrain CLI** | Diagnose, safely refactor, review, back up, and visualize a Markdown vault |

2ndBrain CLI does not replace your editor or Git client. It handles the maintenance work that becomes risky and repetitive as a vault grows.

## Core commands

| Command | What it does | Writes files? |
| --- | --- | --- |
| `brain doctor <path>` | Inspect an existing vault without initialization | No |
| `brain status` | Show vault and Git status | No |
| `brain init` | Create the default workspace and PARA directories | Yes |
| `brain capture <title>` | Create a Markdown note with frontmatter | Yes |
| `brain links --stats --orphans` | Inspect links and orphan notes | No |
| `brain backlinks <note>` | List notes linking to a note | No |
| `brain rename <old> <new> --dry-run` | Preview a safe rename and link updates | No |
| `brain move <old> <new> --dry-run` | Preview a move and relative-link updates | No |
| `brain backup [--push]` | Commit, and optionally push, the notes repository | Git only |
| `brain review week` | Review notes using local metadata | No |
| `brain web --open` | Start the local dashboard, note browser, checks, and graph | Only for editing actions |
| `brain watch start` | Start background notes maintenance | Yes |

Run `brain <command> --help` for every option.

## Safety is a feature

- **Local by default.** `brain web` listens only on `127.0.0.1`.
- **Read-only inspection.** Doctor, links, backlinks, status, reviews, and dry-run previews do not modify notes.
- **Scoped Git operations.** Backup and watcher commands operate only on the Git repository at `NOTES_DIR`.
- **Path protection.** Refactors reject paths outside the configured vault.
- **Recoverable changes.** Preview large moves and keep Git history before applying them.

When duplicate short note names make a WikiLink ambiguous, the CLI reports it instead of guessing. Use a vault-relative WikiLink path to disambiguate.

## Try it without using your own notes

The repository includes a small fictional vault with no personal content, so you can evaluate the scanner and WebUI safely.

```bash
git clone https://github.com/tangquanwei/brain-cli.git
cd brain-cli
npm install
npm run build

node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

The demo is verified with 10 notes, 16 internal links, and no broken links, missing references, ambiguous WikiLinks, or orphan notes. See its [structure and expected relationships](examples/demo-vault/README.md).

## Configuration

Use `--vault <path>` for one-off vault selection. For a persistent default, create a workspace-level `.env` from [`.env.example`](.env.example). Resolution order is `--vault`, then `NOTES_DIR`, then `notes`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NOTES_DIR` | `notes` | Markdown vault path, relative to the workspace or absolute |
| `GIT_AUTO_COMMIT` | `true` | Automatically commit after supported write operations |
| `COMMIT_INTERVAL` | `30` | Watcher commit interval in seconds |
| `PUSH_INTERVAL` | `900` | Watcher push interval in seconds |
| `WATCH_ENABLED` | `true` | Enable watcher behavior |

## Agent Skills

Install the repository's skills globally for Codex and OpenClaw:

```bash
npx --yes skills add tangquanwei/brain-cli --skill '*' --global --agent codex openclaw --yes
```

This adds [`operate-brain-vault`](skills/operate-brain-vault/SKILL.md) for safe vault operations and [`maintain-brain-cli`](skills/maintain-brain-cli/SKILL.md) for repository development. Restart the agent if the skills do not appear immediately. To target another [supported agent](https://github.com/vercel-labs/skills#supported-agents), add or replace an `--agent` value.

## Documentation

- [Quick start](docs/guide/01-快速开始.md) · [CLI reference](docs/guide/02-CLI命令参考.md) · [Configuration](docs/guide/04-配置参考.md)
- [Link-scan benchmark](docs/benchmarks/link-scan.md) · [Watcher](docs/guide/05-Watcher守护进程.md) · [Daily workflow](docs/guide/06-日常工作流.md)
- [Roadmap](TODO.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Issues and focused pull requests are welcome. When reporting feedback from a real vault, please include the editor, operating system, note count, and first point of friction—without sharing private note content.

<div align="center">

Built for people who want the convenience of a knowledge tool and the durability of plain files.

[Get started](#start-in-60-seconds) · [Open an issue](https://github.com/tangquanwei/brain-cli/issues) · [Apache-2.0](LICENSE)

</div>
