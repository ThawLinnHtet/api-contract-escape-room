# Design direction

Selected: 2026-11-03  
Status: user selected the Codecademy lesson layout, supported by Postman request controls and Railway dark surfaces. All five rooms use the workspace. Desktop gateway/archive/completion and 360px gateway screenshots were inspected on 2026-11-05. Tokens below were retained through this visual check; the full release accessibility audit remains pending.

## Purpose

The main screen is a workspace for solving one API puzzle at a time. Keep the room's clue, request input, and response close enough to compare without losing context. The primary action is Send request. Product behavior, room content, and progression rules remain defined in PRD.md.

## Mobbin references

| Reference | Observed pattern | Adaptation for this project |
| --- | --- | --- |
| [Codecademy lesson workspace](https://mobbin.com/screens/663ff85f-d9db-48b2-bc24-b758c9eb7ed6) | Lesson navigation alongside an editor and preview | Primary layout: rooms and clues beside a request editor and response viewer |
| [Postman request workspace](https://mobbin.com/screens/58e9fd16-eeb8-4a7b-9b71-bb3c466a2bc7) | Request configuration above a separate response area, with a visible Send action | Procedure selection, input editing, explicit submission, and response inspection |
| [Railway workspace](https://mobbin.com/screens/f0f3bdde-1afd-4a81-985e-a44650977893) | Dark canvas, bordered panels, compact status indicators | Dark surface hierarchy, fine separators, and restrained state colors; use the surface treatment rather than the graph layout |
| [Vapi request history](https://mobbin.com/screens/395abbd5-9340-4079-9319-92d9c5d443b4) | Expandable request entries with method labels, outcomes, and JSON detail | Collapsible attempt history with procedure, outcome, time, and input/response details |

These are screen references inspected through Mobbin. They are not imported component libraries, and their screenshots do not establish exact color or spacing values. Use our own labels, game content, tokens, and CSS components.

## Main workspace

Use three adjacent areas on a wide screen:

1. **Rooms and brief:** a compact five-room list, active room title, objective, clue, earned artifacts, and optional hints. Label rooms Current, Locked, or Solved with text and icons. Keep unrelated account and project navigation out of this single-campaign workspace.
2. **Request editor:** procedure selector, Query or Mutation label, readable contract, collapsible syntax example, labeled JSON textarea, and Send request. Keep the contract visible while editing. Example values must follow the PRD's answer-disclosure rules.
3. **Response inspector:** latest outcome and explanation above formatted JSON. Use Response and History tabs, with the latest response selected after submission. A solved result includes the awarded artifact and an explicit Continue action.

A slim header carries the game title, textual campaign progress such as 1 of 5 rooms solved, and elapsed time. Restart sits in a secondary menu and opens the PRD-required confirmation. The timer is informational.

On first entry, show room 1, its clue, a valid input template with an unsolved placeholder value, and an empty response message: "Send a request to inspect the response." Keep the clue available while a response is displayed. Never submit or advance automatically.

## Responsive behavior

- At approximately 1200px and wider, show the three areas together. Start with a 280px brief column and divide remaining space between flexible editor and response columns. Use content fit to refine the breakpoint.
- At intermediate widths, retain a compact brief sidebar and stack request and response in the remaining area.
- At narrow widths, stack progress, room navigation, brief, request, and response in reading order. Expand the current room brief by default. Use ordinary page scrolling rather than three nested scrolling panels.
- At 360px, controls and prose must fit the viewport. Confine horizontal scrolling to code blocks when wrapping would obscure the data. Keep response and error feedback reachable after submission without stealing keyboard focus.

## Initial token proposals

Implement as named CSS custom properties using the PRD's plain CSS or CSS Modules approach. Check actual contrast, density, and readability in rendered screens before treating these values as final.

| Token | Starting value | Use |
| --- | --- | --- |
| `--bg` | `#101416` | Page background |
| `--surface` | `#171E21` | Workspace panels |
| `--surface-raised` | `#202A2E` | Menus, selected rows, and history details |
| `--border` | `#35464C` | Decorative separators; verify stronger borders for controls |
| `--text` | `#EDF3F4` | Body text and headings |
| `--text-muted` | `#A6B6BC` | Supporting descriptions and metadata |
| `--accent` | `#64D8C5` | Primary action, active selection, and focus treatment |
| `--on-accent` | `#10201D` | Text on filled accent buttons |
| `--success` | `#91D6A0` | Solved state, paired with a label and icon |
| `--warning` | `#EBC17B` | Hints and incorrect-answer feedback |
| `--danger` | `#F29A9A` | Validation errors and failed requests |

- Body and controls: a system sans-serif stack, starting at 16px for prose and 14px for compact controls. Keep readable line height around 1.5.
- Contracts and JSON: a system monospace stack, starting at 14px with line height around 1.6. Font choice should not require a third-party download.
- Spacing scale: 4, 8, 12, 16, 24, and 32px. Start with 24px panel padding on wide screens and 16px on narrow screens.
- Corners: approximately 6px for controls and 8px for dialogs. Let layout separators define the workspace instead of wrapping every section in a card.
- Use a visible keyboard focus ring with adequate contrast. Make primary actions at least 44px high and keep focus distinguishable from selection.

## Component and state rules

- **Room navigation:** current room is distinct from solved rooms. Locked rooms expose their lock status; the server still enforces access.
- **Procedure selector and contract:** show the allowed procedure name and documented input constraints. Keep transport metadata outside the puzzle editor.
- **Editor:** preserve text through validation failures and network errors. Provide an accessible field label and associate field-specific errors with the input.
- **Send action:** disabled while that tab's request is pending; show "Sending...". On completion, update the response and announce a short status without unexpectedly moving focus.
- **Incorrect answer:** describe a valid request with an unsolved puzzle as an expected outcome. Preserve prior progress and use the server's hint-safe message.
- **Failure:** distinguish malformed JSON, schema errors, session problems, and network failures. Provide recovery appropriate to the actual error.
- **Hint disclosure:** expose the next authored hint as a labeled action and retain earlier revealed hints. Hint content follows PRD.md.
- **History:** collapsed rows remain readable through procedure and outcome text. Treat public query history as presentation data, as specified in the PRD.
- **Solved state:** show success text, the earned artifact, and Continue. Preserve the response for inspection instead of replacing the workspace with a full-screen celebration.
- **Completion:** replace the active puzzle area with the recap while preserving access to recorded attempts.

Use subtle transitions only when they clarify state changes. Honor reduced-motion preferences. Keep the terminal influence in code typography, disciplined spacing, and status language; preserve ordinary readable interface text.

## Visual verification before release

Inspect a typical room, a long contract, multiline JSON, validation feedback, a solved room, and expanded history on desktop and at 360px width. Verify keyboard operation, visible focus, text and control contrast, response announcements, and no horizontal page overflow. Design checks supplement the PRD's gameplay acceptance criteria.

## Current boundary

The selected layout and palette are implemented. The recorded desktop and narrow-screen captures verify the shown states. Full keyboard, contrast, and release acceptance checks remain tracked in Milestone 4.

## Campaign implementation check — 2026-11-05

Retained the three-pane lesson workspace and existing palette. Compact room rows bring the clue into the desktop viewport. Locked rooms are disabled with explicit labels; solved rooms retain navigation and gain check marks. Each room has its own allowlisted procedures, public contracts, and input templates. A successful solve offers Continue without replacing the response. Completion shows saved elapsed time and a brief explanation of each room’s API concept. Inventory values remain selectable. At 360px, navigation becomes a five-step row and the content stacks without page overflow.

Rendered evidence is saved under `/workspace/artifacts/milestone-2` in this cloud workspace. These captures verify the shown states, not a completed release audit.

## Recovery and recap implementation — 2026-11-05

The Milestone 3 changes follow the existing reference roles: Codecademy keeps the room brief beside the workspace; Postman keeps procedure selection, contracts, editing, and explicit submission together; Vapi informs expandable history rows; Railway informs the retained dark surfaces and fine separators. No new Mobbin search or imported component library is claimed for this pass. Impeccable guidance was read from the installed skill, including its polish and craft-floor references; the unavailable context launcher was handled by reading project context directly.

Query history uses the same expandable rows as mutation history, with explicit Query labels. A failed save leaves the response visible, adds a not-saved row, and offers Retry saving history without rerunning the query. On completion, the editor pane becomes a recap with plain label/value rows for rooms restored, elapsed time, hints used, and saved requests. The inspector and room navigation remain available for reviewing the run. These additions reuse the existing tokens, typography, controls, and separators.

Milestone 3 rendered evidence is under `/workspace/artifacts/milestone-3`: completion and history-recovery screens are captured on desktop and at 360px. The completion brief reflects the restored state, and the hint control returns when a solved room is revisited. Final browser checks verify recap counts/time after reload and query-history recovery without reissuing the query.
