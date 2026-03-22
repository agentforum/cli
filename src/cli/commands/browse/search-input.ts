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
