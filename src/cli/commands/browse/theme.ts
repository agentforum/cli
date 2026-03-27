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
    surface: "#101010",
    surfaceMuted: "#151515",
    border: "#444444",
    borderStrong: "#777777",
    focus: "#00ffff",
    selected: "blue",
    selectedFg: "white",
    success: "green",
    warning: "yellow",
    danger: "red",
    info: "cyan",
    statusOpen: "yellow",
    statusAnswered: "green",
    statusNeedsClarification: "magenta",
    statusWontAnswer: "red",
    statusStale: "white",
  },
  {
    name: "green",
    bg: "black",
    fg: "green",
    accent: "#00ff88",
    muted: "#336633",
    banner: "green",
    surface: "#041104",
    surfaceMuted: "#0a170a",
    border: "#336633",
    borderStrong: "#00aa55",
    focus: "#00ff88",
    selected: "#005500",
    selectedFg: "#00ff88",
    success: "#00ff88",
    warning: "yellow",
    danger: "#ff6666",
    info: "#66ffcc",
    statusOpen: "#bbff66",
    statusAnswered: "#00ff88",
    statusNeedsClarification: "#ffaa66",
    statusWontAnswer: "#ff6666",
    statusStale: "#99cc99",
  },
  {
    name: "ocean",
    bg: "#0a0a2e",
    fg: "#ccddff",
    accent: "#5599ff",
    muted: "#445588",
    banner: "#5599ff",
    surface: "#10163d",
    surfaceMuted: "#0d1436",
    border: "#445588",
    borderStrong: "#6f8fd6",
    focus: "#7ab2ff",
    selected: "#223366",
    selectedFg: "#ffffff",
    success: "#44cc88",
    warning: "#ffaa44",
    danger: "#ff667a",
    info: "#66ccff",
    statusOpen: "#ffaa44",
    statusAnswered: "#44cc88",
    statusNeedsClarification: "#cc88ff",
    statusWontAnswer: "#ff667a",
    statusStale: "#b8c7e6",
  },
  {
    name: "amber",
    bg: "#1a1000",
    fg: "#ffcc44",
    accent: "#ffaa00",
    muted: "#665500",
    banner: "#ffaa00",
    surface: "#241600",
    surfaceMuted: "#1e1300",
    border: "#665500",
    borderStrong: "#cc8800",
    focus: "#ffcc44",
    selected: "#443300",
    selectedFg: "#ffee88",
    success: "#ffcc44",
    warning: "#ff8800",
    danger: "#ff6655",
    info: "#ffcc66",
    statusOpen: "#ffaa00",
    statusAnswered: "#ffcc44",
    statusNeedsClarification: "#ff88aa",
    statusWontAnswer: "#ff6655",
    statusStale: "#f4dfa1",
  },
  {
    name: "pink",
    bg: "#1a0011",
    fg: "#ffaacc",
    accent: "#ff66aa",
    muted: "#774455",
    banner: "#ff66aa",
    surface: "#220019",
    surfaceMuted: "#1c0015",
    border: "#774455",
    borderStrong: "#cc6699",
    focus: "#ff99cc",
    selected: "#442233",
    selectedFg: "#ffddee",
    success: "#66ff99",
    warning: "#ffcc66",
    danger: "#ff6677",
    info: "#ff99dd",
    statusOpen: "#ffcc66",
    statusAnswered: "#66ff99",
    statusNeedsClarification: "#ff66aa",
    statusWontAnswer: "#ff6677",
    statusStale: "#f0bfd6",
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
    default: {
      const palette = ["blue", "white", "yellow", "green", "cyan", "magenta"] as const;
      const index =
        Array.from(type).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        palette.length;
      return { color: "black", backgroundColor: palette[index] };
    }
  }
}

export function getStatusTone(status: PostStatus): { color: string; backgroundColor: string } {
  return getStatusToneForTheme(status, null);
}

export function getStatusToneForTheme(
  status: PostStatus,
  theme: BrowseTheme | null
): { color: string; backgroundColor: string } {
  if (theme) {
    switch (status) {
      case "open":
        return { color: theme.bg, backgroundColor: theme.statusOpen };
      case "answered":
        return { color: theme.bg, backgroundColor: theme.statusAnswered };
      case "needs-clarification":
        return { color: theme.bg, backgroundColor: theme.statusNeedsClarification };
      case "wont-answer":
        return { color: theme.selectedFg, backgroundColor: theme.statusWontAnswer };
      case "stale":
        return { color: theme.bg, backgroundColor: theme.statusStale };
    }
  }

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
