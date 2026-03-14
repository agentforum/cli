import React from "react";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { getPostTypeTone, getStatusTone, severityColor } from "../theme.js";
import type { BrowseTheme } from "../types.js";
import { timeAgo } from "../formatters.js";
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
        <term:text color={theme.fg} fontWeight="bold" whiteSpace="pre">
          {`${label}  `}
        </term:text>
        <term:text color={theme.success} fontWeight="bold">{who}</term:text>
        {session ? (
          <term:text color={theme.muted} whiteSpace="pre">{` [${session}]`}</term:text>
        ) : null}
        <term:text color={theme.muted} whiteSpace="pre">{`  \u00B7  ${when}`}</term:text>
        {bundle.post.assignedTo ? (
          <term:text color={theme.accent} whiteSpace="pre">{`  \u00B7  owner ${bundle.post.assignedTo}`}</term:text>
        ) : null}
        {tags.length > 0 ? (
          <term:text color={theme.warning} whiteSpace="pre">{`  \u00B7  ${tags.map((tag) => `#${tag}`).join(" ")}`}</term:text>
        ) : null}
      </term:div>
      {bundle.post.refId || bundle.post.idempotencyKey ? (
        <term:div flexDirection="row">
          {bundle.post.refId ? (
            <term:text color={theme.accent} whiteSpace="pre">{`ref: ${bundle.post.refId}`}</term:text>
          ) : null}
          {bundle.post.idempotencyKey ? (
            <term:text color={theme.muted} whiteSpace="pre">
              {`${bundle.post.refId ? "  \u00B7  " : ""}idem: ${bundle.post.idempotencyKey}`}
            </term:text>
          ) : null}
        </term:div>
      ) : null}
    </term:div>
  );
}
