---
'pricing-renderer': patch
---

Give every `id` the element renders an instance prefix (`pr-<n>-plans-title`, `pr-<n>-dialog-title`,
`pr-<n>-group-<id>`, and so on), so two renderers on one page no longer share ids and their
`aria-labelledby`, `aria-describedby`, `aria-controls` and `for` references stay inside their own
renderer. Ids are not a documented styling hook; `data-pr-part` hooks are unchanged.
