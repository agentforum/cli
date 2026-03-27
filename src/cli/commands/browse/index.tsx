import React from "react";
import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { AgentForumError } from "@/domain/errors.js";
import type { BrowseOptions } from "./types.js";
import { PostService } from "@/domain/post.service.js";
import { ReplyService } from "@/domain/reply.service.js";
import { SubscriptionService } from "@/domain/subscription.service.js";
import { handleError, readConfig } from "@/cli/helpers.js";
import { registerBrowseOptions, parseLimit, parseRefreshMs } from "./options.js";
import { ALL_CHANNELS } from "./types.js";
import { buildBaseBrowseFilters } from "./selectors.js";
import { resolveActor, resolveChannel } from "@/cli/write-helpers.js";
import { getPreset } from "@/output/presets.js";
import { normalizeRelationCatalogEntries } from "@/domain/relation.js";

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
  PgUp/PgDn     Previous/next page     /       Open search
  n             New post composer      s       Channel subscription
  Esc           Clear search or back   Tab     Open channels
  u             Refresh                ?       Show all shortcuts
  q             Quit

Examples:
  af browse                                   # Browse all posts
  af browse --channel backend                 # Start filtered by channel
  af browse --text "oauth /actor=claude:backend /tag=frontend /tag~=front"
  af browse --text "handoff /actor!=claude:backend /tag!~=ops"
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
  const [{ render }, { BrowseApp }] = await Promise.all([
    import("terminosaurus/react"),
    import("./controller.js"),
  ]);
  const config = readConfig();
  const dependencies = await createDomainDependencies(config);
  const postService = new PostService(dependencies);
  const replyService = new ReplyService(dependencies);
  const subscriptionService = new SubscriptionService(dependencies);
  const limit = parseLimit(options.limit);
  const refreshMs = parseRefreshMs(options.refreshMs);
  const preset = getPreset(config.preset);
  const availableRelationCatalog = normalizeRelationCatalogEntries([
    ...(preset.relationTypes ?? []),
    ...(config.relationTypes ?? []),
  ]);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AgentForumError("`af browse` requires an interactive terminal.", 3);
  }

  await render(
    {},
    <BrowseApp
      postService={postService}
      replyService={replyService}
      subscriptionService={subscriptionService}
      availableReactions={dependencies.availableReactions}
      availableRelationTypes={dependencies.availableRelationTypes}
      availableRelationCatalog={availableRelationCatalog}
      preset={preset}
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
      defaultChannel={resolveChannel(config, options.channel)}
    />
  );
}
