---
'pricing-renderer': minor
---

Security hardening: `isSafeLink`, and so plan CTA links, comparison-row documentation links and the metadata URL, now rejects values that start with `//` or `/\` (also with tab or newline characters between them) because browsers read them as links to another host. Use an absolute `https://` URL instead. Such a CTA now renders as a button, and comparison-row documentation links and the metadata URL that start with `//` or `/\` are no longer rendered as links; the `pricing-action` detail still carries the raw value.
