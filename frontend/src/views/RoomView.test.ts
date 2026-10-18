import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import type { ChatMessage, RoomState } from "@scrum-poker/shared";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { roomId: "sprint-1" } }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("../session", () => ({
  getStoredName: () => "Ana",
  getOrAssignAvatar: () => "bernard",
}));

const store = reactive({
  state: null as RoomState | null,
  error: null as string | null,
  selectedCard: null,
  revealed: false,
  join: vi.fn(),
  vote: vi.fn(),
  selectTask: vi.fn(),
  reveal: vi.fn(),
  resetRound: vi.fn(),
  disconnect: vi.fn(),
  messages: [] as ChatMessage[],
  unread: 0,
  sendChat: vi.fn(),
  setChatPanelOpen: vi.fn(),
});

vi.mock("../stores/room", () => ({ useRoomStore: () => store }));

const { default: RoomView } = await import("./RoomView.vue");

function roomState(jiraLinked: boolean): RoomState {
  return {
    id: "sprint-1",
    creatorId: "a",
    phase: "revealed",
    average: 5,
    selectedTask: null,
    jiraLinked,
    users: [{ id: "a", displayName: "Ana", avatar: "bernard", hasVoted: true, vote: "5", isCreator: true }],
  };
}

function mountRoom() {
  return mount(RoomView, {
    global: { stubs: { RouterLink: { template: "<a><slot /></a>" }, BoardDrawer: true, UserBoard: true } },
  });
}

describe("RoomView", () => {
  beforeEach(() => {
    store.revealed = true;
    store.messages = [];
    store.unread = 0;
    store.setChatPanelOpen.mockClear();
  });

  it("offers task selection and estimate assignment in a Jira room", () => {
    store.state = roomState(true);
    const wrapper = mountRoom();
    expect(wrapper.find(".room-task").text()).toBe("Seleccionar tarea");
    expect(wrapper.find(".average-assign").exists()).toBe(true);
    expect(wrapper.findComponent({ name: "BoardDrawer" }).exists()).toBe(true);
  });

  it("hides everything about Jira in a plain room", () => {
    store.state = roomState(false);
    const wrapper = mountRoom();
    expect(wrapper.find(".room-task").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Seleccionar tarea");
    expect(wrapper.find(".average-assign").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "BoardDrawer" }).exists()).toBe(false);
    expect(wrapper.find(".average").exists()).toBe(true);
  });

  it("opens the chat from the corner button and closes it with Escape", async () => {
    store.state = roomState(false);
    store.unread = 2;
    const wrapper = mountRoom();
    expect(wrapper.get(".chat-toggle").text()).toContain("Chat");
    expect(wrapper.get(".chat-badge").text()).toBe("2");
    expect(wrapper.find(".chat-panel").classes()).not.toContain("is-open");

    await wrapper.get(".chat-toggle").trigger("click");
    expect(wrapper.find(".chat-panel").classes()).toContain("is-open");
    expect(wrapper.find(".room-shell").classes()).toContain("is-chat-open");
    expect(store.setChatPanelOpen).toHaveBeenCalledWith(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".chat-panel").classes()).not.toContain("is-open");
    expect(store.setChatPanelOpen).toHaveBeenCalledWith(false);
    wrapper.unmount();
  });
});
