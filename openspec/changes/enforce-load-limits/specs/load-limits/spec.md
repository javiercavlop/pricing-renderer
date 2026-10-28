## ADDED Requirements

### Requirement: Size limit enforced while the body is read

`req~fetch-max-bytes-while-reading~1`
IF the built-in loader of `loadPricingFromUrl` gets a response whose declared `content-length` or delivered body size exceeds the effective `maxBytes`, THEN `loadPricingFromUrl` SHALL resolve to a failed result whose only diagnostic is `PR_SOURCE_TOO_LARGE` at path `$`, without parsing the body and after cancelling a stream body, with no chunk read for a declared length over the limit and none past the chunk that crosses it otherwise.

Needs: impl, utest

#### Scenario: Chunked body without content-length over the limit

- **GIVEN** `maxBytes: 4096` and an injected `fetch` that returns `new Response(stream)` with status 200 and no `content-length` header
- **AND** `stream` is a finite `ReadableStream` with `highWaterMark: 0` whose `pull` enqueues one chunk of 1024 bytes per call, 64 chunks in total, and whose `cancel` is a spy
- **WHEN** `loadPricingFromUrl('https://pricing.example.com/pricing.yml', options)` resolves
- **THEN** the result has `ok: false` and exactly one diagnostic, with code `PR_SOURCE_TOO_LARGE`, severity `error` and path `$`
- **AND** `cancel` was called exactly once
- **AND** `pull` was called at most 5 times

#### Scenario: Exactly maxBytes is accepted, one byte more is rejected

- **GIVEN** `maxBytes: 400`, an injected `fetch` that returns `new Response(stream)` with no `content-length` header, and a valid Pricing2Yaml text of exactly 400 UTF-8 bytes split into 4 chunks of 100 bytes
- **WHEN** `loadPricingFromUrl` resolves
- **THEN** the result has `ok: true`
- **WHEN** the same text padded to 401 bytes is streamed as 4 chunks of 100 bytes and one of 1 byte
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_TOO_LARGE`

#### Scenario: Default limit of 2 MiB on a stream body

- **GIVEN** no `maxBytes` and an injected `fetch` that returns `new Response(stream)` with no `content-length` header, where `stream` yields 32 chunks of 65,536 bytes and a final chunk of 1 byte (2,097,153 bytes)
- **WHEN** `loadPricingFromUrl` resolves
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_TOO_LARGE`

#### Scenario: Response without a body stream

- **GIVEN** `maxBytes: 4096` and an injected `fetch` that returns the object `{ ok: true, status: 200, headers: new Headers(), body: null, arrayBuffer: async () => new ArrayBuffer(4097) }`
- **WHEN** `loadPricingFromUrl` resolves
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_TOO_LARGE`
- **WHEN** `arrayBuffer` returns `new ArrayBuffer(4096)` instead
- **THEN** no diagnostic has code `PR_SOURCE_TOO_LARGE`

#### Scenario: Multi-byte character split across two chunks

- **GIVEN** an injected `fetch` that returns `new Response(stream)` with no `content-length` header, and the UTF-8 bytes of a valid Pricing2Yaml text with `saasName: Café`
- **AND** the stream splits those bytes so that `0xC3` ends one chunk and `0xA9` starts the next
- **WHEN** `loadPricingFromUrl` resolves
- **THEN** the result has `ok: true`
- **AND** the normalized pricing's `saasName` is `Café`

#### Scenario: Declared content-length over the limit

- **GIVEN** `maxBytes: 4096` and an injected `fetch` that returns `new Response(stream, { headers: { 'content-length': '5000' } })`
- **AND** `stream` has `highWaterMark: 0`, a `pull` spy that enqueues 5 chunks of 1000 bytes in total, and a `cancel` spy
- **WHEN** `loadPricingFromUrl` resolves
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_TOO_LARGE`
- **AND** `pull` was never called
- **AND** `cancel` was called exactly once

#### Scenario: Cancel that never settles or rejects does not delay the result

- **GIVEN** `maxBytes: 4096` and an injected `fetch` that returns `new Response(stream)` with status 200 and no `content-length` header
- **AND** `stream` has `highWaterMark: 0`, a `pull` that enqueues one chunk of 1024 bytes per call, 64 chunks in total, and a `cancel` spy that returns a promise that never settles
- **WHEN** `loadPricingFromUrl('https://pricing.example.com/pricing.yml', options)` is called
- **THEN** the call settles with `ok: false` and the only diagnostic code `PR_SOURCE_TOO_LARGE`
- **AND** `cancel` was called exactly once
- **WHEN** the `cancel` spy rejects with `new Error('cancel failed')` instead
- **THEN** the call settles with the only diagnostic code `PR_SOURCE_TOO_LARGE`
- **AND** the test run reports no unhandled rejection

### Requirement: Timeout and abort cover every load step

`req~load-timeout-covers-every-step~1`
WHEN `timeoutMs` elapses or the external `signal` aborts before a `loadPricingFromUrl` call settles, including a `signal` already aborted at the start, `loadPricingFromUrl` SHALL resolve to a failed result whose only diagnostic is `PR_SOURCE_ABORTED` at path `$`, without waiting for the pending `headers` producer, `loadPricing`, `fetch`, body read or body cancel, and without starting `loadPricing`, `fetch` or a body read after the abort.

Needs: impl, utest

#### Scenario: Custom loader that never settles and ignores the signal

- **GIVEN** fake timers, `timeoutMs: 1000` and a `loadPricing` that returns a promise that never settles and never reads `signal`
- **WHEN** `loadPricingFromUrl` is called and the fake clock advances by 1001 ms
- **THEN** the call has settled (a `Promise.race` against an already resolved sentinel returns the result, not the sentinel)
- **AND** the result has `ok: false` and exactly one diagnostic, with code `PR_SOURCE_ABORTED`, severity `error` and path `$`

#### Scenario: External signal aborted before the timeout

- **GIVEN** fake timers, no `timeoutMs` (default 15,000 ms), an `AbortController` whose `signal` is passed as `signal`, and a `loadPricing` that never settles and ignores its `signal`
- **WHEN** the controller aborts at 10 ms and the fake clock advances to 11 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`

#### Scenario: External signal already aborted when the call starts

- **GIVEN** an external `signal` that is already aborted and a `loadPricing` spy that resolves a valid Pricing2Yaml text
- **WHEN** `loadPricingFromUrl('https://pricing.example.com/pricing.yml', { signal, loadPricing })` resolves
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_ABORTED`
- **AND** the `loadPricing` spy was not called
- **WHEN** the same call passes an injected `fetch` spy instead of `loadPricing`
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_ABORTED`
- **AND** the `fetch` spy was not called

#### Scenario: No timer is left after an external abort

- **GIVEN** fake timers, `timeoutMs: 1000`, an `AbortController` whose `signal` is passed as `signal`, and a `loadPricing` that never settles and ignores its `signal`
- **WHEN** the controller aborts at 10 ms and the fake clock advances to 11 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`
- **AND** no fake timer is left pending (`vi.getTimerCount()` is 0)

#### Scenario: Late success after the timeout is ignored

- **GIVEN** fake timers, `timeoutMs: 1000` and a `loadPricing` that ignores its `signal` and resolves a valid Pricing2Yaml text at 1500 ms
- **WHEN** the fake clock advances by 2000 ms
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_ABORTED`

#### Scenario: Late rejection after the timeout is not unhandled

- **GIVEN** fake timers, `timeoutMs: 1000` and a `loadPricing` that ignores its `signal` and rejects with `new Error('late')` at 1500 ms
- **WHEN** the fake clock advances by 2000 ms
- **THEN** the result has `ok: false` and its only diagnostic code is `PR_SOURCE_ABORTED`
- **AND** the test run reports no unhandled rejection

#### Scenario: Headers producer that never settles

- **GIVEN** fake timers, `timeoutMs: 1000`, a `headers` function that returns a promise that never settles, and a `fetch` spy
- **WHEN** the fake clock advances by 1001 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`
- **AND** the `fetch` spy was not called

#### Scenario: Injected fetch that ignores the signal

- **GIVEN** fake timers, `timeoutMs: 1000` and an injected `fetch` that returns a promise that never settles and ignores `init.signal`
- **WHEN** the fake clock advances by 1001 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`

#### Scenario: Body stream that never ends

- **GIVEN** fake timers, `timeoutMs: 1000` and an injected `fetch` that resolves `new Response(stream)` with no `content-length` header, where `stream` enqueues one chunk of 10 bytes and then never enqueues again nor closes
- **WHEN** the fake clock advances by 1001 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`

#### Scenario: Body cancel that never settles does not defeat the timeout

- **GIVEN** fake timers, `timeoutMs: 1000` and an injected `fetch` that resolves `new Response(stream)` with no `content-length` header
- **AND** `stream` enqueues one chunk of 10 bytes, then never enqueues again nor closes, and its `cancel` returns a promise that never settles
- **WHEN** the fake clock advances by 1001 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`

#### Scenario: Fallback to arrayBuffer() that never settles

- **GIVEN** fake timers, `timeoutMs: 1000` and an injected `fetch` that resolves the object `{ ok: true, status: 200, headers: new Headers(), body: null, arrayBuffer: () => new Promise(() => {}) }`
- **WHEN** the fake clock advances by 1001 ms
- **THEN** the call has settled with the only diagnostic code `PR_SOURCE_ABORTED`

#### Scenario: A load that finishes in time is unchanged

- **GIVEN** fake timers, `timeoutMs: 1000` and a `loadPricing` that resolves a valid Pricing2Yaml text at 100 ms
- **WHEN** the fake clock advances by 100 ms and the call settles
- **THEN** the result has `ok: true`
- **AND** no fake timer is left pending (`vi.getTimerCount()` is 0)
