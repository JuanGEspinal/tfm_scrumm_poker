import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import type { ChatMessage } from "@scrum-poker/shared";
import ChatPanel from "./ChatPanel.vue";

const message: ChatMessage = {
  id: "1",
  userId: "a",
  displayName: "Ana",
  avatar: "bernard",
  text: "Mirad [acta](https://docs.example.com/acta.pdf)",
  createdAt: "2026-10-18T17:04:00.000Z",
};

describe("ChatPanel", () => {
  it("renders the message header and a safe link", () => {
    const wrapper = mount(ChatPanel, { props: { open: true, messages: [message] } });
    expect(wrapper.get(".chat-message-name").text()).toBe("Ana");
    expect(wrapper.get("time").attributes("datetime")).toBe(message.createdAt);
    const link = wrapper.get("a");
    expect(link.attributes("href")).toBe("https://docs.example.com/acta.pdf");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    expect(link.text()).toBe("acta");
  });

  it("sends on the button and on Enter, and keeps Shift+Enter as a new line", async () => {
    const wrapper = mount(ChatPanel, { props: { open: true, messages: [] } });
    const textarea = wrapper.get("textarea");

    await textarea.setValue("  ");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")).toBeUndefined();

    await textarea.setValue("hola");
    await textarea.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(wrapper.emitted("send")).toBeUndefined();

    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")?.[0]).toEqual(["hola"]);

    await textarea.setValue("otra");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("send")?.[1]).toEqual(["otra"]);
  });
});