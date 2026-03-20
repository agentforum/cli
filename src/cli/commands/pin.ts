import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import { PostService } from "../../domain/post.service.js";
import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";

interface PinOptions {
  id: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

const PIN_DESCRIPTIONS: Record<"pin" | "unpin", string> = {
  pin: "Pin a post to the top of all listings",
  unpin: "Remove the pin from a post",
};

function addPinAction(program: Command, name: "pin" | "unpin", pinned: boolean): void {
  addOutputOptions(
    program.command(name).description(PIN_DESCRIPTIONS[name]).requiredOption("--id <id>", "Post ID")
  ).action((options: PinOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const post = service.pinPost(options.id, pinned);

      emit(post, {
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

export function registerPinCommands(program: Command): void {
  addPinAction(program, "pin", true);
  addPinAction(program, "unpin", false);
}
