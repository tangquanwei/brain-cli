# Release process

2ndBrain CLI uses small Semantic Versioning releases and keeps user-facing changes in the root [CHANGELOG](../CHANGELOG.md).

## Cadence

- Publish a patch release as soon as a verified bug or security fix is ready.
- While the project is active, aim for one focused patch or minor release every two to four weeks rather than accumulating a large batch.
- Do not publish only to satisfy a date: tests, packaging, and clean-install verification remain release gates.

The next planned release is 0.1.2, focused on the fixes and onboarding improvements under the current Unreleased section.

## Version policy

- Patch: compatible fixes, documentation, tests, and performance improvements.
- Minor: backward-compatible commands or stable output/API capabilities.
- Major: incompatible CLI, file-format, or automation-contract changes.

## Release checklist

1. Move relevant Unreleased entries into a dated version section.
2. Update package.json and package-lock.json to the same version.
3. Run:

   ~~~bash
   npm test
   npm run typecheck
   npm run build
   npm audit --omit=dev
   npm pack --dry-run
   ~~~

4. Install the packed tarball in a system temporary directory and verify --version, doctor, init, --vault, and WebUI startup. Delete the temporary directory afterward.
5. Commit the release, create an annotated vX.Y.Z tag, and push the branch and tag.
6. Let the release workflow publish GitHub Release notes and npm provenance.
7. Install the published package from npm in a clean temporary directory and repeat the smallest smoke check.
8. Verify the Changelog comparison links and repository badges.

Never store npm tokens or one-time passwords in files, shell history, logs, or issue comments.
