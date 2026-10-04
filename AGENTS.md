# Scrum poker (TFM)

Planning poker rooms: several simultaneous rooms, live votes, reveal, average, new round.

## Stack

- Frontend: Vue 3, Vite, Vue Router, Pinia, Socket.IO client (`frontend/`)
- Backend: Node, Fastify, Socket.IO, Redis (`backend/`)
- Shared types and domain: `shared/` (`@scrum-poker/shared`)
- No Firebase

## Commands

```bash
npm install
docker compose up -d redis
npm run dev          # backend :3000 and frontend :5173
npm test
```

## Cursor skills

- `.cursor/skills/scrum-poker-domain/SKILL.md`
- `.cursor/skills/vue-frontend/SKILL.md`
- `.cursor/skills/node-realtime/SKILL.md`
- `.cursor/skills/testing/SKILL.md`
