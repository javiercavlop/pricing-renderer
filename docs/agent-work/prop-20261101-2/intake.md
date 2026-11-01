# Intake: P-20261101-2, record the UX-2 counts and close the UX-7 and UX-9 gates

- Origin: proposal P-20261101-2 (kind docs, size S, risk low), approved by the owner. Planner intake,
  2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/b1ba4020706841e9`. Every `file:line` below is at this
  base.
- INTENT link: O1, "real-world Pricing2Yaml pricings render legibly" (`INTENT.md`, section "O1").
- No code, no test, no spec and no release. Docs only.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, M1 holds the UX-7 and UX-9 decisions and waits on a dispatch. **R.** `plan.md` means
  `docs/agent-work/pending-phases/plan.md`. M1 is at `plan.md:364-373`. It names the UX-7 and UX-9
  gates (`:370-371`) and is "Blocked by N-CI if a dispatch is not possible" (`:373`). Wave 3 puts
  M1 after U1b and one dispatch run (`:486-487`).
- E2, U9 is in the `renderers.ts` chain. **R.** `plan.md:505`: `U9 → U7 → U6 → U11 → U5 → U8`.
  U9 is about 60 lines (`:377`), and "Go only if U2 finds fillers" (`:380`).
- E3, the TOTAL line of job 123038640831. **R.** Read with `ci_log`. The job is `quality (22)` of
  PR #72. It checked out `refs/remotes/pull/72/merge` ("HEAD is now at a5d378c"), the merge of the
  PR head `936631a` into `88f5141`. TOTAL: `fixtures` 62, `rowsAboveRendererCapInGroups` 3032,
  `addOnOnlyRows` 535, `addOnOnlyRowsMisleading` 137, `planDescriptionsFiller` 0,
  `addOnDescriptionsFiller` 0, `addOnsNotAvailableForSelectedPlan` 231 (also `plans` 291,
  `addOns` 471, `rows` 5884, `groups` 179, `rowsAboveProposedCapInGroups` 4521,
  `groupsAboveProposedCap` 158, `planDescriptionsMissing` 76, `addOnDescriptionsMissing` 147).
  - Correction: the proposal says "the head SHA". The counts come from the merge ref `a5d378c`.
    The measurement record should name both SHAs.
  - Still true on today's code: PR #74 (`ee91c18`), job `quality (22)` id 124964849166, merge ref
    `738d087`, prints the same TOTAL line field for field.
- E4, 81 rows across 14 real pricings. **R.** The non-zero `addOnOnlyRowsMisleading` lines of job
  123038640831: box 4, circleci 4, clickup 1, databox 2, github 17, mailchimp 16, notion 1,
  planable 4, postman 8, salesforce 10, slack 2, tableau 6, wrike 3, zoom 3. That makes 81. The
  stress fixtures add 56 (github ×4 at 6, zoom ×4 at 4, salesforce ×4 at 3, webflow ×4 at 1). Total
  137. 62 fixtures = acme + 37 SPECTRA + 24 stress.
- E5, the UX-9 filler rule matches `isFiller`. **R.**
  - UX-9: "Case-insensitive, trimmed, equal to the name means hidden" (`report.md:532`, where
    `report.md` is `docs/agent-work/ux-review/report.md`). Gate: "UX-2 finds any" (`:536`).
  - `isFiller` (`tests/unit/ux-counts.test.ts:53-55`) trims and lowercases both sides, the same as
    the item 11 helper `rowDescription` (`src/element/renderers.ts:253-257`).
  - The counts read `plan.description`/`plan.name` and `addOn.description`/`addOn.name`
    (`ux-counts.test.ts:116,118`), the same fields the renderer prints (`renderers.ts:497-498`,
    `:1164-1165`).
- E6, `docs/agent-work/ux-review/measurements.md` does not exist. **R.** That directory holds
  only `report.md`.
- E7, U2 delivered only part of UX-2. **R.** UX-2 asks for (a)-(d) (`report.md:378-385`), and U2 was
  planned to deliver all of it (`plan.md:361`). `UxCounts` (`ux-counts.test.ts:19-35`) has:
  - (a) no singular-unit field;
  - (b) the add-on-only rows and the misleading ones at the *selected plan only*
    (`:94-98`), with no per-cell count and no mixed-row count;
  - (c) missing and filler plan and add-on descriptions only, with no row-description counts and
    no length maximum or median;
  - (d) `addOnsNotAvailableForSelectedPlan`, so (d) is complete.
- E8, not in the proposal: UX-7 is already in progress. P-20261101-1 is owner-approved, and that
  approval answers CRP-U7 (`docs/agent-work/prop-20261101-1/intake.md:3-5`). Its slice T1 owns
  `tests/unit/ux-counts.test.ts`. T1 adds a cell-level field `addOnMarkerCellsMisleading` and
  rewords the comment of `addOnOnlyRowsMisleading` (`prop-20261101-1/intake.md:161-167`). So this
  change *records* the UX-7 go; it does not unblock it. Neither change owns the other's files.
- E9, not in the proposal: stale references. `report.md:530-531` cites `renderers.ts:218-223`,
  `:388`, `:1049` and `:1166-1167`. They are now `:253-257`, `:498`, `:1165` and `:1282-1283`.
  `ROADMAP.md:93-94` still says UX-2 is "not started", but `tests/unit/ux-counts.test.ts` exists and
  prints the lines above.

## Objective

Keep the unit-level half of M1 in the repository, so it no longer depends on CI log retention, and
record two gate decisions: UX-7 go (81 misleading rows in 14 real pricings) and UX-9 no-go (0
filler plan or add-on descriptions in 62 fixtures). Then U9 leaves the `renderers.ts` chain.

## Scope

- New `docs/agent-work/ux-review/measurements.md` (slice D1).
- Optional status lines in `ROADMAP.md` and `plan.md` that point to it (slice D2, see Q1).

## Non-goals

- The browser half of M1: `SPECTRA_UX_SUMMARY` fields, section heights, the `layout="table"`
  comparison (Q-C), and the UX-3 and UX-4 gates (`plan.md:368-370`). D1 only leaves a placeholder.
- The missing UX-2 parts (a), (b) cells and mixed rows, and (c). They are test code in
  `ux-counts.test.ts`, which P-20261101-1 T1 owns now. Followup.
- Any change to `src/**`, `tests/**`, `openspec/specs/**` or `acceptance/**`.
- Fixing the stale references of `report.md` (E9). Followup.

## Slices

Order: D1, then D2 (optional, it can go in the same PR). Owned files are disjoint. Neither slice
overlaps with P-20261101-1 (its files: `openspec/changes/addon-marker-available-for/**`,
`docs/agent-work/spectra-item6-addon-marker/spec.md`, three test files, `src/core/view-model.ts`,
`src/element/renderers.ts`, one changeset).

### D1. Measurement record, unit half (doc-steward)

- Owns: `docs/agent-work/ux-review/measurements.md` (new). It is the M1 file (`plan.md:366`); M1
  later fills the browser half in the same file. The `ux-review/**` order stays M1 → U10
  (`plan.md:517`), with D1 first.
- Read-only: `tests/unit/ux-counts.test.ts`, `docs/agent-work/ux-review/report.md:373-393,482-538`,
  `plan.md:359-380,505`, this intake.
- Source data: `ci_log` of job 123038640831 (PR #72, `quality (22)`), plus the check below as a
  record from the lab.
- Content:
  1. Source: job id, job name, PR, merge ref `a5d378c`, PR head `936631a`, base `88f5141`, and the
     confirmation from PR #74 (job 124964849166, merge ref `738d087`).
  2. Field definitions, one line each, citing `ux-counts.test.ts:19-35,89-121`. Say plainly that
     `addOnOnlyRowsMisleading` counts *rows at the default selected plan*, not cells (`:94-98`).
  3. The 63 `UX_COUNTS` lines (62 fixtures and TOTAL) copied verbatim into one fenced `text` block.
     Copying avoids transcription errors.
  4. A short gate table: UX-7 go (81 real rows in 14 fixtures, 137 with stress; gate "count above 0",
     `plan.md:370-371`; already approved as P-20261101-1). UX-9 no-go (0 + 0 fillers; rule
     `plan.md:380`, `report.md:536`; rule match E5). Consequence: U9 leaves the chain at
     `plan.md:505`, so the first `renderers.ts` slice is U7.
  5. Followup: the UX-2 parts not delivered (E7).
  6. Placeholder, "Browser half (M1, pending a dispatch)", that lists what M1 adds
     (`plan.md:368-371`) and the UX-3 and UX-4 gates, which stay open.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/ux-counts.test.ts"]`. This reproduces the counts
    on the base. The TOTAL line must equal E3. If it differs, stop and report it, and do not edit the
    numbers to match.
  - `["pnpm", "exec", "prettier", "--check", "docs/agent-work/ux-review/measurements.md"]`. The file
    is formatted: only `docs/agent-work/prop-*/` and some other folders are ignored
    (`.prettierignore:1-22`).
- Expected diff: about 130-170 lines of docs, 63 of them the verbatim block.
- Risk low, score 0 (docs only; no risk area, API or input). Budget 20 turns.

### D2. Status pointers (doc-steward or planner; optional, Q1)

- Depends on: D1 (it cites the file).
- Owns: `ROADMAP.md` (UX-2, UX-7 and UX-9 entries, `:93-94,107-115`) and
  `docs/agent-work/pending-phases/plan.md` (M1 and U9 entries `:364-380`, chain line `:505`).
- Content:
  - ROADMAP: UX-2 "partly done" (evidence: `tests/unit/ux-counts.test.ts`, measurements.md);
    UX-7 "in progress" (P-20261101-1); UX-9 "proposed drop" (0 fillers). These are states that
    `ROADMAP.md:14` allows.
  - plan.md: mark the M1 unit half as recorded and U9 as no-go, and remove U9 from the chain at
    `:505`.
- Checks: `["pnpm", "exec", "prettier", "--check", "ROADMAP.md", "docs/agent-work/pending-phases/plan.md"]`.
- Expected diff: about 10-20 lines. Risk low, score 0. Budget 10 turns.

## Gates per slice

| Gate | D1 | D2 |
|---|---|---|
| G1 openspec validate --strict | only if the coordinator wraps this in an OpenSpec change (no delta spec) | same |
| G2 EPIC | same as G1 | same as G1 |
| G3 red before, G4 frozen tests | N/A (no tests) | N/A |
| G5, G7, G10 | registry | registry |
| G6 trace | N/A (no requirement ids) | N/A |
| G8 mutation | N/A | N/A |
| G9 dependencies | N/A | N/A |
| G11 review | one reviewer (low): numbers match the log, the definition of the selected-plan rows | one reviewer |
| G12 ui-qa | N/A | N/A |
| G13 | N/A, how-to-review: open measurements.md, compare the TOTAL line with job 123038640831, read the gate table | N/A, how-to-review |

"Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies its
own registry.

## Feature flags

None. Docs only, and each slice is complete by itself.

## Risks

- R1. The CI logs expire, so the citation alone does not prove anything later. Mitigation: D1 keeps
  the lines verbatim, and its vitest check records the same output in the lab.
- R2. UX-9 no-go rests on 62 committed fixtures. A host pricing outside them may still repeat a name
  as its description. Mitigation: record this in D1. The plan rule (`plan.md:380`) and the approved
  proposal accept it. A new fixture with fillers would reopen UX-9.
- R3. Readers may take `addOnOnlyRowsMisleading` 137 as a cell count, or as the number that I1 of
  P-20261101-1 brings to 0. It is neither (`prop-20261101-1/intake.md:25-31`). Mitigation: content
  item 2 of D1.
- R4. `ROADMAP.md` or `plan.md` may be owned by another task in flight. Mitigation: the coordinator
  checks before D2, or D2 waits.

## Open questions

- Q1 (coordinator, no CRP). Include D2? Recommended: yes, in the same PR as D1. Without it,
  `ROADMAP.md:93-94` and `plan.md:505` contradict measurements.md. If `plan.md` belongs to the
  coordinator only, D2 keeps just `ROADMAP.md`.
- Q2 (coordinator, no CRP). Register the vitest check of D1 for the doc-steward. Recommended: yes
  (R1).
- No CRP is needed. The UX-7 go is already the owner's (CRP-U7 through P-20261101-1). The UX-9
  no-go follows the planned rule (`plan.md:380`) and is part of the approved proposal. ROADMAP's
  "proposed drop" leaves the final drop to the owner.
