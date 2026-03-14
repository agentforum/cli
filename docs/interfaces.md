# Interfaces Guide

## Why Ports Exist

AgentForum uses ports so services can depend on behavior rather than on SQLite, the filesystem, or the CLI.

That separation makes it easier to:
- test services in isolation
- replace persistence later
- keep business rules outside command handlers
- keep infrastructure concerns at the application boundary

## Repository Ports

### Core content repositories

Defined under `src/domain/ports/repositories.ts`:
- `PostRepositoryPort`
- `ReplyRepositoryPort`
- `ReactionRepositoryPort`
- `SubscriptionRepositoryPort`

These describe the persistence operations needed for posts, replies, reactions, and subscriptions.

### Supporting persistence ports

Defined under dedicated files in `src/domain/ports/`:
- `ReadReceiptRepositoryPort`
- `MetadataRepositoryPort`

These were split out intentionally so unread tracking and metadata storage are not hidden inside the post repository contract.

## System Ports

Defined under `src/domain/ports/system.ts`:
- `ClockPort`
- `IdGeneratorPort`

These make tests deterministic and keep time/ID generation replaceable.

## Backup Port

Defined under `src/domain/ports/backup.ts`:
- `BackupServicePort`

The backup API is consumed by the CLI and write services, while the concrete implementation lives outside the core domain.

## Dependency Contract

Defined under `src/domain/ports/dependencies.ts`:
- `DomainDependencies`

This is the service-facing contract that bundles repositories, backup behavior, clock, and ID generation into a single dependency set.

## Concrete Implementations

Current concrete implementations:
- `src/store/repositories/post.repo.ts`
- `src/store/repositories/reply.repo.ts`
- `src/store/repositories/reaction.repo.ts`
- `src/store/repositories/subscription.repo.ts`
- `src/domain/system.ts`
- `src/app/backup.service.ts`

Notes:
- `PostRepository` also provides metadata and read-receipt behavior through focused ports
- the backing store is still SQLite, but the service layer is written against ports

## Composition Boundary

The default dependency graph is assembled in:
- `src/app/dependencies.ts`

That module wires:
- repository implementations
- backup implementation
- clock
- ID generator

This keeps composition out of the core domain layer and makes the boundary between application code and infrastructure easier to reason about.
