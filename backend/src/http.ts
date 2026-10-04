import type { FastifyInstance } from "fastify";
import { isValidRoomId, normalizeRoomId } from "@scrum-poker/shared";
import { ERROR_MESSAGES } from "./errorMessages.js";
import type { RoomStore } from "./roomStore.js";

export function registerHttp(app: FastifyInstance, store: RoomStore): void {
  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { id?: string } }>("/rooms", async (request, reply) => {
    try {
      const room = await store.create(request.body?.id ?? "");
      return reply.code(201).send({ id: room.id });
    } catch (error) {
      const code = error instanceof Error ? error.message : "invalid_room_id";
      const status = code === "room_exists" ? 409 : 400;
      return reply.code(status).send({
        code,
        message: ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ?? ERROR_MESSAGES.invalid_room_id,
      });
    }
  });

  app.get<{ Params: { id: string } }>("/rooms/:id", async (request, reply) => {
    const id = normalizeRoomId(request.params.id);
    if (!isValidRoomId(id)) {
      return reply.code(400).send({
        code: "invalid_room_id",
        message: ERROR_MESSAGES.invalid_room_id,
      });
    }
    const exists = await store.exists(id);
    if (!exists) {
      return reply.code(404).send({
        code: "room_not_found",
        message: ERROR_MESSAGES.room_not_found,
      });
    }
    return { id, exists: true };
  });
}
