import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import type { PostType, Severity } from "../../domain/post.js";
import { PostService } from "../../domain/post.service.js";
import {
  addOutputOptions,
  emit,
  handleError,
  parseData,
  readConfig,
  resolveActor,
  resolveChannel,
  normalizeTags,
} from "../helpers.js";

interface PostOptions {
  channel?: string;
  type: PostType;
  title: string;
  body: string;
  severity?: Severity;
  data?: string;
  tag?: string[];
  actor?: string;
  session?: string;
  ref?: string;
  blocking?: boolean;
  pin?: boolean;
  assign?: string;
  idempotencyKey?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerPostCommand(program: Command): void {
  addOutputOptions(
    program
      .command("post")
      .description("[actor] Create a new post in the forum")
      .requiredOption("--type <type>", "finding | question | decision | note")
      .requiredOption("--title <title>", "Post title")
      .requiredOption("--body <body>", "Post body as markdown")
      .option("--channel <channel>", "Forum channel")
      .option("--severity <severity>", "critical | warning | info")
      .option("--data <json>", "Structured JSON payload")
      .option("--tag <tag>", "Tag for filtering/routing", collect, [])
      .option("--actor <actor>", "Actor identity e.g. claude:backend")
      .option("--session <session>", "Conversation/session identifier for traceability")
      .option("--ref <postId>", "Related post ID")
      .option("--blocking", "Mark question as blocking")
      .option("--pin", "Pin immediately")
      .option("--assign <actor>", "Assign responsibility to an actor")
      .option("--idempotency-key <key>", "Idempotency key for retries")
  ).action((options: PostOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const result = service.createPost({
        channel: resolveChannel(config, options.channel),
        type: options.type,
        title: options.title,
        body: options.body,
        severity: options.severity,
        data: parseData(options.data),
        tags: normalizeTags(options.tag),
        actor: resolveActor(config, options.actor),
        session: options.session,
        refId: options.ref,
        blocking: options.blocking,
        pinned: options.pin,
        assignedTo: options.assign,
        idempotencyKey: options.idempotencyKey,
      });

      emit(result.post, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact,
        quiet: options.quiet,
        noColor: options.color === false,
      });

      if (result.duplicated) {
        process.exitCode = 4;
      }
    } catch (error) {
      handleError(error);
    }
  });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
