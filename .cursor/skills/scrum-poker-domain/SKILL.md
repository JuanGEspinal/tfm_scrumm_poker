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
- Average: arithmetic mean of numeric votes only. `∞` and `?` excluded. No numeric votes → `null` (UI shows `—`).
- Average is computed only in `revealed`; in `voting` it is `null`.

## IDs and names

- Room id: trim, lowercase, `[a-z0-9-]`, length 3–32.
- Display names unique per room, case-insensitive.
- Empty rooms stay in Redis with TTL 2h so a reload can rejoin.

## Join during revealed

New users see the current revealed votes. They do not vote until `round:reset`.
