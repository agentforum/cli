import type { PostStatus, PostType, Severity } from "@/domain/post.js";
import type { BrowseTheme } from "./types.js";

export const THEMES: BrowseTheme[] = [
  {
    name: "dark",
    bg: "black",
    fg: "white",
    accent: "cyan",
    muted: "#666666",
    banner: "cyan",
    selected: "blue",
    selectedFg: "white",
    success: "green",
    warning: "yellow",
  },
  {
    name: "green",
    bg: "black",
    fg: "green",
    accent: "#00ff88",
    muted: "#336633",
    banner: "green",
    selected: "#005500",
    selectedFg: "#00ff88",
    success: "#00ff88",
    warning: "yellow",
  },
  {
    name: "ocean",
    bg: "#0a0a2e",
    fg: "#ccddff",
    accent: "#5599ff",
    muted: "#445588",
    banner: "#5599ff",
    selected: "#223366",
    selectedFg: "#ffffff",
    success: "#44cc88",
    warning: "#ffaa44",
  },
  {
    name: "amber",
    bg: "#1a1000",
    fg: "#ffcc44",
    accent: "#ffaa00",
    muted: "#665500",
    banner: "#ffaa00",
    selected: "#443300",
    selectedFg: "#ffee88",
    success: "#ffcc44",
    warning: "#ff8800",
  },
  {
    name: "pink",
    bg: "#1a0011",
    fg: "#ffaacc",
    accent: "#ff66aa",
    muted: "#774455",
    banner: "#ff66aa",
    selected: "#442233",
    selectedFg: "#ffddee",
    success: "#66ff99",
    warning: "#ffcc66",
  },
];

export function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "red";
    case "warning":
      return "yellow";
    case "info":
      return "cyan";
  }
}

export function getPostTypeTone(type: PostType): { color: string; backgroundColor: string } {
  switch (type) {
    case "finding":
      return { color: "black", backgroundColor: "yellow" };
    case "question":
      return { color: "black", backgroundColor: "cyan" };
    case "decision":
      return { color: "black", backgroundColor: "green" };
    case "note":
      return { color: "black", backgroundColor: "magenta" };
  }
}

export function getStatusTone(status: PostStatus): { color: string; backgroundColor: string } {
  switch (status) {
    case "open":
      return { color: "black", backgroundColor: "yellow" };
    case "answered":
      return { color: "black", backgroundColor: "green" };
    case "needs-clarification":
      return { color: "black", backgroundColor: "magenta" };
    case "wont-answer":
      return { color: "white", backgroundColor: "red" };
    case "stale":
      return { color: "black", backgroundColor: "white" };
  }
}
