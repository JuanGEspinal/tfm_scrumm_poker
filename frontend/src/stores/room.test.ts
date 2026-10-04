import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { CLIENT_EVENTS, SERVER_EVENTS, type RoomState } from "@scrum-poker/shared";

type Handler = (payload: unknown) => void;

const fakeSocket = {
  handlers: new Map<string, Handler>(),
  emitted: [] as Array<[string, unknown]>,
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  },
  emit(event: string, payload?: unknown) {
    this.emitted.push([event, payload]);
  },
  removeAllListeners() {
    this.handlers.clear();
  },
  disconnect() {},
  receive(event: string, payload: unknown) {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock("../socket", () => ({ connectSocket: () => fakeSocket }));

const { useRoomStore } = await import("./room");

function roomState(phase: RoomState["phase"], anaVoted: boolean): RoomState {
  return {
    id: "sprint-1",
    creatorId: "a",
    phase,
    average: null,
    users: [
      { id: "a", displayName: "Ana", avatar: "bernard", hasVoted: anaVoted, vote: null, isCreator: true },
    ],
  };
}

describe("room store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fakeSocket.handlers.clear();
    fakeSocket.emitted = [];
  });

  it("sends the chosen avatar when joining", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "lechuck");
    expect(fakeSocket.emitted).toContainEqual([
      CLIENT_EVENTS.join,
      { roomId: "sprint-1", displayName: "Ana", avatar: "lechuck" },
    ]);
  });

  it("sends the vote and keeps the own card selected", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "bernard");
    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", false));

    store.vote("5");
    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", true));

    expect(fakeSocket.emitted).toContainEqual([CLIENT_EVENTS.vote, { value: "5" }]);
    expect(store.selectedCard).toBe("5");
  });

  it("clears the own card when another user starts a new round", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "bernard");
    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", false));
    store.vote("13");
    fakeSocket.receive(SERVER_EVENTS.state, roomState("revealed", true));

    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", false));

    expect(store.selectedCard).toBeNull();
  });
});
