# SPECTRA O1 re-measure (partial)

- Objective: O1 of `INTENT.md` (real-world Pricing2Yaml pricings render legibly). Old values come from
  `docs/agent-work/visual-review-spectra/report.md` (phase 1). `report.md` below means that file.
- Date: 2026-10-26. Target: develop head `5b75ae6a8306f9a11a146012c91b82a551c8672e` (merge of PR 53).
- **Coverage: 14 of 111 pricing x viewport pairs (light, `en`) measured. 4 of 37 pricings are fully
  measured, 1 more has 2 of 3 viewports, 32 pricings are not measured.** This file does not support a
  conclusion about the 37 pricings. It records what could be read and nothing else.

## Source and its limits

- The `browsers` job of develop head `5b75ae6` (check run `121524468410`) was still `in_progress` when
  this was written. `ci_log` for it returned `404: job log storage refused the download`.
- Values below come from the last 1500 lines of the `browsers` job of PR 53, check run
  `121511930049` (success), head `57a25c29b416cd84b2341b26dd9b8913887bb87a`. This is the commit that PR
  53 merged into develop. Whether the tree of `5b75ae6` equals that head was not verified.
- No lab run: the lab has no Playwright browsers. Nothing was estimated or inferred.
- The tail holds 33 `SPECTRA_SUMMARY` lines, for 5 pricings only: webflow, salesforce, github, dropbox,
  figma. The earlier lines of the job log cannot be read through `ci_log` (maximum 1500 lines).
- The lines include dark and `es` runs. Only light + `en` is used for the tables, as in `report.md`
  (`report.md:440-442`). Other runs are marked as such.
- `xscreens=` (expanded-state height, PR 53) is `-` ("not measured") on all 33 lines, so the expanded
  height has no value here.
- Definitions are unchanged: `screens` = renderer height / viewport height, collapsed state; `fv` =
  plan cards visible / price visible / CTA visible, read with the renderer at the top of the viewport
  (`report.md:451-454`, `report.md:522-523`).

## Coverage table (light, `en`)

| Pricing    | 1440         | 1024     | 375      |
| ---------- | ------------ | -------- | -------- |
| salesforce | measured     | measured | measured |
| github     | measured     | measured | measured |
| dropbox    | measured     | measured | measured |
| figma      | measured     | measured | measured |
| webflow    | not measured | measured | measured |

The other 32 pricings (alphabetical list is in `tests/fixtures/spectra/`) are not measured at any
viewport. Of these, 24 had values in phase 1 (`report.md:460-490`) and 8 had none (box, buffer, canva,
circleci, clockify, crowdcast, databox, deskera).

Webflow 1440 light `en` has no line. Two other runs of it exist: dark `en` 4.17 screens and light `es`
4.21 screens. They are shown separately and are not counted as measured.

## Signal 1: page height in viewports (`rendererHeightInViewports`, collapsed)

Old = `report.md:460-490`. New = this file. Same pricing, same viewport, light `en`.

| Pricing    | 1440 old | 1440 new     | 1024 old | 1024 new | 375 old | 375 new |
| ---------- | -------- | ------------ | -------- | -------- | ------- | ------- |
| salesforce | 6.05     | 3.12         | 8.72     | 3.81     | 17.41   | 15.09   |
| github     | 7.44     | 3.15         | 11.33    | 3.84     | 20.19   | 17      |
| dropbox    | 4.73     | 3.28         | 6.29     | 3.75     | 17.79   | 17.79   |
| figma      | 4.04     | 2.44         | 5.25     | 2.65     | 19.39   | 18.41   |
| webflow    | 8.82     | not measured | 12.62    | 5.61     | 44.63   | 44.63   |

Webflow 1440, other runs only: dark `en` 4.17, light `es` 4.21 (old light `en` 8.82).

Summary over the measured pairs only (not comparable with the phase 1 figures over 29 pricings):

| Viewport | Measured pricings | Min   | Median | Max   | At most 3 | At most 5 | Phase 1 value for the same pricings |
| -------- | ----------------- | ----- | ------ | ----- | --------- | --------- | ----------------------------------- |
| 1440     | 4 of 37           | 2.44  | 3.135  | 3.28  | 1 of 4    | 4 of 4    | 4.04 to 7.44, 0 of 4 at most 3      |
| 1024     | 5 of 37           | 2.65  | 3.81   | 5.61  | 1 of 5    | 5 of 5    | 5.25 to 12.62, 0 of 5 at most 3     |
| 375      | 5 of 37           | 15.09 | 17.79  | 44.63 | 0 of 5    | 0 of 5    | 17.41 to 44.63, 0 of 5 at most 3    |

The phase 1 figures for all 29 pricings (1440: 2.4 to 8.82, median 4.85, 2 of 29 at most 3; 375: 3.95
to 44.63, 0 of 29 at most 3; `INTENT.md` O1) cannot be compared with the table above. The new range
and median are for 4 or 5 pricings that were among the taller ones in phase 1 (zenhub 2.4 and quip 2.46
are not measured).

## Signal 2: call to action in the first viewport (`fv`, third value)

Old = `report.md:525-533`. New = this file, light `en`. "visible" = CTA flag 1.

| Viewport | Old, same pricings                                        | New, measured pricings                                    | Not measured         |
| -------- | --------------------------------------------------------- | --------------------------------------------------------- | -------------------- |
| 1440     | visible: salesforce, github, dropbox, figma. Not: webflow | visible: salesforce, github, dropbox, figma               | webflow (light `en`) |
| 1024     | visible: salesforce, figma. Not: github, dropbox, webflow | visible: salesforce, github, dropbox, figma. Not: webflow | none                 |
| 375      | visible: salesforce, dropbox, figma, github. Not: webflow | visible: salesforce, github, dropbox, figma. Not: webflow | none                 |

Webflow 1440, other runs: dark `en` and light `es` both `fv=8/1/1`, CTA visible (old: not visible).

Pricings where the CTA is not visible, over the measured pairs: 1440 none of 4; 1024 webflow (1 of 5);
375 webflow (1 of 5). The phase 1 count over all pricings was 8 at 1440 and 7 at 375 (`INTENT.md` O1).
The pricings that were failing in phase 1 other than webflow (shopify, tableau, trello, trustmary,
userguiding, wrike, zoom) are not measured, so the overall counts are unknown.

## Signal 3: plan cards per row (`planCardsPerRow`) and lone last card

Old = `report.md:506-518`. New = `cards=<n>/<per row>` of this file. 375 is one column.

| Pricing    | Plans | 1440 new                                                 | 1024 new  | Lone last card at 1440 / 1024               |
| ---------- | ----- | -------------------------------------------------------- | --------- | ------------------------------------------- |
| salesforce | 3     | 3                                                        | 3         | no / no (old 1024: 2+1)                     |
| github     | 3     | 3                                                        | 3         | no / no (old 1024: 2+1)                     |
| dropbox    | 5     | 3+2                                                      | 3+2       | no / no (old 1024: 2+2+1)                   |
| figma      | 6     | 3+3                                                      | 3+3       | no / no                                     |
| webflow    | 15    | 4+4+4+3 (dark `en`, light `es`; light `en` not measured) | 3+3+3+3+3 | no / no (old 1024: ends with a single card) |

- Lone last card in the measured pairs: 0 of 4 at 1440 (light `en`), 0 of 5 at 1024. The phase 1 count of
  5 pricings with 3+1 at 1440 (`INTENT.md` O1) refers to pricings that are not measured here (slack,
  trello, trustmary, zapier, clickup). Whether they still show 3+1 is unknown.
- Card width `w=` is 417.94 at 1440, 297.48 at 1024 and 321 at 375 for the measured runs. Phase 1
  recorded 320 px at 1440 and 1024 (`report.md:503`). I did not investigate the change.

## Signal 4: truncated texts and awkward breaks

Old = `report.md:555-559`. New = `trunc=` and `breaks=` of this file.

| Count                      | Old                                                           | New, measured runs                                                         |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Truncated texts            | 0 in every record                                             | 0 in all 33 lines                                                          |
| Awkward breaks, light `en` | salesforce, figma (375), github had one (`report.md:557-558`) | 0 in all 14 light `en` lines (salesforce, github, figma, dropbox, webflow) |
| Awkward breaks, other runs | `es` adds 1 or 2 on okta, github, dropbox                     | github 1440 light `es`: 2. All other 18 non-light-`en` lines: 0            |

Examples of the breaks are not in the summary line (`SPECTRA_TEXT` lines were not in the window used),
so none are listed. The other pricings with a phase 1 break (mailchimp, microsoft365Business, zoom,
okta) are not measured.

## Supporting evidence from the gating specs

These are assertions that run on every pull request. They are not values, and they were not re-run.

- `spectra-grid.spec.ts:73-84`: the first CTA must be visible at 1440x900 for every pricing with plans.
- `spectra-grid.spec.ts:66-70`: cards per row must equal the expected rows, and a lone last card is allowed
  only for the exempt counts (`helpers/plan-columns.ts:45-51`). It runs at 1440, 1200 and 1024, not at 375.
- `spectra-text.spec.ts:86`: no truncation example for any fixture at the 3 viewports.
  `spectra-text.spec.ts:81-84`: no awkward-break example, only for the 6 pricings in `gatedBreaks`.
- The `browsers` job of PR 53 (`121511930049`) and PR 51 (`121088477761`) passed, so these assertions
  held at those heads. That is consistent with the measured pairs above, and it does not give the
  values for the pairs that are not measured.

## What is missing and how to close it

- 97 of 111 light `en` pairs have no value. The 1500-line limit of `ci_log` hides the earlier lines of
  every green `browsers` job.
- Options, for the owner or the coordinator to choose: download the `playwright-report` artifact of the
  develop `browsers` job (retention 14 days, one `<fixture>-<width>-light-en-metrics` JSON attachment per
  test, `spectra-review.spec.ts:413`); or run `spectra metrics` in an environment with Playwright
  Chromium. After the develop head job finishes, `ci_log` could be tried again, but it will show the same
  tail window.
- No threshold is proposed or decided here. Q2 and Q3 of `INTENT.md` stay with the owner.
