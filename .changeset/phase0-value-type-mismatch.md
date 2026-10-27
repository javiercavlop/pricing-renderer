---
'pricing-renderer': minor
---

Add the warning `PR_VALUE_TYPE_MISMATCH` when a `NUMERIC` feature or usage limit has a text value (default value, plan or add-on override, `{ value: ... }` form, or add-on `usageLimitsExtensions`). Text such as `10_000` gets a hint about YAML 1.1 digit separators. Values are never converted. The unlimited strings `.inf`, `Infinity` and `unlimited` do not warn, except in `usageLimitsExtensions`.
