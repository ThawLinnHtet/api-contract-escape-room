# Implementation roadmap

Work in order. Each milestone ends with observable behavior; mark it complete only after its exit checks pass. Milestone 1 is complete and verified on the isolated `codex-dev` Neon branch. Milestone 2 is also complete; continue with Milestone 3.

## Milestone 1 — Playable gateway

- [x] Scaffold Next.js, strict TypeScript, a compatible tRPC integration, Zod, and Prisma with Neon PostgreSQL.
- [x] Add reproducible local setup, database initialization, and package scripts to README.md.
- [x] Configure Neon's runtime and migration connections per DATABASE.md; verify migrations against an isolated development database.
- [x] Persist guest session and active run, with context derived from the cookie.
- [x] Implement the room 1 public contract, server solution check, artifact award, and progress query.
- [x] Build the brief, procedure selector, JSON textarea, send action, and response viewer.
- [x] Make gateway mutations duplicate-safe and save accepted attempts transactionally.

Exit: a new guest can solve room 1, reload, and see the same state. Invalid JSON, invalid input, wrong answers, and a duplicated successful request behave as specified. Type checks and the relevant router tests pass.

Verified 2026-11-05: development migration and repeat deployment, application health, production build, strict typecheck, and all five browser/API integration cases passed. The four API/mobile checks passed in the suite; the browser persistence journey passed after correcting its alert selector. See CLOUD.md for commands and transport settings.

## Milestone 2 — Complete campaign

- [x] Implement identity clearance and permission middleware.
- [x] Add archive fixtures, filter validation, cursor pagination, and key recovery.
- [x] Add atomic ordered power transitions and status inspection.
- [x] Implement final restoration and stable completion timestamps.
- [x] Enforce room locks and run ownership on every procedure.

Exit: all five rooms are playable in order. Direct calls cannot skip rooms or access another guest's data. Tests cover the archive pagination path and concurrent/duplicate power operations.

Verified 2026-11-05 on `codex-dev`: all seven browser/API tests passed (4.1 minutes), including the full campaign, scoped evidence and archive cursors, locked procedures, concurrent power requests, stable completion, and reload. Strict typecheck and production build passed. Desktop and 360px screenshots were visually reviewed.

## Milestone 3 — Recovery and learning support

- [ ] Add the three-step persisted hint ladder for every room.
- [ ] Add inventory and persistent paginated request history, including query history recording.
- [ ] Add restart confirmation, fresh run creation, and stale-run rejection.
- [ ] Add completion recap, server-based elapsed time, and room explanations.
- [ ] Handle pending, validation, network failure, and retry states.

Exit: refresh and retries preserve the specified experience. Restart creates an isolated game. The recap and persisted history agree with server state; history cannot influence puzzle completion.

## Milestone 4 — Finish and verify

- [ ] Polish the responsive terminal interface and keyboard focus states.
- [ ] Check status announcements, readable contrast, and narrow-screen layout.
- [ ] Inspect server/client boundaries for unrevealed answers and unintended response fields.
- [ ] Run one end-to-end browser journey with reload and restart.
- [ ] Playtest contracts and hints with a beginner; revise confusing clues.
- [ ] Complete all PRD acceptance criteria and document actual setup and limitations.

Exit: every PRD acceptance criterion passes and documented commands work from a clean checkout. Report actual checks and results; leave any unfinished criterion unchecked.

## After the MVP

Evaluate features only after the campaign is useful and complete: a request replay with explanations, a second campaign, optional account-based recovery, or cooperative rooms using subscriptions. Choose one based on player feedback.
