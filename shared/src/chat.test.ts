import { describe, expect, it } from "vitest";
import { isChatMessage, isSafeHttpUrl, normalizeChatText, parseChatText, CHAT_TEXT_MAX_LENGTH } from "./chat.js";

describe("normalizeChatText", () => {
  it("trims and keeps internal line breaks", () => {
    expect(normalizeChatText("  hola\n\nmundo  ")).toBe("hola\n\nmundo");
  });

  it("rejects empty, oversized, and non-string values", () => {
    expect(normalizeChatText("   \n")).toBeNull();
    expect(normalizeChatText("a".repeat(CHAT_TEXT_MAX_LENGTH + 1))).toBeNull();
    expect(normalizeChatText(12)).toBeNull();
  });
});

describe("isSafeHttpUrl", () => {
  it("accepts only http and https", () => {
    expect(isSafeHttpUrl("https://docs.example.com/a.pdf")).toBe(true);
    expect(isSafeHttpUrl("http://docs.example.com/a")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("nota interna")).toBe(false);
  });
});

describe("parseChatText", () => {
  it("parses bold, italic, markdown links, and bare urls", () => {
    expect(parseChatText("ver **spec** y *nota* o _otra_")).toEqual([
      { type: "text", text: "ver " },
      { type: "strong", children: [{ type: "text", text: "spec" }] },
      { type: "text", text: " y " },
      { type: "em", children: [{ type: "text", text: "nota" }] },
      { type: "text", text: " o " },
      { type: "em", children: [{ type: "text", text: "otra" }] },
    ]);
    expect(parseChatText("doc [acta](https://docs.example.com/a.pdf)")).toEqual([
      { type: "text", text: "doc " },
      {
        type: "link",
        href: "https://docs.example.com/a.pdf",
        children: [{ type: "text", text: "acta" }],
      },
    ]);
    expect(parseChatText("mira https://docs.example.com/a.pdf.")).toEqual([
      { type: "text", text: "mira " },
      {
        type: "link",
        href: "https://docs.example.com/a.pdf",
        children: [{ type: "text", text: "https://docs.example.com/a.pdf" }],
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps unsafe links and snake_case as plain text", () => {
    expect(parseChatText("[x](javascript:alert(1)) y story_points")).toEqual([
      { type: "text", text: "[x](javascript:alert(1)) y story_points" },
    ]);
  });

  it("turns line breaks into tokens", () => {
    expect(parseChatText("una\ndos")).toEqual([
      { type: "text", text: "una" },
      { type: "break" },
      { type: "text", text: "dos" },
    ]);
  });
});

describe("isChatMessage", () => {
  it("accepts a stored message and rejects a broken one", () => {
    expect(
      isChatMessage({
        id: "1",
        userId: "u",
        displayName: "Ana",
        avatar: "bernard",
        text: "hola",
        createdAt: "2026-10-18T17:00:00.000Z",
      }),
    ).toBe(true);
    expect(isChatMessage({ id: "1", text: "hola" })).toBe(false);
  });
});
