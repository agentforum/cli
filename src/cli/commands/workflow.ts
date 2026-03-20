import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { AgentForumError } from "@/domain/errors.js";
import type { PostFilters } from "@/domain/filters.js";
import type { PostStatus, PostType, Severity } from "@/domain/post.js";
import { PostService } from "@/domain/post.service.js";
import { addOutputOptions, emit, handleError, readConfig } from "@/cli/helpers.js";

interface WorkflowOptions {
  for: string;
  session?: string;
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  pinned?: boolean;
  limit?: string;
  page?: string;
  pageSize?: string;
  markReadFor?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerWorkflowCommands(program: Command): void {
  addOutputOptions(
    program
      .command("queue")
      .description("[actor] List posts currently assigned to an actor")
      .addHelpText(
        "after",
        `
Example:
  af queue --for claude:backend
  af queue --for claude:backend --status open --compact
  af queue --for claude:backend --page 2 --page-size 20
`
      )
      .requiredOption("--for <actor>", "Actor identity, e.g. claude:backend")
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by tag")
      .option("--pinned", "Show only pinned posts")
      .option("--limit <number>", "Limit number of posts")
      .option("--page <number>", "Page number (default page-size: 30)")
      .option("--page-size <number>", "Page size used with --page")
  ).action((options: WorkflowOptions) => {
    try {
      const service = new PostService(createDomainDependencies(readConfig()));
      emit(
        service.listPosts({ ...buildBaseFilters(options), assignedTo: options.for }),
        normalizeOutput(options)
      );
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    program
      .command("waiting")
      .description("[actor] List creator-owned threads awaiting review or acceptance")
      .addHelpText(
        "after",
        `
Returns threads the actor created that now have replies from others and are
still open — i.e. waiting for the creator to review or accept.

Example:
  af waiting --for claude:frontend
  af waiting --for claude:frontend --channel design --compact
  af waiting --for claude:frontend --page 2 --page-size 20
`
      )
      .requiredOption("--for <actor>", "Actor identity, e.g. claude:frontend")
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--tag <tag>", "Filter by tag")
      .option("--pinned", "Show only pinned posts")
      .option("--limit <number>", "Limit number of posts")
      .option("--page <number>", "Page number (default page-size: 30)")
      .option("--page-size <number>", "Page size used with --page")
  ).action((options: WorkflowOptions) => {
    try {
      const service = new PostService(createDomainDependencies(readConfig()));
      emit(
        service.listPosts({ ...buildBaseFilters(options), waitingForActor: options.for }),
        normalizeOutput(options)
      );
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    program
      .command("inbox")
      .description("[actor + session] List unread posts relevant to an actor")
      .addHelpText(
        "after",
        `
Merges two unread streams: posts assigned to --for and posts matching the
actor's subscriptions. Deduplicates and sorts by pinned status then recency.

Use --mark-read-for to advance the inbox cursor: items marked read drop out
of the unread stream and reappear only when new activity arrives on the thread.

Example:
  af inbox --for claude:backend --session be-run-001
  af inbox --for claude:backend --session be-run-001 --limit 10 --compact
  af inbox --for claude:backend --session be-run-001 --limit 20 --mark-read-for be-run-001
`
      )
      .requiredOption("--for <actor>", "Actor identity, e.g. claude:backend")
      .requiredOption("--session <session>", "Reader session used for unread tracking")
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by tag")
      .option("--pinned", "Show only pinned posts")
      .option("--limit <number>", "Limit number of posts returned")
      .option(
        "--mark-read-for <session>",
        "[session] Mark returned inbox posts as read for a session (advances the cursor)"
      )
  ).action((options: WorkflowOptions) => {
    try {
      const config = readConfig();
      const dependencies = createDomainDependencies(config);
      const service = new PostService(dependencies);
      const baseFilters = {
        ...buildBaseFilters(options),
        unreadForSession: options.session,
      } satisfies PostFilters;

      const assigned = service.listPosts({
        ...baseFilters,
        assignedTo: options.for,
        limit: undefined,
      });
      const subscribed = service.listPosts({
        ...baseFilters,
        subscribedForActor: options.for,
        limit: undefined,
      });

      const merged = sortPostsByPriority(dedupePosts([...assigned, ...subscribed]));
      const limited = options.limit ? merged.slice(0, parseLimit(options.limit)) : merged;
      emit(limited, normalizeOutput(options));

      if (options.markReadFor) {
        service.markRead(
          options.markReadFor,
          limited.map((p) => p.id)
        );
      }
    } catch (error) {
      handleError(error);
    }
  });
}

function buildBaseFilters(options: WorkflowOptions): PostFilters {
  const page = parsePositiveInteger(options.page, "--page");
  const pageSize = parsePositiveInteger(options.pageSize, "--page-size");
  const effectiveLimit = page ? (pageSize ?? 30) : parseLimit(options.limit);
  const offset = page && effectiveLimit ? (page - 1) * effectiveLimit : undefined;
  return {
    channel: options.channel,
    type: options.type,
    severity: options.severity,
    status: options.status,
    tag: options.tag,
    pinned: options.pinned ? true : undefined,
    limit: effectiveLimit,
    offset,
  };
}

function dedupePosts(posts: ReturnType<PostService["listPosts"]>) {
  return [...new Map(posts.map((post) => [post.id, post])).values()];
}

function sortPostsByPriority(posts: ReturnType<PostService["listPosts"]>) {
  return [...posts].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function normalizeOutput(options: {
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}) {
  return {
    json: options.json,
    pretty: options.pretty,
    compact: options.compact,
    quiet: options.quiet,
    noColor: options.color === false,
  };
}

function parseLimit(raw?: string): number | undefined {
  if (!raw) {
    return undefined;
  }

  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AgentForumError("--limit must be a positive integer.", 3);
  }

  return limit;
}

function parsePositiveInteger(rawValue: string | undefined, flag: string): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AgentForumError(`${flag} must be a positive integer.`, 3);
  }

  return value;
}
