---
'pricing-renderer': minor
---

`PricingRenderer` accepts the render props `renderPlanCta`, `renderSummaryActions`, `renderLoading` and `renderError`. Each one fills the matching slot of the element through a portal, with a context read from the slot node: the plan, its label and safe link, the relation to the current plan, the selected, current and pending state and a `trigger()` for the plan CTA; the selection, resolved prices, relation and pending state for the summary; the diagnostics and a `reload()` for the error. Render props are called on the client only, after the element has rendered, so server output and hydration are unchanged. The context strings (plan name, label, diagnostic message) come from the pricing document and are plain text: render them as text, never through an HTML sink such as `dangerouslySetInnerHTML` or `innerHTML`. Without them nothing changes.
