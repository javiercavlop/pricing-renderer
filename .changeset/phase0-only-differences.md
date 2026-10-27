---
'pricing-renderer': patch
---

A short comparison with `only-differences` now shows every row. While the comparison toolbar is hidden (the rows do not exceed `toolbar-threshold`), the "Only differences" filter is off even when `onlyDifferences` is `true`, because no checkbox exists to undo it. Over the threshold nothing changes: the value is the initial state of the checkbox.
