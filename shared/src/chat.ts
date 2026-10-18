import { isAvatarId, type AvatarId } from "./avatars.js";

export const CHAT_TEXT_MAX_LENGTH = 2000;

export type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  avatar: AvatarId;
  text: string;
  createdAt: string;
};

export type ChatSendPayload = {
  text: string;
};

export type ChatHistoryPayload = {
  messages: ChatMessage[];
};

export type ChatMessagePayload = {
  message: ChatMessage;
};

export type ChatToken =
  | { type: "text"; text: string }
  | { type: "strong"; children: ChatToken[] }
  | { type: "em"; children: ChatToken[] }
  | { type: "link"; href: string; children: ChatToken[] }
  | { type: "break" };

export function normalizeChatText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (!text || text.length > CHAT_TEXT_MAX_LENGTH) {
    return null;
  }
  return text;
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    message.id.length > 0 &&
    typeof message.userId === "string" &&
    message.userId.length > 0 &&
    typeof message.displayName === "string" &&
    message.displayName.length > 0 &&
    isAvatarId(message.avatar) &&
    typeof message.text === "string" &&
    message.text.length > 0 &&
    message.text.length <= CHAT_TEXT_MAX_LENGTH &&
    typeof message.createdAt === "string" &&
    !Number.isNaN(Date.parse(message.createdAt))
  );
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const URL_TRAILING = /[.,;:!?)]+$/;

export function parseChatText(text: string): ChatToken[] {
  const lines = text.split("\n");
  const tokens: ChatToken[] = [];
  lines.forEach((line, index) => {
    tokens.push(...parseInline(line));
    if (index < lines.length - 1) {
      tokens.push({ type: "break" });
    }
  });
  return tokens;
}

function parseInline(source: string): ChatToken[] {
  const tokens: ChatToken[] = [];
  let index = 0;
  let buffer = "";

  const flush = () => {
    if (buffer) {
      tokens.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (index < source.length) {
    if (source.startsWith("**", index)) {
      const close = source.indexOf("**", index + 2);
      if (close > index + 2) {
        flush();
        tokens.push({ type: "strong", children: parseInline(source.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }

    if (source[index] === "*" && source[index + 1] !== "*") {
      const close = findSingleMarker(source, "*", index + 1);
      if (close > index + 1) {
        flush();
        tokens.push({ type: "em", children: parseInline(source.slice(index + 1, close)) });
        index = close + 1;
        continue;
      }
    }

    if (source[index] === "_" && canOpenUnderscore(source, index)) {
      const close = findUnderscoreClose(source, index + 1);
      if (close > index + 1) {
        flush();
        tokens.push({ type: "em", children: parseInline(source.slice(index + 1, close)) });
        index = close + 1;
        continue;
      }
    }

    if (source[index] === "[") {
      const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(source.slice(index));
      if (match?.[1] && match[2] && isSafeHttpUrl(match[2])) {
        flush();
        tokens.push({ type: "link", href: match[2], children: parseInline(match[1]) });
        index += match[0].length;
        continue;
      }
    }

    if (source.startsWith("http://", index) || source.startsWith("https://", index)) {
      const raw = /^https?:\/\/[^\s<>]+/.exec(source.slice(index));
      if (raw) {
        let href = raw[0];
        const trail = URL_TRAILING.exec(href);
        const trailing = trail?.[0] ?? "";
        if (trailing) {
          href = href.slice(0, -trailing.length);
        }
        if (isSafeHttpUrl(href)) {
          flush();
          tokens.push({ type: "link", href, children: [{ type: "text", text: href }] });
          buffer = trailing;
          index += raw[0].length;
          continue;
        }
      }
    }

    buffer += source[index];
    index += 1;
  }

  flush();
  return tokens;
}

function findSingleMarker(source: string, marker: string, from: number): number {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] !== marker) {
      continue;
    }
    if (source[index + 1] === marker || source[index - 1] === marker) {
      continue;
    }
    return index;
  }
  return -1;
}

function canOpenUnderscore(source: string, index: number): boolean {
  const previous = source[index - 1] ?? "";
  const next = source[index + 1] ?? "";
  if (!next || next === " " || next === "_") {
    return false;
  }
  return previous === "" || !isWordChar(previous);
}

function findUnderscoreClose(source: string, from: number): number {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] !== "_") {
      continue;
    }
    const previous = source[index - 1] ?? "";
    const next = source[index + 1] ?? "";
    if (!previous || previous === " " || previous === "_") {
      continue;
    }
    if (next === "" || !isWordChar(next)) {
      return index;
    }
  }
  return -1;
}

function isWordChar(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}
