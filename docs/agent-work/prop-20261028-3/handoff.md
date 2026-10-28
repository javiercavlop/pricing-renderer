# Handoff: prop-20261028-3 (enforce `maxBytes` and `timeoutMs` while loading)

- Status: waiting on the coordinator (plan ready; the owner CRP for Q1 and Q2 is not sent yet). Updated:
  2026-10-28.
- Branch / head: planner task `task/4b29a3837e8748f4`, base `9cf7e21`. PR: none.

## Goal

`loadPricingFromUrl` enforces `maxBytes` while it reads the body, and `timeoutMs` (or an external abort)
on every load step, so a host element never stays in its loading state. This serves INTENT O3.

## State (with evidence)

- The proposal is approved by the owner (owner note in the planner task contract).
- The intake is written: `docs/agent-work/prop-20261028-3/intake.md`. It has five slices: S0, T1, T2,
  I1 and I2.
- The defects reproduce at `9cf7e21`:
  - `src/yaml/load.ts:103-110`: a missing `content-length` gives `Number(null) = 0`, and
    `arrayBuffer()` buffers the whole body before the size check.
  - `load.ts:60,62,91`: the headers producer, `loadPricing` and an injected `fetch` are awaited
    without a race against the signal.
  - `pricing-renderer-element.ts:374,385-390`: the element stays in `loading` while that promise is
    pending.
- No code, test, spec or acceptance file was changed.

## Decisions

- Two code slices, one capability each (size while reading, then timeout on every step). Reason:
  the planner rule of one capability per slice. Both own `src/yaml/load.ts`, so I2 runs after I1.
- No feature flag. Each slice is a complete fix, and a flag would add the public option that the
  non-goals exclude.
- No element change. `PR_SOURCE_ABORTED` already maps to the source error sentence
  (`pricing-renderer-element.ts:106`).
- I2 is high risk. Its recomputed score is 6 (public behaviour +3, external input +2,
  concurrency +1), which is above the proposal's medium. Rule: the higher level wins.
- Red-before design: T1 uses a *finite* stream, and T2 uses fake timers plus a `Promise.race`
  sentinel. Reason: on the base, a hanging test fails by timeout, and the G3 check rejects that.

## Ruled out

- Relying on `content-length` alone: it is optional (chunked responses), and it is the encoded size.
- An endless stream or a bare `await` on a stalled loader in the red-before tests: on the base they
  hang until the vitest timeout instead of failing by assertion.

## Open questions and risks

- Q1, timeout scope: (A) every awaited step (recommended) or (B) only `loadPricing`, or (C) an opt-out
  option. Waiting on the owner via a CRP.
- Q2, changeset bump for I2: patch (recommended) or minor. Waiting on the owner via the same CRP.
- R4: whether #65 touches `load.ts` or `docs/api-reference.md` is not verified. Check its diff before
  I1 starts.
- The proposal's origins are unverified. Task `4b204ca3395244a4` and the "stream and count" note are
  not in the repository. The "R2-SEC-001" it cites is a CI finding
  (`docs/agent-work/ci-speed/review-round2.md:62`).
- The G5, G7 and G10 meanings are not in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator sends one CRP with Q1 and Q2 (options and recommendations in the intake, "Open
   questions").
2. A specifier creates `openspec/changes/enforce-load-limits` (S0) with
   `req~fetch-max-bytes-while-reading~1` and `req~load-timeout-covers-every-step~1`, then runs G1 and
   G2. The coordinator first confirms that `pnpm exec openspec` is available in the container.
3. Test-designers write T1 (`tests/unit/load-stream-max-bytes.test.ts`) and T2
   (`tests/unit/load-timeout.test.ts`) in parallel, each with its red-before check. Then I1 runs, then
   I2 runs after the Q1 answer.

## Evidence

- Files read: `src/yaml/load.ts`, `src/yaml/types.ts`, `tests/unit/load.test.ts`,
  `tests/unit/load-max-bytes.test.ts`, `src/element/pricing-renderer-element.ts:355-396`,
  `docs/api-reference.md:385-419`, `README.md:385-412`, `vitest.config.ts`,
  `docs/agent-work/phase0-hygiene/spec.md:478-512`, `docs/agent-work/phase0-hygiene/intake.md`
  (conventions and gates).
- Checks: none registered for this task, and none run.
