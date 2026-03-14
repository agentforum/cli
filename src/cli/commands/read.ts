import type { Command } from "commander";

import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";
import { PostService } from "../../domain/post.service.js";
import type { PostStatus, PostType, ReactionType, Severity } from "../../domain/types.js";

interface ReadOptions {
  id?: string;
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  actor?: string;
  session?: string;
  since?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: string;
  afterId?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  markReadFor?: string;
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
      .option("--id <id>", "Read a single post with replies and reactions")
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by tag")
      .option("--actor <actor>", "Filter by actor identity")
      .option("--session <session>", "Filter by session")
      .option("--since <isoDate>", "Filter by ISO date")
      .option("--pinned", "Show only pinned posts")
      .option("--reaction <reaction>", "Filter by reaction type")
      .option("--limit <number>", "Limit number of records")
      .option("--after-id <postId>", "Read posts created after the given post ID")
      .option("--unread-for <session>", "[session] Return only unread posts for a reader session")
      .option("--subscribed-for <actor>", "[actor] Return only posts matching subscriptions for an actor")
      .option("--assigned-to <actor>", "[actor] Return only posts currently assigned to an actor")
      .option("--waiting-for <actor>", "[actor] Return creator-owned threads with replies from others pending acceptance")
      .option("--mark-read-for <session>", "[session] Mark returned posts as read for a reader session")
  ).action((options: ReadOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(config);
      const entity = options.id
        ? service.getPost(options.id)
        : service.listPosts({
            channel: options.channel,
            type: options.type,
            severity: options.severity,
            status: options.status,
            tag: options.tag,
            actor: options.actor,
            session: options.session,
            since: options.since,
            pinned: options.pinned ? true : undefined,
            reaction: options.reaction,
            limit: options.limit ? Number(options.limit) : undefined,
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
