# Database configuration

Selected database: Neon PostgreSQL  
Runtime: Next.js Node.js routes, Prisma 7.10.1, `@prisma/adapter-pg`, and `pg`  
Last checked: 2026-11-05

## Provisioning state

The project was linked using the user's requested organization `org-rough-tree-19286185`, project `billowing-bread-81133505`, and `production` branch. `neon deploy` completed successfully and pulled `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` into the ignored local `.env.local`. Only Postgres is declared; Auth, Storage, Functions, and AI services were not added.

The initial migration was applied to the isolated `codex-dev` branch on 2026-11-05. A second deployment correctly reported it already applied. The running application health check confirmed PostgreSQL connectivity. Production migration remains a separate deployment step.

## Architecture

Browser -> tRPC -> server domain functions -> Prisma -> Neon PostgreSQL.

The Node.js runtime uses Prisma's `pg` adapter with a small reused pool. This supports the interactive transactions required for progress and history. The default transport remains `pg`. Set `DATABASE_TRANSPORT=neon-websocket` to use `@prisma/adapter-neon` with interactive transactions over HTTPS WebSockets, preserving the managed HTTPS proxy and TLS trust. Use `npm run db:deploy:websocket` for transactional migrations when TCP access is unavailable. This runner serializes deployments with an advisory lock, verifies checksums, and records successful migrations atomically in the Prisma ledger.

## Environment variables

| Variable | Consumer |
| --- | --- |
| `DATABASE_URL` | Pooled runtime connection, used by `src/server/db.ts` |
| `DATABASE_URL_UNPOOLED` | Direct migration connection, used by `prisma.config.ts` |
| `DATABASE_TRANSPORT` | Optional `neon-websocket`; defaults to PostgreSQL TCP |
| `NEON_BRANCH` | Human-readable branch identity from Neon CLI |

Both URLs must refer to the same intended branch and database. Keep the connection's TLS settings. `.env.example` contains placeholders; real URLs belong in ignored local files or private cloud environment variables. The cloud setup does not inherit local OAuth or database credentials automatically.

## Schema ownership

`prisma/schema.prisma` defines GuestSession, GameRun, RoomProgress, Artifact, and RequestAttempt. All models belong to the `escape_room` PostgreSQL schema. Runtime adapter configuration selects that schema; migration configuration derives the same schema from the direct URL without changing the stored Neon credentials.

The initial migration qualifies application table names and wraps its statements in a transaction. It adds the five tables, their foreign keys, uniqueness constraints, and query indexes. PRD.md owns gameplay semantics and the full model's purpose.

Guest cookie values are hashed before persistence. Domain mutations lock the guest's active-run selection so restart and puzzle retries are serialized. Gateway result, progress, artifact, and accepted attempt writes share a transaction. Duplicate request IDs replay their saved result and reject a different payload.

## Query history and hint retries

`game.recordQuery` accepts only the three documented query procedures and their bounded public response shapes. It locks the active run, stores a `source: query` presentation record, and uses the shared `(runId, requestId)` uniqueness rule for retries. Query results never update clearance, artifacts, room progress, or the power prefix. Authorization and completion read the domain state rather than request history.

Hint disclosure accepts a requested level. The server rejects skipped levels and returns already revealed hints when the same level is retried. The existing schema supports these changes without a migration.

## Commands and environments

```bash
npm run db:generate
npm run db:deploy
node scripts/inspect-db.mjs
```

Generation does not apply migrations. Deployment uses committed migration files through the direct connection. Inspection prints only the table names in the application's own schema.

Test migration changes against an isolated Neon development or disposable test branch before production. Keep automated test data away from production progress. Environment startup installs dependencies and generates the client; it does not automatically migrate production or create another Neon project.

## Remaining verification

The development migration and application health check passed on `codex-dev`. See CLOUD.md for build and integration verification. Production deployment and the remaining campaign milestones are separate work.

## Sources

- [Neon connection guidance](https://neon.com/docs/get-started/connect-neon)
- [Prisma driver adapters](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers)
- Installed Neon skills: preserve the selected ORM, use the Node Postgres driver for a Node server, use pooled runtime connections and direct migration connections.
