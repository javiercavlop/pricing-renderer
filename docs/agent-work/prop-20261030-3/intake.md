# Intake: P-20261030-3, measure the O2 visual-baseline signal and add dark-mode and RTL baselines

- Origin: proposal P-20261030-3 (kind reliability, size S, risk low), approved by the owner. Planner
  intake, 2026-11-01.
- Base: HEAD `019a4b8` of the task branch `task/a32de69adf3947ac`. Every `file:line` below is at this
  base.
- INTENT link: O2, "accessibility and visual-regression guards stay green" (`INTENT.md:46`), signal
  "Visual baselines" (`INTENT.md:56-57`). Promise covered: dark mode and RTL (`README.md:29-30`,
  `INTENT.md:18`).
- Nothing in `src/`, `examples/`, `package.json` or `.github/` changes. No changeset, no release.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, the INTENT signal is "not recorded". **R.** `INTENT.md:56-57`: "Current value: not recorded in
  this draft; the count and the pass rate need a check of `tests/browser`. Threshold: owner decision."
- E2, one `toHaveScreenshot` call. **R.** Grep `toHaveScreenshot` in `tests/` finds one call only, at
  `tests/browser/pricing-renderer.spec.ts:1344`.
- E3, it runs for 9 viewports, in Chromium only, on the light demo page. **R.**
  - The viewports are at `pricing-renderer.spec.ts:1323-1333`, and the Chromium skip is at `:1335`.
  - The page is `/`, opened by `beforeEach` at `:4-7`.
  - The demo starts in the light theme (`examples/vanilla/src/main.ts:44`).
- E4, 9 `-linux` baselines plus 9 non-Linux files. **R.** Glob
  `tests/browser/*-snapshots/**` finds 18 files. All are in
  `tests/browser/pricing-renderer.spec.ts-snapshots/`, one `<name>.png` and one `<name>-linux.png`
  per viewport. The suffix rule is at `playwright.config.ts:3` and the path template at `:23`.
- E5, "dark and RTL are checked only by assertions in `theme-files.spec.ts` and
  `change-review-ui.spec.ts`". **P.**
  - Dark: **R.** Token and colour-scheme assertions are at `tests/browser/theme-files.spec.ts:110-165`
    and `tests/browser/change-review-ui.spec.ts:630-643`. Contrast scans in the dark theme are at
    `pricing-renderer.spec.ts:1992-2005`. `theme-files.spec.ts:167-194` attaches dark screenshots
    for review, with no baseline (the comment at `:167` says so).
  - RTL: **N.** No browser or unit test sets or checks a direction. A case-insensitive grep of
    `tests/` for `rtl`, `\bdir\b` and `direction` finds only unrelated hits: variable names and the
    compare `direction` field. The only RTL-specific style rule is
    `src/styles/base.css:740-742` (the switch thumb moves the other way). RTL has no automated guard
    at all today, and that makes the RTL half of this proposal more valuable than it claims.

## Facts the proposal does not mention

- F1. **The lab and CI may not render the same pixels.** `docs/agent-work/ci-speed/lab-chromium.md:104-107`
  says: "The `-linux` baselines come from GitHub runners ... Lab fonts may differ. So the lab checks
  pass `--ignore-snapshots`. Visual baselines stay CI-only until one lab run shows they match."
  The last full update was a one-off CI run with a temporary workflow
  (`docs/agent-work/spectra-grid-v2/baselines.md:3`). The proposal's plan to produce "the `-linux`
  baselines from a registered check" holds only if a lab run first matches the 9 existing baselines.
  Q1 asks which route to take.
- F2. The non-Linux baselines are stale by design: "not regenerated in CI. They stay stale until
  someone with macOS updates them on purpose" (`spectra-grid-v2/baselines.md:7`).
- F3. "The same tolerance as the existing loop" is not a single value. It is:
  - 0.025 at 320 and 375 (`pricing-renderer.spec.ts:1351-1352`);
  - 0.03 at 1200 (`:1348-1349`);
  - 0.015 otherwise (`:1353`, equal to the config default at `playwright.config.ts:29`).

  So 375 px uses 0.025 and 1440 px uses 0.015. `animations: 'disabled'` is set both in the config
  (`playwright.config.ts:28`) and in the call (`:1346`).
- F4. Dark mode in the demo. The `#theme` select, labelled "Theme" (`examples/vanilla/index.html:135-141`),
  sets `renderer.theme` and `document.documentElement.dataset.theme` together
  (`examples/vanilla/src/main.ts:64-66`), so the page behind the renderer turns dark too
  (`theme-files.spec.ts:97-100`). The `setTheme` helper at `pricing-renderer.spec.ts:1538-1545`
  sets only the renderer, so the demo page stays light (`:1994-1997`). For a dark baseline, the
  test uses the select.
- F5. RTL in the demo. The demo has no direction switch (no `dir` in `examples/vanilla/**`), and
  `<html lang="en">` has no `dir` (`examples/vanilla/index.html:2`). The documented host contract is
  to set `dir` on the document or a container (`docs/i18n.md:111-122`). There is no RTL locale
  catalog in `src/` (no `ar` match), so the RTL baseline shows English text in an RTL layout. That
  is what a host gets today.
- F6. CI. A file under `tests/browser/` is not on the docs-only allowlist (`ci.yml:130-136`), so V1
  runs the browser shards. The visual tests run in shards `chromium 1/2` and `chromium 2/2`
  (`ci.yml:154-161`). A change to `INTENT.md` alone is a root `*.md` file (`ci.yml:134`), so D1 skips
  the browsers.
- F7. Missing baselines. A lookup of the Playwright docs (confidence medium) gives the default
  `updateSnapshots` as `'default'`: "Missing snapshots are created, but the tests that create them
  fail". Sources: playwright.dev/docs/api/class-testconfig and playwright.dev/docs/test-snapshots.
  The lookup could not confirm two things:
  - whether `CI` changes this;
  - whether the actual image can be downloaded from the HTML report.

  A push without the baselines therefore fails CI. The lookup did not confirm that the failing run
  gives back usable PNGs.
- F8. The project has no OpenFastTrace check (`docs/agent-work/prop-20261031-3/intake.md:98-99`),
  so G6 is N/A. The existing browser tests still carry `[utest->req~...]` comments (for example
  `theme-files.spec.ts:7`), so V1 follows that convention.
- F9. Overlap with pending P-20261029-2, which brings `INTENT.md` and `ROADMAP.md` up to date with
  PRs 71-73 (the proposal's Alternatives). No folder or file in the repository refers to
  P-20261029-2 (grep `20261029`). Its scope comes from the proposal text only.

## Objective

Dark mode and `dir="rtl"` each get a Chromium screenshot baseline at 375 and 1440 px (4 screenshots).
They use the tolerance of the existing loop. The baselines are generated on Linux by the route Q1
picks, and they are viewed before they are accepted. `INTENT.md`'s O2 signal then records the
measured count.

## Scope

- One new spec file with 4 visual tests (2 variants, dark and RTL, x 2 widths, 375 and 1440) and
  its 4 `-linux` baselines.
- One `INTENT.md` edit of the "Visual baselines" signal (`INTENT.md:56-57`): the count after V1.

## Non-goals

- No change to the 9 existing tests or their 18 baseline files, and no change to the tolerances.
- No non-Linux baselines for the new tests (F2).
- No Firefox or WebKit baselines (`pricing-renderer.spec.ts:1335` keeps visual baselines in Chromium).
- No dark+RTL combination, no other widths, no `es-ES`, no forced-colors baseline. Each is a later
  choice of the owner (Q2).
- No product, demo, CSS or `ci.yml` change. A failing RTL or dark check is reported as a finding,
  never fixed or loosened in these slices.
- No threshold for the signal (`INTENT.md:57`, owner decision: Q3).
- No ROADMAP edit and no other INTENT signal (P-20261029-2, F9).
- The backlog titles of the proposal (`audit` job, `api-reference.md` coverage, `.npmrc`): out of
  scope.

## Slices

Order: first C0, then V1, then D1. V1 and D1 own disjoint files. D1 waits for V1, so it records the
final count and does not go stale when V1 merges.

### C0. Lab calibration (coordinator, no files)

- Purpose: answer F1 with evidence before V1 generates any baseline.
- Register and run, in the lab, the 9 existing visual tests in comparison mode (no `--ignore-snapshots`):
  `["pnpm", "exec", "playwright", "test", "tests/browser/pricing-renderer.spec.ts", "--project=chromium", "--grep", "is responsive at", "--workers=2", "--reporter=line", "--global-timeout=1500000"]`.
- 9 of 9 pass: lab baselines are trusted, and Q1 resolves to (a).
- Any failure: record the test names and diff ratios from the output, and Q1 goes to the owner as a
  CRP.
- Depends on: the lab Chromium image (`lab-chromium.md:19-29`). If the image is missing, Q1 goes to
  the owner directly.

### V1. Dark and RTL visual baselines

- Role: implementer (it is not an acceptance test, so it is not under `acceptance/`). Default model
  and effort. Budget 30 turns.
- Depends on: C0, and Q1 answered.
- Owns:
  - `tests/browser/visual-variants.spec.ts` (new);
  - `tests/browser/visual-variants.spec.ts-snapshots/*-linux.png` (new, 4 files).
- Read-only: `tests/browser/pricing-renderer.spec.ts:1-7,1323-1356`, `playwright.config.ts`,
  `examples/vanilla/index.html:128-141`, `examples/vanilla/src/main.ts:44,64-67`, `docs/i18n.md:111-122`,
  `tests/browser/theme-files.spec.ts:78-106`.
- Content:
  - One table of 4 cases: `dark-375`, `dark-1440`, `rtl-375`, `rtl-1440`. The sizes are 375x900 and
    1440x1000, the same as `pricing-renderer.spec.ts:1325,1332`.
  - Chromium-only skip, with the same message as `:1335`.
  - `goto('/')`, then wait for the 3 plan cards (as at `:5-6`). Then `setViewportSize`, reload,
    and wait for the 3 cards again.
  - Pin the system scheme with `emulateMedia({ colorScheme: 'light' })`, so that only the variant
    changes.
  - Dark: `getByLabel('Theme').selectOption('dark')` (F4).
  - RTL: `document.documentElement.dir = 'rtl'` (F5).
  - After either switch, wait for `renderer.updateComplete`, two animation frames and
    `document.getAnimations()` (as `pricing-renderer.spec.ts:1542-1544` does).
  - Assert the overflow ≤ 1 px, as at `:1339-1342`. In RTL this is a real guard against layout
    bugs. If it fails, it is a finding, not something to loosen.
  - `scrollIntoViewIfNeeded`, then `toHaveScreenshot('<name>.png', { fullPage: false,
    animations: 'disabled', maxDiffPixelRatio })`, with 0.025 at 375 and 0.015 at 1440 (F3).
  - Tag comment: the ids of Q4, for example `[utest->req~visual-baseline-dark~1]` and
    `[utest->req~visual-baseline-rtl~1]`.
- Checks (argument arrays):
  - `install`: `["pnpm", "install", "--frozen-lockfile"]`
  - `behaviour` (lab, no pixels):
    `["pnpm", "exec", "playwright", "test", "tests/browser/visual-variants.spec.ts", "--project=chromium", "--workers=2", "--ignore-snapshots", "--reporter=line", "--global-timeout=1500000"]`
  - `generate`, route (a) only:
    `["pnpm", "exec", "playwright", "test", "tests/browser/visual-variants.spec.ts", "--project=chromium", "--update-snapshots", "--workers=1", "--reporter=line", "--global-timeout=1500000"]`
  - `compare`, route (a) only:
    `["pnpm", "exec", "playwright", "test", "tests/browser/visual-variants.spec.ts", "--project=chromium", "--workers=2", "--reporter=line", "--global-timeout=1500000"]`
  - `lint`: `["pnpm", "run", "lint"]` (`eslint .`, `package.json:134`) and `fmt`:
    `["pnpm", "run", "format:check"]` (`package.json:136`).
  - No typecheck check: `typecheck` is `tsc -b` (`package.json:133`), and the root `tsconfig*.json`
    files include only `src/**`, so it does not cover `tests/`. Playwright compiles the spec in the
    `behaviour` check.
- Proof in CI: the `browsers` shards on the PR (F6) are the visual proof (`lab-chromium.md:109-110`).
- Expected diff: about 70-90 lines of TypeScript plus 4 PNG files.
- Risk **low**, score 0. It changes tests only (-2, floor 0). It touches no risk area, no public API
  and no external input, and adds no dependency. Review panel: one reviewer plus ui-qa for the
  images.
- Requirements: Q4 (proposed `req~visual-baseline-dark~1` and `req~visual-baseline-rtl~1`).

### D1. Record the O2 visual-baseline signal

- Role: doc-steward. Budget 15 turns.
- Depends on: V1 merged into `develop`, and on Q5 (ownership of `INTENT.md` against P-20261029-2).
- Owns: `INTENT.md`, lines 56-57 only.
- Content: the "Current value" of the signal becomes the counts measured at D1's base:
  - the `toHaveScreenshot` calls (expected 2: `pricing-renderer.spec.ts:1344` and the V1 call);
  - the screenshots (expected 13: 9 light + 2 dark + 2 RTL), with Chromium only, Linux baselines
    and the evidence paths;
  - the pass rate: the result of the `browsers` shards for V1's merge commit on `develop`, read
    with `ci_status`, or "not measured" if no run is readable;
  - "Threshold: owner decision" stays (Q3).
- Checks: `fmt` `["pnpm", "run", "format:check"]` (`INTENT.md:112`).
- Expected diff: about 4-6 lines. Risk **low**, score 0 (docs only).

## Gates per slice

| Gate | C0 | V1 | D1 |
|---|---|---|---|
| G1 openspec validate --strict | - | the change's delta (Q4) | N/A |
| G2 EPIC | - | on the change | N/A |
| G3 red before | - | N/A: the tests guard against later regressions, and no behaviour is new | N/A |
| G4 frozen tests | - | N/A: no acceptance tests | N/A |
| G5, G7, G10 | registry | registry | registry |
| G6 trace | - | N/A: no OFT check (F8); tag comments only | N/A |
| G8 mutation | - | N/A | N/A |
| G9 dependencies | - | N/A: no dependency change | N/A |
| G11 review | - | one reviewer | one reviewer |
| G12 ui-qa | - | **required**: view the 4 new PNGs before they are accepted | N/A |
| G13 | - | how-to-review: the 4 images and the spec | how-to-review |

- "Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies
  its own registry, as in `prop-20261031-3/intake.md:266-267`.
- What the G12 viewer checks on each new image:
  - dark: the page background and the cards are dark (#theme sets both, F4), the text is legible,
    and no light-only area is left;
  - RTL: the cards, prices and summary are mirrored, and nothing is clipped or overflowing;
  - nothing in the image changes between runs (no time, no random data).

## Feature flags

None. The work is tests and one doc line, and each slice is complete by itself.

## Risks

- R1. Lab pixels do not match CI (F1). If the lab generates the baselines anyway, CI fails or, worse,
  a wrong baseline is accepted. Mitigations: C0 first, and the CI `browsers` shards compare on
  every PR.
- R2. Flaky dark screenshots from colour transitions. Mitigations: `animations: 'disabled'`, and the
  wait for `getAnimations()` (as at `pricing-renderer.spec.ts:1544`). The existing loop has run with
  the same settings.
- R3. The RTL run finds a real layout bug (an overflow or a mirrored control). Then V1 cannot pass
  without a product fix. Mitigation: V1 reports it as a finding with the test and the measured
  overflow. The fix is a separate proposal; the tolerance and the assertion are not loosened.
- R4. Local runs on macOS fail the first time, because the new tests have no non-Linux baselines
  (F2, F7). This is accepted, as for the 9 existing tests. The spec file comment says so.
- R5. D1 and P-20261029-2 both edit `INTENT.md` (F9). Mitigation: Q5, and D1 owns two lines only.

## Open questions

- Q1 (owner CRP unless C0 passes 9/9). Who generates the 4 `-linux` baselines?
  - (a) The lab, with the `generate` check of V1. This needs C0 at 9/9. **Recommended** when C0
    passes: it is the proposal's route, and it needs no workflow change.
  - (b) A one-off CI run, as in `spectra-grid-v2/baselines.md:3`. This needs a temporary workflow,
    and workflows are the owner's area (O4). **Recommended if C0 fails.**
  - (c) Push without baselines, and take the actual images from the failing CI run (F7). **Not
    recommended:** the lookup could not confirm that the images can be retrieved.
- Q2 (owner, already in the proposal). Is the baseline set 4 screenshots (dark and RTL at 375 and
  1440)? The proposal says yes; `INTENT.md:57` leaves the set to the owner. **Expected: yes, as
  approved.**
- Q3 (owner, not blocking). The threshold of the signal, for example "every visual test passes on
  `develop`". D1 keeps "owner decision".
- Q4 (coordinator or specifier, no CRP). Requirement ids for the change, proposed
  `req~visual-baseline-dark~1` and `req~visual-baseline-rtl~1`, in a new capability
  `visual-baselines`.
- Q5 (coordinator, no CRP). Is P-20261029-2 in flight and editing `INTENT.md`? If yes, D1 waits for
  it or is merged into it. If no, D1 runs after V1.
