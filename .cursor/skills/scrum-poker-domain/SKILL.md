---
name: scrum-poker-domain
description: Defines Scrum poker room state machine, cards, average rules, and Socket.IO event contracts. Use when changing room logic, votes, reveal, new round, shared types, or event names.
---

# Scrum poker domain

Source of truth: `shared/` (`events.ts`, `cards.ts`, `room.ts`). Backend and frontend import from `@scrum-poker/shared`. Do not duplicate event strings or card lists.

## Room machine

- Phases: `voting` → `revealed` (`round:reveal`) → `voting` (`round:reset`).
- Store votes on the server always. Broadcast `vote` only when `phase === revealed`; otherwise send `hasVoted` and `vote: null` to other clients.
- `creatorId` is stored for a future moderator role. Phase 1: anyone may reveal or reset.

## Cards and average

- Values: `1, 2, 3, 5, 8, 13, 21, ∞, ?`.
- Estimate scale (rounded average and Jira story points): `0, 1, 2, 3, 5, 8, 13, 21`.
- Average: arithmetic mean of numeric votes only, then rounded to the nearest estimate. A tie rounds down (5.5 → 5, 7 → 8). `∞` and `?` excluded. No numeric votes → `null` (UI shows `—`).
- Average is computed only in `revealed`; in `voting` it is `null`. The revealed field stays editable on the client, limited to the estimate scale.

## IDs and names

- Room id: trim, lowercase, `[a-z0-9-]`, length 3–32.
- Display names unique per room, case-insensitive.
- Empty rooms stay in Redis with TTL 2h so a reload can rejoin.

## Jira link

- A room is created either plain or linked to a Jira board (`Room.jiraLinked`, exposed in `RoomState`). Rooms stored without the field count as plain.
- `shared/src/jira.ts`: `JiraLinkInput` and `parseJiraBoardUrl` (Jira Cloud board URLs only).

## Chat

- Room-level, not cleared on `round:reset`. Stored outside `Room` / `room:state` so a message does not rebroadcast votes.
- `chat:send` `{ text }` → validate with `normalizeChatText` (trim, 1–2000). Snapshot `displayName` and `avatar` at send time.
- `chat:history` to the joining socket only. `chat:message` to the Socket.IO room.
- Light markdown parsed by `parseChatText`: `**bold**`, `*italic*` / `_italic_`, `[label](http(s)://...)`, and bare `http(s)` URLs. Other URLs stay plain text.

## Join during revealed

New users see the current revealed votes. They do not vote until `round:reset`.
