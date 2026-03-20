import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { PostService } from "@/domain/post.service.js";
import { SubscriptionService } from "@/domain/subscription.service.js";
import { addOutputOptions, emit, handleError, normalizeTags, readConfig } from "@/cli/helpers.js";

interface ActorOptions {
  actor: string;
  channel?: string;
  tag?: string[];
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

interface MarkReadOptions {
  session: string;
  id: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerSubscriptionCommands(program: Command): void {
  addOutputOptions(
    program
      .command("subscribe")
      .description("[actor] Subscribe to a channel")
      .requiredOption("--actor <actor>", "Actor identity e.g. claude:backend")
      .requiredOption("--channel <channel>", "Channel to subscribe to")
      .option("--tag <tag>", "Optional tag filter", collect, [])
  ).action((options: ActorOptions) => {
    try {
      const service = new SubscriptionService(createDomainDependencies(readConfig()));
      const result = service.subscribe(
        options.actor,
        options.channel as string,
        normalizeTags(options.tag)
      );
      emit(result, normalizeOutput(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    program
      .command("unsubscribe")
      .description("[actor] Unsubscribe from a channel")
      .requiredOption("--actor <actor>", "Actor identity e.g. claude:backend")
      .requiredOption("--channel <channel>", "Channel to unsubscribe from")
      .option("--tag <tag>", "Optional tag filter", collect, [])
  ).action((options: ActorOptions) => {
    try {
      const service = new SubscriptionService(createDomainDependencies(readConfig()));
      const removed = service.unsubscribe(
        options.actor,
        options.channel as string,
        normalizeTags(options.tag)
      );
      emit({ id: String(removed), removed }, normalizeOutput(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    program
      .command("subscriptions")
      .description("[actor] List subscriptions for an actor")
      .requiredOption("--actor <actor>", "Actor identity e.g. claude:backend")
  ).action((options: ActorOptions) => {
    try {
      const service = new SubscriptionService(createDomainDependencies(readConfig()));
      emit(service.list(options.actor), normalizeOutput(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    program
      .command("mark-read")
      .description("[session] Mark a post as read for a reader session")
      .requiredOption("--session <session>", "Reader session identifier")
      .requiredOption("--id <postId>", "Post ID to mark as read")
  ).action((options: MarkReadOptions) => {
    try {
      const config = readConfig();
      new PostService(createDomainDependencies(config)).markRead(options.session, [options.id]);
      emit({ id: options.id, session: options.session, status: "read" }, normalizeOutput(options));
    } catch (error) {
      handleError(error);
    }
  });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
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
