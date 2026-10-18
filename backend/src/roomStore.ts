import { randomUUID } from "node:crypto";
import {
  createEmptyRoom,
  isChatMessage,
  isValidRoomId,
  normalizeRoomId,
  type ChatMessage,
  type Room,
} from "@scrum-poker/shared";
import type { Redis } from "ioredis";
import type { JiraConfig } from "./jiraBoard.js";

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

export function roomJiraKey(roomId: string): string {
  return `room:${roomId}:jira`;
}

export function roomChatKey(roomId: string): string {
  return `room:${roomId}:chat`;
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
    await this.redis
      .multi()
      .set(roomKey(room.id), JSON.stringify(room), "EX", TTL_SECONDS)
      .expire(roomJiraKey(room.id), TTL_SECONDS)
      .expire(roomChatKey(room.id), TTL_SECONDS)
      .exec();
  }

  async create(rawId: string, jira?: JiraConfig): Promise<Room> {
    const id = normalizeRoomId(rawId);
    if (!isValidRoomId(id)) {
      throw new Error("invalid_room_id");
    }
    const existing = await this.get(id);
    if (existing) {
      throw new Error("room_exists");
    }
    const room = createEmptyRoom(id, jira !== undefined);
    const write = this.redis.multi().set(roomKey(id), JSON.stringify(room), "EX", TTL_SECONDS);
    if (jira) {
      write.set(roomJiraKey(id), JSON.stringify(jira), "EX", TTL_SECONDS);
    } else {
      write.del(roomJiraKey(id));
    }
    await write.exec();
    return room;
  }

  async getJira(roomId: string): Promise<JiraConfig | null> {
    const id = normalizeRoomId(roomId);
    if (!isValidRoomId(id)) {
      return null;
    }
    const raw = await this.redis.get(roomJiraKey(id));
    return raw ? (JSON.parse(raw) as JiraConfig) : null;
  }

  async listChat(roomId: string): Promise<ChatMessage[]> {
    const id = normalizeRoomId(roomId);
    if (!isValidRoomId(id)) {
      return [];
    }
    const raw = await this.redis.lrange(roomChatKey(id), 0, -1);
    return raw.flatMap((item) => {
      try {
        const parsed: unknown = JSON.parse(item);
        return isChatMessage(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
  }

  async appendChat(roomId: string, message: ChatMessage): Promise<void> {
    const id = normalizeRoomId(roomId);
    await this.redis
      .multi()
      .rpush(roomChatKey(id), JSON.stringify(message))
      .expire(roomChatKey(id), TTL_SECONDS)
      .expire(roomKey(id), TTL_SECONDS)
      .expire(roomJiraKey(id), TTL_SECONDS)
      .exec();
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
