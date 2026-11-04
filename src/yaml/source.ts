import { normalizePricing } from '../core/index.js';
import type {
  IPricingLike,
  NormalizedPricing,
  NormalizePricingOptions,
  PricingResult,
} from '../core/index.js';
import { loadPricingFromUrl } from './load.js';
import { parsePricingYaml } from './parser.js';
import type { PricingLoader, PricingRequestOptions } from './types.js';

export interface PricingSourceInput {
  pricing?: IPricingLike;
  yaml?: string;
  src?: string;
}

export interface PricingSourceOptions {
  request?: PricingRequestOptions;
  loadPricing?: PricingLoader;
  normalizeOptions?: NormalizePricingOptions;
  signal?: AbortSignal;
}

type SourceResult = PricingResult<NormalizedPricing>;

// [impl->req~load-source-one-source~1]
// The failed result of a source count other than one; undefined when exactly one source is given.
export function pricingSourceError(input: PricingSourceInput): SourceResult | undefined {
  const count =
    (input.pricing !== undefined ? 1 : 0) +
    (input.yaml !== undefined ? 1 : 0) +
    (input.src ? 1 : 0);
  if (count === 1) return undefined;
  return {
    ok: false,
    diagnostics: [
      {
        code: count === 0 ? 'PR_SOURCE_MISSING' : 'PR_SOURCE_CONFLICT',
        severity: 'error',
        message:
          count === 0
            ? 'Provide exactly one pricing source: pricing, yaml or src.'
            : 'Only one pricing source can be provided at a time.',
        path: '$',
      },
    ],
  };
}

// [impl->req~load-source-result~1]
// Inline sources give a result at once, src gives a promise. request is passed as given.
export function loadPricingSource(
  input: PricingSourceInput,
  options: PricingSourceOptions = {},
): SourceResult | Promise<SourceResult> {
  const failure = pricingSourceError(input);
  if (failure) return failure;
  const { request, loadPricing, normalizeOptions, signal } = options;
  if (input.pricing !== undefined) {
    return normalizePricing(input.pricing, normalizeOptions);
  }
  if (input.yaml !== undefined) {
    return parsePricingYaml(input.yaml, {
      ...(normalizeOptions ? { normalize: normalizeOptions } : {}),
    });
  }
  return loadPricingFromUrl(input.src!, {
    ...(request ?? {}),
    ...(loadPricing ? { loadPricing } : {}),
    ...(normalizeOptions ? { normalize: normalizeOptions } : {}),
    ...(signal ? { signal } : {}),
  });
}
