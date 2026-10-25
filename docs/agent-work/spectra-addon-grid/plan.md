Design for SPECTRA item 7, scoped so the demo pricing (3 add-ons) renders equivalent markup and no baseline moves.

- Dense mode when add-ons exceed 8: grid and card modifier classes; availability, dependency, exclusion and constraint notes move into the existing details disclosure (key pricing.moreDetails); the unavailable status stays visible; all new CSS sits under the new modifier classes.
- Filter and cap when add-ons exceed addOnFilterThreshold (attribute add-on-filter-threshold, default 13, so 14 or more; invalid values give 13): search toolbar, counter, cap of 8 with a show-more button, selected add-ons never hidden, empty state. The filtered grid is keyed by add-on id. State lives in the element and resets on load.
- Total: unchanged.

Slices: spec, tests first, dense mode, filter and cap, docs and changeset, review fixes, then PR, panel (reviewer and test-reviewer) and ready.

Baseline impact: none by design.
