# Releasing

This document is for the maintainer release flow.

This project publishes the CLI to npm from GitHub Actions. The release boundary is a git tag, not a merge to `main`.

## Preconditions

1. The npm package name must exist under the intended owner.
2. Repository secrets must allow npm publishing. Today that means `NPM_TOKEN`, unless the workflow is moved fully to trusted publishing.
3. Use Node 22 locally when verifying release candidates so local results match CI and the release runners.

## End-to-end release flow

1. Land user-facing changes on `main` with a changeset:

```bash
yarn changeset
git push
```

2. Wait for the `Changesets` workflow to open or update the version PR.
3. Review and merge the version PR. That commit updates `package.json` and changelog/release-note files for the next release.
4. Pull `main` and verify the versioned commit locally if needed:

```bash
yarn install
yarn test
yarn build
yarn package:tarball
yarn package:binaries
```

5. Create and push a tag that matches the version in `package.json` exactly:

```bash
git tag v0.1.1
git push origin v0.1.1
```

6. Pushing the tag triggers both release workflows:
   - `.github/workflows/release.yml` builds release artifacts on the supported platforms and creates the GitHub Release.
   - `.github/workflows/publish.yml` validates the tag against `package.json`, runs tests, builds the CLI, and publishes to npm.

## Why the workflow is split

- Changesets is good at deciding version bumps and assembling changelog edits.
- Tagging is the deliberate operator step that says "this exact commit is the release candidate."
- GitHub Release creation handles cross-platform artifacts.
- npm publication runs independently from the same tag so package publishing does not depend on GitHub Release permissions or asset creation succeeding first.

This split reduces accidental publishes from ordinary pushes to `main`, but it also means a release can stall between stages if someone forgets the next step.

## Failure modes to watch for

1. No changeset was added for a user-facing change.
Result: no version PR appears, so nothing is ready to release.

2. The tag does not match `package.json`.
Result: the publish workflow fails in the tag validation step.

3. The version PR is merged, but no tag is pushed.
Result: source is versioned on `main`, but neither the GitHub Release nor the npm release happens.

4. The package is scoped but npm access is not explicit.
Result: first publish can fail or resolve to the wrong visibility. This repo now sets public access explicitly in both `package.json` and the publish workflow.

5. Local verification uses a different Node major than CI.
Result: native dependency failures or packaging differences can hide real release issues. Use Node 22 locally to match CI.

## Local verification

```bash
yarn install
yarn test
yarn build
yarn package:tarball
yarn package:binaries
```

On Windows PowerShell, prefer `npm.cmd` only if script execution policy blocks `npm`.
