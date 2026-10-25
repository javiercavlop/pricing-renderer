# SPECTRA follow-ups: acceptance criteria

Tags in tests are written as `[utest->spectra-followups:ACn]`.

## AC1: long labels in tags and badges

Tag and badge labels (`.pr-tag`, `.pr-badge`, the plan badge container) that contain a very long
unbroken word shrink below the width of that word and wrap inside the renderer at a viewport of
375px. Nothing overflows the plan card or the renderer.

## AC2: token caps from 840px container width

From a container width of 840px the `.pr-content` padding-top and row gap use the capped tokens:
by default 16px and 24px. Token values smaller than the caps apply as they are. The margin after
the plans section adds back the difference between the section token and the capped gap, so the
space after the plans stays the token value. Below 840px the caps do not apply.

## AC3: React adapter props

The React adapter forwards `onlyDifferences`, `toolbarThreshold` and `addOnFilterThreshold` to the
element, and its types accept them (`boolean | undefined`, `number`, `number`) and reject other
types.

## AC4: documented part hooks

`docs/theming.md` lists every `data-pr-part` value the code renders, and only those.
