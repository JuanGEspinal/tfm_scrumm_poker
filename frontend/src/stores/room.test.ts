import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { CLIENT_EVENTS, SERVER_EVENTS, type RoomState } from "@scrum-poker/shared";

type Handler = (payload: unknown) => void;

const fakeSocket = {
  handlers: new Map<string, Handler>(),
  ioHandlers: new Map<string, Handler>(),
  emitted: [] as Array<[string, unknown]>,
  io: {
    on(event: string, handler: Handler) {
      fakeSocket.ioHandlers.set(event, handler);
    },
    off(event: string) {
      fakeSocket.ioHandlers.delete(event);
    },
  },
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
    selectedTask: null,
    users: [
      { id: "a", displayName: "Ana", avatar: "bernard", hasVoted: anaVoted, vote: null, isCreator: true },
    ],
  };
}

describe("room store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fakeSocket.handlers.clear();
    fakeSocket.ioHandlers.clear();
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

  it("sends the selected task to the room", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "bernard");
    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", false));
    const task = { key: "SCRUM-2", title: "Cerrar sprint", done: false, estimated: false };

    store.selectTask(task);

    expect(store.state?.selectedTask).toEqual(task);
    expect(fakeSocket.emitted).toContainEqual([CLIENT_EVENTS.selectTask, { task }]);
  });

  it("keeps the task picked before the join state arrives and sends it again", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "bernard");
    const task = { key: "SCRUM-1", title: "Elegir base de datos", done: false, estimated: true };
    store.selectTask(task);

    fakeSocket.receive(SERVER_EVENTS.state, roomState("voting", false));

    expect(store.state?.selectedTask).toEqual(task);
    expect(fakeSocket.emitted.filter(([event]) => event === CLIENT_EVENTS.selectTask)).toEqual([
      [CLIENT_EVENTS.selectTask, { task }],
      [CLIENT_EVENTS.selectTask, { task }],
    ]);
  });

  it("rejoins the room after the socket reconnects", () => {
    const store = useRoomStore();
    store.join("sprint-1", "Ana", "lechuck");
    fakeSocket.emitted = [];

    fakeSocket.ioHandlers.get("reconnect")?.(undefined);

    expect(fakeSocket.emitted).toContainEqual([
      CLIENT_EVENTS.join,
      { roomId: "sprint-1", displayName: "Ana", avatar: "lechuck" },
    ]);
    store.disconnect();
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
