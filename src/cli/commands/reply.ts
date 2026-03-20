import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { ReplyService } from "@/domain/reply.service.js";
import {
  addOutputOptions,
  emit,
  handleError,
  parseData,
  readConfig,
  resolveActor,
} from "@/cli/helpers.js";

interface ReplyOptions {
  post: string;
  body: string;
  data?: string;
  actor?: string;
  session?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerReplyCommand(program: Command): void {
  addOutputOptions(
    program
      .command("reply")
      .description("[actor] Reply to an existing post")
      .requiredOption("--post <postId>", "Post ID")
      .requiredOption("--body <body>", "Reply body")
      .option("--data <json>", "Structured JSON payload")
      .option("--actor <actor>", "Actor identity e.g. claude:backend")
      .option("--session <session>", "Conversation/session identifier for traceability")
  ).action((options: ReplyOptions) => {
    try {
      const config = readConfig();
      const service = new ReplyService(createDomainDependencies(config));
      const reply = service.createReply({
        postId: options.post,
        body: options.body,
        data: parseData(options.data),
        actor: resolveActor(config, options.actor),
        session: options.session,
      });

      emit(reply, {
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
