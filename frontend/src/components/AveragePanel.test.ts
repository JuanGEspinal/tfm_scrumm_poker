import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AveragePanel from "./AveragePanel.vue";

const room = { roomId: "sprint-1", jiraLinked: true };

describe("AveragePanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden until the round is revealed", () => {
    const wrapper = mount(AveragePanel, {
      props: { ...room, visible: false, value: null, issueKey: null },
    });
    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("offers only Fibonacci estimates and starts from the average", () => {
    const wrapper = mount(AveragePanel, {
      props: { ...room, visible: true, value: 5, issueKey: null },
    });
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual([
      "—",
      "0",
      "1",
      "2",
      "3",
      "5",
      "8",
      "13",
      "21",
    ]);
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("5");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Selecciona una tarea para asignar la estimación.");
  });

  it("assigns the edited estimate to the selected issue", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchImpl);
    const wrapper = mount(AveragePanel, {
      props: { ...room, visible: true, value: 5, issueKey: "SCRUM-2" },
    });

    await wrapper.get("select").setValue("8");
    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/api/rooms/sprint-1/board/issues/SCRUM-2/estimate");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ points: 8 });
    expect(wrapper.text()).toContain("Estimación asignada.");
  });

  it("shows only the average in a room without Jira", () => {
    const wrapper = mount(AveragePanel, {
      props: { roomId: "sprint-1", jiraLinked: false, visible: true, value: 5, issueKey: null },
    });
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("5");
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Selecciona una tarea");
  });

  it("follows a new average until the field is edited", async () => {
    const wrapper = mount(AveragePanel, {
      props: { ...room, visible: true, value: 5, issueKey: "SCRUM-2" },
    });
    await wrapper.setProps({ value: 8 } as never);
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("8");

    await wrapper.get("select").setValue("13");
    await wrapper.setProps({ value: 3 } as never);
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("13");
  });
});
