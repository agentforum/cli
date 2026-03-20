import React from "react";
import type { Command } from "commander";
import { render } from "terminosaurus/react";

import { createDomainDependencies } from "../../../app/dependencies.js";
import { AgentForumError } from "../../../domain/errors.js";
import type { BrowseOptions } from "./types.js";
import { PostService } from "../../../domain/post.service.js";
import { ReplyService } from "../../../domain/reply.service.js";
import { handleError, readConfig, resolveActor } from "../../helpers.js";
import { BrowseApp } from "./controller.js";
import { registerBrowseOptions, parseLimit, parseRefreshMs } from "./options.js";
import { ALL_CHANNELS } from "./types.js";
import { buildBaseBrowseFilters } from "./selectors.js";

export function registerBrowseCommand(program: Command): void {
  registerBrowseOptions(
    program
      .command("browse")
      .description("Interactive terminal browser for humans (requires a TTY)")
      .addHelpText(
        "after",
        `
Keyboard shortcuts (shown in-app):
  ↑/↓           Navigate list          Enter   Open thread
  r             Reply                  q       Quit
  u             Refresh                ?       Show all shortcuts

Examples:
  af browse                                   # Browse all posts
  af browse --channel backend                 # Start filtered by channel
  af browse --unread-for run-001              # Show only unread posts
  af browse --auto-refresh --refresh-ms 3000  # Poll every 3 s
  af open P-123                               # Jump straight to a thread
`
      )
  ).action(async (options: BrowseOptions) => {
    try {
      await launchBrowse(options);
    } catch (error) {
      handleError(error);
    }
  });
}

export async function launchBrowse(options: BrowseOptions): Promise<void> {
  const config = readConfig();
  const dependencies = createDomainDependencies(config);
  const postService = new PostService(dependencies);
  const replyService = new ReplyService(dependencies);
  const limit = parseLimit(options.limit);
  const refreshMs = parseRefreshMs(options.refreshMs);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AgentForumError("`af browse` requires an interactive terminal.", 3);
  }

  await render(
    {},
    <BrowseApp
      postService={postService}
      replyService={replyService}
      baseFilters={buildBaseBrowseFilters({
        channel: options.channel,
        type: options.type,
        severity: options.severity,
        status: options.status,
        tag: options.tag,
        pinned: options.pinned ? true : undefined,
        unreadForSession: options.unreadFor,
        subscribedForActor: options.subscribedFor,
        assignedTo: options.assignedTo,
        waitingForActor: options.waitingFor,
      })}
      initialChannelFilter={options.channel ?? ALL_CHANNELS}
      limit={limit}
      actor={resolveActor(config, options.actor)}
      session={options.session}
      refreshMs={refreshMs}
      initialAutoRefresh={options.autoRefresh ?? false}
      initialPostId={options.id}
      initialSearchQuery={options.text}
    />
  );
}
