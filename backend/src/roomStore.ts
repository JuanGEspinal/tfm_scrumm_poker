import { randomUUID } from "node:crypto";
import {
  createEmptyRoom,
  isValidRoomId,
  normalizeRoomId,
  type Room,
} from "@scrum-poker/shared";
import type { Redis } from "ioredis";

const TTL_SECONDS = 60 * 60 * 2;
const LOCK_TTL_MS = 2000;
const LOCK_WAIT_MS = 3000;
const LOCK_RETRY_MS = 15;
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

export function roomKey(roomId: string): string {
  return `room:${roomId}`;
}

export class RoomStore {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly redis: Redis) {}

  async get(roomId: string): Promise<Room | null> {
    const raw = await this.redis.get(roomKey(normalizeRoomId(roomId)));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Room;
  }

  async save(room: Room): Promise<void> {
    await this.redis.set(roomKey(room.id), JSON.stringify(room), "EX", TTL_SECONDS);
  }

  async create(rawId: string): Promise<Room> {
    const id = normalizeRoomId(rawId);
    if (!isValidRoomId(id)) {
      throw new Error("invalid_room_id");
    }
    const existing = await this.get(id);
    if (existing) {
      throw new Error("room_exists");
    }
    const room = createEmptyRoom(id);
    await this.save(room);
    return room;
  }

  async exists(rawId: string): Promise<boolean> {
    const id = normalizeRoomId(rawId);
    if (!isValidRoomId(id)) {
      return false;
    }
    return (await this.redis.exists(roomKey(id))) === 1;
  }

  async update(roomId: string, mutator: (room: Room) => Room): Promise<Room> {
    const id = normalizeRoomId(roomId);
    const previous = this.queues.get(id) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.lockedUpdate(id, mutator));
    const tail = run.catch(() => undefined);
    this.queues.set(id, tail);
    void tail.then(() => {
      if (this.queues.get(id) === tail) {
        this.queues.delete(id);
      }
    });
    return run;
  }

  // Cross-process lock: several Node instances may share the same Redis.
  private async lockedUpdate(id: string, mutator: (room: Room) => Room): Promise<Room> {
    const lockKey = `lock:${roomKey(id)}`;
    const token = randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while ((await this.redis.set(lockKey, token, "PX", LOCK_TTL_MS, "NX")) !== "OK") {
      if (Date.now() > deadline) {
        throw new Error("room_busy");
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
    try {
      const room = await this.get(id);
      if (!room) {
        throw new Error("room_not_found");
      }
      const next = mutator(room);
      await this.save(next);
      return next;
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, token);
    }
  }
}
