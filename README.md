# API Contract Escape Room

A browser puzzle game for learning typed API interactions and building with tRPC.

## Current build

All five rooms are implemented: gateway validation, identity clearance, paginated archive recovery, ordered power startup, and final restoration. Next.js serves the lesson workspace and typed tRPC request console. Prisma persists session-scoped progress, earned artifacts, mutation history, hints, and completion in Neon PostgreSQL.

Milestones 1 through 3 are verified against the isolated `codex-dev` branch. All nine browser/API tests pass; see CLOUD.md for its verification record. Query responses are saved through a separate bounded history mutation. If saving fails, the response remains visible and can be saved again without reissuing the query. The completion recap uses persisted run timestamps, hint totals, and saved request counts. Release acceptance work is tracked in ROADMAP.md.

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
