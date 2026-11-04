# Handoff: prop-20261104-3 (unsafe `pricing-action` `detail.href`)

- Status: blocked · Updated: 2026-11-04. Blocked on an owner CRP; the intake is done and nothing is
  implemented.
- Branch / head: task/607d35d183074a7b / base `8ae591b` · PR: none

## Goal

The `pricing-action` detail no longer hands hosts an expanded CTA `href` that fails `isSafeLink`
(INTENT O3, `INTENT.md:62`; a CRP is needed first, `INTENT.md:110-111`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261104-3/intake.md`. It verifies the proposal's evidence and adds
  E7-E14.
- How the raw value reaches the event:
  - `src/element/cta.ts:102-103,109` builds `eventHref` and keeps it, safe or not;
  - `src/element/renderers.ts:362` passes it;
  - `src/element/pricing-renderer-element.ts:771` puts it into the detail;
  - `tests/unit/cta-href.test.ts:38-42` asserts the raw value.
- `docs/events.md:124-125` is unchanged, so P-20261103-2 D1 has not merged.
- `triggerPlanAction` is not in `src/`. Its spec reuses the built-in CTA's event
  (`openspec/changes/add-react-headless/specs/composition/spec.md:268`).
- No check was run: the task has no registered checks and changes no code.

## Decisions

- The CRP recommends option A, "omit `href` when the value is unsafe", not the proposal's B (`hrefSafe`).
  - Reason: the owner note asks for the safest option. Only A and C keep the unsafe value away from every
    host.
  - A also changes one source file (`cta.ts`), which is outside the P3-11 shared-file chains
    (`openspec/changes/add-react-headless/tasks.md:428-447`).
- Two slices, S1 (spec) and S2 (T/I code PR). Reason: one capability; about 60-120 and 70-110 diff lines.
- No feature flag. Reason: one behaviour in one slice, and a flag would keep the unsafe path reachable.
- S2 risk is high (score 8: security area +3, public event field +3, external input +2). This is above the
  proposal's "medium"; the higher level wins.
- The changeset is `minor` and also edits `.changeset/safe-link-other-host-paths.md:5`. Reason: the package
  is at 0.1.0 (`package.json:3`), and the pending changeset would otherwise contradict the new one.

## Ruled out

- Fixing it in `renderers.ts` or `pricing-renderer-element.ts`. Reason: those files are in the P3-11 chain.
  `cta.ts` is the single place where the safe value is computed.
- Rewriting unsafe values to a safe form. Reason: not asked, and it changes the meaning further.
- B as the recommendation. Reason: hosts that do not read `hrefSafe` stay exposed.

## Open questions and risks

- Q1, the behaviour: A, B, C, D or E. Waiting on the owner through a CRP (draft in the intake).
- Q2, where `req~cta-event-href-unsafe~1` lives, given that plan-cta is not archived (E13). Waiting on a
  coordinator note.
- Q3, rewording or dropping P-20261103-2 D1 change 6 if A or C is chosen first. Waiting on a coordinator
  note.
- Risk: an external host relied on the raw value. Mitigation: the changeset says so, and there is no
  release before the owner says so (`ROADMAP.md:169-176`).
- Risk: `docs/events.md` is shared with D1 and with P3-11 → P3-15b. Mitigation: D1, then S2, then P3-11.

## Next three steps

1. The coordinator opens the CRP from the intake section "CRP draft" and answers Q2 and Q3.
2. After the answer, a specifier writes S1 (the new change with the `plan-cta` delta) and runs
   `openspec validate <id> --strict` and `format:check`.
3. The coordinator writes the S2-T and S2-I contracts from the intake section "S2". S2-T shows red on
   `tests/unit/cta-href.test.ts` before S2-I starts.

## Evidence

- Task: this planner intake (task/607d35d183074a7b). Heads: `8ae591b` (base), `f3302b2` (#79). CI: none
  run.
- Related: `docs/agent-work/prop-20261103-2/handoff.md:42-43,50` and
  `docs/agent-work/prop-20261101-3/handoff.md:40`.
- Follow-up ids fc0c65548dc74477, ebb63162e8044ee4 and e336b836e6f244b9 come from the proposal. Only
  fc0c65548dc74477 matches a branch name in the repository (`docs/agent-work/prop-20261103-2/handoff.md:4`).
