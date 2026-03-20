import chalk, { Chalk } from "chalk";
import Table from "cli-table3";

import type { BackupImportReport } from "../domain/backup.js";
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
  / _ \ / _\` |/ _ \ '_ \| __| |_ / _ \|'__| | | | '_ \` _ \
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

  if (isImportReport(entity)) {
    return mode === "compact"
      ? formatImportReportCompact(entity)
      : formatImportReportPretty(entity, options);
  }

  if (isDigest(entity)) {
    return mode === "compact" ? formatDigestCompact(entity) : formatDigestPretty(entity, options);
  }

  if (isBundle(entity)) {
    return formatBundlePretty(entity, options);
  }

  if (Array.isArray(entity) && entity.every(isPost)) {
    return mode === "compact"
      ? formatPostListCompact(entity)
      : formatPostListPretty(entity, options);
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
    `tags=${post.tags.join(", ") || "-"} createdAt=${post.createdAt}`,
  ];

  if (post.data) {
    lines.push(`data=${JSON.stringify(post.data)}`);
  }

  return maybePrefixBanner(`${lines.join("\n")}\n`, options);
}

function formatPostListPretty(posts: PostRecord[], options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const table = new Table({
    head: [
      c.bold("ID"),
      c.bold("Type"),
      c.bold("Severity"),
      c.bold("Channel"),
      c.bold("Title"),
      c.bold("Actor"),
      c.bold("Assigned"),
      c.bold("Session"),
    ],
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
      post.session ?? "-",
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
    const replyLabel =
      bundle.totalReplies > bundle.replies.length
        ? `Replies (${bundle.replies.length} of ${bundle.totalReplies})`
        : `Replies (${bundle.totalReplies})`;
    output.push(c.bold(replyLabel));
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
  const lines = [
    `${c.bold("DIGEST")} ${digest.channel ? `(${digest.channel})` : "(all channels)"} ${digest.generatedAt}`,
  ];

  appendSection(lines, c.bold("Pinned"), digest.pinned);
  appendSection(lines, c.bold("Findings"), digest.findings);
  appendSection(lines, c.bold("Questions"), digest.questions);
  appendSection(lines, c.bold("Decisions"), digest.decisions);
  appendSection(lines, c.bold("Notes"), digest.notes);

  return maybePrefixBanner(`${lines.join("\n")}\n`, options);
}

function formatDigestCompact(digest: DigestResult): string {
  const lines = [`DIGEST ${digest.channel ?? "all"} ${digest.generatedAt}`];

  if (digest.pinned.summary.total > 0) {
    lines.push("");
    lines.push(`PINNED (${groupLabel(digest.pinned)}):`);
    lines.push(...digest.pinned.items.map(formatCompactLine));
  }

  if (digest.findings.summary.total > 0) {
    lines.push("");
    lines.push(`FINDINGS (${groupLabel(digest.findings)}):`);
    lines.push(...digest.findings.items.map(formatCompactLine));
  }

  if (digest.questions.summary.total > 0) {
    lines.push("");
    lines.push(`QUESTIONS (${groupLabel(digest.questions)}):`);
    lines.push(...digest.questions.items.map(formatCompactLine));
  }

  if (digest.decisions.summary.total > 0) {
    lines.push("");
    lines.push(`DECISIONS (${groupLabel(digest.decisions)}):`);
    lines.push(...digest.decisions.items.map(formatCompactLine));
  }

  if (digest.notes.summary.total > 0) {
    lines.push("");
    lines.push(`NOTES (${groupLabel(digest.notes)}):`);
    lines.push(...digest.notes.items.map(formatCompactLine));
  }

  return `${lines.join("\n")}\n`;
}

function groupLabel(group: DigestResult["pinned"]): string {
  if (group.summary.shown < group.summary.total) {
    return `${group.summary.shown} of ${group.summary.total}`;
  }
  return String(group.summary.total);
}

function appendSection(lines: string[], title: string, group: DigestResult["pinned"]): void {
  lines.push("");
  const label =
    group.summary.shown < group.summary.total
      ? ` (${group.summary.shown} of ${group.summary.total})`
      : "";
  lines.push(`${title}${label}:`);
  if (group.items.length === 0) {
    lines.push("- none");
    return;
  }

  for (const post of group.items) {
    lines.push(`- ${formatCompactLine(post)}`);
  }
}

function formatCompactLine(post: PostRecord): string {
  const tags = post.tags.map((tag) => `#${tag}`).join(" ");
  const metadata = [
    post.actor,
    post.assignedTo ? `owner:${post.assignedTo}` : null,
    post.session ? `session:${post.session}` : null,
    projectMetadataHint(post),
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
  return noColor ? new Chalk({ level: 0 }) : chalk;
}

function maybePrefixBanner(text: string, options: OutputOptions): string {
  const mode = resolveOutputMode(options);
  if (mode !== "pretty" || !process.stdout.isTTY) {
    return text;
  }
  return `${ASCII_BANNER}\n${text}`;
}

function formatImportReportPretty(report: BackupImportReport, options: OutputOptions): string {
  const c = getChalk(options.noColor);
  const lines = [`${c.bold("IMPORT")} ${report.file}`];

  const createdParts = formatCountParts(report.created);
  if (createdParts.length > 0) {
    lines.push(`  ${c.green("created")}  ${createdParts.join("  ")}`);
  } else {
    lines.push(`  ${c.green("created")}  none`);
  }

  const skippedParts = formatCountParts(report.skipped);
  if (skippedParts.length > 0) {
    lines.push(`  ${c.dim("skipped")}  ${skippedParts.join("  ")}`);
  } else {
    lines.push(`  ${c.dim("skipped")}  none`);
  }

  if (report.conflicts.total === 0) {
    lines.push(`  ${c.dim("conflicts")}  none`);
  } else {
    lines.push(`  ${c.yellow("conflicts")}  ${report.conflicts.total}`);
    for (const conflict of report.conflicts.items) {
      lines.push(`    ${c.yellow(conflict.entity)}  ${conflict.key}  ${conflict.reason}`);
    }
  }

  return maybePrefixBanner(`${lines.join("\n")}\n`, options);
}

function formatImportReportCompact(report: BackupImportReport): string {
  return `IMPORT ${report.file}  created=${report.created.total}  skipped=${report.skipped.total}  conflicts=${report.conflicts.total}\n`;
}

function formatCountParts(counts: BackupImportReport["created"]): string[] {
  const fields: Array<[keyof typeof counts, string]> = [
    ["posts", "posts"],
    ["replies", "replies"],
    ["reactions", "reactions"],
    ["subscriptions", "subscriptions"],
    ["readReceipts", "readReceipts"],
    ["meta", "meta"],
  ];
  return fields.filter(([key]) => counts[key] > 0).map(([key, label]) => `${label}=${counts[key]}`);
}

function isImportReport(value: unknown): value is BackupImportReport {
  return Boolean(
    value &&
    typeof value === "object" &&
    "mode" in value &&
    (value as { mode: unknown }).mode === "merge" &&
    "created" in value &&
    "skipped" in value &&
    "conflicts" in value
  );
}

function isPost(value: unknown): value is PostRecord {
  return Boolean(
    value && typeof value === "object" && "id" in value && "type" in value && "title" in value
  );
}

function isBundle(value: unknown): value is ReadPostBundle {
  return Boolean(
    value &&
    typeof value === "object" &&
    "post" in value &&
    "replies" in value &&
    "reactions" in value
  );
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
