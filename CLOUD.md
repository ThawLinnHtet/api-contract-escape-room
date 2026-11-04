# Cloud environment handoff

Prepared: 2026-11-04

## Current state

- The repository contains a Next.js, tRPC, and Prisma gateway-room implementation plus the full campaign plan.
- Impeccable 4.8.0 is installed inside `.agents/skills/impeccable`, with project hooks under `.codex/hooks.json`. Its Windows engine answered `impeccable-engine 0.1.18`. Platform binaries are ignored; the portable launcher can obtain the Linux engine.
- Official Mobbin skills are installed in `.agents/skills`. The remote MCP declaration is in `.codex/config.toml`.
- Neon CLI initialization and `neon deploy` succeeded for project `billowing-bread-81133505`, branch `production`. Only Postgres is configured in neon.ts.
- Local database credentials stay in the ignored `.env.local`. They are not in GitHub and are not automatically transferred to a cloud environment.
- Local `npm run build` passed on 2026-11-04: Next.js compiled successfully, completed TypeScript checks, and generated all four static pages. The local typecheck also passed. The initial migration is committed under `prisma/migrations`. A read-only production inspection found no tables in the `escape_room` schema on 2026-11-04. Migration application and end-to-end verification remain outstanding.
- No cloud environment for this repository has been published, and no new cloud chat has been created yet. Browser automation stopped because it could not verify the current browser URL. The two environments accessible from the app tools belong to a different repository.

## Create the environment

In Settings > Codex Cloud > Environments, create a private environment for this repository and its main branch. Use Node.js 24. Select the project's private environment variables from your personal vault or enter them in the environment configuration:

| Key | Required value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL for application traffic |
| `DATABASE_URL_UNPOOLED` | Direct URL to the same branch/database for migrations |
| `NEON_BRANCH` | Name of the branch represented by those URLs |

These Postgres URLs must be available directly to the application process, rather than substituted into HTTPS requests as HTTP network secrets. Prefer a dedicated development Neon branch for coding and automated tests. Keep the already linked production target for deliberate deployment steps.

Set the install command to:

```bash
bash scripts/cloud-setup.sh
```

The script installs locked dependencies, generates Prisma Client, installs Chromium, and bootstraps the Linux Impeccable engine. It deliberately does not migrate production during environment startup.

The runtime needs the npm registry, GitHub release downloads for the Impeccable engine, Playwright's browser downloads, the selected Neon endpoint, and Mobbin's remote service. Configure network access through the cloud environment UI. In a managed environment, inspect its network-policy snapshot and readiness before assuming database TCP or MCP access works.

Save the tested configuration and publish the environment. The app's new-chat tool can start a cloud chat only after this repository has a runnable saved environment ID. Keep this environment private.

## Start the app and finish Neon verification

After the install command succeeds:

1. Check that the active URLs target the intended branch without printing their values.
2. Test the initial migration against an isolated Neon branch before production. The temporary branch from the earlier local attempt may have expired; verify before reusing it.
3. Apply the migration to the intended development target with `npm run db:deploy`.
4. Run `npm run typecheck` and `npm run build`.
5. Start the built app with `npm run start -- --hostname 0.0.0.0 --port 3100`.
6. Check `/api/health`, then run `BASE_URL=http://127.0.0.1:3100 npm run test:e2e` against the isolated test target.
7. Record the build and test output. Verify saved progress through a browser reload; verify duplicate submissions, guest isolation, and restart isolation. Apply the reviewed migration to production as a separate explicit deployment step.

Playwright selects installed Chrome on Windows and its managed Chromium on Linux. Four browser/API integration tests are included. Their results are pending until they actually run.

## Mobbin verification

The preferred route in a hosted cloud chat is the connected Mobbin plugin. This local chat already used it to inspect the references in DESIGN.md. Account connection and tool availability must be checked in the new cloud chat; repository installation alone does not prove either.

For Codex hosts that load trusted project MCP configuration, the repository declares `https://api.mobbin.com/mcp`. Mobbin uses OAuth. Keep OAuth credentials out of this repository. If using the Codex CLI on such a host, inspect `codex mcp list` and complete the supported `codex mcp login mobbin --no-browser` flow when authentication is needed. Hosted chats should use the plugin's own connection flow instead.

Read `.agents/skills/best-practices/SKILL.md`, then `.agents/skills/search/SKILL.md` before the verification search. Search for a web coding-lesson workspace, inspect a returned image, and return its actual Mobbin screen link. A successful authenticated search in that cloud chat is the acceptance criterion. An unauthenticated HTTP response, an installed skill, or a configured server URL is not a pass. If tools are missing or authentication is refused, report the exact blocker.

## New cloud chat prompt

Continue API Contract Escape Room from this repository. Read AGENTS.md, CLOUD.md, PRD.md, DESIGN.md, DATABASE.md, and ROADMAP.md. The user chose a Codecademy lesson workspace with Postman request controls and Railway dark surfaces. Impeccable and Mobbin skills are installed locally. Start by checking environment/network readiness and making an authenticated Mobbin search; show the returned screen link. Verify the configured Neon target without printing credentials. Finish the initial schema migration and required build/browser checks described in CLOUD.md. Report actual command results and blockers. The current build implements only the gateway room; the remaining campaign is planned, and the roadmap must stay unchecked until its exit criteria are verified. Continue the user's earlier Neon setup request without creating another Neon project or adding unrelated services.

## References

- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
- [MCP configuration and hosted plugin behavior](https://learn.chatgpt.com/docs/extend/mcp)
- [Official Mobbin skills and setup](https://github.com/mobbin/skills)
- [Mobbin remote MCP configuration](https://github.com/mobbin/mobbin-mcp-server)
