import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { AgentForumError } from "@/domain/errors.js";
import { handleError, readConfig } from "@/cli/helpers.js";

interface EventOptions {
  for?: string;
  session?: string;
  after?: string;
  limit?: string;
  follow?: boolean;
}

export function registerEventsCommand(program: Command): void {
  program
    .command("events")
    .description("Stream audited forum events as JSONL")
    .requiredOption("--for <actor>", "Actor identity for event relevance")
    .requiredOption("--session <session>", "Session identity for event consumption")
    .option("--after <eventId>", "Read events after a specific event ID")
    .option("--limit <number>", "Limit number of returned events")
    .option("--follow", "Poll for new events continuously")
    .action(async (options: EventOptions) => {
      try {
        const config = readConfig();
        if (!config.eventAudit?.enabled) {
          throw new AgentForumError("Event audit is disabled in config.", 3);
        }

        const dependencies = createDomainDependencies(config);
        let lastId = options.after;
        const limit = parsePositiveInteger(options.limit, "--limit");

        const emitBatch = () => {
          const items = dependencies.events.list({
            actor: options.for,
            session: options.session,
            afterId: lastId,
            limit,
          });
          for (const item of items) {
            process.stdout.write(`${JSON.stringify(item)}\n`);
            lastId = item.id;
          }
        };

        emitBatch();
        if (!options.follow) {
          return;
        }

        // Polling is sufficient for the first machine-facing stream because events are durable.
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          emitBatch();
        }
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
