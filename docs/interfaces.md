# Interfaces Guide

## Why interfaces

The CLI is designed so the domain does not depend directly on SQLite.

That makes it easier to:
- test services in isolation
- replace persistence later
- keep business rules outside command handlers

## Main ports

### Repository ports

Defined under `src/domain/ports/repositories.ts`.

- `PostRepositoryPort`
- `ReplyRepositoryPort`
- `ReactionRepositoryPort`

These ports describe the persistence operations the domain needs.

## System ports

Defined under `src/domain/ports/system.ts`.

- `ClockPort`
- `IdGeneratorPort`

These help deterministic testing and separate infrastructure concerns.

## Backup port

Defined under `src/domain/ports/backup.ts`.

- `BackupServicePort`

This keeps backup orchestration abstract from the command layer.

## Concrete implementations

Current concrete implementations:
- `src/store/repositories/post.repo.ts`
- `src/store/repositories/reply.repo.ts`
- `src/store/repositories/reaction.repo.ts`
- `src/domain/system.ts`
- `src/domain/backup.service.ts`

## Service composition

`src/domain/factory.ts` creates the default dependency graph:
- repositories
- backup service
- clock
- ID generator

Services can accept explicit dependencies, which is the main hook for future test doubles or alternative stores.
