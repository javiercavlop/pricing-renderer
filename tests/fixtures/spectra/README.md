# SPECTRA fixtures

Real SaaS pricings for exercising the renderer on real-world data: visual
review, layout and normalization tests. They are test data only and are not
part of the published package (`package.json` publishes `dist` and the
documents listed in `files`).

## Source and license

- Dataset: SPECTRA, SaaS Pricing Evaluation Corpus for Temporal Representation
  & Analysis. Francisco Javier Cavero, José Antonio Parejo, Juan C. Alonso and
  Antonio Ruiz-Cortés, version 1.2.0, Zenodo, 2025.
  <https://doi.org/10.5281/zenodo.17237164>
- Copy used: `data/pricings/spectra` of
  <https://github.com/isa-group/pricing-intelligence-labpack> at commit
  `49e90f5a3d4dde91d15614e5c8269085888b6f0b`. That copy extends SPECTRA 1.2.0
  with seven more SaaS and the 2025 snapshots.
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
  for SPECTRA 1.2.0. The labpack copy at commit `49e90f5` is also under CC BY
  4.0, according to the `LICENSE.txt` at the root of that repository, which
  covers the seven extended SaaS.
- Changes: the sources use Pricing2Yaml 2.1. Each file was upgraded to 3.1
  with `retrievePricingFromPath` of pricing4ts 0.12.1, the same upgrade SPHERE
  applies to the pricings it stores. One value was corrected before the
  upgrade (see Trello below); nothing else was edited. `SHA256SUMS` lists the
  digests of the files here; check them with
  `cd tests/fixtures/spectra && sha256sum -c SHA256SUMS`.

## Selection

One snapshot per SaaS, the latest one up to 2024 (Shopify has none after
2022).

That covers the 30 SaaS of SPECTRA 1.2.0 and the seven SaaS of the extended
copy (marked ²). They bring the extremes: a pricing without plans and with 18
add-ons (Okta), 143 features (Zoom) and 15 plans (Webflow).

Trello 2024 sets `powerUpsLimit.defaultValue` to `1_000_000_000`, which a YAML
1.2 parser such as pricing4ts's reads as a string, so neither pricing4ts nor
SPHERE loads it (the 2021 to 2023 snapshots share the value). The number
stands for "unlimited": since 24 August 2021 every Trello plan, Free
included, has unlimited Power-Ups per board, and the 2020 snapshot already
writes unlimited as `.inf`. The value here is `.inf`.

All files load in this renderer without errors; Okta, which has no plans,
yields the `PR_PLANS_EMPTY` warning.

| SaaS | File | Plans | Features | Usage limits | Add-ons | Currency |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Box | `box/2024.yml` | 5 | 50 | 10 | 9 | EUR |
| Buffer | `buffer/2024.yml` | 4 | 76 | 16 | 3 | USD |
| Canva | `canva/2024.yml` | 4 | 92 | 14 | 0 | EUR |
| CircleCI ² | `circleci/2024.yml` | 3 | 49 | 9 | 7 | USD |
| ClickUp | `clickup/2024.yml` | 4 | 136 | 38 | 2 | USD |
| Clockify | `clockify/2024.yml` | 6 | 72 | 0 | 4 | USD |
| Crowdcast | `crowdcast/2024.yml` | 3 | 17 | 5 | 4 | USD |
| Databox | `databox/2024.yml` | 5 | 64 | 8 | 8 | USD |
| Deskera | `deskera/2024.yml` | 3 | 100 | 0 | 0 | USD |
| Dropbox | `dropbox/2024.yml` | 5 | 86 | 17 | 4 | EUR |
| Evernote | `evernote/2024.yml` | 4 | 32 | 7 | 0 | USD |
| Figma | `figma/2024.yml` | 6 | 91 | 2 | 0 | USD |
| GitHub | `github/2024.yml` | 3 | 81 | 9 | 14 | EUR |
| Hypercontext | `hypercontext/2024.yml` | 4 | 63 | 0 | 0 | USD |
| Jira | `jira/2024.yml` | 4 | 60 | 6 | 1 | USD |
| Mailchimp | `mailchimp/2024.yml` | 4 | 90 | 8 | 5 | USD |
| Microsoft 365 Business | `microsoft365Business/2024.yml` | 4 | 60 | 4 | 1 | USD |
| Notion | `notion/2024.yml` | 4 | 58 | 7 | 2 | USD |
| Okta ² | `okta/2024.yml` | 0 | 140 | 1 | 18 | USD |
| OpenPhone | `openphone/2024.yml` | 3 | 48 | 4 | 6 | USD |
| Overleaf | `overleaf/2024.yml` | 4 | 16 | 2 | 0 | USD |
| Planable | `planable/2024.yml` | 4 | 41 | 11 | 5 | USD |
| Postman | `postman/2024.yml` | 4 | 100 | 12 | 12 | USD |
| Pumble | `pumble/2024.yml` | 4 | 34 | 7 | 0 | USD |
| Quip | `quip/2024.yml` | 3 | 15 | 0 | 0 | USD |
| Salesforce | `salesforce/2024.yml` | 3 | 111 | 13 | 14 | USD |
| Shopify ² | `shopify/2022.yml` | 3 | 38 | 5 | 1 | USD |
| Slack | `slack/2024.yml` | 4 | 44 | 7 | 4 | USD |
| Tableau | `tableau/2024.yml` | 3 | 41 | 1 | 7 | USD |
| Trello ² | `trello/2024.yml` | 4 | 41 | 5 | 1 | USD |
| Trustmary | `trustmary/2024.yml` | 4 | 44 | 5 | 1 | USD |
| UserGuiding | `userguiding/2024.yml` | 3 | 59 | 9 | 11 | USD |
| Webflow ² | `webflow/2024.yml` | 15 | 94 | 24 | 3 | USD |
| Wrike | `wrike/2024.yml` | 5 | 81 | 5 | 5 | USD |
| Zapier | `zapier/2024.yml` | 4 | 51 | 3 | 4 | USD |
| ZenHub ² | `zenhub/2024.yml` | 2 | 39 | 4 | 0 | USD |
| Zoom ² | `zoom/2024.yml` | 5 | 143 | 8 | 16 | USD |

² From the extended copy, not part of SPECTRA 1.2.0.
