# Intake: P-20261103-2, correct the stale link-safety notes and document that `detail.href` is not checked

- Origin: proposal P-20261103-2 (kind docs, size S, risk low), approved by the owner. Planner intake,
  2026-11-03.
- Base: HEAD `c0c926d` of the task branch `task/fc0c65548dc74477`. Every `file:line` below is at this base.
- INTENT link: O3, "a stable public API and package across the integrations" (`INTENT.md`, section
  "Objectives", O3; `ROADMAP.md`, objective list).
- No release and no changeset (E11).

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, stale notes in `openspec/changes/add-react-headless/tasks.md`. **R.**
  - `:384-387`: "(a protocol-relative `//host` value is accepted today, `docs/events.md:170`)" and "The
    `isSafeLink` hardening stays a followup slice after an owner decision". `docs/events.md:170` now says the
    opposite ("`//host` and `/\host` are not safe").
  - `:482-488`: "`isSafeLink` (`src/core/view-model.ts:600-605`) accepts `//host` and `/\host` ... and it
    does not drop tab, CR and LF before the check". Both halves are stale (E3).
  - `:400-401` and `:408-410` are **not wrong**. "May point to another host" is still true: an absolute
    `https://` link to another host is still safe (`docs/events.md:172-173`). They only refer to P3-13
    ("as in P3-13"), so they read correctly once `:384-387` is fixed. D1 gives them a small optional change
    only.
- E2, `docs/agent-work/phase3-react-headless/handoff.md:14`. **R.** "The isSafeLink `//host` hardening is a
  followup that needs an owner decision."
- E3, the code rejects these values. **R.**
  - `src/core/view-model.ts:604-605` returns `false` when the value, with tab, CR and LF removed, starts with
    two characters that are each `/` or `\`.
  - `tests/unit/cta-href.test.ts:70-87` lists `//evil.example`, `/\evil.example` and the tab, CR and LF
    variants as rejected.
  - Commit `f3302b2` "Reject //host and /\host in isSafeLink (#79)" is in the branch history (git status at
    the start of the session).
  - `.changeset/safe-link-other-host-paths.md:5` records it.
- E4, the unchecked value reaches the event. **R** for the code, **P** for the docs.
  - `src/element/cta.ts:102` builds `eventHref` with `expandCtaHref`. `:103` keeps `href` only when
    `isSafeLink` accepts it. `:109` always adds `eventHref`.
  - `src/element/renderers.ts:362` passes `cta.eventHref` to `triggerAction`, so the value goes into the
    `pricing-action` detail also when the CTA renders as a button.
  - `tests/unit/cta-href.test.ts:38-42` asserts this for `//evil.example/{planId}`: `href` is `undefined`,
    `eventHref` is `//evil.example/pro%20plus%2Fx`.
  - Docs, partly: `docs/events.md:169-178` does not mention it, as the proposal says. But
    `docs/events.md:124-125` already says "check it before you use it". It does not say that the value is
    unchecked, or that it is also present when the CTA renders as a button. It calls the value "as
    configured but trimmed", while `:136-140` says it is the value after the `{planId}` expansion. The code
    does both: `asString` trims (`src/core/utils.ts:11-13`, used at `src/core/view-model.ts:69`), and then
    `expandCtaHref` expands (`src/element/cta.ts:58-60`).
- E5, followups b04f8bdbd6704018, ebb63162e8044ee4 and e336b836e6f244b9. **Not verified.** A grep of the
  repository for the three ids returned 0 matches.
- E6, P3-1T and P3-1I are unticked although #74 merged them. **R.**
  - `tasks.md:75` and `:84` are `- [ ]`.
  - `ROADMAP.md:199`: "First code slice P3-1: #74, `ee91c18`, `.changeset/core-selection-logic.md`".
  - The P3-1T files exist: `tests/unit/selection-change.test.ts`, `tests/unit/price-stabilizer.test.ts`.
  - The P3-1I files exist: `src/core/selection-change.ts`, `src/core/price-stabilizer.ts`,
    `.changeset/core-selection-logic.md`.
  - `tasks.md:89-90` already cites "the PR 74 review" for the P3-1I hardening.
- E7, not in the proposal: the CTA `href` is also external input. `presentation.ctas` comes from host props
  and from the pricing document's `custom.pricingRenderer` (`src/core/view-model.ts:273`, normalized at
  `:52-78`). A pricing document can therefore put a `javascript:` or `//host` value into `detail.href`. The
  element renders such a CTA as a button (`openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:177-186`),
  but the detail still carries the value. That is what the proposal describes.
- E8, not in the proposal: hosts can call the check. `isSafeLink` is exported from the package root
  `pricing-renderer` (`src/core/index.ts:44`; `docs/api-reference.md:6` and `:101`).
- E9, not in the proposal: the docs tests read `docs/events.md` only for words, table rows and detail
  keys (`tests/unit/docs-examples.test.ts:101-131`, `tests/unit/phase0-docs.test.ts:37,149-153`). One more
  sentence does not break them. Prettier uses `printWidth` 100 (`.prettierrc.json:4`).
- E10, not in the proposal: `docs/events.md` is a shared file of the add-react-headless chain "P3-11 →
  P3-15b" (`tasks.md:445`). P3-11 (`:271`) and P3-15b (`:412`) are unticked.
- E11, not in the proposal: no changeset. `docs/` is not in the package `files` (`package.json:68-75`). The
  add-react-headless rule asks for a changeset only when a slice touches `src/` or `package.json`
  (`tasks.md:5-7`).
- E12, spec location: `openspec/specs/` has no `spec.md` (glob returned 0 files). The add-react-headless
  change is still open under `openspec/changes/add-react-headless/`.

## Objective

The plan notes that brief P3-13, P3-14 and P3-15a match the `isSafeLink` behaviour since #79. The events
reference says that `pricing-action` `detail.href` is the trimmed, expanded and unchecked value, and that a
host checks it with `isSafeLink` before it navigates.

## Scope

- `openspec/changes/add-react-headless/tasks.md`: the link notes at `:384-387`, the follow-up at `:482-488`,
  and the ticks of P3-1T (`:75`) and P3-1I (`:84`).
- `docs/agent-work/phase3-react-headless/handoff.md:14`.
- `docs/events.md`, the `href` bullet at `:124-125` (see D1 for why it goes there and not after `:173`).

## Non-goals

- Changing what `pricing-action` puts into `detail.href`, for example dropping or flagging an unsafe value.
  That changes a public event field (O3, and the additive-only rule at `tasks.md:15`). It needs its own
  proposal and an owner decision (followup).
- Any change to `isSafeLink`, `src/**`, tests, `acceptance/**` or `openspec/specs/**`.
- Any requirement text of `openspec/changes/add-react-headless/specs/**`. `req~react-slot-href-safe~1`
  (`specs/composition/spec.md:426-441`) delegates to `isSafeLink` and is still correct.
- Ticking other P3 tasks, or any other ROADMAP or INTENT edit.
- `docs/api-reference.md:101` ("Validate a link: safe scheme or same-host path") is already correct.
- The other stale docs named at `phase3-react-headless/handoff.md:15`.

## Slices

One slice with one capability: the link-safety notes match the code. It has about 20-35 diff lines, which
is under the proposal's 60 and well under 300. No other slice runs in parallel inside this proposal.

### D1. Link-safety notes and `detail.href` (doc-steward)

- Model and effort: role default. Budget 15 turns.
- Owns:
  - `openspec/changes/add-react-headless/tasks.md`, only `:75`, `:84`, `:384-387`, `:400-401`, `:408-410`
    and `:482-488`;
  - `docs/agent-work/phase3-react-headless/handoff.md`, only `:14`;
  - `docs/events.md`, only `:124-125`.
- Read-only: `src/core/view-model.ts:52-78,273,600-607`, `src/core/utils.ts:11-13`,
  `src/element/cta.ts:58-60,89-112`, `src/element/renderers.ts:349-363`, `tests/unit/cta-href.test.ts`,
  `.changeset/safe-link-other-host-paths.md`, `ROADMAP.md:197-201`, this intake.
- Requirements: none. No requirement is added or changed.
- Changes (the wording is a proposal; the doc-steward keeps the meaning and the 100-column wrap):
  1. `tasks.md:75` and `:84`: `- [ ]` becomes `- [x]`. Evidence: #74 (`ROADMAP.md:199`).
  2. `tasks.md:384-387`, P3-13 link note. Say that:
     - the plan context `href` passes `isSafeLink` (`req~react-slot-href-safe~1`);
     - since #79 `isSafeLink` rejects `//host` and `/\host` (`docs/events.md:169-173`), but an absolute
       `https://` link to another host is still safe, so the example does not present the `href` as a
       same-site link;
     - the `pricing-action` `detail.href` is not checked (`docs/events.md:124-125`), so the example never
       navigates to it without `isSafeLink`.
     - Drop "The `isSafeLink` hardening stays a followup slice after an owner decision."
  3. `tasks.md:400-401` (P3-14) and `:408-410` (P3-15a): keep the wording. For P3-15a, optionally add that
     the guide says `detail.href` is unchecked. These lines are not wrong (E1).
  4. `tasks.md:482-488`: replace the open follow-up with a done note. #79 (`f3302b2`) made `isSafeLink`
     reject `//host` and `/\host`, also with tab, CR or LF between them (`src/core/view-model.ts:604-605`,
     `tests/unit/cta-href.test.ts:70-87`), and `req~react-slot-href-safe~1` inherits that. The one item
     still open: `pricing-action` carries the unchecked expanded value (`src/element/cta.ts:102-109`), and a
     change to that needs its own proposal.
  5. `phase3-react-headless/handoff.md:14`: the hardening is done in #79 (`f3302b2`), and no owner decision
     is pending.
  6. `docs/events.md:124-125`, the `href` bullet. Say that the value is the configured `href`, trimmed and
     with `{planId}` expanded (see below), and present only when the CTA has an `href`. It is not checked:
     a value that is not safe, which renders the CTA as a button, still appears here. So check it with
     `isSafeLink` (exported from `pricing-renderer`) before you navigate to it.
     - Why `:124-125` and not after `:173` as the proposal says: the bullet is where a reader looks up the
       field. It already says "check it before you use it", and its "as configured but trimmed" does not
       match `:136-140` (E4). Lines `:169-178` are about the rendered link and the default navigation, not
       the detail.
     - If the reviewer wants a cross-reference, one clause at the end of `:139-140` is enough: "...renders
       the CTA as a button; `detail.href` still carries it."
- Checks (the coordinator registers them; this task has none):
  - `["pnpm","install","--frozen-lockfile"]`
  - `["openspec","validate","add-react-headless","--strict"]` (the `spec` array of `tasks.md:38-40`; the lab
    provides the binary)
  - `["pnpm","exec","vitest","run","tests/unit/docs-examples.test.ts","tests/unit/phase0-docs.test.ts"]`
  - `["pnpm","run","format:check"]`
  - Or the `docs` set of `tasks.md:61` (`install`, `test`, `fmt`), if the coordinator prefers the full unit
    run.
- Expected diff: about 20-35 lines across three files.
- Risk **low**. Score 0: docs and plan notes only; no code, test, spec requirement, dependency or public API.
  It touches security guidance, so the reviewer checks the sentence against `src/element/cta.ts:102-109`.
- Split point (Q1): if the coordinator keeps `tasks.md` and the phase-3 handoff with the add-react-headless
  lead, D1 splits into two slices with disjoint files:
  - D1a (that lead or a doc-steward under it): changes 1-5, with the `openspec validate` check;
  - D1b (doc-steward): change 6, with the vitest and format checks.
  - Both are about 10-20 lines and can run in parallel.

## Order and shared files

- D1 can start now. Nothing in this proposal depends on another slice.
- It should merge before P3-13 and P3-14 start (`tasks.md:378`, `:396`), because those slices read the notes
  as their brief (the proposal's value).
- `docs/events.md`: the coordinator serializes D1 (or D1b) with the add-react-headless chain "P3-11 →
  P3-15b" (`tasks.md:445`). Neither slice is ticked yet, so D1 first is the natural order.
- `openspec/changes/add-react-headless/tasks.md`: no other open task should edit it at the same time (Q1).

## Gates per slice

| Gate | D1 (or D1a / D1b) |
|---|---|
| G1 openspec validate --strict | yes, `add-react-headless` (D1a); N/A for D1b |
| G2 EPIC | N/A: no requirement text changes |
| G3 red before | N/A: no test |
| G4 frozen tests | N/A: no test |
| G5, G7, G10 | registry |
| G6 trace | N/A: no `impl` or `utest` tag changes; the `tasks.md` traceability checklist (`:490+`) is untouched |
| G8 mutation | N/A: no code |
| G9 dependencies | N/A: no dependency |
| G11 review | one reviewer (low). The reviewer checks change 6 against `src/element/cta.ts:102-109` |
| G12 ui-qa | N/A: no UI change |
| G13 | how-to-review: read the `docs/events.md` bullet against `cta.ts:102-109` and `cta-href.test.ts:38-42`; read the `tasks.md` notes against `view-model.ts:604-605` and `ROADMAP.md:199` |

"Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies its own
registry.

## Feature flags

None. There is one docs slice and no behaviour change.

## Risks

- R1. The plan file is edited while another P3 task owns it. Mitigation: Q1 and the split point.
- R2. `docs/events.md` is shared with P3-11 and P3-15b. Mitigation: serialize (Order).
- R3. The new sentence could suggest that `isSafeLink` gives same-host links. It does not: `https://` links
  to other hosts pass. Mitigation: the sentence says "safe", not "same-host", and keeps `:172-173` as it is.
- R4. The open behaviour question stays open: a host that ignores the docs can still navigate to a
  `javascript:` value from a pricing document (E7). Mitigation: the followup proposal below.

## Open questions

No question needs a CRP. Two go to the coordinator, and one becomes a followup proposal.

- Q1 (coordinator, no CRP). Who owns `openspec/changes/add-react-headless/tasks.md` and
  `docs/agent-work/phase3-react-headless/handoff.md` for this edit?
  - Recommended: D1 owns them, for the listed lines only, if no open add-react-headless task holds them.
  - Otherwise use the D1a/D1b split, and D1a goes to that change's lead. The handoff is a lead checkpoint
    file, so its lead may prefer to rewrite it at the next `lead_checkpoint`.
- Q2 (coordinator, no CRP). Does this need its own OpenSpec change?
  - Recommended: no. Nothing changes a requirement. The edit goes into the open change's `tasks.md` plus
    one docs file.
  - If the process needs a change id anyway, it would hold `proposal.md` and `tasks.md` only. This intake has
    not checked whether `openspec validate --strict` accepts a change without a delta spec.
- Q3 (followup proposal, owner decision; not part of this work). Should `pricing-action` stop carrying an
  unsafe `detail.href` (drop it, or add a flag such as `hrefSafe`)?
  - This changes or extends a public event field (O3; `tasks.md:15` "Additive only"), so the owner decides.
  - The prop-20261101-3 intake also left it out of scope ("Non-goals", E8 there).
