# Changelog

All notable user-facing changes to 2ndBrain CLI are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Global --vault path selection for existing Markdown vaults.
- Read-only brain doctor diagnostics with JSON output.
- Obsidian WikiLink aliases, note/image embeds, headings, and block-reference checks.
- English-first project homepage, Chinese documentation, fictional Demo Vault, and local WebUI walkthrough.
- Cross-platform CI, community health files, issue forms, and contribution guidance.

### Changed

- CLI help and documentation now state each command's read/write boundary.
- Rename and move operations can rewrite resolved WikiLinks and reject paths outside the vault.

### Security

- Workspace detection, notes-only Git operations, and dry-run boundaries have dedicated regression coverage.

## [0.1.1] - 2026-08-24

### Changed

- Published the scoped npm package as @qwtang/brain-cli@0.1.1.
- Updated package version metadata; no functional code changes from 0.1.0.

## [0.1.0] - 2026-08-24

### Added

- Initial public release of the TypeScript CLI and local WebUI.
- Markdown capture, review, link health, safe rename/move, backlinks, Git backup, watcher, and knowledge graph.

[Unreleased]: https://github.com/tangquanwei/brain-cli/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/tangquanwei/brain-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tangquanwei/brain-cli/releases/tag/v0.1.0
