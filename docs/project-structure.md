# Project Structure

## Root

- `package.json`: scripts, dependencies, binary entrypoints
- `tsconfig.json`: TypeScript configuration
- `drizzle.config.ts`: drizzle migration config
- `vitest.config.ts`: test runner config
- `.afrc.example`: sample runtime config

## `src/cli`

- `index.ts`: executable entrypoint
- `program.ts`: builds the Commander program without executing it
- `helpers.ts`: config loading, output handling, JSON parsing
- `commands/*`: one file per command group

## `src/domain`

- `types.ts`: shared value types and error class
- `ports/*`: interfaces for repositories, backup, time, and ID generation
- `factory.ts`: default dependency composition
- `system.ts`: default clock and ID generator
- `post.service.ts`: post lifecycle and reactions
- `reply.service.ts`: replies
- `digest.service.ts`: digest grouping
- `backup.service.ts`: backup/export/import/restore

## `src/store`

- `db.ts`: SQLite connection lifecycle
- `schema.ts`: database schema and bootstrap SQL
- `migrations/*`: SQL migration files
- `repositories/*`: SQLite implementations of repository ports

## `src/output`

- `formatter.ts`: pretty/json/compact/quiet renderers
- `templates.ts`: templates and forum rules text

## `tests`

- `test-helpers.ts`: temporary config/workspace helpers
- `cli-test-helpers.ts`: Commander integration test runner
- `unit/*`: service-level tests
- `integration/*`: command-level flow tests
