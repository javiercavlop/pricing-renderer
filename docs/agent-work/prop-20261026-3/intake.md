# Intake: P-20261026-3, keep keyboard focus when a "show more" button disappears

- Proposal: P-20261026-3 (kind reliability, size S, owner-approved). Planner intake, 2026-10-26.
- Base: `3841e7c` (task branch `task/6a5b999848c4407d`).
- INTENT link: **O2, "accessibility and visual-regression guards stay green"** (`INTENT.md:44`).
  The promise it serves: "Accessible semantic HTML, keyboard flows" (`INTENT.md:17`). INTENT is
  still a draft (`INTENT.md:3`); the owner approved this proposal, so citing O2 is accepted here.

## Objective

When a keyboard or screen-reader user activates "Show N more" in the comparison (table or compact
layout) or in the filtered add-on grid, focus moves to the first newly shown row or card instead
of being lost to `<body>`. A browser test proves it for both buttons.

## Verified facts (file:line at `3841e7c`)

- `_revealGroup` only updates `_revealedGroups` and calls `requestUpdate()`, with no focus handling:
  `src/element/pricing-renderer-element.ts:804-807`.
- `revealAddOns` only sets `_addOnsRevealed = true` and calls `requestUpdate()`:
  `src/element/pricing-renderer-element.ts:881-884`.
- Other handlers already move focus: dialog `pricing-renderer-element.ts:598-600` and `687-689`,
  dialog restore `718` and `753-756`, breakdown toggle `825`.
- The comparison button is rendered only while hidden rows remain: compact
  `src/element/renderers.ts:732-744`, table `renderers.ts:819-835`. The cap is a hard-coded 30
  rows per group: `renderers.ts:617-619`.
- The add-on button is rendered only while `!search && hidden > 0`: `renderers.ts:1188-1198`. Cap
  `ADDON_VISIBLE_CAP = 8` (`renderers.ts:80`). Selected add-ons beyond the cap are already visible
  before the reveal (`renderers.ts:1162`), so "first newly shown" is the first add-on, in source
  order, that was not rendered before. It is not always index 8.
- Add-on cards are keyed by id in filter mode (`renderers.ts:1129-1140`), so the card elements
  rendered before the reveal stay the same. Comparison rows are not keyed (`renderers.ts:702`,
  `795`), but new rows are appended after the first 30, so the first 30 `<tr>`/`<article>` stay.
- Neither the rows (`<tr data-pr-part="comparison-row">`, `renderers.ts:798`;
  `<article ... data-pr-part="comparison-row">`, `renderers.ts:705`) nor the add-on cards
  (`<article data-pr-part="add-on-card" data-add-on-id=...>`, `renderers.ts:1024-1030`) are
  focusable. The add-on card has a checkbox only when selection is enabled (`renderers.ts:1041-1066`).
- The theme focus ring covers only `button, a, input, select` (`src/styles/base.css:24-25`) and the
  selection control (`base.css:387-388`). A focused row or card gets only the browser default ring.
- The counters are `aria-live="polite"` already: comparison `renderers.ts:673`, add-ons
  `renderers.ts:1179`. The fix does not need a new live region.
- `RenderActions` and the renderers are not exported from any `src/**/index.ts` (grep, no match),
  so a change to the internal `revealGroup` signature is not public API. INTENT counts attribute,
  property, event field and CSS part as public API (`INTENT.md:106-107`).
- Tests: no test checks focus after "show more". Focus assertions exist only for the plan, dialog
  and breakdown flows (`tests/browser/pricing-renderer.spec.ts:317,329,740,1703-1718,1797`). The
  add-on button is clicked in `tests/browser/spectra-addon-grid.spec.ts:62` and checked absent at
  `:155-156`. The comparison buttons are clicked in a loop in
  `tests/browser/spectra-addon-marker.spec.ts:32-55`.
- Correction to the proposal: besides `:155-156`, `spectra-addon-grid.spec.ts:62` also uses the
  add-on button. It clicks it and does not check focus.
- Browser projects: chromium, firefox and webkit (`playwright.config.ts:32-36`). The SPECTRA specs
  skip non-chromium (`spectra-addon-grid.spec.ts:20-22`). CI runs `pnpm test:browser` with all three
  browsers installed (`.github/workflows/ci.yml:76-77`).
- Unit tests run in the `node` environment with no render (`vitest.config.ts:5`,
  `tests/unit/addon-grid-element.test.ts:1-4`), so focus can only be proved in the browser.
- Fixtures: Okta has 18 add-ons and is in filter mode (`spectra-addon-grid.spec.ts:16-17,127`).
  ClickUp has a 136-row "General" group (`docs/agent-work/visual-review-spectra/report.md:200`;
  fixture `tests/fixtures/spectra/clickup/2024.yml`). Which ClickUp group is expanded at load is
  not verified; the test expands it if needed.
- The reviewer followup ids 4610c985fc894023 and 464741c014d441e7 do not appear in the repository
  (grep, no match). They come from the proposal only.

## Scope

- Comparison, table and compact: after the reveal renders, focus the first newly shown
  `[data-pr-part="comparison-row"]` of that group.
- Add-on grid in filter mode: after the reveal renders, focus the first newly shown
  `[data-pr-part="add-on-card"]`.
- A theme focus ring for a focused row or card (uses `--pr-color-focus`, like `base.css:24-25`).
- A Playwright spec covering both buttons and both comparison layouts in chromium, firefox and webkit.
- A patch changeset.

## Non-goals

- No new or changed attribute, property, event, event field or `data-pr-part` value (public API per
  `INTENT.md:106-107`). No change to the 30-row or 8-card caps, the button text or the counters.
- No markup change to rows or cards at render time. `tabindex="-1"` is set only on the one focus
  target, by the handler (see D2).
- No change to the dialog, breakdown or plan focus flows.
- No backlog item of the proposal (Vue docs, vacuous unit assertion, Spanish plurals, SPECTRA
  opt-in, release decision).
- No visual baseline update: the responsive screenshots (`pricing-renderer.spec.ts:1330-1350`)
  never press "show more".

## Requirement drafts (the coordinator assigns the final ids)

- `req~reveal-focus-comparison~1`: WHEN the user activates the show-more button of a comparison
  group, the element SHALL, after the update completes, move focus to the first comparison row of
  that group that was not rendered before, in the table and in the compact layout.
- `req~reveal-focus-addons~1`: WHEN the user activates the add-on show-more button, the element
  SHALL, after the update completes, move focus to the first add-on card, in source order, that was
  not rendered before. A selected add-on that was already shown beyond the cap is not that card.
- `req~reveal-focus-visible~1`: A comparison row or add-on card focused this way SHALL show the
  theme focus ring (`--pr-color-focus`) when it matches `:focus-visible`, and SHALL NOT enter the Tab
  order of rows or cards that were not focused this way.

Scenarios for the test-designer:

- Okta, 1440x900, search empty, nothing selected: focus "Show 10 more" and press Enter. Then
  `document.activeElement` is inside `pricing-renderer`, is the 9th `add-on-card`, and its `h4` text
  equals `names[8]` of the revealed list.
- ClickUp, 1440x900 (table) and 375x800 (compact): expand the large group, focus its "Show N more"
  and press Enter. Then the focused element is the 31st `comparison-row` of that group and lies
  inside `pricing-renderer`.
- Pressing Tab after that moves focus to the next focusable element after the row or card, and
  never to `<body>`.

## Decisions taken in this intake (no owner decision needed)

- D1. Focus the row or card itself, not a control inside it. Reason: comparison rows have no
  control (`renderers.ts:798-814`), and add-on cards have a checkbox only with selection enabled
  (`renderers.ts:1041-1066`). One rule works for both buttons and for every mode.
- D2. Set `tabindex="-1"` only on the focus target, in the handler, and only if it has none.
  Reason: no change to rendered markup, so the unit tests that regex the rendered HTML (for example
  `tests/unit/addon-grid-filter.test.ts:232`) and host styles stay as they are. The target leaves
  the Tab order unchanged.
- D3. Capture "before" in the handler, before the state change: the visible add-on ids
  (`data-add-on-id` of the cards under `.pr-addon-main`), and for the comparison, the group
  container and its row count. For the comparison, pass the clicked button to the handler as an
  optional second argument of the internal `revealGroup` action
  (`revealGroup(groupId, origin?: HTMLElement)`). The container is
  `origin.closest('tbody, .pr-comparison-group')`. Reason: the table `<tbody>` has no id
  (`renderers.ts:780`), and with `closest` the group id never goes into a CSS selector. Existing
  callers that build `RenderActions` with `revealGroup: noop` (for example
  `tests/unit/addon-grid-filter.test.ts:38`) keep compiling.
- D4. Move focus on every activation, mouse included. Reason: the button is removed in every case,
  and WebKit does not focus a clicked button, so a "keyboard only" check would be unreliable. If no
  target is found (for example after a new load reset the state, `pricing-renderer-element.ts:415`),
  do nothing.
- D5. Use plain `focus()`, without `preventScroll`. Reason: the target renders where the button
  was, and a keyboard user needs it in view.
- D6. No feature flag. Reason: one capability in one PR, no public API, a small behaviour change
  that is reverted by reverting the PR.

## Slices

One change, one PR into develop. S1 and S2 are tasks of that PR and are not merged on their own
(S1 alone would merge a failing test). Order: S1, then S2. File ownership is disjoint.

### S1: failing browser test for focus after "show more"

- Role: test-designer (default model and effort). Turn budget: 40.
- Owns: `tests/browser/reveal-focus.spec.ts` (new). Nothing else.
- Read-only context: this intake, `tests/browser/helpers/spectra.ts` (`openRenderer`,
  `applyPricing`, `readFixture`), `tests/browser/spectra-addon-grid.spec.ts`,
  `tests/browser/pricing-renderer.spec.ts:300-330` (focus assertion style), `playwright.config.ts`,
  `src/element/renderers.ts:617-835,1123-1200`.
- Content: the scenarios above. Activate the buttons with the keyboard (`focus()` then `Enter`) so
  the test is the same in WebKit. Run in all three projects (no chromium-only skip), because focus
  behaviour differs per engine. Tag
  `[utest->req~reveal-focus-comparison~1] [utest->req~reveal-focus-addons~1]
[utest->req~reveal-focus-visible~1]` (final ids from the coordinator).
- Size: about 120-170 lines. Risk: **low** (score 0: tests only -2, floor 0).
- Checks:
  - `["pnpm", "install", "--frozen-lockfile"]`
  - red-before (G3), timeout 900: `{"argv": ["pnpm", "exec", "playwright", "test",
"tests/browser/reveal-focus.spec.ts", "--reporter=line"], "type": "red_before",
"expect_exit": [1], "expect_pattern": "toBeFocused|toBe\\(|toEqual\\(", "overlay":
["tests/browser/reveal-focus.spec.ts"]}`. On the base, the focused element is `<body>`, so the
    test fails by assertion. The pattern must match the assertion the test-designer actually uses.
  - `["pnpm", "exec", "eslint", "tests/browser/reveal-focus.spec.ts"]`
  - `["pnpm", "exec", "prettier", "--check", "tests/browser/reveal-focus.spec.ts"]`
- Depends on: the requirement text (coordinator). Nothing else.

### S2: move focus after both reveals

- Role: implementer (default model and effort). Turn budget: 40.
- Owns: `src/element/pricing-renderer-element.ts`, `src/element/renderers.ts`,
  `src/styles/base.css`, `.changeset/reveal-focus.md` (new).
- Read-only context: this intake, `tests/browser/reveal-focus.spec.ts` (from S1, frozen),
  `pricing-renderer-element.ts:593-600` (focus after `updateComplete`, the pattern to copy).
- Content: D2-D5 in `_revealGroup` and `revealAddOns`. In `renderers.ts`, pass
  `event.currentTarget` to `revealGroup` at lines 737 and 826, and widen the `RenderActions`
  type. In `base.css`, add a `:focus-visible` outline for
  `[data-pr-part="comparison-row"]` and `[data-pr-part="add-on-card"]` that matches `base.css:24-25`.
  Add `[impl->...]` tags next to the handlers. Add a patch changeset in the style of
  `.changeset/spectra-followups.md`.
- Size: about 50-90 lines without tests. Risk: **low** (score 0-1). It touches no risk area: no
  price computation, no auth, CI or schema. There is no public API change (`RenderActions` is not
  exported). The diff is under 200 lines. +1 only if `src/styles` counts as a second module. If the
  coordinator counts the whole product as the "pricing" risk area, the score is +3 (medium) and the
  panel grows. I do not recommend that, because the change does not touch price resolution.
- Checks:
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "typecheck"]`
  - `["pnpm", "lint"]`
  - `["pnpm", "test"]` (the unit render tests must not change)
  - `["pnpm", "exec", "playwright", "test", "tests/browser/reveal-focus.spec.ts", "--reporter=line"]`
    (timeout 900; must now pass in chromium, firefox and webkit)
  - `["pnpm", "exec", "playwright", "test", "tests/browser/spectra-addon-grid.spec.ts",
"tests/browser/spectra-addon-marker.spec.ts", "--project=chromium", "--reporter=line"]`
    (timeout 1200; regression for the two specs that click these buttons)
  - `["pnpm", "format:check"]`
- Depends on: S1 integrated (its test is the acceptance).

Change-level check for the PR (same as CI `browsers`, `ci.yml:77`), heavy:
`["pnpm", "test:browser"]` with timeout 1800, or rely on the CI run of the PR.

## Gates per slice

The skills I read for this intake define G3, G4 and G13 (`factory:qa-checks`). For the rest I keep
the mapping of the previous intake (`docs/agent-work/prop-20261025-1/intake.md:132-152`), which found
no definition for G5 and G7. I did not check that again.

- G1, openspec validate --strict: change level, for both, once the change exists.
- G2, EPIC spec review: applies at change level (the change carries 3 requirements).
- G3, red-before: S1 applies (the check above). S2 N/A.
- G4, acceptance freeze: the coordinator freezes `tests/browser/reveal-focus.spec.ts` after S1, and
  S2 runs the frozen test.
- G5: not defined in the skills I read; the coordinator maps it.
- G6, trace: S1 adds the `utest` tags, S2 adds the `impl` tags, and the trace passes at change level.
- G7: not defined in the skills I read; the coordinator maps it.
- G8, mutation: N/A for both, unless one is registered for `src/element`.
- G9, dependency and licence: N/A for both (no dependency).
- G10, secrets: applies to both if registered.
- G11, review: S1 by a test-reviewer. S2 by one reviewer (low risk), who checks D1-D5.
- G12, ui-qa: S1 N/A. S2 applies: the focus ring shows on a row and on a card, light and dark, at
  375 and 1440.
- G13, how-to-test: S1 N/A. S2 applies: a guide with keyboard steps on Okta (add-ons) and ClickUp
  (comparison).

## Open questions

None needs a CRP. The change adds no public API (`INTENT.md:106-107`), and the proposal already
states the behaviour. The owner can veto these in review:

- D4, moving focus on a mouse click as well.
- The new focus ring on rows and cards (`req~reveal-focus-visible~1`). It is visible only on
  keyboard focus, and the responsive baselines do not show it.

Needs for the coordinator (not owner decisions):

- `openspec/` still does not exist at `3841e7c` (glob `openspec/**`, no match). The OpenSpec change
  needs `openspec init` first, or the earlier convention of a spec under
  `docs/agent-work/<id>/spec.md` (for example `docs/agent-work/spectra-item7-addon-grid/spec.md`).
- The lab must have the Playwright browsers for chromium, firefox and webkit installed. The
  webServer runs `pnpm demo` (`playwright.config.ts:26-31`), which builds first. I could not verify
  either in this role.
- Assign the final requirement ids.
