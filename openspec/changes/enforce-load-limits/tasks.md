# Tasks: enforce-load-limits

Rules for every slice:

- One capability (`load-limits`), one requirement per slice, at most 300 diff lines without tests.
  Order: S0, then T1 and T2 in parallel, then I1, then I2 (design.md D1).
- Tests first: the test-designer task writes the tests and proves them red before (G3) without a
  hang (design.md D5); the implementer task runs the frozen tests and touches no test file (G4).
- Every requirement is traced: `[impl->req~…~1]` in `src/yaml/load.ts`, `[utest->req~…~1]` in the
  tests.
- No feature flag, no ADR (design.md D4). One patch changeset per implementation task (D6).
- No element, React, Vue or `space` change; no change to `src/yaml/types.ts`.

Checks (the coordinator registers them; names are the commands):

- `install`: `["pnpm", "install", "--frozen-lockfile"]`
- `typecheck`: `["pnpm", "run", "typecheck"]`
- `lint`: `["pnpm", "run", "lint"]`
- `unit`: `["pnpm", "run", "test"]`
- `format`: `["pnpm", "exec", "prettier", "--check", <owned files>]`
- `red_before`: `["pnpm", "exec", "vitest", "run", "<test file>"]`, expected exit 1, pattern
  `AssertionError`, overlay `<test file>`
- `spec`: `["pnpm", "exec", "openspec", "validate", "enforce-load-limits", "--strict"]`
- `slice1-tests`: `["pnpm", "exec", "vitest", "run", "tests/unit/load-stream-max-bytes.test.ts", "tests/unit/load.test.ts", "tests/unit/load-max-bytes.test.ts"]`
- `slice2-tests`: `["pnpm", "exec", "vitest", "run", "tests/unit/load-timeout.test.ts", "tests/unit/load-stream-max-bytes.test.ts", "tests/unit/load.test.ts", "tests/unit/load-max-bytes.test.ts", "tests/unit/element-stale-load.test.ts"]`

## S0: OpenSpec change

- [x] S0 Spec (specifier).
  - Files: `openspec/changes/enforce-load-limits/**`.
  - Checks: `install`, `spec`, `format` on the change folder. Gates G1, G2.

## Slice 1: size limit while reading

Requirement: `req~fetch-max-bytes-while-reading~1`. Risk medium (intake, I1).

- [ ] T1 Tests (test-designer; parallel with T2).
  - Files: `tests/unit/load-stream-max-bytes.test.ts` (new).
  - Read only: `specs/load-limits/spec.md`, `src/yaml/load.ts`, `tests/unit/load.test.ts`.
  - Cases: every scenario of the requirement, with an injected `fetch` that returns
    `new Response(stream)`. Keep every stream finite. At least "Chunked body without
    content-length over the limit", "Declared content-length over the limit" (its `cancel`
    assertion) and "Cancel that never settles or rejects does not delay the result" (its `cancel`
    assertion) fail on the base by assertion.
  - Tag: `// [utest->req~fetch-max-bytes-while-reading~1]`.
  - Checks: `red_before` on the new file, `install`, `typecheck`, `lint`, `unit`, `format`.
- [ ] I1 Implementation (implementer, after T1 is frozen).
  - Files: `src/yaml/load.ts` (the body read at `:103-110`),
    `.changeset/load-stream-max-bytes.md` (patch).
  - Change: design.md D2, including the cancel of the unread body when `content-length` is over the
    limit, and a cancel that is called without being awaited (rejection swallowed). Tag:
    `// [impl->req~fetch-max-bytes-while-reading~1]`.
  - Changeset (patch): the body is counted while it is read; a body over `maxBytes`, declared by
    `content-length` or counted, is cancelled and the load fails with `PR_SOURCE_TOO_LARGE`.
  - Checks: `slice1-tests`, `install`, `typecheck`, `lint`, `unit`, `format`.
  - Gates: G4, G6, G11 (medium panel plus a clean-context review), G13 (a node snippet or a local
    server streaming an oversized body without `content-length`).

## Slice 2: timeout and abort on every step

Requirement: `req~load-timeout-covers-every-step~1`. Risk high (intake, I2: score 6).

- [ ] T2 Tests (test-designer; parallel with T1).
  - Files: `tests/unit/load-timeout.test.ts` (new).
  - Read only: `specs/load-limits/spec.md`, `src/yaml/load.ts`,
    `tests/unit/load-max-bytes.test.ts`.
  - Cases: every scenario of the requirement, with fake timers and the `Promise.race` sentinel of
    design.md D5, including the pre-aborted `signal` with a `fetch` spy, the `arrayBuffer()`
    fallback that never settles, the body cancel that never settles and the timer left after an
    external abort. Restore real timers in `afterEach`. Do not `await` a promise that may hang on
    the base.
  - Tag: `// [utest->req~load-timeout-covers-every-step~1]`.
  - Checks: `red_before` on the new file, `install`, `typecheck`, `lint`, `unit`, `format`.
- [ ] I2 Implementation (implementer, after I1 is merged and T2 is frozen).
  - Files: `src/yaml/load.ts`, `docs/api-reference.md` (the `timeoutMs` and `signal` bullets at
    `:406,413`), `README.md:405`, `docs/events.md:334` (the `PR_SOURCE_ABORTED` row),
    `.changeset/load-timeout-every-step.md` (patch).
  - Change: design.md D3, including the pre-aborted external signal, the race on the
    `arrayBuffer()` fallback, the reader cancel that is not awaited and the timer cleanup on the
    abort path. Tag: `// [impl->req~load-timeout-covers-every-step~1]`.
  - Docs: a `loadPricing`, `fetch` or `headers` function that ignores the signal is cut off at
    `timeoutMs` or on abort, its late result is ignored, and its work is not stopped. A `signal`
    already aborted when the call starts fails the load with `PR_SOURCE_ABORTED`.
  - Changeset (patch): tells hosts with slow loaders to raise `request.timeoutMs`, and says that a
    `signal` already aborted when the call starts now fails the load with `PR_SOURCE_ABORTED`.
  - Checks: `slice2-tests`, `install`, `typecheck`, `lint`, `unit`, `format`.
  - Gates: G4, G6, G11 (high panel with the security-auditor, plus a clean-context review), G13 (a
    node snippet: a stalled loader resolves to `PR_SOURCE_ABORTED`).

## Ownership and order

| Order | Task | Owns                                       | Parallel with |
| ----- | ---- | ------------------------------------------ | ------------- |
| 1     | S0   | `openspec/changes/enforce-load-limits/**`  | none          |
| 2     | T1   | `tests/unit/load-stream-max-bytes.test.ts` | T2            |
| 2     | T2   | `tests/unit/load-timeout.test.ts`          | T1            |
| 3     | I1   | `src/yaml/load.ts`, I1 changeset           | none          |
| 4     | I2   | `src/yaml/load.ts`, docs, I2 changeset     | none          |

## Traceability checklist

- `req~fetch-max-bytes-while-reading~1`: impl in `src/yaml/load.ts`, utest in
  `tests/unit/load-stream-max-bytes.test.ts`.
- `req~load-timeout-covers-every-step~1`: impl in `src/yaml/load.ts`, utest in
  `tests/unit/load-timeout.test.ts`.
- `req~custom-loader-max-bytes~1` keeps its tags (`load.ts:75`, `load-max-bytes.test.ts:20`).
