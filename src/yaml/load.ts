import { normalizePricing } from '../core/index.js';
import type { IPricingLike } from '../core/index.js';
import { parsePricingYaml } from './parser.js';
import type { LoadedPricingResult, LoadPricingOptions, PricingRequestOptions } from './types.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function loadError(code: string, message: string): LoadedPricingResult {
  return {
    ok: false,
    diagnostics: [{ code, severity: 'error', message, path: '$' }],
  };
}

async function resolveHeaders(
  headers: PricingRequestOptions['headers'],
): Promise<HeadersInit | undefined> {
  return typeof headers === 'function' ? headers() : headers;
}

function createAbortController(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error('Pricing request timed out.')),
    timeoutMs,
  );
  return {
    controller,
    cleanup: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onAbort);
    },
  };
}

export async function loadPricingFromUrl(
  source: string,
  options: LoadPricingOptions = {},
): Promise<LoadedPricingResult> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return loadError('PR_SOURCE_URL_INVALID', 'Pricing source URL is invalid.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return loadError('PR_SOURCE_PROTOCOL_INVALID', 'Pricing source must use HTTP or HTTPS.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const { controller, cleanup } = createAbortController(options.signal, timeoutMs);
  try {
    const headers = await resolveHeaders(options.headers);
    if (options.loadPricing) {
      const loaded = await options.loadPricing({
        url: url.toString(),
        signal: controller.signal,
        request: {
          credentials: options.credentials ?? 'omit',
          timeoutMs,
          maxBytes,
          ...(headers ? { headers } : {}),
        },
      });
      return typeof loaded === 'string'
        ? parsePricingYaml(loaded)
        : normalizePricing(loaded as IPricingLike);
    }

    const fetchImplementation = options.fetch ?? globalThis.fetch;
    if (typeof fetchImplementation !== 'function') {
      return loadError('PR_FETCH_UNAVAILABLE', 'No fetch implementation is available.');
    }
    const response = await fetchImplementation(url, {
      method: 'GET',
      credentials: options.credentials ?? 'omit',
      ...(headers ? { headers } : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      return loadError(
        'PR_SOURCE_HTTP_ERROR',
        `Pricing request failed with HTTP ${response.status}.`,
      );
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return loadError('PR_SOURCE_TOO_LARGE', 'Pricing source exceeds the configured size limit.');
    }
    const body = await response.arrayBuffer();
    if (body.byteLength > maxBytes) {
      return loadError('PR_SOURCE_TOO_LARGE', 'Pricing source exceeds the configured size limit.');
    }
    return parsePricingYaml(new TextDecoder().decode(body));
  } catch (error) {
    const aborted = controller.signal.aborted;
    return loadError(
      aborted ? 'PR_SOURCE_ABORTED' : 'PR_SOURCE_LOAD_FAILED',
      aborted
        ? 'Pricing request was cancelled or timed out.'
        : error instanceof Error
          ? error.message
          : 'Pricing source could not be loaded.',
    );
  } finally {
    cleanup();
  }
}
