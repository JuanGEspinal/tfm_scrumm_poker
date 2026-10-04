import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { formatAverage } from "./format";
import CardDeck from "./components/CardDeck.vue";

describe("formatAverage", () => {
  it("shows an em dash when there is no numeric mean", () => {
    expect(formatAverage(null)).toBe("—");
  });
});

describe("CardDeck", () => {
  it("emits the selected card", async () => {
    const wrapper = mount(CardDeck, {
      props: { selected: null, disabled: false },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(9);
    await buttons[4]?.trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["8"]);
  });
});
