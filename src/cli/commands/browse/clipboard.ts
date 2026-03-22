import { spawnSync } from "node:child_process";

import type { ReadPostBundle } from "@/domain/post.js";
import type { ConversationItem } from "./types.js";

export function copyToClipboard(text: string): void {
  if (tryCopyWithSystemClipboard(text)) {
    return;
  }

  writeOsc52(text);
}

export function copyContextPack(
  bundle: ReadPostBundle,
  visibleConversationItems: ConversationItem[],
  actor?: string
): void {
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
    ...visibleConversationItems.flatMap((item) => {
      const lines = [`### ${item.label} - ${item.actor ?? "unknown"}`];
      if (item.quoteRefs.length > 0) {
        lines.push(`refs: ${item.quoteRefs.map((ref) => `${ref.label}:${ref.id}`).join(", ")}`);
      }
      lines.push(item.body.trim());
      return [lines.join("\n")];
    }),
    "",
    "## Useful commands",
    `af reply --post ${bundle.post.id} --body "..."`,
    `af react --id ${bundle.post.id} --reaction confirmed`,
    `af resolve --id ${bundle.post.id} --status ${defaultResolveStatus}`,
    `af assign --id ${bundle.post.id} --actor <agent>`,
  ];

  copyToClipboard(sections.join("\n"));
}

function tryCopyWithSystemClipboard(text: string): boolean {
  const commands = [
    {
      command: "wl-copy",
      args: [] as string[],
      enabled: Boolean(process.env.WAYLAND_DISPLAY),
    },
    {
      command: "xclip",
      args: ["-selection", "clipboard"] as string[],
      enabled: Boolean(process.env.DISPLAY),
    },
    {
      command: "xsel",
      args: ["--clipboard", "--input"] as string[],
      enabled: Boolean(process.env.DISPLAY),
    },
    {
      command: "pbcopy",
      args: [] as string[],
      enabled: process.platform === "darwin",
    },
    {
      command: "clip.exe",
      args: [] as string[],
      enabled: process.platform === "win32",
    },
  ];

  for (const entry of commands) {
    if (!entry.enabled) {
      continue;
    }

    const result = spawnSync(entry.command, entry.args, {
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "ignore"],
    });

    if (!result.error && result.status === 0) {
      return true;
    }
  }

  return false;
}

function writeOsc52(text: string): void {
  const osc52 = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;
  if (process.env.TMUX) {
    const escaped = osc52.replace(/\x1b/g, "\x1b\x1b");
    process.stdout.write(`\x1bPtmux;\x1b${escaped}\x1b\\`);
    return;
  }

  process.stdout.write(osc52);
}
