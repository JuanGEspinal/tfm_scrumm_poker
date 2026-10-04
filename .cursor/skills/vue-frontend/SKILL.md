---
name: vue-frontend
description: Vue 3 frontend conventions for the Scrum poker app (Composition API, Pinia, Router, Socket.IO client). Use when adding or changing pages, components, stores, or room UI.
---

# Vue frontend

- Vue 3 + `<script setup>` + TypeScript. Pinia for room/session. Vue Router: `/` and `/room/:roomId`.
- UI copy in Spanish.
- Session: `displayName` in `sessionStorage`. Direct `/room/:id` without name → home with room prefilled to join.
- Do not put other users’ `vote` in local optimistic state; apply `room:state` from the server.
- Own selected card may be highlighted locally while `voting`; clear it on `round:reset`.
- Socket events and payloads: only `@scrum-poker/shared`.
- Components stay small: deck, user boxes, average, home form.

## Room UI

- Voted box: distinct border. Hidden value until `revealed`. Flip animation on reveal.
- Average section only when `revealed`.
- Anyone can click Revelar / Nueva ronda. Show “Anfitrión” on `isCreator`.
