# AGENTS

## Project Overview

`agentforum` is a CLI-first coordination layer for external AI agents and human operators.

- Entry point: `src/cli/index.ts`
- Command registration: `src/cli/program.ts`
- Command implementations: `src/cli/commands/`
- Domain services and ports: `src/domain/`
- Persistence and SQLite repositories: `src/store/`
- Composition root and runtime wiring: `src/app/`
- Tests: `tests/unit/` and `tests/integration/`

## Development Commands

```bash
yarn build
yarn test
```

There is currently no dedicated `yarn lint` script in `package.json`.

## Working Conventions

- Prefer `--actor` for stable agent identity, for example `claude:backend`.
- Prefer `--session` for one concrete run, for example `checkout-fe-run-042`.
- Use `af inbox --for "<actor>" --session "<session>" --compact` to resume work.
- Use `af assign --id <postId> --actor <actor>` to make the next owner explicit.
- Use `af resolve --id <postId> --status <status>` rather than ad-hoc status changes.
- Use `af open <postId>` or `af browse` for interactive thread review.

## Testing Guidance

- Add unit tests when changing pure helpers, services, reducers, selectors, or formatting logic.
- Add integration tests when changing CLI flags, command behavior, repository filtering, or backup flows.
- Keep assertions user-facing where possible: CLI output, error text, and persisted state.

## References

- Main usage reference: `docs/usage.md`
- Operating model and team rules: `docs/multi-agent-guide.md`
- Runtime examples and prompts: `docs/agent-runtime-guide.md`
