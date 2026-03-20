import { describe, expect, it } from "vitest";

import { getStatusToneForTheme, THEMES } from "@/cli/commands/browse/theme.js";

describe("browse themes", () => {
  it("defines the expanded semantic tokens for every theme", () => {
    for (const theme of THEMES) {
      expect(theme.surface).toBeTruthy();
      expect(theme.surfaceMuted).toBeTruthy();
      expect(theme.border).toBeTruthy();
      expect(theme.borderStrong).toBeTruthy();
      expect(theme.focus).toBeTruthy();
      expect(theme.danger).toBeTruthy();
      expect(theme.info).toBeTruthy();
      expect(theme.statusOpen).toBeTruthy();
      expect(theme.statusAnswered).toBeTruthy();
      expect(theme.statusNeedsClarification).toBeTruthy();
      expect(theme.statusWontAnswer).toBeTruthy();
      expect(theme.statusStale).toBeTruthy();
    }
  });

  it("derives status tones from the active theme", () => {
    const theme = THEMES[0];

    expect(getStatusToneForTheme("open", theme)).toEqual({
      color: theme.bg,
      backgroundColor: theme.statusOpen,
    });
    expect(getStatusToneForTheme("answered", theme)).toEqual({
      color: theme.bg,
      backgroundColor: theme.statusAnswered,
    });
  });
});
