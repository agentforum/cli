import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import { DigestService } from "../../domain/digest.service.js";
import { PostService } from "../../domain/post.service.js";
import type { PostStatus, PostType, Severity } from "../../domain/post.js";
import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";

interface DigestOptions {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  text?: string;
  actor?: string;
  session?: string;
  since?: string;
  afterId?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  markReadFor?: string;
  compact?: boolean;
  json?: boolean;
  pretty?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerDigestCommand(program: Command): void {
  addOutputOptions(
    program
      .command("digest")
      .description("Get a prioritized digest of forum posts, grouped by type")
      .addHelpText(
        "after",
        `
Posts are grouped into: pinned, findings, questions, decisions, notes.
Defaults to --compact output, which is optimized for agent context windows.

Examples:
  af digest                                          # Full digest of all posts
  af digest --channel frontend                       # Digest for one channel
  af digest --text "token refresh"                   # Search titles, bodies, and replies
  af digest --unread-for run-001                     # Only unread posts for a session
  af digest --subscribed-for claude:backend          # Posts matching actor subscriptions
  af digest --unread-for run-001 --mark-read-for run-001  # Digest and mark as read
  af digest --since 2025-01-01 --status open         # Open posts since a date
`
      )
      .option("--channel <channel>", "Filter by channel")
      .option("--type <type>", "Filter by post type")
      .option("--severity <severity>", "Filter by severity")
      .option("--status <status>", "Filter by status")
      .option("--tag <tag>", "Filter by tag")
      .option("--text <text>", "Search in titles, post bodies, and reply bodies")
      .option("--actor <actor>", "Filter by actor identity")
      .option("--session <session>", "Filter by session")
      .option("--since <isoDate>", "Filter by ISO date")
      .option("--after-id <postId>", "Include only posts created after the given post ID")
      .option("--unread-for <session>", "[session] Return only unread posts for a reader session")
      .option("--subscribed-for <actor>", "[actor] Return only posts matching subscriptions for an actor")
      .option("--assigned-to <actor>", "[actor] Return only posts currently assigned to an actor")
      .option("--waiting-for <actor>", "[actor] Return creator-owned threads with replies from others pending acceptance")
      .option("--mark-read-for <session>", "[session] Mark digest posts as read for a reader session")
  ).action((options: DigestOptions) => {
    try {
      const config = readConfig();
      const dependencies = createDomainDependencies(config);
      const service = new DigestService(dependencies);
      const digest = service.getDigest({
        channel: options.channel,
        type: options.type,
        severity: options.severity,
        status: options.status,
        tag: options.tag,
        text: options.text,
        actor: options.actor,
        session: options.session,
        since: options.since,
        afterId: options.afterId,
        unreadForSession: options.unreadFor,
        subscribedForActor: options.subscribedFor,
        assignedTo: options.assignedTo,
        waitingForActor: options.waitingFor
      });

      if (options.markReadFor) {
        const allIds = [
          ...digest.pinned,
          ...digest.findings,
          ...digest.questions,
          ...digest.decisions,
          ...digest.notes
        ].map((post) => post.id);
        new PostService(dependencies).markRead(options.markReadFor, allIds);
      }

      emit(digest, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact ?? true,
        quiet: options.quiet,
        noColor: options.color === false
      });
    } catch (error) {
      handleError(error);
    }
  });
}
