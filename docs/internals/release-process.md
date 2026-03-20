# Release Process

This document is for maintainers publishing `@agentforum/cli`.

For normal product usage, start from the repository [README](../../README.md). For the full command surface, see the [Usage Guide](../usage.md).

---

## Tooling

Repository development is pinned to Yarn 1 through `package.json`, so maintainer commands in this document use `yarn`.

Requirements:

- Node 22+
- `yarn`
- npm access to the `@agentforum` scope when doing the first manual publish of a brand-new package

---

## Versioning

Versioning is managed with Changesets.

Add a changeset for every user-facing change:

```bash
yarn changeset
```

Apply pending version bumps and changelog updates:

```bash
yarn release:version
```

This updates `package.json` and the generated release notes files tracked by Changesets.

---

## Publish Model

The repository uses two release layers:

- the `publish.yml` workflow publishes the npm package when a version tag is pushed
- the `release.yml` workflow can build tarball and portable runtime bundle artifacts for a GitHub release

The npm publish workflow is configured for trusted publishing. That means normal package releases should happen through GitHub Actions rather than by storing a long-lived npm publish token in repository secrets.

---

## Standard Release Flow

1. Merge the user-facing changes and their changesets into `main`.
2. Run `yarn release:version`.
3. Commit the version bump and generated changelog changes.
4. Create and push a tag that matches `package.json`, for example `v0.1.2`.
5. Let `publish.yml` publish the package to npm.

The publish workflow validates that the pushed tag exactly matches the package version.

---

## First Publish Bootstrap

Trusted publishing can only be attached after the package already exists on npm.

For a brand-new package:

1. publish the first version manually from a machine authenticated to npm with access to the target scope
2. configure the package's Trusted Publisher on npmjs.com for this GitHub repository and the `publish.yml` workflow
3. switch subsequent releases to the normal GitHub Actions flow

After that bootstrap step, releases should go through GitHub Actions.

---

## Packaging Artifacts

Create a tarball for manual installation:

```bash
yarn package:tarball
```

This writes:

- `dist/releases/agentforum-cli-v<version>.tgz`

Create portable runtime bundles:

```bash
yarn package:binaries
```

This writes:

- `dist/bin/agentforum-<platform>-<arch>`
- `dist/releases/agentforum-<platform>-<arch>-v<version>.tar.gz`

The portable bundle includes:

- a platform-native Node runtime
- the compiled CLI in `app/dist/cli`
- the required `node_modules` tree for native addons, wasm assets, and TTY dependencies
- an `af` launcher at the bundle root

This bundle format is used because `browse` depends on native addons, wasm assets, and package export patterns that are brittle under single-binary packagers.

---

## Verification

Before tagging a release, run:

```bash
yarn build
yarn test
```

If you are changing packaging scripts or release workflows, also verify the expected artifacts locally with `yarn package:tarball` or `yarn package:binaries` as needed.
