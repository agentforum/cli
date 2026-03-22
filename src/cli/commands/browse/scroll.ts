import type { TermElement } from "terminosaurus";

export function scrollListItemWithMargin(params: {
  item: TermElement | null;
  marginRows?: number;
}): void {
  const { item, marginRows = 1 } = params;
  const container = findScrollableAncestor(item);

  if (!container || !item) {
    return;
  }

  container.triggerUpdates();
  item.triggerUpdates();

  const viewportTop = container.scrollTop;
  const viewportHeight = Math.max(1, container.offsetHeight);
  const viewportBottom = viewportTop + viewportHeight;
  const itemTop = item.elementRect.y;
  const itemBottom = itemTop + Math.max(1, item.elementRect.h);
  const topThreshold = viewportTop + Math.max(0, marginRows);
  const bottomThreshold = viewportBottom - Math.max(0, marginRows);

  if (itemTop < topThreshold) {
    const nextTop = Math.max(0, itemTop - marginRows);
    if (nextTop !== container.scrollTop) {
      container.scrollTop = nextTop;
    }
    return;
  }

  if (itemBottom > bottomThreshold) {
    const nextTop = Math.max(0, itemBottom - viewportHeight + marginRows);
    if (nextTop !== container.scrollTop) {
      container.scrollTop = nextTop;
    }
  }
}

function findScrollableAncestor(item: TermElement | null): TermElement | null {
  let current = item?.parentNode ?? null;

  while (current) {
    current.triggerUpdates();

    if (current.scrollHeight > current.offsetHeight) {
      return current;
    }

    current = current.parentNode;
  }

  return null;
}
