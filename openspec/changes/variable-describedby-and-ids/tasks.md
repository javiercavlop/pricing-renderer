# Tasks: variable-describedby-and-ids

Rules for every slice:

- One capability per slice, at most 300 diff lines without tests. Order: S1 then S2 (design.md D1).
- Tests first: the test-designer task writes the tests and proves them red before (G3); the
  implementer task runs the frozen tests and touches no test file (G4). The T and I tasks of one
  slice merge together.
- Every requirement is traced: `[impl->req~…~<rev>]` in code, `[utest->req~…~<rev>]` in tests.
- No feature flag (D5). No ADR (D6). One `patch` changeset per implementation task.
- S2-T must not assert an `-error` id, so its test does not depend on S1.

Checks (the coordinator registers them; names are the commands):

- `install`: `["pnpm", "install", "--frozen-lockfile"]`
- `typecheck`: `["pnpm", "typecheck"]`
- `lint`: `["pnpm", "lint"]`
- `unit`: `["pnpm", "test"]`
- `format`: `["pnpm", "format:check"]`
- `red_before`: `["pnpm", "exec", "vitest", "run", "<test file>"]`, expected exit 1, pattern
  `AssertionError|expected`, overlay `<test file>`
- `spec`: `["pnpm", "exec", "openspec", "validate", "variable-describedby-and-ids", "--strict"]`
- `browser`: `["pnpm", "test:browser"]` in CI (chromium shards)

## Slice S1: variable help and error linked to the control

Requirement: `req~variable-field-describedby~1`. Risk low.

- [ ] S1-T Tests (test-designer).
  - Files: `tests/unit/variable-field-describedby.test.ts` (new).
  - Read only: `src/element/renderers.ts` (`controlInput` and `renderVariables`),
    `tests/unit/element-instance-ids.test.ts:66-143` (copy the `flatten`/`attributeValues`/
    `stateFor` pattern; do not import from that file).
  - Cases (`renderVariables`, `idPrefix: 'pr-7'`, synthetic controls `flag` boolean, `region`
    select, `seats` slider, `users` number, `team` text): every scenario of
    `specs/variable-field-describedby/spec.md`.
  - Checks: `red_before` on the new file, `install`, `typecheck`, `lint`, `unit`, `format`.
- [ ] S1-I Implementation (implementer, after S1-T).
  - Files: `src/element/renderers.ts` (only `controlInput` and the error `<p>` in
    `renderVariables`), `.changeset/variable-field-describedby.md` (patch).
  - Tag: `[impl->req~variable-field-describedby~1]`. Binding quoted, absent when empty (D3).
  - Checks: `install`, `typecheck`, `lint`, `unit`, `format`; CI `quality` and `browser`.
  - ui-qa: with NVDA or VoiceOver, focus a described slider, a described select and an invalid
    number field; the description and the error are read. Report a double reading of the error
    (Q3); do not change `role="alert"` here.

## Slice S2: injective instance ids

Requirement: `req~element-instance-ids~2`. Risk low. Starts its I task after S1 is merged.

- [ ] S2-T Tests (test-designer; may run in parallel with S1-T).
  - Files: `tests/unit/element-instance-ids.test.ts`.
  - Updates: `pr-3-group-Core-Features` -> `pr-3-group-Core_20_Features`;
    `pr-7-variable-priceByRegion-eu-price-0-` -> `pr-7-variable-priceByRegion_2e_eu_20_price_5b_0_5d_`;
    `pr-9-addon-help-extra-storage` -> `pr-9-addon-help-extra_20_storage`. Moves the tags at
    `:145,222,302` to `~2`.
  - New cases: every scenario of `specs/element-instance-ids/spec.md` (`a b`/`a-b` variables and
    groups, CJK paths, `x`/`x-help` suffix, alphanumeric ids unchanged, one escape for an astral
    code point).
  - Checks: `red_before` on the file, `install`, `typecheck`, `lint`, `unit`, `format`.
- [ ] S2-I Implementation (implementer, after S2-T and after S1 is merged).
  - Files: `src/element/renderers.ts` (only `instanceId` and its tag at `:93`),
    `src/element/pricing-renderer-element.ts` (only the tag at `:221`, `~1` -> `~2`),
    `tests/browser/element-instance-ids.spec.ts` (only the tag at `:6`),
    `.changeset/injective-instance-ids.md` (patch: "data-derived ids now escape every character
    other than letters and digits"; states Q1).
  - Checks: `install`, `typecheck`, `lint`, `unit`, `format`; CI `quality` and `browser`
    (axe `duplicate-id-aria` clean).

## Ownership and order

| Order | Task | Owns | Parallel with |
|---|---|---|---|
| 1 | S1-T | `tests/unit/variable-field-describedby.test.ts` | S2-T |
| 1 | S2-T | `tests/unit/element-instance-ids.test.ts` | S1-T |
| 2 | S1-I | `src/element/renderers.ts`, `.changeset/variable-field-describedby.md` | none |
| 3 | S2-I | `src/element/renderers.ts`, the element file tag, the browser spec tag, `.changeset/injective-instance-ids.md` | none |

## Traceability checklist

- `req~variable-field-describedby~1`: impl in `renderers.ts`, utest in
  `tests/unit/variable-field-describedby.test.ts`.
- `req~element-instance-ids~2`: impl in `renderers.ts` and `pricing-renderer-element.ts`, utest in
  `tests/unit/element-instance-ids.test.ts` and `tests/browser/element-instance-ids.spec.ts`. No
  `req~element-instance-ids~1` tag left after S2.
