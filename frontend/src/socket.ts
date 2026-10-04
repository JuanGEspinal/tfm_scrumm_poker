import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@scrum-poker/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function connectSocket(): AppSocket {
  return io({ transports: ["websocket"] });
}
