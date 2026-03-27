import { describe, expect, it } from "vitest";

import { computePickerLayout, computePickerMargins } from "@/cli/commands/browse/picker-layout.js";

describe("picker layout", () => {
  it("switches to compact mode when described rows would overflow a short terminal", () => {
    expect(
      computePickerLayout({
        preferredLimit: 5,
        itemCount: 10,
        hasDescriptions: true,
        terminalHeight: 24,
      })
    ).toEqual({
      visibleLimit: 4,
      hideDescriptions: true,
    });
  });

  it("keeps the preferred limit when the terminal has enough space", () => {
    expect(
      computePickerLayout({
        preferredLimit: 5,
        itemCount: 10,
        hasDescriptions: false,
        terminalHeight: 40,
      })
    ).toEqual({
      visibleLimit: 5,
      hideDescriptions: false,
    });
  });

  it("shrinks modal margins on smaller terminals", () => {
    expect(computePickerMargins({ terminalWidth: 120, terminalHeight: 40 })).toEqual({
      top: 3,
      right: 8,
      bottom: 3,
      left: 8,
    });

    expect(computePickerMargins({ terminalWidth: 60, terminalHeight: 20 })).toEqual({
      top: 1,
      right: 2,
      bottom: 1,
      left: 2,
    });
  });
});
