'use client';

import { createContext, createElement, useMemo, type ReactElement, type ReactNode } from 'react';
import type { MessageCatalog, PricingPresentation, PricingRendererConfig } from '../core/index.js';
import type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';

export interface PricingRendererProviderProps {
  config?: Partial<PricingRendererConfig>;
  messages?: MessageCatalog;
  presentation?: PricingPresentation;
  request?: PricingRequestOptions;
  // Origins, besides the page origin, that may receive the provider request headers.
  requestOrigins?: readonly string[];
  loadPricing?: PricingLoader;
  children?: ReactNode;
}

export type PricingRendererContextValue = Omit<PricingRendererProviderProps, 'children'>;

export const PricingRendererContext = createContext<PricingRendererContextValue | undefined>(
  undefined,
);

function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

// Headers and credentials of a provider request only go to the page origin or a listed origin.
export function filterProviderRequest(
  request: PricingRequestOptions | undefined,
  src: string | undefined,
  requestOrigins?: readonly string[],
): PricingRequestOptions | undefined {
  if (request === undefined) return undefined;
  const origin = src === undefined ? undefined : originOf(src);
  if (origin !== undefined && origin !== 'null') {
    const pageOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (origin === pageOrigin) return request;
    for (const entry of requestOrigins ?? []) {
      if (originOf(entry) === origin) return request;
    }
  }
  const rest = { ...request };
  delete rest.headers;
  delete rest.credentials;
  return rest;
}

// The provider only publishes its props to its tree; it never writes the global configuration.
export function PricingRendererProvider(props: PricingRendererProviderProps): ReactElement {
  const { children, config, messages, presentation, request, requestOrigins, loadPricing } = props;
  const value = useMemo(
    () => ({ config, messages, presentation, request, requestOrigins, loadPricing }),
    [config, messages, presentation, request, requestOrigins, loadPricing],
  );
  return createElement(PricingRendererContext.Provider, { value }, children);
}
