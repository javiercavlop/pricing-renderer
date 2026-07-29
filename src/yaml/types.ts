import type { IPricingLike, NormalizedPricing, PricingResult } from '../core/index.js';

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
}

export interface LoadPricingOptions extends PricingRequestOptions {
  loadPricing?: PricingLoader;
  signal?: AbortSignal;
}

export type LoadedPricingResult = PricingResult<NormalizedPricing>;
