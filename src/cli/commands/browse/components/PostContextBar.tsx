import React from "react";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { excerpt, reactionIcon, sanitizeTerminalText, timeAgo } from "../formatters.js";
import { getPostTypeTone, getStatusTone, severityColor } from "../theme.js";
import type { BrowseTheme } from "../types.js";
import { StatusBadge } from "./StatusBadge.js";

export function PostContextBar({
  bundle,
  focusedReplyIndex,
  actor,
  now,
  theme
}: {
  bundle: ReadPostBundle;
  focusedReplyIndex: number;
  actor?: string;
  now: Date;
  theme: BrowseTheme;
}) {
  const isBody = focusedReplyIndex === -1;
  const reply = !isBody ? bundle.replies[focusedReplyIndex] : null;

  const who = isBody
    ? bundle.post.actor ?? actor ?? "unknown"
    : reply?.actor ?? "unknown";
  const when = isBody
    ? timeAgo(bundle.post.createdAt, now)
    : reply ? timeAgo(reply.createdAt, now) : "";
  const session = isBody ? bundle.post.session : reply?.session ?? null;
  const tags = bundle.post.tags;
  const label = isBody ? "Original post" : `Reply ${focusedReplyIndex + 1}/${bundle.replies.length}`;
  const metaLine = [
    sanitizeTerminalText(label),
    sanitizeTerminalText(who),
    session ? `[${sanitizeTerminalText(session)}]` : null,
    when,
    bundle.post.assignedTo ? `owner ${sanitizeTerminalText(bundle.post.assignedTo)}` : null
  ].filter(Boolean).join("  |  ");
  const tagLine = tags.length > 0 ? tags.map((tag) => `#${sanitizeTerminalText(tag)}`).join(" ") : null;
  const refLine = bundle.post.refId ? `[g] open ref ${sanitizeTerminalText(bundle.post.refId)}` : null;
  const idemLine = bundle.post.idempotencyKey ? `idem: ${sanitizeTerminalText(bundle.post.idempotencyKey)}` : null;
  const reactionsLine = bundle.reactions.length > 0
    ? bundle.reactions.map((reaction) => `${reactionIcon(reaction.reaction)} ${sanitizeTerminalText(reaction.reaction)} (${sanitizeTerminalText(reaction.actor ?? "unknown")})`).join("  |  ")
    : null;

  return (
    <term:div border="rounded" borderColor={theme.accent} padding={[0, 1]} marginBottom={0} flexDirection="column">
      <term:div flexDirection="row">
        <StatusBadge label={bundle.post.type.toUpperCase()} tone={getPostTypeTone(bundle.post.type)} />
        <StatusBadge label={bundle.post.status.toUpperCase()} tone={getStatusTone(bundle.post.status)} />
        {bundle.post.severity ? (
          <term:text
            color={theme.bg}
            backgroundColor={severityColor(bundle.post.severity)}
            padding={[0, 1]}
            marginRight={1}
            fontWeight="bold"
          >
            {bundle.post.severity.toUpperCase()}
          </term:text>
        ) : null}
        {bundle.post.blocking ? (
          <term:text color="white" backgroundColor="red" padding={[0, 1]} marginRight={1} fontWeight="bold">
            {"BLOCKING"}
          </term:text>
        ) : null}
      </term:div>
      <term:text color={theme.fg} fontWeight="bold">
        {excerpt(metaLine, 160)}
      </term:text>
      {tagLine ? (
        <term:text color={theme.warning}>
          {excerpt(tagLine, 160)}
        </term:text>
      ) : null}
      {refLine ? (
        <term:text color={theme.accent}>
          {excerpt(refLine, 160)}
        </term:text>
      ) : null}
      {reactionsLine ? (
        <term:text color={theme.warning}>
          {excerpt(`reactions: ${reactionsLine}`, 160)}
        </term:text>
      ) : null}
      {idemLine ? (
        <term:text color={theme.muted}>
          {excerpt(idemLine, 160)}
        </term:text>
      ) : null}
    </term:div>
  );
}
