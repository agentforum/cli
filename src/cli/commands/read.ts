import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import type { PostStatus, PostType, Severity } from "../../domain/post.js";
import { PostService } from "../../domain/post.service.js";
import type { ReactionType } from "../../domain/reaction.js";
import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";

interface ReadOptions {
  id?: string;
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  text?: string;
  actor?: string;
  replyActor?: string;
  session?: string;
  since?: string;
  until?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: string;
  page?: string;
  pageSize?: string;
  afterId?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  markReadFor?: string;
  replyLimit?: string;
  replyPage?: string;
  replyPageSize?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerReadCommand(program: Command): void {
  addOutputOptions(
    program
      .command("read")
      .description("Read posts and full threads from the forum")
      .addHelpText(
        "after",
        `
Examples:
  af read --id P-123                          # Full thread with replies
  af read --channel backend --status open     # All open posts in a channel
  af read --unread-for run-001 --limit 20     # First 20 unread posts for a session
  af read --id P-123 --mark-read-for run-001  # Read a thread and mark it read
  af read --type finding --severity critical  # Critical findings across all channels
  af read --text "token refresh" --page 2     # Search title/body/replies
`
      )
      .option("--id <id>", "Read a single post with replies and reactions")
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by tag")
      .option("--text <text>", "Search in titles, post bodies, and reply bodies")
      .option("--actor <actor>", "Filter by actor identity")
      .option("--reply-actor <actor>", "Filter posts that have a reply from a given actor")
      .option("--session <session>", "Filter by session")
      .option("--since <isoDate>", "Filter by ISO date")
      .option("--until <isoDate>", "Filter up to an ISO date")
      .option("--pinned", "Show only pinned posts")
      .option("--reaction <reaction>", "Filter by reaction type")
      .option("--limit <number>", "Limit number of records")
      .option("--page <number>", "Read a specific page of results")
      .option("--page-size <number>", "Page size used together with --page")
      .option("--after-id <postId>", "Read posts created after the given post ID")
      .option("--unread-for <session>", "[session] Return only unread posts for a reader session")
      .option("--subscribed-for <actor>", "[actor] Return only posts matching subscriptions for an actor")
      .option("--assigned-to <actor>", "[actor] Return only posts currently assigned to an actor")
      .option("--waiting-for <actor>", "[actor] Return creator-owned threads with replies from others pending acceptance")
      .option("--mark-read-for <session>", "[session] Mark returned posts as read for a reader session")
      .option("--reply-limit <number>", "Limit number of replies shown in a single-post bundle")
      .option("--reply-page <number>", "Reply page (use with --reply-page-size, default 20)")
      .option("--reply-page-size <number>", "Replies per page")
  ).action((options: ReadOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const page = parsePositiveInteger(options.page, "--page");
      const pageSize = parsePositiveInteger(options.pageSize, "--page-size");
      const limit = pageSize ?? parsePositiveInteger(options.limit, "--limit");
      const effectiveLimit = page ? limit ?? 30 : limit;
      const offset = page && effectiveLimit ? (page - 1) * effectiveLimit : undefined;

      const replyPage = parsePositiveInteger(options.replyPage, "--reply-page");
      const replyPageSize = parsePositiveInteger(options.replyPageSize, "--reply-page-size");
      const replyLimit = replyPageSize ?? parsePositiveInteger(options.replyLimit, "--reply-limit");
      const effectiveReplyLimit = replyPage ? replyLimit ?? 20 : replyLimit;
      const replyOffset = replyPage && effectiveReplyLimit ? (replyPage - 1) * effectiveReplyLimit : undefined;
      const replyOptions =
        effectiveReplyLimit !== undefined || replyOffset !== undefined
          ? { limit: effectiveReplyLimit, offset: replyOffset }
          : undefined;

      const entity = options.id
        ? service.getPost(options.id, replyOptions)
        : service.listPosts({
            channel: options.channel,
            type: options.type,
            severity: options.severity,
            status: options.status,
            tag: options.tag,
            text: options.text,
            actor: options.actor,
            replyActor: options.replyActor,
            session: options.session,
            since: options.since,
            until: options.until,
            pinned: options.pinned ? true : undefined,
            reaction: options.reaction,
            limit: effectiveLimit,
            offset,
            afterId: options.afterId,
            unreadForSession: options.unreadFor,
            subscribedForActor: options.subscribedFor,
            assignedTo: options.assignedTo,
            waitingForActor: options.waitingFor
          });

      if (options.markReadFor) {
        const postIds = options.id
          ? [(entity as { post: { id: string } }).post.id]
          : (entity as Array<{ id: string }>).map((post) => post.id);
        service.markRead(options.markReadFor, postIds);
      }

      emit(entity, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact,
        quiet: options.quiet,
        noColor: options.color === false
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
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
}
