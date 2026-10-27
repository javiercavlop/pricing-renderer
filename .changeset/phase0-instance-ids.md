---
'pricing-renderer': patch
---

Give every `id` the element renders an instance prefix (`pr-<n>-plans-title`, `pr-<n>-dialog-title`,
`pr-<n>-group-<id>`, and so on), so two renderers on one page no longer share ids and their
`aria-labelledby`, `aria-describedby`, `aria-controls` and `for` references stay inside their own
renderer. The plan and billing radio groups carry the prefix too (`name="pr-<n>-plan"`), so a pick in
one renderer no longer unchecks the radios of another, and a collapsed comparison group no longer
sets `aria-controls` on its header. Ids are not a documented styling hook; `data-pr-part` hooks are unchanged.
