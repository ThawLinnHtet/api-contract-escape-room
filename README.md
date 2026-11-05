# API Contract Escape Room

A browser puzzle game for learning typed API interactions and building with tRPC.

## Current build

The gateway room is implemented with a JSON request editor, validation feedback, guest sessions, hints, inventory, persistent attempts, and restart. Next.js serves the UI and tRPC routes. Prisma accesses Neon PostgreSQL through the Node.js `pg` driver.

Rooms 2 through 5 remain planned. Milestone 1 is verified against the isolated `codex-dev` Neon branch; see CLOUD.md for the verification record. Existing roadmap items describe the complete planned campaign, rather than claiming that the MVP is finished.

## Local setup

Use Node.js 24. Copy `.env.example` to an ignored `.env.local` and supply the pooled and direct Neon URLs for the same development target. Alternatively, link the intended Neon project and pull its environment with the Neon CLI. Preserve real credentials outside Git.

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

In a managed cloud environment with HTTPS access and no PostgreSQL TCP grants, use Neon's WebSocket transport (including interactive transactions):

```bash
npm run db:deploy:websocket
DATABASE_TRANSPORT=neon-websocket npm run dev
```

Set `DATABASE_TRANSPORT=neon-websocket` for the production server too. The WebSocket driver preserves `HTTPS_PROXY` and TLS verification. The migration runner applies explicitly transactional committed migrations and records their checksums in Prisma's migration ledger; reruns skip unchanged migrations and reject changed or unfinished ones. TCP environments can continue using `npm run db:deploy` and the default `pg` adapter.

The migration creates the app's five tables inside `escape_room`. Review and test migrations on an isolated branch before applying them to production.

```bash
npm run typecheck
npm run build
npm run start -- --port 3100
```

With the built server running against an isolated test target:

```bash
npm run test:e2e
```

Install the appropriate Playwright browser first: Windows tests use installed Chrome; Linux tests use `npx playwright install --with-deps chromium`.

## Cloud and design tools

- [CLOUD.md](CLOUD.md): cloud install command, private environment variables, Mobbin acceptance check, and the continuation prompt.
- [DESIGN.md](DESIGN.md): chosen Mobbin references and layout rules.
- Impeccable and official Mobbin skills are stored in `.agents/skills`; portable Mobbin MCP configuration is in `.codex/config.toml`. OAuth is configured separately for the destination host.

## Project documents

- [PRD.md](PRD.md): gameplay, API behavior, data model, and acceptance criteria.
- [DATABASE.md](DATABASE.md): database connection and migration decisions.
- [ROADMAP.md](ROADMAP.md): implementation milestones and exit criteria.
- [AGENTS.md](AGENTS.md): instructions for coding agents.
