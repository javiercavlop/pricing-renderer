# SPECTRA layout metrics

Measured on the 37 pricings in `tests/fixtures/spectra/<saas>/<year>.yml`, parsed with
`parsePricingYaml` and turned into a view model with `createPricingViewModel` (default options,
default visibility, so private plans and add-ons are excluded). The full per-pricing data, including
the row ids behind every count and up to five unit examples per pricing, is in `metrics.json`. The
numbers are reproduced by `tests/unit/spectra-layout-metrics.test.ts`
(`SPECTRA_METRICS_OUT=docs/agent-work/visual-review-spectra/metrics.json`).

## Definitions

- Rows: comparison rows over `viewModel.comparisonGroups` (features and usage limits whose `render`
  is not `disabled`).
- Identical: rows whose value is deep-equal in every plan, which a "differences only" toggle would
  hide. Rows left = rows minus identical.
- Add-on only: every plan cell is empty (`false`, `null` or `undefined`, shown as "—") and at least
  one add-on gives a value for the same feature id (`addOn.features`) or usage limit id
  (`addOn.usageLimits` or `addOn.usageLimitsExtensions`). A candidate for an "Add-on" label.
- Unit-plural: usage-limit rows with a unit and at least one finite numeric plan value other than 1
  (`renderValue` writes `<number> <unit>` as is, for example `3 unit`).
- No desc / filler: rows with no description, and rows whose description equals the name ignoring
  case. Plans and add-ons are counted the same way in `metrics.json`; the table shows plans and
  add-ons with no description.
- Longest texts are character counts of the row name, description (rows, plans and add-ons), string
  cell value, plan name and add-on name; the id of the worst one is in `metrics.json`.

## Summary

- Pricings: 37. Total rows per pricing: min 15, first quartile 49, median 65, third quartile 98, max
  174 (quartiles use linear interpolation).
- Pricings over 100 rows: 8 strictly over 100 (ClickUp, Zoom, Okta, Salesforce, Webflow, Postman,
  Canva, Dropbox); 9 with 100 or more, adding Deskera, which has exactly 100.
- Comparison groups: 4 pricings have 1 group, 30 have 2 groups, so 34 of 37 have 1 or 2 groups. The
  other three are Shopify (6 groups), Zenhub (7) and Zoom (10).
- Orphan card on the last row of a grid (pricings with more than one plan): 17 on a 3-column grid
  (`plans % 3 === 1`), 5 on a 4-column grid (`plans % 4 === 1`), 22 on either. `plansMod3` and
  `plansMod2` per pricing are in `metrics.json`.
- Longest values across all pricings: row name 65 characters (Okta), description 398 (Zoom,
  `waitingRoom`), string cell 76 (Wrike, `multiLanguageSupport` on the FREE plan), plan name 29
  (Webflow, `WORKSPACES_INHOUSE_ENTERPRISE`), add-on name 53 (OpenPhone,
  `carrierReviewAndSetupFeesForUsCanadaMessaging`).
- Okta has 0 plans, so every one of its 141 rows counts as "identical in all plans" and as "add-on
  only" vacuously. Read those two columns for Okta as not meaningful.

## Per pricing, sorted by total rows

Columns: Plans, Add-ons, Groups, Rows, Feat (feature rows), Lim (usage-limit rows), Ident
(identical in all plans), Left (rows after a differences-only filter), AddOn (add-on only rows), Unit
(unit-plural candidates), NoDesc (rows with no description), Fill (rows with filler description),
PlanND (plans with no description), AddND (add-ons with no description), then the longest name,
description, string cell, plan name and add-on name in characters.

| Pricing              | Plans | Add-ons | Groups | Rows | Feat | Lim | Ident | Left | AddOn | Unit | NoDesc | Fill | PlanND | AddND | Name | Desc | Cell | Plan | Add-on |
| -------------------- | ----: | ------: | -----: | ---: | ---: | --: | ----: | ---: | ----: | ---: | -----: | ---: | -----: | ----: | ---: | ---: | ---: | ---: | -----: |
| clickup              |     4 |       2 |      2 |  174 |  136 |  38 |    67 |  107 |     1 |   38 |    150 |    0 |      0 |     2 |   51 |  125 |   13 |   10 |     31 |
| zoom                 |     5 |      16 |     10 |  151 |  143 |   8 |    64 |   87 |    13 |    8 |    139 |    0 |      1 |    16 |   39 |  398 |    0 |   13 |     44 |
| okta                 |     0 |      18 |      2 |  141 |  140 |   1 |   141 |    0 |   141 |    0 |    139 |    0 |      0 |    18 |   65 |   83 |    0 |    0 |     36 |
| salesforce           |     3 |      14 |      2 |  124 |  111 |  13 |    87 |   37 |    44 |   13 |     76 |    0 |      3 |    14 |   46 |  159 |    0 |   13 |     50 |
| webflow              |    15 |       3 |      2 |  118 |   94 |  24 |     3 |  115 |     1 |   24 |     41 |    0 |     15 |     3 |   38 |  268 |    2 |   29 |     22 |
| postman              |     4 |      12 |      2 |  112 |  100 |  12 |    66 |   46 |    14 |   12 |     81 |    0 |      4 |    12 |   37 |  108 |    0 |   12 |     32 |
| canva                |     4 |       0 |      2 |  106 |   92 |  14 |    45 |   61 |     0 |   12 |      0 |   14 |      0 |     0 |   45 |  170 |   12 |   10 |      0 |
| dropbox              |     5 |       4 |      2 |  103 |   86 |  17 |    50 |   53 |     0 |   10 |    103 |    0 |      5 |     4 |   52 |    0 |    0 |   13 |     21 |
| deskera              |     3 |       0 |      1 |  100 |  100 |   0 |    87 |   13 |     0 |    0 |    100 |    0 |      3 |     0 |   26 |    0 |    0 |   12 |      0 |
| mailchimp            |     4 |       5 |      2 |   98 |   90 |   8 |    56 |   42 |    16 |    8 |     98 |    0 |      0 |     5 |   41 |   64 |    0 |   10 |     48 |
| figma                |     6 |       0 |      2 |   93 |   91 |   2 |    30 |   63 |     0 |    2 |     93 |    0 |      6 |     0 |   32 |    0 |   38 |   21 |      0 |
| buffer               |     4 |       3 |      2 |   92 |   76 |  16 |    39 |   53 |     0 |   16 |      0 |   10 |      0 |     3 |   50 |  362 |    0 |   10 |     25 |
| github               |     3 |      14 |      2 |   90 |   81 |   9 |    76 |   14 |    32 |    5 |      6 |    0 |      0 |    14 |   54 |  314 |    0 |   10 |     26 |
| wrike                |     5 |       5 |      2 |   86 |   81 |   5 |    21 |   65 |     3 |    5 |      7 |    0 |      0 |     5 |   42 |  203 |   76 |   10 |     23 |
| clockify             |     6 |       4 |      1 |   72 |   72 |   0 |    23 |   49 |     0 |    0 |      0 |    0 |      0 |     4 |   31 |  139 |    0 |   11 |     16 |
| databox              |     5 |       8 |      2 |   72 |   64 |   8 |    30 |   42 |     3 |    8 |     60 |    0 |      5 |     8 |   34 |  301 |   13 |   12 |     28 |
| userguiding          |     3 |      11 |      2 |   68 |   59 |   9 |    45 |   23 |     0 |    9 |     68 |    0 |      0 |     1 |   34 |   96 |    0 |   12 |     29 |
| jira                 |     4 |       1 |      2 |   66 |   60 |   6 |    29 |   37 |     0 |    6 |     65 |    0 |      4 |     1 |   41 |   79 |    0 |   10 |     22 |
| notion               |     4 |       2 |      2 |   65 |   58 |   7 |    32 |   33 |     1 |    6 |     65 |    0 |      4 |     2 |   36 |    0 |    0 |   10 |     19 |
| microsoft365Business |     4 |       1 |      2 |   64 |   60 |   4 |    30 |   34 |     1 |    4 |     23 |    0 |      4 |     1 |   34 |  130 |    0 |   17 |     10 |
| hypercontext         |     4 |       0 |      1 |   63 |   63 |   0 |     6 |   57 |     0 |    0 |     63 |    0 |      0 |     0 |   39 |   57 |    0 |   10 |      0 |
| box                  |     5 |       9 |      2 |   60 |   50 |  10 |    23 |   37 |     4 |    7 |     60 |    0 |      5 |     5 |   47 |  132 |    0 |   16 |     27 |
| circleci             |     3 |       7 |      2 |   58 |   49 |   9 |    30 |   28 |     4 |    9 |     57 |    0 |      3 |     7 |   36 |   23 |    0 |   11 |     16 |
| zapier               |     4 |       4 |      2 |   54 |   51 |   3 |    15 |   39 |     3 |    2 |     54 |    0 |      0 |     4 |   30 |   54 |    0 |   12 |     26 |
| openphone            |     3 |       6 |      2 |   52 |   48 |   4 |    33 |   19 |     6 |    2 |     50 |    0 |      3 |     6 |   38 |   11 |    0 |   10 |     53 |
| planable             |     4 |       5 |      2 |   52 |   41 |  11 |    29 |   23 |     4 |    9 |     42 |    0 |      0 |     0 |   30 |  104 |    0 |   10 |     25 |
| slack                |     4 |       4 |      2 |   51 |   44 |   7 |    13 |   38 |     2 |    6 |      0 |    0 |      0 |     4 |   37 |  384 |   62 |   15 |     29 |
| trustmary            |     4 |       1 |      2 |   49 |   44 |   5 |    28 |   21 |     1 |    3 |     48 |    0 |      1 |     1 |   37 |   49 |    0 |    8 |     25 |
| trello               |     4 |       1 |      2 |   46 |   41 |   5 |    18 |   28 |     1 |    3 |     27 |    0 |      4 |     0 |   29 |  233 |   23 |   10 |     16 |
| shopify              |     3 |       1 |      6 |   43 |   38 |   5 |    28 |   15 |     1 |    2 |      6 |    0 |      0 |     0 |   59 |  179 |   10 |    8 |     15 |
| zenhub               |     2 |       0 |      7 |   43 |   39 |   4 |    20 |   23 |     0 |    4 |     43 |    0 |      2 |     0 |   40 |    0 |    0 |   10 |      0 |
| tableau              |     3 |       7 |      2 |   42 |   41 |   1 |    19 |   23 |    10 |    1 |     31 |    0 |      0 |     7 |   58 |  139 |    0 |    8 |     24 |
| pumble               |     4 |       0 |      2 |   41 |   34 |   7 |    27 |   14 |     0 |    7 |      0 |    0 |      0 |     0 |   28 |  133 |    0 |   10 |      0 |
| evernote             |     4 |       0 |      2 |   39 |   32 |   7 |    21 |   18 |     0 |    7 |     23 |    0 |      0 |     0 |   34 |   93 |    0 |   11 |      0 |
| crowdcast            |     3 |       4 |      2 |   22 |   17 |   5 |    14 |    8 |     1 |    5 |      6 |    0 |      0 |     0 |   28 |  224 |    2 |    8 |     25 |
| overleaf             |     4 |       0 |      2 |   18 |   16 |   2 |     5 |   13 |     0 |    2 |      0 |    0 |      4 |     0 |   29 |  272 |    0 |   12 |      0 |
| quip                 |     3 |       0 |      1 |   15 |   15 |   0 |     7 |    8 |     0 |    0 |     15 |    0 |      0 |     0 |   41 |   81 |    0 |    8 |      0 |

## Discrepancies with the owner numbers

- Median total rows: the owner said about 60; the measured median of the 37 totals is 65 (the 19th
  value, Notion). Quartiles are 49 and 98.
- "Almost all" pricings have 1 or 2 comparison groups: confirmed, 34 of 37 (4 with 1 group, 30 with
  2). The exceptions are Shopify (6), Zenhub (7) and Zoom (10).
- Pricings over 100 rows: 8 strictly over 100; Deskera has exactly 100, so "100 or more" gives 9.
  The nine totals the owner measured are all reproduced exactly (ClickUp 174, Zoom 151, Okta 141,
  Salesforce 124, Webflow 118, Postman 112, Canva 106, Dropbox 103, Deskera 100), the nine largest
  are exactly those nine, Webflow has 15 plans, and Okta has 0 plans and 18 add-ons.
