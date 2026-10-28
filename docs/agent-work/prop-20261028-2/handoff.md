# Handoff: prop-20261028-2

- Status: waiting-review (planner intake done) · Updated: 2026-10-28
- Branch / head: task/6168e44879304acd / base `9cf7e21` · PR: none

## Goal

Link each variable control to its help and error text with `aria-describedby`, and make
data-derived instance ids collision-free (P-20261028-2, O2 at `INTENT.md:46`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261028-2/intake.md`. Nothing implemented.
- The proposal's evidence was verified at `9cf7e21`: `instanceId` `src/element/renderers.ts:95-102`
  (sanitizer at `:101`). Help `<p>` without a reference at `:649`. Error `<p>` without an id at
  `:653`. No `aria-describedby` in `controlInput` `:532-619`; the only uses are at `:1158` and
  `:1541`.
- New finding: the suffix collision. `${id}-help` for path `x` equals the input id of path
  `x-help`, because `-` stays as it is in the data. CJK-only values all map to `-` (ASCII `\w`).
- Tests that pin today's form: `tests/unit/element-instance-ids.test.ts:230-231,279,285`.
  Under D2 these stay valid: `:245,278,309` and `tests/unit/addon-grid.test.ts:405-407`.

## Decisions

- Two slices, in order: S1 describedby, then S2 injective ids. Reason: both edit `renderers.ts`,
  and there is one capability each (intake D1).
- Encoding: keep `[A-Za-z0-9]`, write every other code point (including `-` and `_`) as
  `_<hex>_`. Reason: injective, and safe under the `-help`/`-error` suffixes. Alphanumeric ids do
  not change (D2).
- Help id `${id}-help`, error id `${id}-error`. `aria-describedby` is bound quoted (the test
  harness reads only the first token of an unquoted value, `element-instance-ids.test.ts:87-90`),
  and is absent when empty (D3).
- Requirements: new `req~variable-field-describedby~1`, and a revision
  `req~element-instance-ids~2` (D4). No flag (D5). No ADR (D6). T then I per slice (D7).

## Ruled out

- Only `aria-describedby`: it leaves R1-REV-005/UIQ-004 open.
- Keeping `-` and escaping the rest: the suffix collision stays.
- `encodeURIComponent` or base64 (CSS selectors, readability). Counters or hashes (ids no longer
  predictable).

## Open questions and risks

- Q1 (owner, may be stated in the S2 PR): data-derived ids change form. Patch if ids are not
  public (`.changeset/phase0-instance-ids.md:10`); minor and medium risk if they are.
- Q2 (coordinator): the OpenSpec change name and where the `element-instance-ids` delta goes
  (`~1` lives only in `docs/agent-work/phase0-hygiene/spec.md:117-134`).
- Q3 (coordinator, ui-qa): the error has `role="alert"` and will be in `aria-describedby`, so it
  may be read twice. Out of scope unless ui-qa reports it.
- Q4 (coordinator): re-check the open PRs for changes to `renderers.ts` before S1-I.
- Risk: S2-T updates existing assertions. A wrong expected string would freeze a wrong encoding.
  Mitigation: the reviewer checks D2's examples (`a_20_b`, `a_2d_b`, `_5ea7__5e2d_`).

## Next three steps

1. The coordinator writes the OpenSpec change (the two requirements of D4, with scenarios from
   intake S1/S2), runs G1, and writes the task contracts S1-T, S2-T (parallel), S1-I and S2-I,
   with the owned files in the intake's ownership table.
2. S1-T and S2-T write their tests and prove them red (the red-before form in the intake). Then
   S1-I implements and merges.
3. S2-I implements `instanceId` per D2 after S1 is merged. CI `quality` and the chromium shards
   must be green, then one reviewer per slice.

## Evidence

- Tasks: this planner task (no checks registered) · Base: `9cf7e21` · CI: not run (no code).
