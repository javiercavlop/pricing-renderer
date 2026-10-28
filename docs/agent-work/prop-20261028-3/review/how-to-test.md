# How to test: PR 70, size and time limits of `loadPricingFromUrl`

The change is in `src/yaml/load.ts` (library only, no UI, no HTTP API). There are no screenshots and no
preview URL. Every step runs locally from the repository root at the PR head. No account is needed.

Steps 2 to 5 are run by one script, `docs/agent-work/prop-20261028-3/review/demo.mjs`. It imports
`dist/yaml/index.js`, so build first. It prints one `PASS` or `FAIL` line per step and exits 1 on any `FAIL`.

## Step 1: install and run the two new test files (22 tests)

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run tests/unit/load-stream-max-bytes.test.ts tests/unit/load-timeout.test.ts
```

Expected: `Test Files 2 passed (2)` and `Tests 22 passed (22)` (13 in `load-timeout`, 9 in
`load-stream-max-bytes`).

Status: verified (G13 run). Output: both files passed, 22 of 22 tests.

## Setup for steps 2 to 5

```sh
pnpm build
node docs/agent-work/prop-20261028-3/review/demo.mjs
```

Real output of the run:

```text
PASS step 2: code=PR_SOURCE_TOO_LARGE chunksRead=5 cancels=1
PASS step 3: code=PR_SOURCE_TOO_LARGE chunksRead=0 cancels=1
PASS step 4: fetch: PR_SOURCE_ABORTED after 300 ms; loadPricing: PR_SOURCE_ABORTED after 300 ms
PASS step 5: fetch: PR_SOURCE_ABORTED, loadPricing: PR_SOURCE_ABORTED, fetchCalls=0 loaderCalls=0
```

The elapsed times may differ by a few milliseconds; the script accepts 250 ms to under 1500 ms.

## Step 2: endless stream without `content-length`, `maxBytes` 4096

The `fetch` option returns a response whose body is an endless stream of 1 KiB chunks.

Expected: `PR_SOURCE_TOO_LARGE`, 5 chunks read (the fifth crosses 4096 bytes), the stream cancelled once.
Reading stops instead of continuing without end.

Status: verified (G13 run). Line: `PASS step 2: code=PR_SOURCE_TOO_LARGE chunksRead=5 cancels=1`.

## Step 3: same stream with `content-length: 5000`

Expected: `PR_SOURCE_TOO_LARGE` before any byte is read: 0 chunks read, the stream cancelled once.

Status: verified (G13 run). Line: `PASS step 3: code=PR_SOURCE_TOO_LARGE chunksRead=0 cancels=1`.

## Step 4: stalled `fetch` and stalled `loadPricing` that ignore the signal, `timeoutMs` 300

Both functions return a promise that never settles and do not look at the abort signal.

Expected: each call returns `PR_SOURCE_ABORTED` about 0.3 s after it starts (negative case: no hang).

Status: verified (G13 run). Line: `PASS step 4: fetch: PR_SOURCE_ABORTED after 300 ms; loadPricing: PR_SOURCE_ABORTED after 300 ms`.

## Step 5: signal already aborted

Both `fetch` and `loadPricing` are passed an `AbortSignal` that is aborted before the call.

Expected: `PR_SOURCE_ABORTED` with 0 `fetch` calls and 0 loader calls (negative case: nothing is requested).

Status: verified (G13 run). Line: `PASS step 5: fetch: PR_SOURCE_ABORTED, loadPricing: PR_SOURCE_ABORTED, fetchCalls=0 loaderCalls=0`.
