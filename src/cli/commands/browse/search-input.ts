export const MAX_SEARCH_QUERY_LENGTH = 96;

export function sanitizeSearchInput(text: string): string {
  return text.replace(/[\r\n\t\u001B\u0000-\u001F\u007F]/g, "");
}

export function appendSearchQuery(
  current: string,
  incoming: string,
  maxLength = MAX_SEARCH_QUERY_LENGTH
): string {
  const sanitized = sanitizeSearchInput(incoming);
  if (!sanitized) {
    return current;
  }

  const currentChars = Array.from(current);
  const available = Math.max(0, maxLength - currentChars.length);
  if (available === 0) {
    return current;
  }

  return current + Array.from(sanitized).slice(0, available).join("");
}

export function deleteSearchQueryBackward(value: string): string {
  const chars = Array.from(value);
  chars.pop();
  return chars.join("");
}

export function consumeOpenSearchShortcut(text: string, pendingShortcut: string | null): string {
  if (!pendingShortcut || !text.startsWith(pendingShortcut)) {
    return text;
  }

  return text.slice(pendingShortcut.length);
}

export function buildInputViewport(params: {
  value: string;
  placeholder: string;
  visibleWidth: number;
}): {
  text: string;
  isPlaceholder: boolean;
  isClipped: boolean;
} {
  const visibleWidth = Math.max(1, params.visibleWidth);
  const valueChars = Array.from(params.value);

  if (valueChars.length === 0) {
    const placeholderChars = Array.from(params.placeholder);
    return {
      text: placeholderChars.slice(0, visibleWidth).join(""),
      isPlaceholder: true,
      isClipped: placeholderChars.length > visibleWidth,
    };
  }

  if (valueChars.length <= visibleWidth) {
    return {
      text: params.value,
      isPlaceholder: false,
      isClipped: false,
    };
  }

  if (visibleWidth === 1) {
    return {
      text: "\u2026",
      isPlaceholder: false,
      isClipped: true,
    };
  }

  return {
    text: `\u2026${valueChars.slice(valueChars.length - (visibleWidth - 1)).join("")}`,
    isPlaceholder: false,
    isClipped: true,
  };
}

export function insertInputTextAtCursor(params: {
  value: string;
  incoming: string;
  cursorIndex: number;
  maxLength?: number;
}): {
  value: string;
  cursorIndex: number;
} {
  const sanitized = sanitizeSearchInput(params.incoming);
  if (!sanitized) {
    return {
      value: params.value,
      cursorIndex: clampCursorIndex(params.value, params.cursorIndex),
    };
  }

  const chars = Array.from(params.value);
  const insertChars = Array.from(sanitized);
  const cursorIndex = clampCursorIndex(params.value, params.cursorIndex);
  const maxLength = params.maxLength ?? Number.POSITIVE_INFINITY;
  const available = Math.max(0, maxLength - chars.length);
  if (available === 0) {
    return { value: params.value, cursorIndex };
  }

  const nextInsertChars = insertChars.slice(0, available);
  chars.splice(cursorIndex, 0, ...nextInsertChars);
  return {
    value: chars.join(""),
    cursorIndex: cursorIndex + nextInsertChars.length,
  };
}

export function deleteInputTextBackward(params: { value: string; cursorIndex: number }): {
  value: string;
  cursorIndex: number;
} {
  const chars = Array.from(params.value);
  const cursorIndex = clampCursorIndex(params.value, params.cursorIndex);
  if (cursorIndex === 0 || chars.length === 0) {
    return { value: params.value, cursorIndex };
  }

  chars.splice(cursorIndex - 1, 1);
  return {
    value: chars.join(""),
    cursorIndex: cursorIndex - 1,
  };
}

export function moveInputCursor(value: string, cursorIndex: number, delta: number): number {
  return clampCursorIndex(value, cursorIndex + delta);
}

export function clampCursorIndex(value: string, cursorIndex: number): number {
  return Math.max(0, Math.min(Array.from(value).length, cursorIndex));
}

export function buildEditableInputViewport(params: {
  value: string;
  placeholder: string;
  visibleWidth: number;
  cursorIndex: number;
}): {
  before: string;
  cursor: string;
  after: string;
  isPlaceholder: boolean;
  leftClipped: boolean;
  rightClipped: boolean;
} {
  const visibleWidth = Math.max(1, params.visibleWidth);
  const chars = Array.from(params.value);
  const cursorIndex = clampCursorIndex(params.value, params.cursorIndex);

  if (chars.length === 0) {
    const placeholderChars = Array.from(params.placeholder);
    return {
      before: "",
      cursor: " ",
      after: placeholderChars.slice(0, Math.max(0, visibleWidth - 1)).join(""),
      isPlaceholder: true,
      leftClipped: false,
      rightClipped: placeholderChars.length > Math.max(0, visibleWidth - 1),
    };
  }

  const cursorCellWidth = 1;
  const contentWidth = Math.max(0, visibleWidth - cursorCellWidth);
  const windowStart = Math.max(0, cursorIndex - contentWidth);
  const before = chars.slice(windowStart, cursorIndex).join("");
  const cursor = chars[cursorIndex] ?? " ";
  const afterCapacity = Math.max(0, visibleWidth - before.length - 1);
  const after = chars.slice(cursorIndex + 1, cursorIndex + 1 + afterCapacity).join("");
  const leftClipped = windowStart > 0;
  const rightClipped = cursorIndex + 1 + afterCapacity < chars.length;

  return {
    before: leftClipped && before.length > 0 ? `\u2026${before.slice(1)}` : before,
    cursor,
    after: rightClipped && after.length > 0 ? `${after.slice(0, -1)}\u2026` : after,
    isPlaceholder: false,
    leftClipped,
    rightClipped,
  };
}

export function buildSingleLineEditorDisplay(params: {
  value: string;
  placeholder: string;
  visibleWidth: number;
  cursorIndex: number;
}): {
  text: string;
  caretOffset: number;
  isPlaceholder: boolean;
} {
  const visibleWidth = Math.max(1, params.visibleWidth);
  const chars = Array.from(params.value);
  const cursorIndex = clampCursorIndex(params.value, params.cursorIndex);

  if (chars.length === 0) {
    const placeholder = Array.from(params.placeholder).slice(0, visibleWidth).join("");
    return {
      text: placeholder || " ",
      caretOffset: 0,
      isPlaceholder: true,
    };
  }

  const windowStart = Math.max(0, cursorIndex - Math.max(0, visibleWidth - 1));
  const visibleChars = chars.slice(windowStart, windowStart + visibleWidth);
  let text = visibleChars.join("");
  if (windowStart > 0 && text.length > 0) {
    text = `\u2026${text.slice(1)}`;
  }
  if (windowStart + visibleWidth < chars.length && text.length > 0) {
    text = `${text.slice(0, -1)}\u2026`;
  }

  return {
    text: text || " ",
    caretOffset: Math.max(0, Math.min(visibleWidth - 1, cursorIndex - windowStart)),
    isPlaceholder: false,
  };
}
