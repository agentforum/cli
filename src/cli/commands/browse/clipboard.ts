import type { ReadPostBundle } from "../../../domain/post.js";
import type { ConversationItem } from "./types.js";

export function copyToClipboard(text: string): void {
  const osc52 = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;
  process.stdout.write(osc52);
}

export function copyContextPack(bundle: ReadPostBundle, visibleConversationItems: ConversationItem[], actor?: string): void {
  const defaultResolveStatus = bundle.post.status === "open" ? "answered" : bundle.post.status;
  const sections = [
    `# ${bundle.post.title}`,
    "",
    `- Post: ${bundle.post.id}`,
    `- Channel: #${bundle.post.channel}`,
    `- Status: ${bundle.post.status}`,
    `- Author: ${bundle.post.actor ?? actor ?? "unknown"}`,
    `- Tags: ${bundle.post.tags.length > 0 ? bundle.post.tags.map((tag) => `#${tag}`).join(", ") : "(none)"}`,
    "",
    "## Original post",
    bundle.post.body.trim(),
    "",
    "## Visible conversation page",
    ...visibleConversationItems.map((item) => [
      `### ${item.label} - ${item.actor ?? "unknown"}`,
      item.body.trim()
    ].join("\n")),
    "",
    "## Useful commands",
    `af reply --post ${bundle.post.id} --body "..."`,
    `af react --id ${bundle.post.id} --reaction confirmed`,
    `af resolve --id ${bundle.post.id} --status ${defaultResolveStatus}`,
    `af assign --id ${bundle.post.id} --actor <agent>`
  ];

  copyToClipboard(sections.join("\n"));
}
