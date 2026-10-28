# Proposal: enforce `maxBytes` while reading and `timeoutMs` on every load step

Change `enforce-load-limits`. Proposal P-20261028-3 (kind reliability, size S), approved by the
owner. Planner intake: `docs/agent-work/prop-20261028-3/intake.md`; handoff:
`docs/agent-work/prop-20261028-3/handoff.md`. Base `9cf7e21`; the `src/yaml/load.ts` lines below are
the same at head `52a31c8`.

## Why

INTENT link: **O3, "a stable public API and package across the integrations"** (`INTENT.md`,
`ROADMAP.md` objective list). The documented options promise two limits with no exception:
`timeoutMs` "defaults to 15 seconds" and `maxBytes` "defaults to 2 MiB"
(`docs/api-reference.md:406-410`), and the loader "honors cancellation" (`README.md:405`).

Today:

- `src/yaml/load.ts:103` reads `Number(response.headers.get('content-length'))`. A missing header
  gives `Number(null) === 0`, so the early check at `:104` passes. `:107` then awaits
  `response.arrayBuffer()`, which buffers the whole body before the size check at `:108`.
- The timeout only aborts the internal signal (`:29-32`). The `headers` producer (`:60`), a custom
  `loadPricing` (`:62`) and an injected `fetch` (`:91`) are awaited without a race against it, so a
  step that ignores the signal is never cut off. A loader that ignores the signal and resolves after
  the timeout even returns a successful result.
- An external `signal` that is already aborted when the call starts is never forwarded: the
  `abort` listener (`:28`) does not fire for a past event.
- The element sets `loading` (`src/element/pricing-renderer-element.ts:374`) and awaits the load
  (`:385-390`), so a load that never settles keeps the skeleton forever.

## What changes

- A response body is counted while it is read. Once the count is above `maxBytes`, the stream is
  cancelled and the load fails with `PR_SOURCE_TOO_LARGE`, with or without `content-length`. When
  the declared `content-length` is already above `maxBytes`, the unread body is cancelled without
  reading any chunk.
- A body of exactly `maxBytes` bytes is still accepted; a response without a body stream is still
  measured after `arrayBuffer()`.
- Once `timeoutMs` elapses or the external `signal` aborts, the load fails with
  `PR_SOURCE_ABORTED` whichever step is pending: the `headers` producer, `loadPricing`, `fetch` or a
  body read, `arrayBuffer()` included (owner answer: every awaited step). A `signal` that is already
  aborted when the call starts fails the load too; `loadPricing`, `fetch` and the body read never
  start.
- A late result of an abandoned step is ignored, and its late rejection is not reported as an
  unhandled rejection. A body cancel is never awaited, so a cancel that hangs or rejects delays
  neither limit. No timer is left once the call has settled, after an abort too.
- The element always leaves its loading state; it needs no code change, because it already maps
  `PR_SOURCE_ABORTED` (`pricing-renderer-element.ts:106`).

## Impact

- Capability: `load-limits` (ADDED): `req~fetch-max-bytes-while-reading~1` and
  `req~load-timeout-covers-every-step~1`. One capability, two requirements, one slice each.
- Code areas: `src/yaml/load.ts` only. Docs: the `timeoutMs` and `signal` bullets of
  `docs/api-reference.md:406,413`, `README.md:405`, the `PR_SOURCE_ABORTED` row of
  `docs/events.md:334`. Two new unit test files. Two patch changesets (owner answer).
- Public API: no type, option or error code changes (`src/yaml/types.ts:8-37`). Visible behaviour
  changes:
  - a custom loader, `fetch` or `headers` function that is slower than `timeoutMs` and ignores the
    signal now fails with `PR_SOURCE_ABORTED` where it used to succeed late or hang (I2);
  - a `signal` already aborted when the call starts now fails the load with `PR_SOURCE_ABORTED`
    instead of letting it complete (I2);
  - a body over `maxBytes`, declared or counted, is now cancelled instead of being buffered or left
    unread (I1).
- Slices: the `content-length` cancel and the cancel that is not awaited belong to I1; the
  pre-aborted `signal`, the `arrayBuffer()` race and the timer cleanup on abort belong to I2. Both
  changesets stay patch (owner answer to Q2).
- Risks and their mitigations: design.md, "Risks".

## Out of scope

- Measuring an object returned by `loadPricing`. It stays unmeasured
  (`docs/api-reference.md:409-410`, `req~custom-loader-max-bytes~1`).
- New options (an opt-out of the timeout), new error codes, changes to `LoadPricingOptions` or
  `PricingLoaderContext`.
- Element, React, Vue or `space` code.
- Stopping the work of an abandoned loader: only its result is dropped.
- Retries, caching, or a streaming YAML parser.
- The backlog titles of the proposal that belong to other proposals (intake, "Non-goals").
