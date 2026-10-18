import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}));

const { default: HomeView } = await import("./HomeView.vue");

const jira = {
  boardUrl: "https://empresa.atlassian.net/jira/software/projects/SCRUM/boards/1",
  email: "ada@example.com",
  apiToken: "secret",
};

function mountHome() {
  return mount(HomeView, { global: { stubs: { AvatarPicker: true } } });
}

async function fillCreate(wrapper: ReturnType<typeof mountHome>) {
  const inputs = wrapper.findAll("input");
  await inputs[0]?.setValue("Ana");
  await inputs[1]?.setValue("sprint-1");
}

function createButton(wrapper: ReturnType<typeof mountHome>, label: string) {
  const button = wrapper.findAll("button").find((item) => item.text() === label);
  if (!button) {
    throw new Error(`missing ${label}`);
  }
  return button;
}

describe("HomeView", () => {
  beforeEach(() => {
    push.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("offers a plain room and a Jira-linked room", () => {
    const wrapper = mountHome();
    expect(createButton(wrapper, "Crear sala").exists()).toBe(true);
    expect(createButton(wrapper, "Crear sala vinculada a Jira").exists()).toBe(true);
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
  });

  it("creates a plain room without Jira credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "sprint-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchImpl);
    const wrapper = mountHome();
    await fillCreate(wrapper);

    await createButton(wrapper, "Crear sala").trigger("click");
    await flushPromises();

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ id: "sprint-1" });
    expect(push).toHaveBeenCalledWith({ name: "room", params: { roomId: "sprint-1" } });
  });

  it("opens the modal and creates the room with the Jira credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "sprint-1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchImpl);
    const wrapper = mountHome();
    await fillCreate(wrapper);

    await createButton(wrapper, "Crear sala vinculada a Jira").trigger("click");
    const dialog = wrapper.get("[role=dialog]");
    const fields = dialog.findAll("input");
    await fields[0]?.setValue(jira.boardUrl);
    await fields[1]?.setValue(jira.email);
    await fields[2]?.setValue(jira.apiToken);
    await dialog.trigger("submit");
    await flushPromises();

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms");
    expect(JSON.parse(String(init.body))).toEqual({ id: "sprint-1", jira });
    expect(push).toHaveBeenCalledWith({ name: "room", params: { roomId: "sprint-1" } });
  });

  it("does not open the modal without a name", async () => {
    const wrapper = mountHome();
    await createButton(wrapper, "Crear sala vinculada a Jira").trigger("click");
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
    expect(wrapper.get(".error").text()).toContain("Indica tu nombre");
  });
});
