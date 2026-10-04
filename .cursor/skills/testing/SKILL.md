---
name: testing
description: Testing conventions for Scrum poker (Vitest domain tests, Vue tests, Socket.IO integration). Use when adding or changing tests.
---

# Testing

- Vitest everywhere. Domain tests in `shared/` are mandatory for average, phase transitions, join/leave, duplicate names, and public state hiding votes.
- Backend: at least one integration flow join → vote → reveal → average → reset, with Redis (compose or testcontainer/localhost).
- Frontend: Pinia/store or component tests for deck selection and revealed vs hidden votes. No need for full E2E in the first increment.
- Do not assert Firebase. Do not hit production Redis keys; use a test prefix or dedicated DB index.
