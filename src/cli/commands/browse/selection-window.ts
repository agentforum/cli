export interface SelectionWindow {
  start: number;
  end: number;
  selectedIndex: number;
}

export function getSelectionWindow(
  itemCount: number,
  selectedIndex: number,
  maxVisible = 5
): SelectionWindow {
  if (itemCount <= 0) {
    return { start: 0, end: 0, selectedIndex: 0 };
  }

  const clampedMaxVisible = Math.max(1, maxVisible);
  const effectiveSelectedIndex = Math.max(0, Math.min(itemCount - 1, selectedIndex));
  if (itemCount <= clampedMaxVisible) {
    return { start: 0, end: itemCount, selectedIndex: effectiveSelectedIndex };
  }

  const halfWindow = Math.floor(clampedMaxVisible / 2);
  let start = Math.max(0, effectiveSelectedIndex - halfWindow);
  const end = Math.min(itemCount, start + clampedMaxVisible);
  start = Math.max(0, end - clampedMaxVisible);

  return { start, end, selectedIndex: effectiveSelectedIndex };
}
