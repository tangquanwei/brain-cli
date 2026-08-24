# Security Policy

2ndBrain CLI reads and mutates local Markdown files and can run Git operations, so path boundaries and safe defaults are security-sensitive behavior.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest published 0.1.x patch | Yes |
| Older 0.1.x patches | Upgrade first |
| Unreleased source builds | Best effort |

## Report a vulnerability privately

Use GitHub's private [Report a vulnerability](https://github.com/tangquanwei/brain-cli/security/advisories/new) form.

Please include:

- affected version and operating system;
- the smallest reproducible command or request;
- expected and actual security boundary;
- impact and whether private files, Git repositories, or network access are involved;
- a synthetic reproduction, never a real private vault.

Do not include credentials, private note content, personal filesystem paths, or remote URLs containing secrets.

## Response process

The maintainer will aim to:

1. acknowledge a report within three business days;
2. confirm scope and severity before public disclosure;
3. prepare a patch and narrow regression test;
4. publish a GitHub Security Advisory and patched release when applicable.

Please allow a reasonable remediation window before public disclosure.

## Security boundaries

Reports are especially useful when they involve:

- reads or writes escaping the configured vault;
- Git commits or pushes affecting a parent or unrelated repository;
- unsafe Markdown rendering or WebUI request handling;
- WebUI exposure beyond 127.0.0.1;
- arbitrary command execution, path traversal, or unsafe file opening;
- dependency vulnerabilities with a demonstrated reachable impact.

General bugs and feature requests belong in the public [issue tracker](https://github.com/tangquanwei/brain-cli/issues).
