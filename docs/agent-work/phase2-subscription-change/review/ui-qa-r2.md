# UI QA, round 2: `<pricing-change-review>` at 08c8fa4 (PR 63)

Static review. The lab has no browser and I have no image tool. Nothing below was rendered, and no
screenshot was viewed. The Playwright specs (`tests/browser/change-review-ui.spec.ts`) were read, not run.

## Findings

```yaml
- id: R2-UIQ-001
  severity: minor
  location: src/styles/base.css:1830 (.pr-button white-space: nowrap), src/element/change-review-renderers.ts:372
  req: none (WCAG 1.4.10 reflow)
  claim: >
    A host label from `confirm-label`, or a long translated label, cannot wrap. In the narrow
    layout each button is `flex: 1 1 8rem`, so the text can overflow the 320 px container.
  evidence: |
    quote base.css:1830 "white-space: nowrap;" with base.css:1888 "flex: 1 1 8rem;"
    renderers.ts:372 "state.confirmLabel || t(state, 'pricing.reviewConfirm')"
    The "nothing overflows a 320px container" test (spec:599) uses the default labels only.
  fix: Allow wrapping in the narrow container (white-space: normal, or min-inline-size: 0 with wrapping), or add a long-label case to the 320 px test.
  confidence: medium

- id: R2-UIQ-002
  severity: minor
  location: src/element/change-review-renderers.ts:417-419; mock README open question 4
  req: none
  claim: >
    The headings are h2 for the title and h3 for the sections, fixed. The mock used h3/h4 and
    left the level open. A host that puts the element under an h2 gets a skipped or duplicate
    level. This is documented but not configurable.
  evidence: 'quote renderers.ts:419 "<h2 id=${titleId} ... >" and renderers.ts:143 "<h3 id=${titleId}>"'
  fix: Accept and record the fixed levels as the owner's answer to question 4 (the docs already say h2/h3). No code change needed.
  confidence: high

- id: R2-UIQ-003
  severity: minor
  location: src/element/change-review-renderers.ts:396; mock index.html:283
  req: none
  claim: >
    The "Nothing changes" note has no `role="status"` (the mock had it). The pending status
    region is correct (always present, filled on pending). Focus moves to the h2 on a new
    comparison, so the note is probably read after the title anyway.
  evidence: 'mock index.html:283 `<p class="pr-cr-notice" role="status">`; renderers.ts:396 has none.'
  fix: Optional. Leave as is, or add role="status" to match the mock.
  confidence: low

- id: R2-UIQ-004
  severity: nit
  location: src/styles/base.css:1629-1632
  req: none
  claim: '`list-style: none` on the `ul`s removes list semantics in Safari/VoiceOver. This is a known quirk.'
  evidence: 'quote base.css:1631 "list-style: none;"'
  fix: Add role="list" to the `ul`s, or ignore it.
  confidence: medium

- id: R2-UIQ-005
  severity: nit
  location: tests/browser/change-review-ui.spec.ts
  req: none
  claim: No RTL or 1200 px case in the spec. The CSS uses logical properties (inline-size, margin-inline-end, border-block-start), so RTL is probably fine, but this is unverified.
  evidence: 'grep of the spec for "rtl|dir=" found none; the layout tests use container widths (spec:567-610).'
  fix: Optional smoke test with dir="rtl" (no horizontal overflow, the status text at the start side).
  confidence: low
```

## Deviations from the approved mock

These are not defects unless the owner objects. The mock README did not decide them.

- Usage limits are `change-row` list rows in every width. The mock used a table from 600 px and a block per
  limit below. This is the "plain list" option of open question 3 and is simpler.
- There are no sub-group headings (Added, Removed automatically, Quantity changed, Gained, Lost, Changed). Each
  kind is a badge on the row.
- The relation chip is a badge in the plan row, not in the header. The version banner sits under the plan row
  inside the Plan section, not under the header.
- "Unchanged" is a section with a count sentence, not a `<details>` list (question 2). There is no expand control.
- Tokens, cards, badge tones and the sticky footer below 600 px (container query) match the mock.

## What I could check statically

- **States.** Default, pending, error, nothing changes and quote are all covered by the renderers and have specs.
  Pending: the status `p` is always present, Confirm is `aria-disabled` and `aria-busy`, Back stays enabled.
  Error: `role="alert"`, and focus goes to Confirm. Nothing changes: no sections, Confirm blocked.
  Quote: Confirm stays enabled, the same as the open question 6 behaviour.
- **Focus order.** Title (programmatic only), then the content, which has no controls, then Back, then Confirm.
  `aria-disabled` keeps Confirm focusable. The focus ring is on `button, h2` with a 3px offset.
- **Contrast (computed by hand from theme.css).** Light: warning #9a5600 on #fff7e8 is about 5.3:1. Muted
  #626275 on #fff is above 5.5:1. White on the accent #6558e8 is about 5.1:1. The disabled Confirm (muted on
  #f5f5f8) is above 5:1. Dark: the tokens are lighter, so all of these pass by a wide margin. The tinted badges
  are darkened, with a comment. Not measured in a browser; axe at 375 px in both themes is in the spec.
- **Forced colors.** The root, the sections and the buttons get system-colour borders. Every change is named in
  text, so no meaning is carried by colour only.
- **Reduced motion.** Transitions and animations are shortened for the element.
- **Themes.** Default is light. `theme="dark"`, `[data-theme=dark]` and `theme="auto"` are in theme.css, with the
  `prefers-color-scheme` media query.
- **Responsive.** The container query switches at 600 px: three price columns, or two when there is no difference.
  Below that, a sticky action bar. Names wrap (`overflow-wrap`, `min-inline-size: 0`).
- **`data-pr-part` hooks vs docs.** docs/theming.md:167-183 lists 17 parts. The renderers emit each one
  (`change-review`, `review-title`, the review-* sections, `change-row`, `change-badge`, `change-actions`,
  `review-status`, `review-back`, `review-confirm`, `review-error`, `review-no-changes`). The mock's
  `change-section` is not used and not documented, which is consistent.
- **Text only.** Every name, reason, notice and error is a Lit text binding. There is no `unsafeHTML`.

## Could not verify without a browser

Any rendered result: the 375 and 1200 px screenshots, the sticky bar's real behaviour inside a scrolling host,
`:has()` and container-query support in the browsers used, `color-mix` colours, forced-colors rendering,
RTL layout, 200% zoom, a screen reader's reading of the live regions, and whether the spec passes. The task
asked for 375 and 1200 px screenshots, and they were not produced.

```yaml
verdict: approve
round: 2
counts: {blocker: 0, major: 0, minor: 3, nit: 2}
checked: [states, heading levels, labelling, focus order, keyboard flow, contrast by hand, forced-colors CSS, reduced-motion CSS, themes, responsive CSS, data-pr-part vs docs, mock deviations, text-only rendering]
not_checked: [rendered layout, screenshots at 375 and 1200 px, RTL rendering, zoom, screen reader output, spec runs (no browser, checks not registered)]
```
