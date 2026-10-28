# Intake: P-20261028-3, enforce `maxBytes` and `timeoutMs` while the pricing is loading

- Origin: proposal P-20261028-3 (kind reliability, size S). Its state changed from deferred to approved in
  the owner note of this task's contract. Planner intake, 2026-10-28.
- Base: HEAD `9cf7e21` of the task branch `task/4b29a3837e8748f4`. Every `file:line` below is at this base.
- INTENT link: O3, "a stable public API and package across the integrations" (`INTENT.md`, `ROADMAP.md`
  objective list). The documented options are `timeoutMs` (15 s) and `maxBytes` (2 MiB)
  (`docs/api-reference.md:406-410`, `README.md:396-397`).
- No release: every code slice adds a pending changeset. Nobody versions or publishes. Package version
  `0.1.0` (`package.json:3`).
- Lab limits: unit tests run in the vitest `node` environment (`vitest.config.ts:5`). Node >= 22
  (`package.json:25`) provides `Response`, `ReadableStream`, `AbortController` and `TextDecoder`, so
  both slices can be tested without a browser. No Playwright spec is needed.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, size not enforced while reading. **R.**
  - `src/yaml/load.ts:103` computes `Number(response.headers.get('content-length'))`. A missing header
    gives `Number(null) === 0`, which is finite and not above `maxBytes`, so the early check at `:104` is
    skipped.
  - `:107` awaits `response.arrayBuffer()`, which buffers the whole body. The size check comes after,
    at `:108`.
  - The result code is already correct (`PR_SOURCE_TOO_LARGE`). The defect is memory use and the time
    spent before that result, plus a body that never ends (see E2).
- E2, timeout does not cover a custom loader. **R, and wider than the proposal says.**
  - The timeout only aborts the signal (`:29-32`). `:62` awaits `options.loadPricing(...)` with no race,
    so a loader that ignores `signal` is never cut off.
  - Also found: `:60` awaits `resolveHeaders(options.headers)`, an async host function (`:16-20`), with
    no race. `:91` awaits an injected `options.fetch`, which may ignore `signal` too. `:107` reads a body
    whose stream may never end when the fetch is injected.
  - Also found: a loader that ignores the signal and resolves *after* the timeout returns a normal,
    successful result today. The catch at `:114-123` only runs on a throw. So the race changes a
    visible outcome as well as fixing a hang.
  - Element impact: `reload()` sets `_status = 'loading'` (`src/element/pricing-renderer-element.ts:374`)
    and awaits `loadPricingFromUrl` (`:385-390`). A promise that never settles keeps the skeleton
    forever. `PR_SOURCE_ABORTED` already maps to the source error sentence (`:106`), so the element
    needs no code change.
- E3, docs promise both limits with no exception. **R.** See `docs/api-reference.md:406-410`. Also
  `docs/events.md:333-334` and `README.md:401-406` ("honors cancellation").
- E4, tests. **R.** `tests/unit/load-max-bytes.test.ts` covers only custom loader strings (`:21-85`).
  `tests/unit/load.test.ts:48-52` covers an oversized fetch body, and that `Response` has a
  `content-length` set by the platform, not a chunked one. No test in `tests/` uses fake timers or
  `ReadableStream` (grep of `useFakeTimers|ReadableStream`: 0 matches).
- E5, origin references. **P.**
  - Task `4b204ca3395244a4` and the "stream and count instead" note are not in this worktree: grep finds
    no match.
  - The proposal cites "R2-SEC-001 ... for object results", but the R2-SEC-001 in the repository is a
    CI finding (`docs/agent-work/ci-speed/review-round2.md:62`). Treat that alternative's citation as
    wrong. It does not affect the plan.
- Existing requirement: `req~custom-loader-max-bytes~1`. It is defined in
  `docs/agent-work/phase0-hygiene/spec.md:481-512` and traced at `load.ts:75` and
  `load-max-bytes.test.ts:20`. `openspec/specs/` does not exist. `openspec/changes/` holds only
  `add-subscription-change-flow`.

## Objective

Make `loadPricingFromUrl` enforce its two documented limits in every case:

- a body larger than `maxBytes` is cut off while it is read;
- no step of a load outlives `timeoutMs` or an external abort.

The element then always leaves its loading state.

## Scope

- Built-in fetch path: read `response.body` with a reader and count the bytes. Once the count is above
  `maxBytes`, cancel the reader and return `PR_SOURCE_TOO_LARGE`. When `response.body` is `null` (or a
  host stand-in has no stream), fall back to `arrayBuffer()` plus the existing post-read check. Keep the
  `content-length` fast path (`:103-106`).
- Timeout and abort: every awaited step of a load settles as `PR_SOURCE_ABORTED` once the internal
  signal aborts (timeout or external `signal`). The steps are the headers producer, `loadPricing`, the
  injected or global `fetch`, and the body read. A late result of an abandoned step is ignored, and its
  late rejection must not surface as an unhandled rejection.
- Tests for both, docs for the timeout scope, one changeset per code slice.

## Non-goals

- Measuring an object returned by `loadPricing`. It stays unmeasured (`docs/api-reference.md:409-410`,
  `req~custom-loader-max-bytes~1`).
- Any change to `LoadPricingOptions`, `PricingLoaderContext` or error codes (`src/yaml/types.ts:8-37`).
  No new option and no new code.
- Element, React, Vue or `space` code. The element already maps the codes (`pricing-renderer-element.ts:106`).
- The backlog titles in the proposal (R2-TST-001/002, the theme-builder nav link, the density spec in
  #65, the `host-reset-spec` tag). They belong to other proposals.
- Retries, caching or streaming the YAML parser.

## Slices

Order: S0, then T1 and T2 in parallel, then I1, then I2. I1 and I2 both own `src/yaml/load.ts`, so they
are sequential, never parallel. Each implementation slice can be merged into develop on its own and is
complete by itself, so no feature flag is needed (see "Feature flags").

### S0. OpenSpec change `enforce-load-limits` (specifier)

- Owns: `openspec/changes/enforce-load-limits/**` (proposal.md, design.md, tasks.md, `specs/load-limits/spec.md`).
- Read-only: `src/yaml/load.ts`, `src/yaml/types.ts`, `docs/api-reference.md:396-416`,
  `docs/agent-work/phase0-hygiene/spec.md:481-512`, this intake.
- Requirements (EARS, proposed ids):
  - `req~fetch-max-bytes-while-reading~1`. WHILE the built-in loader reads a response body, IF the
    bytes read so far exceed the effective `maxBytes`, THEN it SHALL cancel the body and return
    `PR_SOURCE_TOO_LARGE` at `$` without reading further or parsing. A body of exactly `maxBytes` bytes
    is accepted. A body with no stream is measured after `arrayBuffer()`.
  - `req~load-timeout-covers-every-step~1`. IF the internal signal aborts (timeout or external
    `signal`) before a load settles, THEN `loadPricingFromUrl` SHALL return `PR_SOURCE_ABORTED` at `$`
    without waiting for the headers producer, `loadPricing`, `fetch` or the body read. It SHALL ignore
    their later results. The scope depends on Q1.
- Checks: G1 `["pnpm", "exec", "openspec", "validate", "enforce-load-limits", "--strict"]`. The
  coordinator confirms that the CLI is available in the container, because it is not a
  `package.json` script.
- Risk low (docs/spec only: score 0). Budget 20 turns.
- Gates: G1, G2 (EPIC on the change).

### T1. Acceptance tests for the size limit while reading (test-designer)

- Owns: `tests/unit/load-stream-max-bytes.test.ts` (new).
- Read-only: S0 delta spec, `src/yaml/load.ts`, `tests/unit/load.test.ts`.
- Cases, all tagged `// [utest->req~fetch-max-bytes-while-reading~1]`, with an injected `fetch` that
  returns `new Response(stream)` and no `content-length`:
  1. A finite `ReadableStream` of 64 chunks of 1 KiB with `maxBytes: 4096`. Expect
     `PR_SOURCE_TOO_LARGE`, the stream's `cancel` called once, and at most 5 chunks pulled. On the base
     all 64 chunks are pulled and `cancel` is never called. Keep the stream finite: an endless stream
     would make the base hang and fail by timeout, which the red-before check rejects.
  2. Exactly `maxBytes` bytes across several chunks is accepted. One byte more fails.
  3. Fallback: a `Response`-like stand-in with `body: null` and `arrayBuffer()` of `maxBytes + 1` bytes
     fails. One of `maxBytes` bytes is accepted.
  4. Multi-byte UTF-8 split across a chunk boundary decodes correctly (`saasName` with `é`).
  5. Regression: `content-length` above the limit fails before any read (no pull).
- Checks: `["pnpm", "exec", "vitest", "run", "tests/unit/load-stream-max-bytes.test.ts"]`.
  Red before (G3): the same argv, `type: red_before`, `expect_exit: [1]`,
  `expect_pattern: "AssertionError"`, `overlay: ["tests/unit/load-stream-max-bytes.test.ts"]`.
  Cases 2-5 may pass on the base. At least case 1 must fail.
- Risk low (tests only: score 0). Budget 25 turns.
- Gates: G3, G6 (tags).

### T2. Acceptance tests for the timeout across every step (test-designer)

- Owns: `tests/unit/load-timeout.test.ts` (new).
- Read-only: S0 delta spec, `src/yaml/load.ts`, `tests/unit/load-max-bytes.test.ts`.
- Pattern: `vi.useFakeTimers()` before the call, then `vi.advanceTimersByTimeAsync(timeoutMs + 1)`, then
  `Promise.race([resultPromise, Promise.resolve(PENDING)])`. Assert that the outcome is not
  `PENDING`. This makes a hanging base fail by assertion and not by the test timeout. Restore the
  timers in `afterEach`.
- Cases, tagged `// [utest->req~load-timeout-covers-every-step~1]`:
  1. A `loadPricing` that never settles and ignores `signal` gives `PR_SOURCE_ABORTED` after
     `timeoutMs` (custom value, for example 1000).
  2. The same loader with an external `signal` aborted at 10 ms gives `PR_SOURCE_ABORTED` without
     waiting for `timeoutMs`.
  3. A loader that ignores the signal and resolves valid YAML after `timeoutMs` gives
     `PR_SOURCE_ABORTED`, not `ok: true`.
  4. A loader that rejects after `timeoutMs` gives `PR_SOURCE_ABORTED` and no unhandled rejection.
     Vitest fails a run on unhandled rejections, and `vitest.config.ts` does not override that.
  5. If Q1 = A: a headers producer that never settles, an injected `fetch` that ignores `signal`, and a
     body stream that never ends each give `PR_SOURCE_ABORTED`.
  6. Regression: a loader that resolves before `timeoutMs` still gives `ok: true`, and the timer is
     cleared (`vi.getTimerCount()` is 0 after the call).
- Checks: `["pnpm", "exec", "vitest", "run", "tests/unit/load-timeout.test.ts"]`. Red before (G3):
  the same argv, `type: red_before`, `expect_exit: [1]`, `expect_pattern: "AssertionError"`,
  `overlay: ["tests/unit/load-timeout.test.ts"]`.
- Risk low (tests only: score 0). Budget 30 turns.
- Gates: G3, G6.

### I1. Count bytes while reading the body (implementer)

- Depends on: S0, T1 frozen (G4).
- Owns: `src/yaml/load.ts`, `.changeset/load-stream-max-bytes.md` (patch).
- Read-only: `tests/unit/load-stream-max-bytes.test.ts`, `tests/unit/load.test.ts`,
  `tests/unit/load-max-bytes.test.ts`.
- Change: replace `:107-110` with a helper that reads `response.body` through `getReader()`, adds
  `value.byteLength` per chunk, and calls `reader.cancel()` and returns `PR_SOURCE_TOO_LARGE` once the
  total is above `maxBytes`. It then joins the chunks and decodes them once with `TextDecoder`
  (same BOM and replacement behaviour as today). Use `arrayBuffer()` when `response.body` is `null`.
  Add `// [impl->req~fetch-max-bytes-while-reading~1]`.
- Expected diff: about 35-55 lines in `load.ts`, plus the changeset.
- Checks: `["pnpm", "exec", "vitest", "run", "tests/unit/load-stream-max-bytes.test.ts",
  "tests/unit/load.test.ts", "tests/unit/load-max-bytes.test.ts"]`, `["pnpm", "run", "test"]`,
  `["pnpm", "run", "typecheck"]`, `["pnpm", "run", "lint"]`,
  `["pnpm", "exec", "prettier", "--check", "src/yaml/load.ts", ".changeset/load-stream-max-bytes.md"]`.
- Risk **medium**. The recomputed score is 2 (external HTTP input +2; same codes and options, so no
  public API point), but the proposal's level is medium and the higher level wins. Review: the
  medium panel plus a clean-context review.
- Budget 25 turns.
- Gates: G4, G6, G11, G13 (how-to-test with a node snippet or a local server, no UI). G12 N/A. G9 N/A.

### I2. Every load step settles on timeout or abort (implementer)

- Depends on: I1 merged or at least integrated (same file), T2 frozen (G4), and the CRP answer to Q1.
- Owns: `src/yaml/load.ts`, `docs/api-reference.md` (the `timeoutMs` and `signal` bullets at
  `:406,413`), `README.md:401-403`, `docs/events.md:334` (the `PR_SOURCE_ABORTED` row),
  `.changeset/load-timeout-every-step.md` (patch, Q2).
- Read-only: `tests/unit/load-timeout.test.ts`, `src/element/pricing-renderer-element.ts:370-396`.
- Change: a small `untilAborted<T>(promise, signal)` helper that rejects with the signal's reason
  when it aborts (or at once if it is already aborted), removes its listener when it settles, and
  attaches a no-op `catch` to the abandoned promise. Apply it to `:60`, `:62` and, if Q1 = A, to
  `:91` and to each `reader.read()` of I1. The existing catch at `:114-123` already maps to
  `PR_SOURCE_ABORTED`. Add `// [impl->req~load-timeout-covers-every-step~1]`.
- Docs: the `timeoutMs` and `signal` bullets say that a loader, fetch or headers function that ignores
  the signal is cut off, and that its late result is ignored. The changeset tells hosts with slow
  loaders to raise `request.timeoutMs`.
- Expected diff: about 40-60 lines in `load.ts` and 10-15 lines of docs.
- Checks: `["pnpm", "exec", "vitest", "run", "tests/unit/load-timeout.test.ts",
  "tests/unit/load-stream-max-bytes.test.ts", "tests/unit/load.test.ts",
  "tests/unit/load-max-bytes.test.ts", "tests/unit/element-stale-load.test.ts"]`,
  `["pnpm", "run", "test"]`, `["pnpm", "run", "typecheck"]`, `["pnpm", "run", "lint"]`,
  `["pnpm", "exec", "prettier", "--check", "src/yaml/load.ts", "docs/api-reference.md", "README.md",
  "docs/events.md", ".changeset/load-timeout-every-step.md"]`.
- Risk **high**. Score 6:
  - public behaviour of an exported function +3: a slow loader that used to succeed now fails;
  - external input +2;
  - concurrency (racing promises and abandoned work) +1.
  The proposal said medium; the recomputed level wins. Review: the high panel (including the
  security-auditor) plus a clean-context review.
- Budget 30 turns.
- Gates: G4, G6, G11, G13 (node snippet: a stalled loader resolves to `PR_SOURCE_ABORTED`). G12 N/A,
  because the element is unchanged and its error state is already covered by
  `tests/unit/error-state.test.ts:169`. G9 N/A.

## Gates per slice

| Gate | S0 | T1 | T2 | I1 | I2 |
|---|---|---|---|---|---|
| G1 openspec validate --strict | yes | - | - | re-run if the delta changes | re-run if the delta changes |
| G2 EPIC | yes | - | - | - | - |
| G3 red before | - | yes | yes | - | - |
| G4 frozen tests | - | - | - | T1 | T2 |
| G5, G7, G10 | registry | registry | registry | registry | registry |
| G6 trace (`utest`/`impl` tags) | ids | utest | utest | impl | impl |
| G8 mutation | - | - | - | if registered | if registered |
| G9 dependencies | N/A | N/A | N/A | N/A (no new dependency) | N/A |
| G11 review | one reviewer | test-reviewer | test-reviewer | medium panel + clean context | high panel + clean context |
| G12 ui-qa | N/A | N/A | N/A | N/A | N/A |
| G13 how-to-test | how-to-review | - | - | yes | yes |

"Registry": the meaning of G5, G7 and G10 is not defined in any file this intake read. The
coordinator applies its own registry. G10 (the secret scan of the diff) applies to I1 and I2 if the
registry runs it per PR.

## Feature flags

None. I1 and I2 are each a complete fix of one documented limit and can be merged on their own.
Neither adds an option, and a flag would add the public option that the non-goals exclude. If the
owner wants an opt-out for I2 (Q1 option C), that is a new public option and needs its own CRP.

## Risks

- R1. I2 turns a custom loader that is slower than `timeoutMs` and ignores the signal from a late
  success into `PR_SOURCE_ABORTED`. Mitigation: the changeset and docs name `request.timeoutMs`.
  Q2 asks for the bump.
- R2. An abandoned loader keeps running in the background (only the result is dropped). Mitigation:
  the docs say so, and the no-op `catch` prevents unhandled rejections (T2 case 4).
- R3. `Response` stand-ins in host tests may have no `body`. Mitigation: the `arrayBuffer` fallback
  (T1 case 3).
- R4. #65 (phase 1a) is in flight. Whether it touches `src/yaml/load.ts` or `docs/api-reference.md`
  is not verified here. Mitigation: I1 and I2 start from the develop head after #65, or the
  coordinator checks its diff first.
- R5. `content-length` is the encoded size, and the stream yields decoded bytes. The check counts
  decoded bytes, as `arrayBuffer()` does today, so behaviour stays the same.

## Open questions (one CRP to the owner)

- Q1, timeout scope (public behaviour):
  - (A) Race every awaited step: headers producer, `loadPricing`, `fetch` and body read.
    **Recommended.** It matches "15 seconds" in `docs/api-reference.md:406` with no exception, and
    `load.ts:60,91` have the same gap.
  - (B) Race only `loadPricing`, as the proposal's first slice says. Document the remaining gaps.
  - (C) A or B with a new opt-out option. Not recommended: it adds public API.
- Q2, changeset bump for I2: patch (recommended; same as `.changeset/phase0-loader-max-bytes.md`,
  which also turned a working loader into an error) or minor, because a late success now fails.
  The package is `0.1.0`.
