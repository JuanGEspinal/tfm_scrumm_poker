import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  addUser,
  castVote,
  findUserByName,
  isAvatarId,
  isValidDisplayName,
  isValidRoomId,
  normalizeDisplayName,
  normalizeRoomId,
  randomAvatarId,
  rejoinUser,
  removeUser,
  resetRound,
  revealRound,
  selectTask,
  toPublicRoomState,
  type ClientToServerEvents,
  type JoinPayload,
  type RoomErrorCode,
  type SelectTaskPayload,
  type ServerToClientEvents,
  type VotePayload,
} from "@scrum-poker/shared";
import { Server } from "socket.io";
import { ERROR_MESSAGES } from "./errorMessages.js";
import type { RoomStore } from "./roomStore.js";

type SocketData = {
  roomId?: string;
  userId?: string;
};

const DISCONNECT_GRACE_MS = 3000;

export function createSocketServer(
  httpServer: HttpServer,
  store: RoomStore,
  corsOrigin: string,
): Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    { cors: { origin: corsOrigin } },
  );

  const pendingDisconnect = new Map<string, NodeJS.Timeout>();
  const socketTails = new Map<string, Promise<void>>();

  // Socket.IO does not wait for async handlers. Join must finish before vote or
  // task selection on the same connection, or the first action is rejected.
  const enqueue = (socketId: string, work: () => Promise<void>) => {
    const previous = socketTails.get(socketId) ?? Promise.resolve();
    const run = previous.then(work, work);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    socketTails.set(socketId, tail);
    void tail.finally(() => {
      if (socketTails.get(socketId) === tail) {
        socketTails.delete(socketId);
      }
    });
  };

  const emitError = (
    socket: { emit: (event: typeof SERVER_EVENTS.error, payload: { code: RoomErrorCode; message: string }) => void },
    code: RoomErrorCode,
  ) => {
    socket.emit(SERVER_EVENTS.error, { code, message: ERROR_MESSAGES[code] });
  };

  const broadcast = async (roomId: string) => {
    const room = await store.get(roomId);
    if (!room) {
      return;
    }
    io.to(roomId).emit(SERVER_EVENTS.state, toPublicRoomState(room));
  };

  io.on("connection", (socket) => {
    socket.on(CLIENT_EVENTS.join, (payload: JoinPayload) => {
      enqueue(socket.id, async () => {
        try {
          const roomId = normalizeRoomId(payload.roomId ?? "");
          const displayName = normalizeDisplayName(payload.displayName ?? "");
          if (!isValidRoomId(roomId)) {
            emitError(socket, "invalid_room_id");
            return;
          }
          if (!isValidDisplayName(displayName)) {
            emitError(socket, "invalid_name");
            return;
          }

          const avatar = isAvatarId(payload.avatar) ? payload.avatar : randomAvatarId();
          const userId = randomUUID();
          const next = await store.update(roomId, (room) => {
            const existing = findUserByName(room, displayName);
            if (existing) {
              const pendingKey = `${roomId}:${existing.id}`;
              const timeout = pendingDisconnect.get(pendingKey);
              if (timeout) {
                clearTimeout(timeout);
                pendingDisconnect.delete(pendingKey);
                return rejoinUser(room, existing.id, { id: userId, displayName, avatar, vote: null });
              }
              throw new Error("name_taken");
            }
            return addUser(room, { id: userId, displayName, avatar, vote: null });
          });

          if (socket.data.roomId && socket.data.roomId !== roomId) {
            socket.leave(socket.data.roomId);
          }
          socket.data.roomId = roomId;
          socket.data.userId = userId;
          await socket.join(roomId);
          io.to(roomId).emit(SERVER_EVENTS.state, toPublicRoomState(next));
        } catch (error) {
          const code = (error instanceof Error ? error.message : "room_not_found") as RoomErrorCode;
          emitError(socket, ERROR_MESSAGES[code] ? code : "room_not_found");
        }
      });
    });

    socket.on(CLIENT_EVENTS.vote, (payload: VotePayload) => {
      enqueue(socket.id, async () => {
        const { roomId, userId } = socket.data;
        if (!roomId || !userId) {
          emitError(socket, "not_in_room");
          return;
        }
        try {
          await store.update(roomId, (room) => castVote(room, userId, payload.value));
          await broadcast(roomId);
        } catch (error) {
          const code = (error instanceof Error ? error.message : "invalid_vote") as RoomErrorCode;
          emitError(socket, ERROR_MESSAGES[code] ? code : "invalid_vote");
        }
      });
    });

    socket.on(CLIENT_EVENTS.reveal, () => {
      enqueue(socket.id, async () => {
        const { roomId, userId } = socket.data;
        if (!roomId || !userId) {
          emitError(socket, "not_in_room");
          return;
        }
        try {
          await store.update(roomId, revealRound);
          await broadcast(roomId);
        } catch (error) {
          const code = (error instanceof Error ? error.message : "wrong_phase") as RoomErrorCode;
          emitError(socket, ERROR_MESSAGES[code] ? code : "wrong_phase");
        }
      });
    });

    socket.on(CLIENT_EVENTS.selectTask, (payload: SelectTaskPayload) => {
      enqueue(socket.id, async () => {
        const { roomId, userId } = socket.data;
        if (!roomId || !userId) {
          emitError(socket, "not_in_room");
          return;
        }
        try {
          await store.update(roomId, (room) => selectTask(room, payload?.task));
          await broadcast(roomId);
        } catch (error) {
          const code = (error instanceof Error ? error.message : "invalid_task") as RoomErrorCode;
          emitError(socket, ERROR_MESSAGES[code] ? code : "invalid_task");
        }
      });
    });

    socket.on(CLIENT_EVENTS.reset, () => {
      enqueue(socket.id, async () => {
        const { roomId, userId } = socket.data;
        if (!roomId || !userId) {
          emitError(socket, "not_in_room");
          return;
        }
        try {
          await store.update(roomId, resetRound);
          await broadcast(roomId);
        } catch (error) {
          const code = (error instanceof Error ? error.message : "wrong_phase") as RoomErrorCode;
          emitError(socket, ERROR_MESSAGES[code] ? code : "wrong_phase");
        }
      });
    });

    socket.on("disconnect", () => {
      enqueue(socket.id, async () => {
        const { roomId, userId } = socket.data;
        if (!roomId || !userId) {
          return;
        }
        const pendingKey = `${roomId}:${userId}`;
        const timeout = setTimeout(() => {
          void (async () => {
            pendingDisconnect.delete(pendingKey);
            try {
              await store.update(roomId, (room) => removeUser(room, userId));
              await broadcast(roomId);
            } catch {
              // Room already gone.
            }
          })();
        }, DISCONNECT_GRACE_MS);
        pendingDisconnect.set(pendingKey, timeout);
      });
    });
  });

  return io;
}
