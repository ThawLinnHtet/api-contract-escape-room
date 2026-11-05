# Milestone 4 release audit

Date: 2026-11-05

Status: in progress, blocked by an unavailable cloud executor. Milestone 4 is not complete. The remote branch initially contains this audit record and PLAYTEST.md only; do not assume it contains the workspace UI fixes described below.

## Evidence collected before the interruption

The last accepted baseline is Milestone 3 (PR #3, merged into main). Its nine browser/API checks, typecheck, and production build are recorded in CLOUD.md. They establish the previous milestone's behavior, not completion of the new release audit.

The current pass read AGENTS.md, PRD.md, ROADMAP.md, DESIGN.md, CLOUD.md, the installed Impeccable audit/craft guidance, and the application/server implementation. It retained the selected Mobbin reference roles in DESIGN.md; no new Mobbin search is claimed.

Axe was run on the rendered baseline in Chromium for new guest, active gateway, invalid JSON, and a 360px error state. Two rule classes were reported in each state:

| Finding | Impact | Observed target |
| --- | --- | --- |
| Label content does not match accessible name | Serious; affects voice and assistive navigation | Brand link and five room buttons; visible room numbers were omitted from their explicit accessible names |
| Heading order skips a level | Moderate; affects heading navigation | Clue heading after the room's main heading |

The scan also returned an incomplete `aria-prohibited-attr` item requiring manual review. The generic timer span's accessible naming was inspected; a semantic timer with live announcements off was included in the workspace fixes. The tablet-width baseline had no horizontal page overflow. Automated scan results do not establish full accessibility conformance.

Baseline captures and raw audit output were written under `/workspace/artifacts/milestone-4` in the cloud workspace. Their current availability depends on executor recovery. They show the baseline, not the updated UI.

## Work written in the cloud workspace, not yet pushed

Before disconnection, the agent wrote:

- Accessible names that include visible room numbers, corrected brand text spacing, and consistent clue/inventory/hint headings.
- A skip link; focus handling for room changes and completion; status updates for start, requests, hints, and copying; a timer with announcements off.
- Keyboard-accessible artifact and JSON-copy actions.
- A native Game options disclosure containing restart, matching DESIGN.md's secondary action placement.
- Targeted reduced-motion styling and a reusable hover color token.
- `tests/release.spec.ts`: a full 360px keyboard-only campaign with Axe scans in multiple states, clipboard actions, dialog focus/escape behavior, reload and restart; public API projection/method checks; touch, contrast, responsive, and doubled-text checks.
- `scripts/check-client-boundary.mjs`: extracts the actual server-only hint/fixture definitions and checks built browser assets for them.
- Package scripts for release tests and boundary checks, and an Axe dev dependency with its lockfile changes.

The UI production build and an intermediate strict typecheck passed before release-test execution. The final release tests, final boundary-check output, updated screenshots, clean-checkout verification, and final combined suite were not obtained. Do not mark these checks passed.

## Executor failure

Starting the release-test server failed with:

`Failed to create unified exec process: exec-server transport disconnected`

A subsequent command failed with:

`No usable execution environment is available. Wait for an environment to become available before using this tool.`

The chat's environment context changed to `unavailable`. The environment status API still reported running/connected with ready variables, but that control-plane result did not restore command execution. No production deployment was attempted.

## Recovery sequence

1. Reconnect/restart the attached cloud environment and inspect the workspace before overwriting anything. The uncommitted fixes may still be present; verify rather than assuming persistence.
2. Fetch `origin/codex/milestone-4-release-audit` to obtain this report and PLAYTEST.md. Reconcile the local branch with those documentation commits while preserving any uncommitted fixes. Do not reset or discard them.
3. Read the current AGENTS.md, PRD.md, DESIGN.md, DATABASE.md, ROADMAP.md, and CLOUD.md. Inspect network policy and runtime readiness without exposing credentials. Keep tests on `codex-dev`.
4. Inspect the UI changes as one batch, then generate the client, typecheck, and build. Run the client-boundary script only after a successful build.
5. Start one current production server with `DATABASE_TRANSPORT=neon-websocket` in this HTTPS-only environment. Stop obsolete servers started by this task when no longer needed; their accumulated processes are not needed for verification.
6. Run the release tests and the relevant regression suite. Existing browser tests were adjusted in the workspace for the new Game options disclosure and room accessible names. Verify those changes before running them.
7. Inspect desktop and narrow-screen captures together. Check labels, contrast, focus, status announcements, solved navigation, long contracts, history, errors, completion, and restart. Record what was measured and what remains untested.
8. Verify documented install/generation/migration/build/start/check commands from a clean checkout using an isolated development target. Do not apply production migrations as part of this audit.
9. Run the beginner session using PLAYTEST.md. Record real observations, revise confusing material, and retest. The user said they can arrange a beginner participant; no result has been received.
10. Update roadmap checkboxes only for passed exit criteria. Push verified source changes to this branch and update the draft PR around the final diff. Keep Milestone 4 pending until all required evidence exists.

## Release gate

The required release evidence includes all ten PRD acceptance criteria, the complete keyboard/narrow-screen journey, public data/bundle boundaries, actual setup reproducibility, and beginner playtesting. None of the still-pending work should be represented as a passed check merely because its test source exists.
