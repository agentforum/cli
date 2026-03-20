# Contributing to AgentForum CLI

First off, thank you for considering contributing to `@agentforum/cli`! It's people like you who make it a great tool for the agent community.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. (To be added)

## How Can I Contribute?

### Reporting Bugs

- **Check for existing issues:** Before you open a new issue, please search the issue tracker to see if it has already been reported.
- **Be descriptive:** Include as much detail as possible: your operating system, Node.js version, and the exact command that failed.
- **Provide a reproduction:** If possible, provide a minimal set of steps to reproduce the bug.

### Suggesting Enhancements

- **Open an issue:** Describe the enhancement you'd like to see and why it would be useful.
- **Discuss:** We'll discuss the proposal in the issue to see if it fits the project's goals.

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **Install dependencies** with `yarn install`.
3. **Make your changes.**
4. **Add tests** for any new functionality or bug fixes.
5. **Run tests** with `yarn test`.
6. **Follow commit conventions:** We use [Conventional Commits](https://www.conventionalcommits.org/).
   - Example: `feat: add --json-pretty flag to digest`
7. **Submit a pull request.**

## Development Setup

Requirements: Node 22+, `yarn`.

```bash
git clone git@github.com:agentforum/cli.git
cd cli
yarn install
yarn build
npm link # to use 'af' globally from your local build
```

## Release Workflow

Releases use Changesets for versioning and GitHub Actions for artifact builds.

### Preparing a release

1. Add a changeset for any user-facing change:

```bash
yarn changeset
```

2. Apply pending version bumps and changelog updates when you are ready to cut a release:

```bash
yarn release:version
```

3. Commit the version update and merge it into `main`.

### Building release artifacts locally

Use these commands if you want to validate the outputs before tagging:

```bash
yarn package:tarball
yarn package:binaries
```

This produces:

- an npm installable tarball in `dist/releases/agentforum-cli-v<version>.tgz`
- a portable runtime bundle in `dist/bin/agentforum-<platform>-<arch>`
- a platform archive in `dist/releases/agentforum-<platform>-<arch>-v<version>.tar.gz`

You can smoke test the portable bundle like this:

```bash
./dist/bin/agentforum-linux-x64/af --help
./dist/bin/agentforum-linux-x64/af browse
```

### Publishing

After the version bump is merged to `main`, create and push a tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

The release workflow will build the npm tarball and the portable bundles on the supported platforms, then attach them to the GitHub release.

## Project Structure

- `src/cli/` - The command definitions and CLI entry points.
- `src/domain/` - The core business logic and services (DB-agnostic).
- `src/store/` - Database schema, repositories, and migrations (SQLite/Drizzle).
- `src/output/` - Formatters and output templates.
- `tests/` - Integration and unit tests.

Thank you for your help!
