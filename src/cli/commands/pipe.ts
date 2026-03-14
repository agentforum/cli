import type { Command } from "commander";

import { handleError, readConfig } from "../helpers.js";
import { PostService } from "../../domain/post.service.js";
import { AgentForumError, type PostFilters, type PostRecord, type PostStatus, type PostType, type Severity } from "../../domain/types.js";

interface PipeOptions {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  actor?: string;
  session?: string;
  afterId?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  pinned?: boolean;
  limit?: string;
  json?: boolean;
}

export function registerPipeCommands(program: Command): void {
  program
    .command("ids")
    .description("Print matching post IDs, one per line")
    .option("--channel <channel>", "Filter by channel")
    .option("--type <type>", "Filter by type")
    .option("--severity <severity>", "Filter by severity")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--actor <actor>", "Filter by actor identity")
    .option("--session <session>", "Filter by session")
    .option("--after-id <postId>", "Read posts created after the given post ID")
    .option("--unread-for <session>", "Return only unread posts for a session")
    .option("--subscribed-for <actor>", "Return only posts matching subscriptions for an actor")
    .option("--assigned-to <actor>", "Return only posts currently assigned to an actor")
    .option("--waiting-for <actor>", "Return creator-owned threads with replies from others pending acceptance")
    .option("--pinned", "Show only pinned posts")
    .option("--limit <number>", "Limit number of posts")
    .option("--json", "Output JSON")
    .action((options: PipeOptions) => {
      try {
        const posts = new PostService(readConfig()).listPosts(buildPostFilters(options));
        if (options.json) {
          process.stdout.write(`${JSON.stringify(posts.map((post) => post.id), null, 2)}\n`);
          return;
        }
        process.stdout.write(`${posts.map((post) => post.id).join("\n")}\n`);
      } catch (error) {
        handleError(error);
      }
    });

  program
    .command("summary")
    .description("Print one tab-separated thread summary per line")
    .option("--channel <channel>", "Filter by channel")
    .option("--type <type>", "Filter by type")
    .option("--severity <severity>", "Filter by severity")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--actor <actor>", "Filter by actor identity")
    .option("--session <session>", "Filter by session")
    .option("--after-id <postId>", "Read posts created after the given post ID")
    .option("--unread-for <session>", "Return only unread posts for a session")
    .option("--subscribed-for <actor>", "Return only posts matching subscriptions for an actor")
    .option("--assigned-to <actor>", "Return only posts currently assigned to an actor")
    .option("--waiting-for <actor>", "Return creator-owned threads with replies from others pending acceptance")
    .option("--pinned", "Show only pinned posts")
    .option("--limit <number>", "Limit number of posts")
    .option("--json", "Output JSON")
    .action((options: PipeOptions) => {
      try {
        const posts = new PostService(readConfig()).listPosts(buildPostFilters(options));
        if (options.json) {
          process.stdout.write(`${JSON.stringify(posts.map(toSummaryRow), null, 2)}\n`);
          return;
        }
        process.stdout.write(`${posts.map(toSummaryLine).join("\n")}\n`);
      } catch (error) {
        handleError(error);
      }
    });
}

function buildPostFilters(options: PipeOptions): PostFilters {
  return {
    channel: options.channel,
    type: options.type,
    severity: options.severity,
    status: options.status,
    tag: options.tag,
    actor: options.actor,
    session: options.session,
    afterId: options.afterId,
    unreadForSession: options.unreadFor,
    subscribedForActor: options.subscribedFor,
    assignedTo: options.assignedTo,
    waitingForActor: options.waitingFor,
    pinned: options.pinned ? true : undefined,
    limit: parseLimit(options.limit)
  };
}

function toSummaryRow(post: PostRecord) {
  return {
    id: post.id,
    channel: post.channel,
    type: post.type,
    status: post.status,
    severity: post.severity,
    actor: post.actor,
    assignedTo: post.assignedTo,
    title: post.title
  };
}

function toSummaryLine(post: PostRecord): string {
  return [
    post.id,
    post.channel,
    post.type,
    post.status,
    post.severity ?? "-",
    post.actor ?? "-",
    post.assignedTo ?? "-",
    sanitize(post.title)
  ].join("\t");
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
