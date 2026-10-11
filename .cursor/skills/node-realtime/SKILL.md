---
name: node-realtime
description: Fastify, Socket.IO, and Redis conventions for Scrum poker rooms. Use when changing HTTP routes, socket handlers, presence, or room persistence.
---

# Node realtime backend

- Fastify + TypeScript. Socket.IO on the same HTTP server. CORS for the Vite origin.
- Room JSON in Redis key `room:{id}` with TTL 2h, refreshed on activity. Socket.IO Redis adapter for multiple Node processes.
- One handler per client event. Validate with `shared/` helpers. Mutate via `shared` room functions, then persist and emit `room:state` to the Socket.IO room named `roomId`.
- REST: `GET /health`, `POST /rooms`, `GET /rooms/:id`, `GET /board/issues`, `GET /board/issues/:key`, `GET /board/issues/:key/attachments/:attachmentId`, `GET /board/issues/:key/attachments/:attachmentId/thumbnail`, `PUT /board/issues/:key/estimate`. Join/vote/reveal/reset/leave are sockets.
- Map `socket.id` → `{ roomId, userId }`. On disconnect: short grace (3s); if no reconnect with same name, remove user and broadcast.
- Never emit another user’s vote except when `phase === revealed` (use `toPublicRoomState`).
