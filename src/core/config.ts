import type { PricingRendererConfig } from './types.js';

export const DEFAULT_PRICING_RENDERER_CONFIG: Readonly<PricingRendererConfig> = Object.freeze({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
  presentation: Object.freeze({}),
});

let configuredDefaults = DEFAULT_PRICING_RENDERER_CONFIG;

function normalizeLocale(locale: string): string {
  const value = locale.trim();
  if (!value) throw new TypeError('Pricing renderer locale cannot be empty.');
  try {
    return Intl.getCanonicalLocales(value)[0] ?? value;
  } catch {
    throw new TypeError(`Invalid pricing renderer locale: ${locale}`);
  }
}

function normalizePricingPath(pricingPath: string): string {
  const value = pricingPath.trim();
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new TypeError(
      'Pricing renderer pricingPath must be an absolute application pathname such as "/pricing".',
    );
  }
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function normalizeFeatureFlag(
  value: boolean | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new TypeError(`Pricing renderer ${name} must be a boolean.`);
  }
  return value;
}

export function createPricingRendererConfig(
  options: Partial<PricingRendererConfig> = {},
): Readonly<PricingRendererConfig> {
  if (
    options.presentation !== undefined &&
    (typeof options.presentation !== 'object' ||
      options.presentation === null ||
      Array.isArray(options.presentation))
  ) {
    throw new TypeError('Pricing renderer presentation must be an object.');
  }
  return Object.freeze({
    locale: normalizeLocale(options.locale ?? DEFAULT_PRICING_RENDERER_CONFIG.locale),
    pricingPath: normalizePricingPath(
      options.pricingPath ?? DEFAULT_PRICING_RENDERER_CONFIG.pricingPath,
    ),
    selectionEnabled: normalizeFeatureFlag(
      options.selectionEnabled,
      DEFAULT_PRICING_RENDERER_CONFIG.selectionEnabled,
      'selectionEnabled',
    ),
    ctaEnabled: normalizeFeatureFlag(
      options.ctaEnabled,
      DEFAULT_PRICING_RENDERER_CONFIG.ctaEnabled,
      'ctaEnabled',
    ),
    variablesEnabled: normalizeFeatureFlag(
      options.variablesEnabled,
      DEFAULT_PRICING_RENDERER_CONFIG.variablesEnabled,
      'variablesEnabled',
    ),
    presentation: Object.freeze({ ...(options.presentation ?? {}) }),
  });
}

export function configurePricingRenderer(
  options: Partial<PricingRendererConfig> = {},
): Readonly<PricingRendererConfig> {
  configuredDefaults = createPricingRendererConfig(options);
  return configuredDefaults;
}

export function getPricingRendererConfig(): Readonly<PricingRendererConfig> {
  return configuredDefaults;
}
