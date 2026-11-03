# Handoff: prop-20261103-2 (stale link-safety notes, unchecked `detail.href`)

- Status: waiting-review (intake done; nothing implemented) · Updated: 2026-11-03
- Branch / head: task/fc0c65548dc74477 / base `c0c926d` · PR: none

## Goal

The add-react-headless plan notes match `isSafeLink` since #79, and `docs/events.md` says that
`pricing-action` `detail.href` is unchecked and that hosts check it with `isSafeLink` (INTENT O3).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261103-2/intake.md`. It verifies the proposal's evidence (E1-E6)
  and adds E7-E12.
- Stale today:
  - `openspec/changes/add-react-headless/tasks.md:384-387` and `:482-488`;
  - `docs/agent-work/phase3-react-headless/handoff.md:14`;
  - the ticks of P3-1T (`tasks.md:75`) and P3-1I (`:84`).
- Code facts:
  - `src/core/view-model.ts:604-605` rejects `//host` and `/\host`, with tests at
    `tests/unit/cta-href.test.ts:70-87` (#79, `f3302b2`).
  - `src/element/cta.ts:102-109` and `src/element/renderers.ts:362` put the unchecked expanded value into the
    event, as `tests/unit/cta-href.test.ts:38-42` shows.
  - CTA hrefs can come from the pricing document (`src/core/view-model.ts:273`).
- No check was run: the task has no registered checks and changes no code.

## Decisions

- One slice, D1 (doc-steward, risk low, about 20-35 lines). Reason: one capability, three small files, no
  code. The split D1a/D1b is ready if Q1 needs it.
- The `docs/events.md` sentence goes into the `href` bullet at `:124-125`, not after `:173`. Reason: that is
  the field description. It already says "check it", and its "as configured but trimmed" leaves out the
  expansion stated at `:136-140`.
- `tasks.md:400-401` and `:408-410` keep their wording. Reason: "may point to another host" is still true
  for `https://` links (`docs/events.md:172-173`).
- No changeset. Reason: `docs/` is not shipped (`package.json:68-75`), and the rule at `tasks.md:5-7` asks
  for one only when `src/` or `package.json` changes.
- No feature flag. Reason: no behaviour change.

## Ruled out

- Changing `detail.href` itself (drop or flag unsafe values). Reason: a public event field and the
  additive-only rule (`tasks.md:15`). It goes to a separate proposal (intake Q3).
- Leaving the fix to P3-15b. Reason: P3-13 and P3-14 read the notes first (`tasks.md:378`, `:396`, `:412`).

## Open questions and risks

- Q1, who owns `tasks.md` and the phase-3 handoff for this edit. Waiting on a coordinator note.
- Q2, whether an OpenSpec change of its own is needed. Recommended: no. Waiting on a coordinator note.
- Q3, the unsafe `detail.href` behaviour. A followup proposal and an owner decision; not this work.
- Followup ids b04f8bdbd6704018, ebb63162e8044ee4 and e336b836e6f244b9 are not found in the repository and
  are not verified.
- Risk: `docs/events.md` is shared with the P3-11 → P3-15b chain (`tasks.md:445`). Serialize D1 first.

## Next three steps

1. The coordinator answers Q1 and Q2, then writes the D1 contract (or the D1a/D1b contracts) from the intake
   section "Slices". It registers the four checks listed there.
2. A doc-steward makes changes 1-6 of D1, limited to the listed lines, and runs the checks through qa_run.
3. One reviewer checks the `detail.href` bullet against `src/element/cta.ts:102-109`. Merge before P3-13 and
   P3-14 start.

## Evidence

- Tasks: this planner intake (task/fc0c65548dc74477). Heads: `c0c926d` (base), `f3302b2` (#79), `ee91c18`
  (#74, per `ROADMAP.md:199`). CI: none run.
