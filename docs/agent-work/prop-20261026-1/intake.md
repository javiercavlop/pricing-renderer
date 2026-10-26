# Intake: P-20261026-1, re-measure the SPECTRA O1 signals on develop

- Proposal: P-20261026-1 (kind research, size S, risk low, owner-approved). Planner intake,
  2026-10-26.
- Base: `3841e7c` (task branch `task/94f79093e9074504`). The proposal calls this the develop head; I
  could not confirm that (no git tool, see "Needs").
- INTENT link: objective **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:25-42`).
  INTENT is still a draft waiting for the owner (`INTENT.md:3-4`).

## Objective

Replace the out-of-date O1 values (`INTENT.md:31-42`) with values measured on current develop, so the
owner can answer Q2 (page height) and Q3 (CTA) (`INTENT.md:129-134`) using current numbers, and can
see whether items 8 and 10 worked.

## Scope

- One new results file, `docs/agent-work/visual-review-spectra/o1-remeasure.md`. For each of the
  four O1 signals it gives the old value (from `report.md`), the new value, the source and the
  coverage:
  - page height in viewports (`rendererHeightInViewports`, collapsed state), 1440/1024/375;
  - CTA in the first viewport (`firstViewport.firstCtaVisible`), 1440/1024/375;
  - plans per row (`planCardsPerRow`) and lone last cards, 1440/1024 (375 is one column);
  - truncated texts and awkward breaks (`truncatedTexts.count`, `awkwardBreaks.count`).
- After the owner accepts INTENT (Q1), a second step changes the O1 lines in `INTENT.md` so they
  point to the new file.

## Non-goals

- No code, test, CSS, CI workflow, dependency or public API change. Workflow changes are also
  excluded, including making the SPECTRA spec opt-in (Q6).
- No new metric. The expanded-state height (`spectra-review.spec.ts:6`, phase 2 step 1) is out of
  scope.
- No threshold decision. Q2 and Q3 stay with the owner. The results file may restate the existing
  proposals (`report.md:91-95`) but must not settle them.
- No edit to `report.md`, `metrics.md` or `metrics.json`. They are the phase 1 record.
- No `acceptance/**` and no `openspec/specs/**`.

## Verified facts the slices must use

`report.md` means `docs/agent-work/visual-review-spectra/report.md`.

- 37 fixtures, one `.yml` each (glob `tests/fixtures/spectra/*/*.yml`, 37 matches). The spec uses
  the latest file per SaaS (`spectra-review.spec.ts:13-22`).
- `spectra metrics` runs every fixture at 1440x900, 1024x768 and 375x812, in light and `en`. Each
  test prints one `SPECTRA_SUMMARY` line and one `SPECTRA_METRICS` JSON line
  (`spectra-review.spec.ts:30-34,407-414,463-487`). The summary fields are `screens=`, `cards=<n>/<per
  row>`, `fv=<cards>/<price>/<cta>`, `trunc=` and `breaks=` (`spectra-review.spec.ts:388-404`). It
  runs in chromium only (`:49-51`).
- `fv` is read after the renderer is scrolled to the top of the viewport
  (`spectra-review.spec.ts:247-250`). That is the definition used in the report (`report.md:451-454`).
- Old values: page height `report.md:83` and `:460-493` (29 of 37 pricings); CTA `report.md:82` and
  `:525-533`; grid `report.md:86` and `:506-518`; text `report.md:87` and `:555-559`. Missing in
  phase 1: box, buffer, canva, circleci, clockify, crowdcast, databox, deskera (`report.md:446-449`).
- Phase 1 numbers came only from the CI log, through a tool that returns just the tail of the log
  (`report.md:446-449,577-578`).
- CI log limit, checked today: `ci_log` reads a green job. The `browsers` job of PR #51 (check run
  `121088477761`, head `e46761610f64`, success, `695 passed`, `838 skipped`) has 2184 log lines, and
  a call returns at most the last 1500. Lines 1-684 cannot be read. The last test output in that
  window is `SPECTRA_TEXT`, not `SPECTRA_SUMMARY`.
- CI runs on pull requests and on pushes to `develop` (`.github/workflows/ci.yml:3-11`). It has no
  `workflow_dispatch`. With `CI` set, the reporters are `html` and `github` and retries are 2; locally
  the reporter is `list` and retries are 0 (`playwright.config.ts:19-20`). `test-results/` and
  `playwright-report/` are gitignored (`.gitignore:6-7`).
- Other specs already gate some O1 signals on every PR. They give supporting evidence, not
  replacement values:
  - `spectra-grid.spec.ts:73-84`: `firstCtaVisible` must be true at 1440x900 for every pricing that
    has plans. The definition is the same (`helpers/spectra.ts:116-159`).
  - `spectra-grid.spec.ts:66-70`: cards per row must equal `expectedRows`, and a lone last card is
    allowed only when exempt (`helpers/plan-columns.ts:45-51`; any odd count at two columns, 7 or 13
    at three, 13 at four). The grid spec runs at 1440, 1200 and 1024, not at 375 (`:17-21`).
  - `spectra-text.spec.ts:86`: no truncation examples for any fixture at any of the 3 viewports.
    `:81-84`: no awkward-break examples, but only for the 6 pricings in `gatedBreaks` (`:25-32`).
  - The PR #51 browsers job passed (check run above). So at `e46761610f64` these assertions held.
    Whether develop has code changes after #51 is not verified.

## Slices

Two slices, in order, with disjoint files. No feature flag: everything is docs, nothing is
user-visible.

### S1: measure and write the results file

- Role: doc-steward (default model and effort). It needs `ci_log`/`ci_status`, which every role has.
  Turn budget: 40.
- Owns: `docs/agent-work/visual-review-spectra/o1-remeasure.md` (new). Nothing else.
- Read-only context: `report.md` sections 3 and 6, `tests/browser/spectra-review.spec.ts`,
  `tests/browser/spectra-grid.spec.ts`, `tests/browser/spectra-text.spec.ts`,
  `tests/browser/helpers/spectra.ts`, `tests/browser/helpers/plan-columns.ts`, `INTENT.md:25-42`, and
  this intake.
- Requirement ids: none yet (the coordinator assigns them if the change carries any).
- Source of the numbers, in order of preference. Write down which one was used.
  1. A lab run through check 1 below. It gives the full output, so it has no tail limit. Use it only
     if the coordinator confirms the project container has Playwright Chromium (`report.md:577` says
     workers had none in phase 1).
  2. Otherwise, the `browsers` job of the CI run for the develop head commit (full SHA from the
     coordinator): `ci_status` with that SHA, then `ci_log` with its job id and `lines: 1500`. Take
     only the `SPECTRA_SUMMARY` lines, which are compact. Use `SPECTRA_GRID` and `SPECTRA_TEXT` lines
     only as supporting evidence.
- Content:
  - header with the commit measured, the source (check run id or qa_run record) and the date;
  - coverage table: which of the 111 fixture x viewport pairs have a summary line. Mark missing pairs
    "not measured" and never estimate them;
  - per signal, old vs new: min, median, max, and the count at most 3 and at most 5 screens at
    1440 and 375; the list of pricings where the CTA is not visible at each viewport; the pricings
    with a lone last card at 1440 and 1024; truncated and awkward-break counts with their examples;
  - a short per-pricing height table (1440/1024/375) for every measured pricing;
  - the supporting evidence from the gating specs (above), described as assertions, not values.
- Size: about 150-220 lines, mostly tables. Risk: **low** (score 0: docs only, no risk area).
- Checks (exact arrays, to register):
  - 0: `["pnpm", "install", "--frozen-lockfile"]`
  - 1 (only if Chromium is present, timeout 1800):
    `["pnpm", "exec", "playwright", "test", "tests/browser/spectra-review.spec.ts", "--project=chromium", "--grep", "spectra metrics", "--workers=2", "--reporter=list"]`
    It writes only to the gitignored `test-results/`. The webServer starts `pnpm demo` itself
    (`playwright.config.ts:26-31`).
  - 2: `["pnpm", "exec", "prettier", "--check", "docs/agent-work/visual-review-spectra/o1-remeasure.md"]`
- Depends on: the coordinator providing the full develop head SHA, and the lab Chromium answer.

### S2: point the O1 lines of INTENT.md to the results

- Role: doc-steward (default). Turn budget: 20.
- Owns: `INTENT.md`, only the O1 block (`INTENT.md:25-42`).
- Read-only context: the S1 results file and this intake.
- Content: replace "Current value" and "Evidence" in the four O1 signals with the S1 values and a link
  to `o1-remeasure.md`. Remove "so the table is not re-measured here" (`:33-34`) and "the value
  needs a new measurement" (`:38-39`). Leave thresholds and Q2/Q3 unchanged.
- Size: under 30 changed lines. Risk: **low** (score 0).
- Checks: 0 as above; `["pnpm", "exec", "prettier", "--check", "INTENT.md"]`.
- Depends on: S1 merged, **and** the owner's answer to Q1 (INTENT accepted). The proposal makes this
  conditional ("once the owner accepts INTENT"). If Q1 is still open, S2 waits. S1 does not.

Ownership is disjoint: S1 has one new file, S2 has `INTENT.md`. Change-level check for the PR:
`["pnpm", "format:check"]` (the same command as CI, `ci.yml:34,75`).

## Gates per slice

The same for S1 and S2 unless a line says otherwise. G5 and G7 are not defined in the factory skills
I could read; the coordinator maps them.

- G1, openspec validate --strict: at change level, once the coordinator creates the change.
- G2, EPIC review: N/A unless the change carries requirements.
- G3, red-before: N/A (no tests).
- G4, acceptance freeze: N/A (no `acceptance/`).
- G5: undefined here; the coordinator maps it.
- G6, trace: N/A (no requirement tags in code).
- G7: undefined here; the coordinator maps it.
- G8, mutation: N/A.
- G9, dependency and licence: N/A.
- G10, secrets: applies if registered (docs text; S1 must not paste log lines with credentials or
  artifact URLs that carry tokens).
- G11, review: one reviewer (low risk). For S1, the reviewer checks every new value against the cited
  check run id or qa_run record. For S2, the reviewer checks that the INTENT values match the S1 file.
- G12, ui-qa: N/A (no UI change).
- G13, how-to-test: N/A. The PR uses how_to_review (which file, which table, what changed vs phase 1).

## Open questions

Needing a CRP (owner):

- Q1 (already in `INTENT.md:127-128`): accept INTENT. S2 is blocked on it, S1 is not.
- Conditional, only if both sources leave pairs unmeasured: may the owner download the
  `playwright-report` artifact of the measured run? It holds a `<fixture>-<width>-light-en-metrics`
  JSON attachment per test (`spectra-review.spec.ts:413`). Retention is 14 days (`ci.yml:83`).
  Agents could not read it in phase 1 (`report.md:449`).

For the coordinator, not owner decisions:

- Full SHA of the develop head, and whether it has a finished CI `browsers` job. Is `3841e7c` on
  develop, and do the commits after #51 (`5429fa7`) change only docs? I could not check either.
- Whether the project container has Playwright Chromium, which decides between check 1 and the
  CI-log path.
- Change id for the OpenSpec change. This intake uses `prop-20261026-1`.
