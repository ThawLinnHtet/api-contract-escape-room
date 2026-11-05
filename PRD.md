# API Contract Escape Room — Product Requirements

Status: approved concept; Milestones 1 and 2 implemented and verified on codex-dev
Created: 2026-11-03  
Working title: API Contract Escape Room

## 1. Purpose

Build a single-player browser puzzle game for developers learning typed APIs. The player is trapped inside a broken server and must restore five systems to escape. Each room introduces a different API interaction and contributes evidence needed later.

The project is also a learning exercise for its builder: tRPC should handle real application boundaries, validation, session context, middleware, queries, mutations, and client cache updates.

Success means a first-time player can finish all five rooms using the visible contracts, clues, responses, and optional hints, without opening developer tools or guessing undocumented field names. A first playthrough should target roughly 15–25 minutes; validate that estimate with playtesting.

## 2. Audience and learning goals

Players know basic JSON and programming concepts. They do not need prior tRPC knowledge: the game teaches API reasoning, while the codebase demonstrates tRPC implementation.

The MVP teaches input shapes, useful validation feedback, session-based permissions, filtering and pagination, ordered state changes, and combining evidence. The finish screen connects each room to the corresponding implementation concept in plain language.

## 3. Core loop and interface

1. Start a guest run and enter the active room.
2. Read its story, objective, public procedure contracts, and clues.
3. Select an allowed procedure and edit its JSON input.
4. Submit the request and inspect the structured response.
5. Use the result or a hint to adjust the next request.
6. Solve the room, collect its artifact, and continue.

The desktop interface has a progress strip, room brief, procedure selector, JSON textarea, send button, and response/history panel. On narrow screens these stack vertically. Use a restrained terminal style with readable text, clear status labels, and color-independent feedback.

Each procedure card shows its name, purpose, input fields and constraints, and a valid example shape. Examples explain syntax without revealing puzzle answers. Display JSON parse errors before sending and field-specific server validation errors after sending. Preserve the player's input on errors.

Use a textarea initially. Arbitrary JavaScript execution, a real shell, and a general-purpose API proxy are outside scope.

## 4. MVP scope

Included:

- One fixed campaign containing five rooms.
- Guest session, one active run per session, and reload-safe progress.
- Public API contracts, editable JSON requests, and structured responses.
- Persistent request history, room artifacts, and a numbered hint ladder.
- Restart with confirmation, final recap, and elapsed completion time.
- Responsive layout, keyboard operation, and accessible status updates.

Deferred:

- User accounts, public leaderboards, multiplayer, subscriptions, and chat.
- AI-generated puzzles, custom campaign editors, and user-authored code execution.
- Payments, badges, social sharing, and deployment infrastructure.

## 5. Campaign specification

Fixture answers are intentionally deterministic for reproducible learning. Place the actual solution fixtures on the server; client bundles receive only public room content and earned artifacts. Casual inspection resistance is sufficient: this is a learning game, not a competitive anti-cheat system.

### Room 1: The Locked Gateway

- Objective: restore the outer gateway.
- Public procedure: `gateway.unlock`, mutation, input `{ accessCode: string }` with exactly four digits.
- Clue: an incident plaque says the server was commissioned in 1991.
- Solution fixture: `1991`.
- Success: mark room solved and award the gateway receipt, a server-generated credential associated with this run.
- Learning: the difference between a valid input shape and a correct domain answer.

### Room 2: Identity Vault

- Objective: elevate the run's simulated clearance to archivist.
- Public procedures: `identity.status`, query with no input; `identity.claim`, mutation with `{ credential: string }`.
- Clue: present the gateway receipt awarded in room 1.
- Server rule: validate the credential against the current run before recording clearance. This gameplay credential is separate from the actual guest session cookie.
- Success: unlock the archive and award the vault seal.
- Learning: request context, permission middleware, and session-scoped state.

### Room 3: Broken Archive

- Objective: find the missing maintenance key in a paginated archive.
- Public procedures: `archive.search`, query with `{ tag: string, cursor?: string }`; `archive.recover`, mutation with `{ recordId: string }`.
- Contract: tags have a documented format, results contain three records per page, and responses expose `nextCursor` when another page exists. Cursors are opaque and scoped to the run and filter.
- Clue: the room brief names the `maintenance` tag. A readable repair note appears beyond the first page and identifies the required key record.
- Server rule: archive access requires archivist clearance. Recovery accepts the designated fixture record for this run.
- Success: award the maintenance key and unlock the power grid. Keep the archive available for revisiting.
- Learning: protected queries, pagination, filtering, and query-versus-mutation responsibilities. Queries never advance progress or append request records.

### Room 4: Power Grid

- Objective: activate three switches in the correct order.
- Public procedures: `power.status`, query with no input; `power.activate`, mutation with `{ switchId: string }`.
- Visible switch IDs: `cooling`, `core`, and `uplink`. Clue: stabilize cooling before booting the core, then reconnect communications.
- Required order: cooling, core, uplink. A wrong next switch returns a helpful domain outcome and preserves the existing prefix. Activating an already completed switch is a harmless no-op.
- Server rule: validate the expected next switch and update the sequence atomically. Concurrent calls cannot skip a transition.
- Success: award the power checksum and unlock the control room.
- Learning: state transitions, transactions, and duplicate-safe mutations.

### Room 5: Control Room

- Objective: combine the evidence and restore the server.
- Public procedure: `control.restore`, mutation with `{ vaultSeal: string, maintenanceKey: string, powerChecksum: string }`.
- Clue: the final contract explicitly names the three artifacts required. All earned values remain visible in the inventory.
- Server rule: compare artifacts with this run's values and require all preceding rooms to be solved.
- Success: set completion time once and show the recap. Repeating the request returns the existing completion result.
- Learning: authorization, composition, and server-authoritative completion.

## 6. Shared behavior and API boundaries

### Sessions and progress

Create a guest session with an opaque cookie identifier and persist its active run. Use HttpOnly and SameSite cookie settings, plus Secure when served over HTTPS. A run identifier alone grants no access. Refreshing resumes the active run while the cookie remains available; cross-device recovery is deferred.

Rooms unlock sequentially. Solved rooms remain readable. Requests to future rooms are rejected on the server even if a caller bypasses the UI. Restart creates a new run with fresh state and artifacts, retaining no access to the old run through the active UI. Requests carrying the old run ID must fail after restart.

Session and run creation must be explicit actions, rather than side effects of a query. Create the guest session through a same-origin server entry point before initializing the run context. Mutation requests must enforce the configured same-origin protections; never use state-changing GET requests.

### Contracts and dispatch

The console chooses from an explicit typed dispatch map of puzzle procedures. It never interprets arbitrary paths, code, or URLs. Inspectable procedure names are expected. Public contracts are educational content, not secrets or a substitute for server validation.

Keep application procedures for run creation, progress, hints, history, and restart separate from the console's puzzle procedure list. Use a small mutation envelope containing `{ runId, requestId, input }`: runId rejects stale tabs; requestId enables safe retries. Display the puzzle input shape, not this transport metadata, in the editor.

Puzzle outcomes use a stable structure with `outcome`, `message`, and optional public `data`. Suggested outcomes: `INCORRECT`, `PROGRESS`, `SOLVED`, and `ALREADY_APPLIED`. Invalid input uses normal validation errors. Missing session, locked room, and unauthorized run access are transport errors. Keep internal details out of error responses.

After a successful mutation, refresh affected progress, inventory, and history queries. A failed request preserves the current input and allows retry.

### Request history and retry behavior

Persist accepted, schema-valid puzzle mutation attempts, including incorrect domain answers. Record their procedure, submitted puzzle input, public response, server timestamp, and duration. Store the history record in the same transaction as any state change. Use a unique `(runId, requestId)` pair and replay the stored result for identical retries; reject reuse with a different payload. A fresh request ID may log a new attempt, but solved rooms and awarded artifacts remain unchanged.

Persist query attempts through a separate idempotent history mutation after the query completes. Record only allowlisted procedure names and bounded public display payloads; treat these records as untrusted presentation history, never as gameplay evidence. Show queries locally even if saving their history fails. JSON parse errors, validation failures, and rejected transport requests can stay local and need not survive reload. Never store session cookies in history.

Show the latest 20 entries with pagination for older records. Limit input size to 8 KB, paginate archive content, and cap stored public history payload sizes. During a pending request, disable duplicate submission in that tab; server correctness still handles retries and multiple tabs.

### Hints and completion

Each room has three authored hints: a conceptual nudge, a concrete direction, and a near-solution example. Reveal them in order through a mutation, persist the revealed level, and keep earlier hints available. Hints are optional and have no score penalty. Answers remain on the server until revealed as hints or earned artifacts.

Compute elapsed time from server timestamps for run start and completion; time continues while the browser is closed. The recap shows rooms completed, elapsed time, hints used, request history, and one short explanation of each room's API concept. There is no ranking or speed penalty.

## 7. Initial data model

Database decision: Neon PostgreSQL with Prisma. Use DATABASE.md for connection configuration, environment separation, and migration workflow. The schema migration and gateway end-to-end verification passed on the isolated codex-dev branch. Production deployment and the remaining recovery and release acceptance work are pending.

| Entity | Purpose and key fields |
| --- | --- |
| GuestSession | Opaque session identifier, active run reference, created timestamp |
| GameRun | Session reference, campaign version, start/completion timestamps, clearance, sequence revision |
| RoomProgress | Run and room references, solved timestamp, revealed hint level; unique per run/room |
| Artifact | Run reference, artifact kind and value; unique per run/kind |
| RequestAttempt | Run reference, request ID, procedure, bounded public input/output, source, timestamp, duration |

Static room content and archive fixtures live in versioned server definitions. Public room projections contain only explicitly selected fields. Bind a run to a campaign version so content changes cannot silently invalidate saved progress. Keep definitions for any version with active runs; migration behavior can be designed later.

## 8. Verification and acceptance

The MVP is complete when:

1. A new guest can finish all rooms using the displayed contracts and clues.
2. Reload preserves progress, inventory, hints, and persisted history.
3. Malformed JSON and invalid input produce actionable feedback without losing text.
4. Guessing a later procedure or submitting another run's ID cannot bypass progression or ownership.
5. Incorrect answers preserve valid progress and never award artifacts.
6. Retrying a mutation is safe, and concurrent power requests cannot violate sequence order.
7. Restart isolates the new run and rejects stale requests from the previous one.
8. Completion is recorded once; the recap accurately reflects server state.
9. The complete journey works with the keyboard and on a 360px-wide viewport without horizontal page overflow.
10. Client responses and production bundles contain only intentionally public content, revealed hints, and earned artifacts.

Use domain tests for puzzle transitions, tRPC integration tests for validation and permissions, and one browser journey for start-to-finish persistence and restart. Add targeted regression cases when failures reveal meaningful gaps.
