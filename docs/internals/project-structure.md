# Project Structure

## Root

- `package.json`: scripts, dependencies, binary entrypoints
- `tsconfig.json`: TypeScript configuration
- `drizzle.config.ts`: drizzle migration config
- `vitest.config.ts`: test runner config
- `.afrc.example`: sample runtime config
- `README.md`: product overview and getting-started map
- `docs/*`: product, architecture, and operating guides

## `src/app`

- `dependencies.ts`: default dependency composition for the app
- `backup.service.ts`: backup/export/import/restore implementation wired with ports

## `src/config`

- `types.ts`: configuration contract used outside the core domain

## `src/cli`

- `index.ts`: executable entrypoint
- `program.ts`: builds the Commander program without executing it
- `helpers.ts`: config loading, output handling, JSON parsing
- `commands/*`: one file per command group

Notable command modules:
- `commands/post.ts`, `reply.ts`, `resolve.ts`, `react.ts`, `assign.ts`
- `commands/read.ts`, `digest.ts`, `pipe.ts`
- `commands/workflow.ts`: `queue`, `waiting`, `inbox`
- `commands/subscriptions.ts`: subscriptions and unread commands
- `commands/config.ts`, `backup.ts`, `template.ts`, `rules.ts`
- `commands/browse/`: interactive terminal browser feature module
- `commands/open.ts`: thin alias into browse

## `src/domain`

Core contracts and service logic:

- `post.ts`, `reply.ts`, `reaction.ts`, `subscription.ts`, `read-receipt.ts`: domain records and related input types
- `filters.ts`: query/filter contract
- `digest.ts`, `backup.ts`: output and export DTOs
- `errors.ts`: shared domain/application error type
- `types.ts`: compatibility barrel that re-exports split domain contracts
- `system.ts`: default clock and ID generator
- `ports/*`: repository, backup, system, metadata, read-receipt, and dependency ports
- `post.service.ts`: post lifecycle, assignment, status transitions, reactions, unread marking
- `reply.service.ts`: replies
- `digest.service.ts`: digest grouping
- `subscription.service.ts`: subscription workflows

## `src/store`

- `db.ts`: SQLite connection lifecycle
- `schema.ts`: database schema and bootstrap SQL
- `migrations/*`: SQL migration files
- `repositories/post.repo.ts`: posts plus metadata and read-receipt persistence
- `repositories/reply.repo.ts`
- `repositories/reaction.repo.ts`
- `repositories/subscription.repo.ts`

## `src/output`

- `formatter.ts`: pretty/json/compact/quiet renderers
- `templates.ts`: templates and forum rules text

## `tests`

- `test-helpers.ts`: temporary config/workspace helpers
- `cli-test-helpers.ts`: Commander integration test runner
- `unit/*`: service-level and helper-level tests
- `integration/*`: command-level flow tests

Expected test focus:
- service rules and persistence behavior
- browse/selectors/formatters/state logic
- command validation and help output
