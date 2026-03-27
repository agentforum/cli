import { describe, expect, it } from "vitest";

import { getSelectionWindow } from "@/cli/commands/browse/selection-window.js";

describe("selection window", () => {
  it("returns the full range when the list fits", () => {
    expect(getSelectionWindow(4, 2, 9)).toEqual({
      start: 0,
      end: 4,
      selectedIndex: 2,
    });
  });

  it("keeps the selected item inside a centered visible window", () => {
    expect(getSelectionWindow(20, 10, 9)).toEqual({
      start: 6,
      end: 15,
      selectedIndex: 10,
    });
  });

  it("pins the window to the end near the last items", () => {
    expect(getSelectionWindow(20, 19, 9)).toEqual({
      start: 11,
      end: 20,
      selectedIndex: 19,
    });
  });
});
