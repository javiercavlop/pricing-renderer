# Design: enforce-load-limits

Decisions come from the planner intake (`docs/agent-work/prop-20261028-3/intake.md`, "Scope",
"Slices", "Feature flags") and the owner answers to its Q1 and Q2. Line numbers are at `9cf7e21`;
`src/yaml/load.ts` is unchanged at head `52a31c8`.

## Context

- `loadPricingFromUrl` (`src/yaml/load.ts:42-127`) checks the URL and protocol synchronously
  (`:46-54`), then creates an internal `AbortController` linked to the external `signal` and to a
  `setTimeout` of `timeoutMs` (`:22-40`, `:58`).
- Awaited steps: `resolveHeaders(options.headers)` (`:60`), `options.loadPricing(...)` (`:62`), the
  injected or global `fetch` (`:91`) and `response.arrayBuffer()` (`:107`). Parsing and
  normalization are synchronous.
- The catch at `:114-123` maps any throw to `PR_SOURCE_ABORTED` when the internal signal is aborted,
  else to `PR_SOURCE_LOAD_FAILED`. The `finally` clears the timer and the external listener.
- Defaults: `timeoutMs` 15,000 ms (`:6`), `maxBytes` 2,097,152 bytes (`:7`).

## Decisions

### D1. One capability, two slices, in order

`load-limits` holds both limits of one function. Each requirement is one slice (I1 size, then I2
timeout), because both edit `src/yaml/load.ts`. I2 starts after I1 is merged. Each slice is a
complete fix of one documented limit and can be merged and reverted alone.

### D2. Count the bytes while reading (I1)

Read `response.body` with `getReader()`, add `value.byteLength` per chunk, and once the total is
above `maxBytes` call `reader.cancel()` and return `PR_SOURCE_TOO_LARGE`. Join the chunks and decode
them once with `TextDecoder` (same BOM and replacement behaviour as `decode(arrayBuffer)` today).
When `response.body` is `null` or absent (a host stand-in), fall back to `arrayBuffer()` and the
existing post-read check. Keep the `content-length` fast path, and cancel the unread body there
too, so the connection is released. Both additions stay in I1: they are part of the size limit.

Cancel without waiting: `reader.cancel()` (and `body.cancel()` on the fast path) is called and never
awaited. Its promise gets a no-op `catch`, so a rejection is swallowed, and the result resolves at
once. A source whose `cancel` hangs therefore cannot hold back `PR_SOURCE_TOO_LARGE`, nor, in I2, the
timeout. Options considered for the cancel:

- Await it: a source whose `cancel` never settles keeps the call pending, which defeats both
  limits. Rejected.
- Race it against the signal: bounded by `timeoutMs`, but the size result is already known and
  would wait for nothing useful; more code. Rejected.
- Call it without awaiting, rejection swallowed. **Chosen.** The scenario "Cancel that never settles
  or rejects does not delay the result" pins it.

Options considered for the read:

- Rely on `content-length` alone: it is optional (chunked responses) and is the encoded size.
  Rejected.
- Keep `arrayBuffer()` and check afterwards: buffers the whole body and never ends on an endless
  body. Rejected (the defect).
- Decode each chunk with `TextDecoder` in stream mode: same result, more code. Optional for the
  implementer; the scenario "Multi-byte character split across two chunks" pins the outcome.

### D3. Race every awaited step against the signal (I2)

A small helper `untilAborted<T>(promise, signal)` rejects with the signal's reason when the signal
aborts (at once when it is already aborted), removes its listener when it settles, and attaches a
no-op `catch` to the abandoned promise. Apply it to the `headers` producer, `loadPricing`, `fetch`
and each `reader.read()` of D2 (and the `arrayBuffer()` fallback). The existing catch maps the
rejection to `PR_SOURCE_ABORTED`. When the abort cuts a pending `reader.read()`, the reader is
cancelled the D2 way: called, never awaited, rejection swallowed. So a hanging `cancel` cannot
defeat the timeout either. The `finally` clears the timer and the external listener on every path,
the abort path included.

Also forward an external `signal` that is already aborted when the call starts: abort the internal
controller at once in `createAbortController`. Then the race around the `headers` producer rejects
at once, and `loadPricing`, `fetch` and the body read never start. The requirement names this
trigger ("including a `signal` already aborted at the start"). It stays in I2: it is the same
signal handling.

Options considered (owner Q1):

- (A) every awaited step. **Chosen by the owner.** It matches "15 seconds" with no exception.
- (B) only `loadPricing`. Rejected: `load.ts:60,91` have the same gap.
- (C) an opt-out option. Rejected: new public API.

### D4. No feature flag, no ADR

A flag would add the public option the non-goals exclude. No new architecture, dependency or
public format.

### D5. Tests first; red before without hangs

Each slice has a test-designer task (T, red before, G3) and an implementer task (I, frozen test,
G4). On the base, a test that waits on a hanging promise fails by the vitest timeout, which the G3
check rejects. So:

- T1 uses a _finite_ stream (64 chunks). On the base all 64 are pulled and `cancel` is never called,
  so the assertions fail. The scenario with the hanging or rejecting `cancel` fails the same way:
  the base reads the finite stream to its end and never calls `cancel`.
- T2 uses `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync(timeoutMs + 1)`, then
  `Promise.race([resultPromise, Promise.resolve(PENDING)])` and asserts that the outcome is not
  `PENDING`. Timers are restored in `afterEach`. The scenarios for the `arrayBuffer()` fallback,
  the hanging body cancel and the timer after an external abort use the same sentinel: on the base
  each call stays pending.

### D6. Changesets

One patch changeset per implementation slice (owner Q2: patch, as
`.changeset/phase0-loader-max-bytes.md` also turned a working loader into an error). The I1
changeset says that an oversized body is cancelled, also when its `content-length` declares it. The
I2 changeset tells hosts with slow loaders to raise `request.timeoutMs`, and says that a `signal`
already aborted when the call starts now fails the load with `PR_SOURCE_ABORTED`. Both stay patch.

## Requirement notes

The requirement statements are short (OpenSpec warns above 500 characters); these notes fix their
terms. The scenarios pin each one with concrete values.

`req~fetch-max-bytes-while-reading~1` (tests: `tests/unit/load-stream-max-bytes.test.ts`):

- "Built-in loader": the path without `loadPricing`, with the global or an injected `fetch`. A string
  from `loadPricing` stays under `req~custom-loader-max-bytes~1`.
- "Effective `maxBytes`": `maxBytes` of the options, else 2,097,152 bytes. The comparison is `>`:
  exactly `maxBytes` bytes is accepted.
- Bytes are counted as the body delivers them (after content decoding), as `arrayBuffer()` counts
  them today. A declared `content-length` above the limit is the other trigger of the requirement;
  the body is then cancelled before any chunk is read.
- "Cancelling": the loader calls the cancel and does not wait for it (D2). The result does not
  depend on whether the cancel settles, rejects or hangs.
- "The first chunk that crosses the limit": the chunk after which the total exceeds `maxBytes`. No
  read request follows it. A source with a `highWaterMark` above 0 may have queued one more chunk;
  the scenarios use `highWaterMark: 0` so that pulls equal reads.
- A body without a stream (`body` is `null` or absent) is measured after `arrayBuffer()`.

`req~load-timeout-covers-every-step~1` (tests: `tests/unit/load-timeout.test.ts`):

- "Settled": the returned promise has resolved. The URL and protocol checks run first and keep
  their codes (`PR_SOURCE_URL_INVALID`, `PR_SOURCE_PROTOCOL_INVALID`).
- "Without waiting": the result resolves in the microtasks that follow the abort; no step's later
  result or rejection can change it, and a late rejection is handled (no unhandled rejection).
- "Body read": a `reader.read()` of D2 or the `arrayBuffer()` fallback. "Body cancel": the cancel of
  D2, never awaited.
- An external `signal` already aborted when the call starts counts as aborted before the call
  settled. The `headers` producer may be called; `loadPricing`, `fetch` and the body read are not.
- The abandoned step keeps running; only its result is dropped (risk R2).
- A load that finishes before `timeoutMs`, or ends on an external abort, leaves no pending timer.

## Risks

- R1. A custom loader, `fetch` or `headers` function slower than `timeoutMs` that ignores the
  signal now fails with `PR_SOURCE_ABORTED` instead of succeeding late. Mitigation: the docs and the
  I2 changeset name `request.timeoutMs`.
- R2. An abandoned step, or a cancel that is not awaited, keeps running in the background.
  Mitigation: the docs say so; the no-op `catch` prevents unhandled rejections.
- R3. `Response` stand-ins in host tests may have no `body`. Mitigation: the `arrayBuffer()`
  fallback.
- R4. Both implementation slices edit `src/yaml/load.ts`. Mitigation: I2 starts after I1 is
  merged; the coordinator checks open PRs for edits to `load.ts` and `docs/api-reference.md` first.
- R5. Pre-aborted external signal: hosts that pass an already aborted signal now get
  `PR_SOURCE_ABORTED` instead of a completed load. This matches "honors cancellation"
  (`README.md:405`); the I2 changeset states it.

## Migration

None. No stored data, option or error code changes.

## Open questions

None for the owner. Q1 (scope: every awaited step) and Q2 (patch) are answered. The pre-aborted
signal case (D3) follows from the owner's Q1 answer and the documented "honors cancellation". It
stays in I2, and the cancel of the unread body on the `content-length` fast path stays in I1 (G2
audit advice).
