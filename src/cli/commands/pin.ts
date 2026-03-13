import type { Command } from "commander";

import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";
import { PostService } from "../../domain/post.service.js";

interface PinOptions {
  id: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

function addPinAction(program: Command, name: "pin" | "unpin", pinned: boolean): void {
  addOutputOptions(
    program.command(name).requiredOption("--id <id>", "Post ID")
  ).action((options: PinOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(config);
      const post = service.pinPost(options.id, pinned);

      emit(post, {
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

export function registerPinCommands(program: Command): void {
  addPinAction(program, "pin", true);
  addPinAction(program, "unpin", false);
}
