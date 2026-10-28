// Demo for the loadPricingFromUrl limits. Run after `pnpm build`:
//   node docs/agent-work/prop-20261028-3/review/demo.mjs
import { loadPricingFromUrl } from '../../../../dist/yaml/index.js';

const URL_ = 'https://example.test/pricing.yml';
const results = [];

function report(step, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} step ${step}: ${detail}`);
}

const codeOf = (result) => result.diagnostics?.[0]?.code ?? (result.ok ? 'ok' : 'none');

// Endless 1 KiB-chunk stream; highWaterMark 0 so a chunk is produced only when it is read.
function endlessResponse(headers) {
  const counts = { reads: 0, cancels: 0 };
  const chunk = new Uint8Array(1024).fill(97);
  const body = new ReadableStream(
    {
      pull(controller) {
        counts.reads += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        counts.cancels += 1;
      },
    },
    { highWaterMark: 0 },
  );
  return { counts, response: new Response(body, { status: 200, headers }) };
}

async function streamStep(step, headers, expectedReads) {
  const { counts, response } = endlessResponse(headers);
  const result = await loadPricingFromUrl(URL_, {
    maxBytes: 4096,
    timeoutMs: 5000,
    fetch: async () => response,
  });
  const code = codeOf(result);
  await new Promise((resolve) => setTimeout(resolve, 20));
  report(
    step,
    code === 'PR_SOURCE_TOO_LARGE' && counts.reads === expectedReads && counts.cancels === 1,
    `code=${code} chunksRead=${counts.reads} cancels=${counts.cancels}`,
  );
}

await streamStep(2, undefined, 5);
await streamStep(3, { 'content-length': '5000' }, 0);

// Step 4: steps that ignore the signal still end at the timeout.
{
  const never = () => new Promise(() => {});
  const startedFetch = Date.now();
  const fromFetch = await loadPricingFromUrl(URL_, { timeoutMs: 300, fetch: never });
  const fetchMs = Date.now() - startedFetch;
  const startedLoader = Date.now();
  const fromLoader = await loadPricingFromUrl(URL_, { timeoutMs: 300, loadPricing: never });
  const loaderMs = Date.now() - startedLoader;
  const inWindow = (ms) => ms >= 250 && ms < 1500;
  report(
    4,
    codeOf(fromFetch) === 'PR_SOURCE_ABORTED' &&
      codeOf(fromLoader) === 'PR_SOURCE_ABORTED' &&
      inWindow(fetchMs) &&
      inWindow(loaderMs),
    `fetch: ${codeOf(fromFetch)} after ${fetchMs} ms; loadPricing: ${codeOf(fromLoader)} after ${loaderMs} ms`,
  );
}

// Step 5: a signal that is already aborted never reaches the fetch or the loader.
{
  let fetchCalls = 0;
  let loaderCalls = 0;
  const controller = new AbortController();
  controller.abort();
  const fromFetch = await loadPricingFromUrl(URL_, {
    signal: controller.signal,
    fetch: async () => {
      fetchCalls += 1;
      return new Response('x');
    },
  });
  const fromLoader = await loadPricingFromUrl(URL_, {
    signal: controller.signal,
    loadPricing: async () => {
      loaderCalls += 1;
      return 'x';
    },
  });
  report(
    5,
    codeOf(fromFetch) === 'PR_SOURCE_ABORTED' &&
      codeOf(fromLoader) === 'PR_SOURCE_ABORTED' &&
      fetchCalls === 0 &&
      loaderCalls === 0,
    `fetch: ${codeOf(fromFetch)}, loadPricing: ${codeOf(fromLoader)}, fetchCalls=${fetchCalls} loaderCalls=${loaderCalls}`,
  );
}

process.exit(results.every(Boolean) ? 0 : 1);
