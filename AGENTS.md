# Agent instructions

## Read before changing code

- Read PRD.md when implementing gameplay, APIs, persistence, or interface behavior. It is the source of truth for product requirements.
- Read DESIGN.md before implementing UI, responsive layout, or interaction states. Preserve the selected lesson workspace structure and distinguish proposed tokens from visually verified decisions.
- Read DATABASE.md before configuring Prisma, database connections, migrations, or database-backed tests. Neon PostgreSQL is the selected database.
- Read ROADMAP.md before starting a milestone. Implement the earliest unfinished dependency first unless the user requests a specific change.
- Read CLOUD.md when preparing or continuing a cloud chat, configuring environment variables, or verifying Mobbin access. Inspect the actual app and package scripts; the gateway implementation exists and the remaining rooms are planned.

## Project skills

- For frontend work, read .agents/skills/impeccable/SKILL.md and preserve the selected direction in DESIGN.md.
- For Mobbin work, read .agents/skills/best-practices/SKILL.md first and .agents/skills/search/SKILL.md before searches. Verify authentication in the current host; local installation does not establish cloud connectivity.

## Implementation boundaries

- Keep the project focused on learning tRPC. Prefer one application and a small domain layer over separate services or a generic game engine.
- Put puzzle checks, authorization, progression, timestamps, and completion decisions on the server. Return explicit public room data to the client.
- Enforce the active guest run in request context. Derive run ownership from the session cookie rather than trusting a submitted owner or run identifier.
- tRPC procedure names and input types are discoverable. Puzzle correctness must depend on server checks, not hidden endpoints or client-side secrecy.
- Expose the request console through an explicit procedure allowlist. Preserve typed calls at each dispatch branch and validate JSON before submission. Treat input as data.
- Use transactions for mutations that combine puzzle effects, progress, and request history. Keep state scoped to a run and apply the idempotency rules in PRD.md.
- Keep solution data in server-only modules. Keep client-visible contracts and descriptions separate from the solution definitions.

## Working sequence

1. Identify the milestone and its acceptance criteria; inspect existing code and dependencies.
2. Implement the smallest complete path from UI through tRPC to persisted state.
3. Verify the affected behavior, including applicable authorization and progression failure cases.
4. Run the relevant available type, lint, and test checks. Report results and any checks that could not run.
5. Update roadmap checkboxes only when their exit criteria pass. Update product documentation when the user approves a scope change.

## Quality bar

- Use strict TypeScript and shared Zod schemas where appropriate. Keep transport concerns in routers and puzzle transitions in testable domain functions.
- Use structured outcome codes for expected puzzle results. Reserve transport errors for invalid requests, missing sessions, unauthorized access, and unexpected failures.
- Preserve useful loading, validation, failure, and retry states. Make the complete game keyboard accessible.
- Test meaningful behavior: session isolation, room locking, ordered transitions, duplicate submissions, restart isolation, and final completion. Avoid tests that only repeat static labels or implementation details.
- Obtain compatible current package versions during setup; record reproducible scripts in package.json and commit the selected package manager's lockfile.

## Handoff

Summarize what works, which milestone criteria passed, commands run, and any unfinished work. Describe planned features as planned until they have been implemented and verified.
