import chalk from "chalk";
import Table from "cli-table3";

import type { DigestResult } from "../domain/digest.js";
import type { PostRecord, ReadPostBundle } from "../domain/post.js";
import type { ReactionRecord } from "../domain/reaction.js";
import type { ReplyRecord } from "../domain/reply.js";

export interface OutputOptions {
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}

const ASCII_BANNER = String.raw`
    _                    _   _____
   / \   __ _  ___ _ __ | |_|  ___|__  _ __ _   _ _ __ ___
  / _ \ / _\` |/ _ \ '_ \| __| |_ / _ \| '__| | | | '_ \` _ \
 / ___ \ (_| |  __/ | | | |_|  _| (_) | |  | |_| | | | | | |
/_/   \_\__, |\___|_| |_|\__|_|  \___/|_|   \__,_|_| |_| |_|
        |___/
`;

export function resolveOutputMode(options: OutputOptions): "json" | "pretty" | "compact" | "quiet" {
  if (options.quiet) return "quiet";
  if (options.compact) return "compact";
  if (options.json) return "json";
  if (options.pretty) return "pretty";
  return process.stdout.isTTY ? "pretty" : "json";
}

export function formatEntity(entity: unknown, options: OutputOptions = {}): string {
  const mode = resolveOutputMode(options);

  if (mode === "quiet") {
    return formatQuiet(entity);
  }

  if (mode === "json") {
    return `${JSON.stringify(entity, null, 2)}\n`;
  }

  if (isDigest(entity)) {
    return mode === "compact" ? formatDigestCompact(entity) : formatDigestPretty(entity, options);
  }

  if (isBundle(entity)) {
    return formatBundlePretty(entity, options);
  }

  if (Array.isArray(entity) && entity.every(isPost)) {
    return mode === "compact" ? formatPostListCompact(entity) : formatPostListPretty(entity, options);
  }

  if (isPost(entity)) {
    return formatPostPretty(entity, options);
  }

  if (entity && typeof entity === "object") {
    return maybePrefixBanner(`${JSON.stringify(entity, null, 2)}\n`, options);
  }

  return maybePrefixBanner(`${String(entity)}\n`, options);
}

function formatQuiet(entity: unknown): string {
  if (typeof entity === "string") {
    return `${entity}\n`;
  }

  if (entity && typeof entity === "object" && "id" in entity) {
    const value = (entity as { id?: string }).id;
    return value ? `${value}\n` : "\n";
  }

  return "\n";
}

function formatPostPretty(post: PostRecord, options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const lines = [
    `${c.bold(post.id)} ${c.cyan(post.type)}${post.severity ? ` ${c.yellow(post.severity)}` : ""}`,
    c.bold(post.title),
    post.body,
    `channel=${post.channel} status=${post.status}${post.blocking ? " blocking=true" : ""}${post.pinned ? " pinned=true" : ""}`,
    `actor=${post.actor ?? "unknown"} session=${post.session ?? "-"} assignedTo=${post.assignedTo ?? "-"}`,
    `tags=${post.tags.join(", ") || "-"} createdAt=${post.createdAt}`
  ];

  if (post.data) {
    lines.push(`data=${JSON.stringify(post.data)}`);
  }

  return maybePrefixBanner(`${lines.join("\n")}\n`, options);
}

function formatPostListPretty(posts: PostRecord[], options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const table = new Table({
    head: [c.bold("ID"), c.bold("Type"), c.bold("Severity"), c.bold("Channel"), c.bold("Title"), c.bold("Actor"), c.bold("Assigned"), c.bold("Session")]
  });

  for (const post of posts) {
    table.push([
      post.id,
      post.type,
      post.severity ?? "-",
      post.channel,
      post.title,
      post.actor ?? "unknown",
      post.assignedTo ?? "-",
      post.session ?? "-"
    ]);
  }

  return maybePrefixBanner(`${table.toString()}\n`, options);
}

function formatPostListCompact(posts: PostRecord[]): string {
  return `${posts.map(formatCompactLine).join("\n")}\n`;
}

function formatBundlePretty(bundle: ReadPostBundle, options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const output = [formatPostPretty(bundle.post, options).trimEnd()];

  if (bundle.replies.length > 0) {
    output.push("");
    output.push(c.bold("Replies"));
    output.push(...bundle.replies.map(formatReply));
  }

  if (bundle.reactions.length > 0) {
    output.push("");
    output.push(c.bold("Reactions"));
    output.push(...bundle.reactions.map(formatReaction));
  }

  return maybePrefixBanner(`${output.join("\n")}\n`, options);
}

function formatDigestPretty(digest: DigestResult, options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const lines = [`${c.bold("DIGEST")} ${digest.channel ? `(${digest.channel})` : "(all channels)"} ${digest.generatedAt}`];

  appendSection(lines, c.bold("Pinned"), digest.pinned);
  appendSection(lines, c.bold("Findings"), digest.findings);
  appendSection(lines, c.bold("Questions"), digest.questions);
  appendSection(lines, c.bold("Decisions"), digest.decisions);
  appendSection(lines, c.bold("Notes"), digest.notes);

  return maybePrefixBanner(`${lines.join("\n")}\n`, options);
}

function formatDigestCompact(digest: DigestResult): string {
  const lines = [`DIGEST ${digest.channel ?? "all"} ${digest.generatedAt}`];

  if (digest.pinned.length > 0) {
    lines.push("");
    lines.push("PINNED:");
    lines.push(...digest.pinned.map(formatCompactLine));
  }

  if (digest.findings.length > 0) {
    lines.push("");
    lines.push(`FINDINGS (${digest.findings.length}):`);
    lines.push(...digest.findings.map(formatCompactLine));
  }

  if (digest.questions.length > 0) {
    lines.push("");
    lines.push(`QUESTIONS (${digest.questions.length}):`);
    lines.push(...digest.questions.map(formatCompactLine));
  }

  if (digest.decisions.length > 0) {
    lines.push("");
    lines.push(`DECISIONS (${digest.decisions.length}):`);
    lines.push(...digest.decisions.map(formatCompactLine));
  }

  if (digest.notes.length > 0) {
    lines.push("");
    lines.push(`NOTES (${digest.notes.length}):`);
    lines.push(...digest.notes.map(formatCompactLine));
  }

  return `${lines.join("\n")}\n`;
}

function appendSection(lines: string[], title: string, posts: PostRecord[]): void {
  lines.push("");
  lines.push(`${title}:`);
  if (posts.length === 0) {
    lines.push("- none");
    return;
  }

  for (const post of posts) {
    lines.push(`- ${formatCompactLine(post)}`);
  }
}

function formatCompactLine(post: PostRecord): string {
  const tags = post.tags.map((tag) => `#${tag}`).join(" ");
  const metadata = [
    post.actor,
    post.assignedTo ? `owner:${post.assignedTo}` : null,
    post.session ? `session:${post.session}` : null,
    projectMetadataHint(post)
  ]
    .filter(Boolean)
    .join(" • ");
  return `[${post.id}] ${post.type.toUpperCase()}${post.severity ? ` ${post.severity.toUpperCase()}` : ""}${post.blocking ? " BLOCKING" : ""} ${tags} "${post.title}"${metadata ? ` — ${metadata}` : ""}`;
}

function projectMetadataHint(post: PostRecord): string | null {
  if (!post.data) return null;
  const repo = typeof post.data.repo === "string" ? post.data.repo : null;
  const branch = typeof post.data.branch === "string" ? post.data.branch : null;
  const commit = typeof post.data.commit === "string" ? String(post.data.commit).slice(0, 8) : null;

  const parts = [repo, branch, commit ? `commit:${commit}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatReply(reply: ReplyRecord): string {
  return `- ${reply.id} ${reply.actor ?? "unknown"}${reply.session ? ` [${reply.session}]` : ""}: ${reply.body}`;
}

function formatReaction(reaction: ReactionRecord): string {
  return `- ${reaction.id} ${reaction.reaction} by ${reaction.actor ?? "unknown"}${reaction.session ? ` [${reaction.session}]` : ""}`;
}

function getChalk(noColor?: boolean) {
  return noColor ? new chalk.Instance({ level: 0 }) : chalk;
}

function maybePrefixBanner(text: string, options: OutputOptions): string {
  const mode = resolveOutputMode(options);
  if (mode !== "pretty" || !process.stdout.isTTY) {
    return text;
  }
  return `${ASCII_BANNER}\n${text}`;
}

function isPost(value: unknown): value is PostRecord {
  return Boolean(value && typeof value === "object" && "id" in value && "type" in value && "title" in value);
}

function isBundle(value: unknown): value is ReadPostBundle {
  return Boolean(value && typeof value === "object" && "post" in value && "replies" in value && "reactions" in value);
}

function isDigest(value: unknown): value is DigestResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "generatedAt" in value &&
      "pinned" in value &&
      "findings" in value &&
      "questions" in value
  );
}
