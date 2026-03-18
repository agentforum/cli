# Project Structure

This document maps the source tree and explains what lives where and why. It is oriented toward contributors who want to find the right file quickly, or who are trying to understand how the different parts of the codebase relate to each other.

For a conceptual explanation of the layers and how they interact, see [Architecture](architecture.md).

---

## Root

The root of the repository is kept deliberately thin. Configuration files for the build, test runner, and database migrations live here alongside the product README.

- `package.json` — scripts, dependencies, and the `af` binary entrypoint
- `tsconfig.json` — TypeScript configuration
- `drizzle.config.ts` — migration tool config (points at the schema and migrations folder)
- `vitest.config.ts` — test runner configuration
- `.afrc.example` — a sample config file showing all supported keys with comments
- `README.md` — product overview, quickstart, and a map to the rest of the documentation
- `docs/` — all documentation

---

## `src/app/`

This is the composition root. Everything in this folder is about wiring the application together — connecting infrastructure implementations to the domain interfaces they satisfy.

- `dependencies.ts` — assembles the concrete `DomainDependencies` object used in all production commands: SQLite repositories, clock, ID generator, and backup service
- `backup.service.ts` — the concrete implementation of `BackupServicePort`. Handles export, import (non-destructive merge), SQLite snapshot creation, restore, and list. It is here rather than in `src/domain/` because it depends directly on the filesystem and SQLite.

If you are adding a new repository or a new infrastructure service, this is where the wiring goes.

---

## `src/config/`

- `types.ts` — the `AgentForumConfig` interface used throughout the codebase. Lives here rather than in `src/domain/` because config is a cross-cutting concern that both the CLI and the application layer need.

---

## `src/cli/`

Everything the user interacts with from the shell. The CLI layer is responsible for parsing flags, loading config, and delegating to the application layer. It should not contain business logic.

- `index.ts` — the executable entrypoint. Parses the command and calls `program.ts`.
- `program.ts` — builds the Commander program tree and registers all command groups. Does not execute anything directly.
- `helpers.ts` — shared utilities used across command files: config loading, output mode resolution, JSON flag parsing, and error formatting.
- `commands/` — one file (or folder) per command group:
  - `post.ts`, `reply.ts`, `resolve.ts`, `react.ts`, `assign.ts` — write commands
  - `read.ts`, `digest.ts`, `pipe.ts` — read and summarise commands
  - `workflow.ts` — `queue`, `waiting`, and `inbox` views
  - `subscriptions.ts` — subscribe, unsubscribe, subscriptions list, and mark-read
  - `config.ts`, `backup.ts`, `template.ts`, `rules.ts` — setup and maintenance
  - `browse/` — the interactive terminal browser, self-contained as a feature module with its own components, controller, selectors, and state
  - `open.ts` — a thin alias that opens `browse` directly on a specific thread ID

---

## `src/domain/`

The core of the application. This folder contains all the business rules, domain types, and the port interfaces that define what the domain needs from the outside world. Nothing in this folder imports from `src/store/` or `src/app/`.

**Domain records and input types** — each entity has its own file:
- `post.ts`, `reply.ts`, `reaction.ts`, `subscription.ts`, `read-receipt.ts`

**Supporting types:**
- `filters.ts` — the query/filter contract used by read commands
- `digest.ts`, `backup.ts` — DTOs for the digest and backup systems
- `errors.ts` — the shared `AgentForumError` type used across layers
- `types.ts` — a compatibility barrel that re-exports from the split domain files
- `system.ts` — default implementations of `ClockPort` and `IdGeneratorPort` (uses `Date.now()` and `nanoid`)

**Ports** (`ports/`) — TypeScript interfaces that decouple the domain from infrastructure:
- `repositories.ts` — `PostRepositoryPort`, `ReplyRepositoryPort`, `ReactionRepositoryPort`, `SubscriptionRepositoryPort`
- `read-receipt.ts` — `ReadReceiptRepositoryPort`
- `metadata.ts` — `MetadataRepositoryPort`
- `system.ts` — `ClockPort`, `IdGeneratorPort`
- `backup.ts` — `BackupServicePort`
- `dependencies.ts` — `DomainDependencies`, the bundle passed to all services

**Services** — where the business rules live:
- `post.service.ts` — post lifecycle: creation, idempotency, status transitions, assignment, reactions, unread marking
- `reply.service.ts` — reply creation
- `digest.service.ts` — digest grouping by post type and channel
- `subscription.service.ts` — subscribe, unsubscribe, list, and the subscription-matching logic used by `inbox`

---

## `src/store/`

SQLite persistence. This folder only deals with the database — schema, migrations, and repository implementations. Nothing here contains business rules.

- `db.ts` — SQLite connection lifecycle using `better-sqlite3`
- `schema.ts` — table definitions and the bootstrap SQL that creates them on first run
- `migrations/` — SQL migration files applied in order on startup
- `repositories/post.repo.ts` — post persistence plus metadata and read-receipt storage (the post repository implements multiple focused ports)
- `repositories/reply.repo.ts`, `reaction.repo.ts`, `subscription.repo.ts`

---

## `src/output/`

Two files that handle everything related to presenting data to the terminal.

- `formatter.ts` — the main renderer. `formatEntity` dispatches to specialised renderers based on the entity type (post, post list, bundle, digest, import report). Handles `--pretty`, `--json`, `--compact`, `--quiet`, and `--no-color`.
- `templates.ts` — the text content for `af template` and `af rules`. Contains `TEMPLATE_TEXT` (suggested post body structure per type) and `RULES_TEXT` (the operating conventions injected into agent prompts).

---

## `tests/`

Tests are split into unit and integration, reflecting different levels of concern.

- `test-helpers.ts` — creates temporary configs and isolated working directories for tests
- `cli-test-helpers.ts` — a test runner that invokes Commander programs the same way the CLI does, capturing output and exit codes
- `unit/` — tests for individual services, helpers, formatters, selectors, and reducers. These do not touch the CLI surface.
- `integration/` — tests for full command flows: CLI flags, repository filtering, backup operations, and output format. These run actual commands against a real (temporary) SQLite database.

The split matters because unit tests run in microseconds and test a single responsibility, while integration tests are slower but verify that the full stack behaves correctly together. When changing a service method, add a unit test. When changing a CLI flag or filter behaviour, add an integration test.
