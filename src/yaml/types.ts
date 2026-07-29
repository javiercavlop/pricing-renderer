import type {
  IPricingLike,
  NormalizedPricing,
  NormalizePricingOptions,
  PricingResult,
} from '../core/index.js';

export interface PricingRequestOptions {
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  credentials?: RequestCredentials;
  timeoutMs?: number;
  maxBytes?: number;
  fetch?: typeof globalThis.fetch;
}

export interface PricingLoaderContext {
  url: string;
  signal: AbortSignal;
  request: Omit<PricingRequestOptions, 'headers' | 'fetch'> & {
    headers?: HeadersInit;
  };
}

export type PricingLoader = (context: PricingLoaderContext) => Promise<string | IPricingLike>;

export interface ParsePricingYamlOptions {
  maxAliasCount?: number;
  normalize?: NormalizePricingOptions;
}

export interface LoadPricingOptions extends PricingRequestOptions {
  loadPricing?: PricingLoader;
  signal?: AbortSignal;
  normalize?: NormalizePricingOptions;
}

export type LoadedPricingResult = PricingResult<NormalizedPricing>;
