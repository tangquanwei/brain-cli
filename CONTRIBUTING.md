# Contributing to 2ndBrain CLI

Thanks for helping make Markdown vault maintenance safer and easier to adopt.

## Start with the right channel

- Use [Discussions](https://github.com/tangquanwei/brain-cli/discussions) for questions, workflow ideas, and early proposals.
- Use an [Issue](https://github.com/tangquanwei/brain-cli/issues/new/choose) for reproducible bugs, scoped feature requests, and compatibility gaps.
- Use [Security Advisories](https://github.com/tangquanwei/brain-cli/security/advisories/new) for vulnerabilities. Do not open a public security issue.

Never attach a private vault. Reduce the problem to a fictional Markdown sample and remove names, paths, remotes, tokens, and note content that should not be public.

## Good first contributions

Issues labeled [good first issue](https://github.com/tangquanwei/brain-cli/labels/good%20first%20issue) are designed to be completed without prior knowledge of the codebase. Comment on the issue before starting so work is not duplicated.

Good contribution areas include:

- documentation and examples;
- Obsidian/Markdown compatibility fixtures;
- Windows, macOS, and Linux path tests;
- read-only diagnostics and clear error messages.

Keep a pull request focused on one problem. For a larger behavior or data-contract change, open a Discussion or Issue first.

## Local development

Requires Node.js 20 or newer.

~~~bash
git clone https://github.com/tangquanwei/brain-cli.git
cd brain-cli
npm install
npm test
npm run typecheck
npm run build
~~~

Use the fictional Demo Vault for manual checks:

~~~bash
node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
~~~

## Safety expectations

Every command must have an explicit read/write boundary.

- Diagnostics and previews should remain read-only by default.
- File mutations must stay inside the configured vault.
- Git operations must stay inside the configured vault repository.
- WebUI services must listen on 127.0.0.1 unless a future design explicitly documents authentication and exposure.
- Tests and screenshots must use synthetic content.

Changes to rename, move, Git, watcher, WebUI write APIs, or path resolution need boundary-focused tests.

## Pull requests

Before opening a PR:

~~~bash
npm test
npm run typecheck
npm run build
git diff --check
~~~

Include:

- the user-facing problem and scope;
- the commands or UI flow used to verify it;
- read/write boundary changes;
- tests added or why tests are not applicable;
- screenshots only when visible UI changed.

Maintainers may ask for a smaller PR when unrelated cleanup makes safety review difficult.

## Style

- Follow the existing TypeScript and React conventions.
- Run Prettier on files you change.
- Prefer standard Markdown links in repository documentation.
- Keep user-facing language direct and avoid claiming compatibility that is not covered by tests.

By contributing, you agree that your contribution is licensed under the repository's [Apache-2.0 License](LICENSE).
