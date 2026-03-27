export function computePickerLayout(params: {
  preferredLimit: number;
  itemCount: number;
  hasDescriptions: boolean;
  terminalHeight: number;
}): { visibleLimit: number; hideDescriptions: boolean } {
  const preferred = Math.max(1, params.preferredLimit);
  const itemCount = Math.max(1, params.itemCount);
  const availableContentRows = Math.max(1, params.terminalHeight - 16);
  const describedFit = Math.max(1, Math.floor(availableContentRows / 3));
  if (!params.hasDescriptions || describedFit >= preferred) {
    return {
      visibleLimit: Math.min(
        preferred,
        itemCount,
        params.hasDescriptions ? describedFit : Math.max(1, Math.floor(availableContentRows / 2))
      ),
      hideDescriptions: false,
    };
  }

  const compactFit = Math.max(1, Math.floor(availableContentRows / 2));
  return {
    visibleLimit: Math.min(preferred, itemCount, compactFit),
    hideDescriptions: true,
  };
}

export function computePickerMargins(params: { terminalWidth: number; terminalHeight: number }): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const vertical = params.terminalHeight >= 30 ? 3 : params.terminalHeight >= 22 ? 2 : 1;
  const horizontal = params.terminalWidth >= 100 ? 8 : params.terminalWidth >= 70 ? 4 : 2;
  return {
    top: vertical,
    right: horizontal,
    bottom: vertical,
    left: horizontal,
  };
}
