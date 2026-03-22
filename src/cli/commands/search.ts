import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { resolveStructuredSearchFilters } from "@/cli/search-query.js";
import type { PostStatus, PostType, Severity } from "@/domain/post.js";
import { PostService } from "@/domain/post.service.js";
import type { ReactionType } from "@/domain/reaction.js";
import { AgentForumError } from "@/domain/errors.js";
import { addOutputOptions, emit, handleError, readConfig } from "@/cli/helpers.js";

interface SearchOptions {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  actor?: string;
  replyActor?: string;
  since?: string;
  until?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  page?: string;
  pageSize?: string;
  limit?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerSearchCommand(program: Command): void {
  addOutputOptions(
    program
      .command("search <text>")
      .description("Search posts by text and structured qualifiers")
      .addHelpText(
        "after",
        `
Examples:
  af search "token refresh"
  af search "oauth" --channel backend --status open
  af search "handoff" --reply-actor claude:reviewer --page 2
  af search "oauth /actor=claude:backend /tag=frontend /tag~=front"
  af search "oauth /actor!=claude:backend /tag!~=ops"
  af search "/assigned=gemini:frontend /status=open handoff"
  af search '"token refresh" /session=run-042 /channel=backend'
`
      )
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by exact tag")
      .option("--actor <actor>", "Filter by post author")
      .option("--reply-actor <actor>", "Filter by reply author")
      .option("--since <isoDate>", "Filter by ISO date")
      .option("--until <isoDate>", "Filter up to an ISO date")
      .option("--pinned", "Show only pinned posts")
      .option("--reaction <reaction>", "Filter by reaction type")
      .option("--limit <number>", "Limit number of results")
      .option("--page <number>", "Read a specific page of results")
      .option("--page-size <number>", "Page size used together with --page")
  ).action((text: string, options: SearchOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const page = parsePositiveInteger(options.page, "--page");
      const pageSize = parsePositiveInteger(options.pageSize, "--page-size");
      const limit = pageSize ?? parsePositiveInteger(options.limit, "--limit");
      const effectiveLimit = page ? (limit ?? 30) : limit;
      const offset = page && effectiveLimit ? (page - 1) * effectiveLimit : undefined;
      const resolved = resolveStructuredSearchFilters(
        {
          channel: options.channel,
          type: options.type,
          severity: options.severity,
          status: options.status,
          tag: options.tag,
          actor: options.actor,
          replyActor: options.replyActor,
          since: options.since,
          until: options.until,
          pinned: options.pinned ? true : undefined,
          reaction: options.reaction,
          limit: effectiveLimit,
          offset,
        },
        text
      );

      const entity = service.listPosts(resolved.filters);

      emit(entity, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact,
        quiet: options.quiet,
        noColor: options.color === false,
      });
    } catch (error) {
      handleError(error);
    }
  });
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
