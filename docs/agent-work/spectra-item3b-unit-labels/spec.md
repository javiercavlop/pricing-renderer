# SPECTRA item 3b: `presentation.unitLabels`

## Purpose

Let a pricing author or an integrator set the singular and plural form of a usage unit per
locale, instead of relying on the built-in English-only rule of `formatUnit`. The option is
`presentation.unitLabels?: Record<string, Record<string, { one: string; other: string }>>`,
keyed locale, then unit. The locale key `*` applies to any locale. Values are plain strings and
objects, so the option is JSON-safe.

## Criteria

Lookup: `formatUnit(unit, count, locale = 'en-US', unitLabels?)`.

- U1. An entry overrides the built-in plural (`execution`, count 3, `other: 'go'` gives `go`).
- U2. An entry overrides the built-ins for units they leave alone (`user/month`, `GB`, units
  ending in `s`).
- U3. A count of exactly 1 returns `one` in locales where 1 is in the plural category `one`
  (English and Spanish are tested).
- U4. The category comes from `Intl.PluralRules(locale)`: `one` gives `one`, anything else gives
  `other`. For an invalid locale, count 1 gives `one` and any other count gives `other`.
- U5. A unit without an entry keeps the built-in rule.
- U6. Absent `unitLabels` gives exactly the previous behaviour.
- U7. Locale keys are tried in order: exact tag, base language, `*`, then the built-ins.
- U8. The first locale key with a valid entry for the unit wins; a key that lacks the unit, or
  holds a malformed entry for it, continues to the next key.
- U9. `_` is treated as `-` and keys compare case-insensitively (`es_MX`, `ES-mx`).
- U10. Malformed input is ignored and never throws: `unitLabels`, a locale value or a unit value
  that is not an object; `one` or `other` missing, not a string, empty or whitespace only. The
  built-in result is returned.
- U11. Lookup uses own properties only: units named `constructor` or `__proto__` do not reach
  `Object.prototype`; an own `__proto__` key made with `JSON.parse` is an ordinary unit.

Normalization and merge: `mergePresentationOptions`.

- U12. Only valid entries are kept; empty unit maps and empty locale maps are dropped, and
  `unitLabels` is absent when nothing valid remains.
- U13. Layers merge deep by locale, then by unit; the provided layer wins per unit. The inputs
  are not mutated.
- U14. The result survives a JSON round trip unchanged.

Rendering: `renderValue` passes `viewModel.presentation.unitLabels` to `formatUnit`.

- U15. The label from `custom.pricingRenderer.unitLabels` is rendered (`>3 runs<`), including for
  units the built-ins leave alone.
- U16. The label from the element `presentation` option given to `createPricingViewModel` is
  rendered.
- U17. The element option overrides the pricing block per unit; units it does not name keep the
  pricing block label.
- U18. The rendered label follows the locale of the view model.
- U19. Without `unitLabels` the rendered text is unchanged.

## Out of scope

- No visual change and no new CSS.
- No new built-in locales or plural rules.
- No change to the demo.

## Criterion to test

Every test title starts with its criterion id. Pure tests are in `tests/unit/unit-labels.test.ts`
(U1 to U14) and rendering tests in `tests/unit/unit-labels-render.test.ts` (U15 to U19). Filter
with the id, for example `-t "U8 "`.

- U1: `U1 the override wins over the built-in English plural`
- U2: `U2 the override wins for units the built-ins leave alone`
- U3: `U3 a count of exactly 1 returns the one label`
- U4: `U4 an invalid locale uses one for a count of 1 and other for any other count`
- U4 also: `U4 the category comes from Intl.PluralRules`
- U5: `U5 a unit without an entry keeps the built-in rule`
- U6: `U6 absent unitLabels behaves exactly as before`
- U7: `U7 the exact locale wins, then the base language, then *, then the built-ins`
- U8: `U8 a locale key without the unit continues to the next key` and
  `U8 a malformed entry in the exact locale continues to the next key`
- U9: `U9 underscore and case forms of the locale tag are equivalent`
- U10: `U10 ignores <case> without throwing` (one test per malformed case)
- U11: `U11 does not read units or locales from Object.prototype`,
  `U11 ignores entries that are only inherited through the prototype chain` and
  `U11 an own __proto__ key created by JSON.parse is an ordinary unit`
- U12: `U12 keeps valid entries, drops malformed ones and empty maps`
- U13: `U13 merges deep by locale and unit, the provided layer winning per unit` and
  `U13 does not mutate the inputs`
- U14: `U14 the merged value survives a JSON round trip unchanged`
- U15: `U15 renders the label from custom.pricingRenderer.unitLabels` and
  `U15 renders the label for a unit the built-ins leave alone`
- U16: `U16 renders the label from the element presentation option`
- U17: `U17 the element option overrides the pricing block per unit` and
  `U17 the full chain: element over project config over the pricing block`
- U18: `U18 follows the locale of the view model`
- U19: `U19 without unitLabels the rendered text is unchanged`
