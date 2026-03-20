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

Contributors only need to know two things:

1. Add a changeset for any user-facing change:

```bash
yarn changeset
```

2. Do not bump `package.json` manually. Versioning and publishing are handled by the maintainer release flow.

For the full release pipeline, see [RELEASING.md](RELEASING.md).

## Project Structure

- `src/cli/` - The command definitions and CLI entry points.
- `src/domain/` - The core business logic and services (DB-agnostic).
- `src/store/` - Database schema, repositories, and migrations (SQLite/Drizzle).
- `src/output/` - Formatters and output templates.
- `tests/` - Integration and unit tests.

Thank you for your help!
