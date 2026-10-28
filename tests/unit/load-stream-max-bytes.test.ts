import { describe, expect, it, vi } from 'vitest';
import { loadPricingFromUrl } from '../../src/yaml/index.js';
import type { LoadedPricingResult, LoadPricingOptions } from '../../src/yaml/index.js';

const URL_SOURCE = 'https://pricing.example.com/pricing.yml';
const GUARD_MS = 1000;
const HANGING = Symbol('hanging');

const yamlWithNote = (note: string) => `
syntaxVersion: "3.1"
saasName: Loader pricing
plans:
  free:
    price: 0
# ${note}
`;

function yamlOfBytes(bytes: number): string {
  const size = new TextEncoder().encode(yamlWithNote('')).length;
  return yamlWithNote('a'.repeat(bytes - size));
}

function chunksOf(count: number, size: number): Uint8Array[] {
  return Array.from({ length: count }, () => new Uint8Array(size).fill(97));
}

function splitBytes(bytes: Uint8Array, size: number): Uint8Array[] {
  const parts: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    parts.push(bytes.slice(offset, offset + size));
  }
  return parts;
}

// A finite stream: `pull` enqueues one chunk per call and closes after the last one. With
// `highWaterMark: 0` the stream pulls only when a read is pending, so pulls equal reads.
function finiteStream(chunks: Uint8Array[], onCancel?: () => Promise<void>) {
  let next = 0;
  const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
    const chunk = chunks[next];
    next += 1;
    if (chunk) controller.enqueue(chunk);
    if (next >= chunks.length) controller.close();
  });
  const cancel = vi.fn(onCancel);
  const stream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
  return { stream, pull, cancel };
}

// A real-timer guard: an implementation that waits for a promise that never settles fails an
// assertion here instead of running into the test timeout.
async function settle(call: Promise<LoadedPricingResult>): Promise<LoadedPricingResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<typeof HANGING>((resolve) => {
    timer = setTimeout(() => resolve(HANGING), GUARD_MS);
  });
  try {
    const outcome = await Promise.race([call, guard]);
    expect(outcome === HANGING, `the load did not settle within ${GUARD_MS} ms`).toBe(false);
    return outcome as LoadedPricingResult;
  } finally {
    clearTimeout(timer);
  }
}

function load(response: unknown, options: LoadPricingOptions = {}): Promise<LoadedPricingResult> {
  const fetchImplementation = (async () => response) as unknown as typeof fetch;
  return settle(loadPricingFromUrl(URL_SOURCE, { ...options, fetch: fetchImplementation }));
}

function expectOnlyTooLarge(result: LoadedPricingResult) {
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SOURCE_TOO_LARGE',
    severity: 'error',
    path: '$',
  });
}

const neverSettles = () => new Promise<void>(() => {});
const rejects = () => Promise.reject(new Error('cancel failed'));

// [utest->req~fetch-max-bytes-while-reading~1]
describe('maxBytes while the response body is read', () => {
  it('cancels a chunked body without content-length once it crosses the limit', async () => {
    const { stream, pull, cancel } = finiteStream(chunksOf(64, 1024));
    const result = await load(new Response(stream), { maxBytes: 4096 });
    expectOnlyTooLarge(result);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(pull.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('accepts a streamed body of exactly maxBytes', async () => {
    const bytes = new TextEncoder().encode(yamlOfBytes(400));
    expect(bytes.length).toBe(400);
    const chunks = splitBytes(bytes, 100);
    expect(chunks).toHaveLength(4);
    const { stream } = finiteStream(chunks);
    const result = await load(new Response(stream), { maxBytes: 400 });
    expect(result.ok).toBe(true);
  });

  it('rejects a streamed body one byte over maxBytes', async () => {
    const bytes = new TextEncoder().encode(yamlOfBytes(401));
    expect(bytes.length).toBe(401);
    const chunks = splitBytes(bytes, 100);
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 100, 100, 1]);
    const { stream } = finiteStream(chunks);
    const result = await load(new Response(stream), { maxBytes: 400 });
    expectOnlyTooLarge(result);
  });

  it('applies the 2 MiB default to a stream body', async () => {
    const chunks = [...chunksOf(32, 65_536), new Uint8Array(1).fill(97)];
    const { stream } = finiteStream(chunks);
    const result = await load(new Response(stream));
    expectOnlyTooLarge(result);
  });

  it('measures a response without a body stream after arrayBuffer()', async () => {
    const standIn = (buffer: ArrayBuffer) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      arrayBuffer: async () => buffer,
    });

    const over = await load(standIn(new ArrayBuffer(4097)), { maxBytes: 4096 });
    expectOnlyTooLarge(over);

    const exact = await load(standIn(new ArrayBuffer(4096)), { maxBytes: 4096 });
    expect(exact.diagnostics.map((item) => item.code)).not.toContain('PR_SOURCE_TOO_LARGE');
  });

  it('decodes a multi-byte character split across two chunks', async () => {
    const text = `
syntaxVersion: "3.1"
saasName: Café
plans:
  free:
    price: 0
`;
    const bytes = new TextEncoder().encode(text);
    const lead = bytes.indexOf(0xc3);
    expect([bytes[lead], bytes[lead + 1]]).toEqual([0xc3, 0xa9]);
    const { stream } = finiteStream([bytes.slice(0, lead + 1), bytes.slice(lead + 1)]);
    const result = await load(new Response(stream));
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.saasName).toBe('Café');
  });

  it('cancels the unread body when content-length is over the limit', async () => {
    const { stream, pull, cancel } = finiteStream(chunksOf(5, 1000));
    const response = new Response(stream, { headers: { 'content-length': '5000' } });
    const result = await load(response, { maxBytes: 4096 });
    expectOnlyTooLarge(result);
    expect(pull).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a cancel that never settles', async () => {
    const { stream, cancel } = finiteStream(chunksOf(64, 1024), neverSettles);
    const result = await load(new Response(stream), { maxBytes: 4096 });
    expectOnlyTooLarge(result);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('swallows the rejection of a cancel that fails', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const { stream, cancel } = finiteStream(chunksOf(64, 1024), rejects);
      const result = await load(new Response(stream), { maxBytes: 4096 });
      expectOnlyTooLarge(result);
      expect(cancel).toHaveBeenCalledTimes(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
