# Database configuration

Selected database: Neon PostgreSQL  
Runtime: Next.js Node.js routes, Prisma 7.10.1, `@prisma/adapter-pg`, and `pg`  
Last checked: 2026-11-04

## Provisioning state

The project was linked using the user's requested organization `org-rough-tree-19286185`, project `billowing-bread-81133505`, and `production` branch. `neon deploy` completed successfully and pulled `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` into the ignored local `.env.local`. Only Postgres is declared; Auth, Storage, Functions, and AI services were not added.

The app code is wired to those environment names. The initial schema migration is generated but production application remains pending: the latest read-only inspection found no tables in the `escape_room` schema. Build and browser evidence must be recorded after actual verification; consult CLOUD.md for the handoff.

## Architecture

Browser -> tRPC -> server domain functions -> Prisma -> Neon PostgreSQL.

The Node.js runtime uses Prisma's `pg` adapter with a small reused pool. This supports the interactive transactions required for progress and history. The earlier planning suggestion of `@prisma/adapter-neon` was replaced with the Node driver during implementation. If the destination environment restricts TCP, inspect its network policy and select a supported connection method with full transaction support before claiming connectivity.

## Environment variables

| Variable | Consumer |
| --- | --- |
| `DATABASE_URL` | Pooled runtime connection, used by `src/server/db.ts` |
| `DATABASE_URL_UNPOOLED` | Direct migration connection, used by `prisma.config.ts` |
| `NEON_BRANCH` | Human-readable branch identity from Neon CLI |

Both URLs must refer to the same intended branch and database. Keep the connection's TLS settings. `.env.example` contains placeholders; real URLs belong in ignored local files or private cloud environment variables. The cloud setup does not inherit local OAuth or database credentials automatically.

## Schema ownership

`prisma/schema.prisma` defines GuestSession, GameRun, RoomProgress, Artifact, and RequestAttempt. All models belong to the `escape_room` PostgreSQL schema. Runtime adapter configuration selects that schema; migration configuration derives the same schema from the direct URL without changing the stored Neon credentials.

The initial migration qualifies application table names and wraps its statements in a transaction. It adds the five tables, their foreign keys, uniqueness constraints, and query indexes. PRD.md owns gameplay semantics and the full model's purpose.

Guest cookie values are hashed before persistence. Domain mutations lock the guest's active-run selection so restart and puzzle retries are serialized. Gateway result, progress, artifact, and accepted attempt writes share a transaction. Duplicate request IDs replay their saved result and reject a different payload.

## Commands and environments

```bash
npm run db:generate
npm run db:deploy
node scripts/inspect-db.mjs
```

Generation does not apply migrations. Deployment uses committed migration files through the direct connection. Inspection prints only the table names in the application's own schema.

Test migration changes against an isolated Neon development or disposable test branch before production. Keep automated test data away from production progress. Environment startup installs dependencies and generates the client; it does not automatically migrate production or create another Neon project.

## Remaining verification

Apply the migration to the intended isolated target, build the app, start it, and run the four integration tests. These exercise Postgres health, browser persistence, hints and history, duplicate mutations, guest ownership, restart isolation, and narrow-screen behavior. Then apply the reviewed migration to production and verify the intended user flow there. Record actual command output and distinguish each target.

## Sources

- [Neon connection guidance](https://neon.com/docs/get-started/connect-neon)
- [Prisma driver adapters](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers)
- Installed Neon skills: preserve the selected ORM, use the Node Postgres driver for a Node server, use pooled runtime connections and direct migration connections.
