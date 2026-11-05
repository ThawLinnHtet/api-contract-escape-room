# Beginner playtest

Status: prepared; no beginner playtest result has been recorded.

## Facilitator setup

Choose someone who knows basic JSON but has not seen the puzzle solutions. Use the intended review build against the isolated development database. Follow README.md to start it; the tester needs only the browser interface. Record the tested commit and browser before starting. The cloud executor disconnected during the Milestone 4 audit, so its new UI fixes and release tests must be recovered and verified before claiming final release acceptance.

Allow about 30 minutes. The PRD's 15–25 minute first-playthrough estimate is a hypothesis to validate, not a measured result. Keep this guide and the solution specification away from the player until the session is finished.

## Read this to the player

“You are inside a broken server. Restore its five systems to escape. Use the clues, procedure contracts, request editor, and responses on the screen. Hints are available whenever you want them, with no penalty. Say what you are trying and what you expect to happen. You do not need developer tools.”

Do not provide the solution order or field values. Observe whether the player can discover the next action from the interface. If they get stuck, first ask what they expected; then point to the existing hint control rather than supplying an answer.

## Observe the journey

- Can the player start without explanation and find the first clue and input contract?
- Do malformed JSON, invalid fields, and incorrect answers lead to a useful next action without losing input?
- Does the player notice earned inventory values and understand how to reuse them?
- Can they distinguish a query from a mutation, find later archive pages, and identify the record requested by the note?
- Do power responses make the preserved sequence understandable after a wrong switch?
- Can they combine the final evidence and understand the recap?
- After one solved room, ask the player to reload. Check that the preserved progress, inventory, hints, and history make sense.
- After completion, ask them to inspect history, cancel restart once, then confirm a fresh run.

Do not force incorrect answers just to satisfy the checklist; record naturally occurring mistakes. Technical regression tests separately cover deliberate invalid requests.

## Ask after the session

1. Where did you feel unsure what to do next?
2. Which contract, response, or hint was hardest to understand? What would you change?
3. What was different about a query and a mutation?
4. Did any control, focus movement, copying action, or layout prevent you from continuing?
5. Did the elapsed time feel appropriate for the amount learned?

A separate optional pass can use keyboard navigation or a narrow viewport. Record the actual input method and device; do not infer physical-device or screen-reader coverage from an automated viewport test.

## Results template

- Date and tested commit:
- Browser, device/viewport, input method:
- Player familiarity with JSON / tRPC / these puzzles:
- Start and finish time; total elapsed:
- Completed without facilitator-supplied solutions: yes / no
- Hints used by room:
- Reload result:
- History and restart result:
- Confusing wording or blocked step (room, procedure, observed behavior, player expectation):
- Player's explanation of query versus mutation:
- Changes needed, severity, and owner:
- Retest result after any changes:

## Acceptance

Record observations from the actual participant. Revise confusing clues, contracts, or recovery copy while preserving the PRD's server rules and answer-disclosure policy. Retest affected steps. Mark the roadmap's beginner-playtest item complete only after that evidence exists. Automated scripted journeys do not satisfy this criterion.
