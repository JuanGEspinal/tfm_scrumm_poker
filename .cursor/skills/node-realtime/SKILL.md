---
name: node-realtime
description: Fastify, Socket.IO, and Redis conventions for Scrum poker rooms. Use when changing HTTP routes, socket handlers, presence, or room persistence.
---

# Node realtime backend

- Fastify + TypeScript. Socket.IO on the same HTTP server. CORS for the Vite origin.
- Room JSON in Redis key `room:{id}` with TTL 2h, refreshed on activity. Socket.IO Redis adapter for multiple Node processes.
- One handler per client event. Validate with `shared/` helpers. Mutate via `shared` room functions, then persist and emit `room:state` to the Socket.IO room named `roomId`.
- REST: `GET /health`, `POST /rooms` (body `{ id, jira? }`), `GET /rooms/:id`, `GET /rooms/:id/board/issues`, `GET /rooms/:id/board/issues/:key`, `GET /rooms/:id/board/issues/:key/attachments/:attachmentId`, `GET /rooms/:id/board/issues/:key/attachments/:attachmentId/thumbnail`, `PUT /rooms/:id/board/issues/:key/estimate`. Join/vote/reveal/reset/leave/chat are sockets.
- Chat history is Redis list `room:{id}:chat` (same 2h TTL, refreshed when the room is saved and when a message is appended). `chat:history` goes only to the socket that just joined; `chat:message` goes to the room. Do not put messages inside `room:state`.
- Jira credentials are per room, never global. `POST /rooms` with `jira` validates it (`toJiraConfig`, only `https://*.atlassian.net`) and checks the board with Jira before creating the room. They live in Redis key `room:{id}:jira` (same TTL as the room) and never go into `room:state`. Board routes on a room without Jira answer 409 `jira_not_linked`.
- Map `socket.id` → `{ roomId, userId }`. On disconnect: short grace (3s); if no reconnect with same name, remove user and broadcast.
- Never emit another user’s vote except when `phase === revealed` (use `toPublicRoomState`).
