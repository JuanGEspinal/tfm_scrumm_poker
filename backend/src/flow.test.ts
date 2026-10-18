import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { Redis } from "ioredis";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  isAvatarId,
  type ChatHistoryPayload,
  type ChatMessagePayload,
  type RoomError,
  type RoomState,
} from "@scrum-poker/shared";
import { buildApp } from "./app.js";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function waitForConnect(socket: Socket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for connect")), 4000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForState(
  socket: Socket,
  predicate: (state: RoomState) => boolean,
  errors: string[] = [],
): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for room state ${errors.join(",")}`)),
      4000,
    );
    const handler = (state: RoomState) => {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off(SERVER_EVENTS.state, handler);
        resolve(state);
      }
    };
    socket.on(SERVER_EVENTS.state, handler);
  });
}

describe("socket flow", () => {
  let close: () => Promise<void>;
  let origin: string;

  beforeAll(async () => {
    const redis = new Redis(redisUrl);
    const built = await buildApp({
      redis,
      redisUrl,
      corsOrigin: "*",
      logger: false,
      useAdapter: false,
    });
    await built.app.listen({ port: 0, host: "127.0.0.1" });
    const address = built.app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("no address");
    }
    origin = `http://127.0.0.1:${address.port}`;
    close = async () => {
      built.io.close();
      await built.app.close();
      built.pubClient.disconnect();
      built.subClient.disconnect();
      redis.disconnect();
    };
  });

  afterAll(async () => {
    await close();
  });

  it("creates a room, votes, reveals average, then resets", async () => {
    const roomId = `sprint-test-${Date.now()}`;
    const created = await fetch(`${origin}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: roomId }),
    });
    expect(created.status).toBe(201);

    const a = ioClient(origin);
    const b = ioClient(origin);
    const errors: string[] = [];
    a.on(SERVER_EVENTS.error, (error) => errors.push(`a:${error.code}`));
    b.on(SERVER_EVENTS.error, (error) => errors.push(`b:${error.code}`));
    await waitForConnect(a);
    await waitForConnect(b);

    const task = { key: "SCRUM-2", title: "Cerrar sprint", done: false, estimated: false };
    const aReady = waitForState(a, (s) => s.selectedTask?.key === task.key, errors);
    a.emit(CLIENT_EVENTS.join, { roomId, displayName: "Ana", avatar: "lechuck" });
    a.emit(CLIENT_EVENTS.selectTask, { task });
    const selectedAlone = await aReady;
    expect(selectedAlone.users.map((u) => u.displayName)).toEqual(["Ana"]);
    expect(selectedAlone.selectedTask).toEqual(task);

    const both = waitForState(b, (s) => s.users.length === 2, errors);
    b.emit(CLIENT_EVENTS.join, { roomId, displayName: "Bruno" });
    const joined = await both;
    expect(joined.users.find((u) => u.displayName === "Ana")?.avatar).toBe("lechuck");
    expect(isAvatarId(joined.users.find((u) => u.displayName === "Bruno")?.avatar)).toBe(true);

    const voted = waitForState(a, (s) => s.users.filter((u) => u.hasVoted).length === 2, errors);
    a.emit(CLIENT_EVENTS.vote, { value: "5" });
    b.emit(CLIENT_EVENTS.vote, { value: "8" });
    await voted;

    const revealed = waitForState(a, (s) => s.phase === "revealed" && s.average === 5, errors);
    a.emit(CLIENT_EVENTS.reveal);
    const revealState = await revealed;
    expect(revealState.users.map((u) => u.vote).sort()).toEqual(["5", "8"]);

    const reset = waitForState(a, (s) => s.phase === "voting" && s.users.every((u) => !u.hasVoted), errors);
    a.emit(CLIENT_EVENTS.reset);
    await reset;

    a.close();
    b.close();
  });

  it("keeps chat history for the room and rejects an empty message", async () => {
    const roomId = `chat-test-${Date.now()}`;
    const created = await fetch(`${origin}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: roomId }),
    });
    expect(created.status).toBe(201);

    const a = ioClient(origin);
    const b = ioClient(origin);
    await waitForConnect(a);
    await waitForConnect(b);

    const aJoined = waitForState(a, (state) => state.users.some((user) => user.displayName === "Ana"));
    a.emit(CLIENT_EVENTS.join, { roomId, displayName: "Ana", avatar: "bernard" });
    await aJoined;

    const empty = waitForError(a, (error) => error.code === "invalid_message");
    a.emit(CLIENT_EVENTS.sendChat, { text: "   " });
    expect((await empty).code).toBe("invalid_message");

    const delivered = waitForChatMessage(b, (payload) => payload.message.text.includes("acta"));
    const bJoined = waitForState(b, (state) => state.users.length === 2);
    b.emit(CLIENT_EVENTS.join, { roomId, displayName: "Bruno", avatar: "stan" });
    await bJoined;
    a.emit(CLIENT_EVENTS.sendChat, { text: "Mirad [acta](https://docs.example.com/acta.pdf)" });
    const live = await delivered;
    expect(live.message.displayName).toBe("Ana");
    expect(live.message.avatar).toBe("bernard");

    a.close();
    b.close();

    const late = ioClient(origin);
    await waitForConnect(late);
    const history = waitForChatHistory(late, (payload) => payload.messages.length === 1);
    late.emit(CLIENT_EVENTS.join, { roomId, displayName: "Celia", avatar: "elaine" });
    const stored = await history;
    expect(stored.messages[0]?.text).toContain("https://docs.example.com/acta.pdf");
    expect(stored.messages[0]?.displayName).toBe("Ana");
    late.close();
  });
});

function waitForChatMessage(
  socket: Socket,
  predicate: (payload: ChatMessagePayload) => boolean,
): Promise<ChatMessagePayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for chat message")), 4000);
    const handler = (payload: ChatMessagePayload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(SERVER_EVENTS.chatMessage, handler);
        resolve(payload);
      }
    };
    socket.on(SERVER_EVENTS.chatMessage, handler);
  });
}

function waitForChatHistory(
  socket: Socket,
  predicate: (payload: ChatHistoryPayload) => boolean,
): Promise<ChatHistoryPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for chat history")), 4000);
    const handler = (payload: ChatHistoryPayload) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(SERVER_EVENTS.chatHistory, handler);
        resolve(payload);
      }
    };
    socket.on(SERVER_EVENTS.chatHistory, handler);
  });
}

function waitForError(socket: Socket, predicate: (error: RoomError) => boolean): Promise<RoomError> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for room error")), 4000);
    const handler = (error: RoomError) => {
      if (predicate(error)) {
        clearTimeout(timer);
        socket.off(SERVER_EVENTS.error, handler);
        resolve(error);
      }
    };
    socket.on(SERVER_EVENTS.error, handler);
  });
}
