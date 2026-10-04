import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { Redis } from "ioredis";
import { CLIENT_EVENTS, SERVER_EVENTS, isAvatarId, type RoomState } from "@scrum-poker/shared";
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

    const aReady = waitForState(a, (s) => s.users.some((u) => u.displayName === "Ana"), errors);
    a.emit(CLIENT_EVENTS.join, { roomId, displayName: "Ana", avatar: "lechuck" });
    await aReady;

    const both = waitForState(b, (s) => s.users.length === 2, errors);
    b.emit(CLIENT_EVENTS.join, { roomId, displayName: "Bruno" });
    const joined = await both;
    expect(joined.users.find((u) => u.displayName === "Ana")?.avatar).toBe("lechuck");
    expect(isAvatarId(joined.users.find((u) => u.displayName === "Bruno")?.avatar)).toBe(true);

    const voted = waitForState(a, (s) => s.users.filter((u) => u.hasVoted).length === 2, errors);
    a.emit(CLIENT_EVENTS.vote, { value: "5" });
    b.emit(CLIENT_EVENTS.vote, { value: "8" });
    await voted;

    const revealed = waitForState(a, (s) => s.phase === "revealed" && s.average === 6.5, errors);
    a.emit(CLIENT_EVENTS.reveal);
    const revealState = await revealed;
    expect(revealState.users.map((u) => u.vote).sort()).toEqual(["5", "8"]);

    const reset = waitForState(a, (s) => s.phase === "voting" && s.users.every((u) => !u.hasVoted), errors);
    a.emit(CLIENT_EVENTS.reset);
    await reset;

    a.close();
    b.close();
  });
});
