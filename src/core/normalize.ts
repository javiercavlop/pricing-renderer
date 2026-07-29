import { collectExpressionDependencies } from './expression.js';
import type {
  IPricingLike,
  NormalizedAddOn,
  NormalizedBillingPeriod,
  NormalizedFeature,
  NormalizedPlan,
  NormalizedPricing,
  NormalizedUsageLimit,
  PriceSource,
  PricingDiagnostic,
  PricingResult,
  SubscriptionConstraints,
  UnknownRecord,
} from './types.js';
import {
  asBoolean,
  asFiniteNumber,
  asRecord,
  asString,
  asStringArray,
  entries,
  humanizeIdentifier,
  isRecord,
  normalizeRenderMode,
} from './utils.js';

function diagnostic(
  code: string,
  severity: PricingDiagnostic['severity'],
  message: string,
  path?: string,
): PricingDiagnostic {
  return { code, severity, message, ...(path ? { path } : {}) };
}

function normalizeSyntaxVersion(
  input: unknown,
  diagnostics: PricingDiagnostic[],
): string | undefined {
  const value =
    typeof input === 'number' && Number.isFinite(input)
      ? String(input)
      : typeof input === 'string'
        ? input.trim()
        : '';
  const match = value.match(/^(\d+)\.(\d+)(?:\.\d+)?$/);
  if (!match) {
    diagnostics.push(
      diagnostic(
        'PR_VERSION_INVALID',
        'error',
        'syntaxVersion must use a supported semantic version such as "3.1".',
        'syntaxVersion',
      ),
    );
    return undefined;
  }
  if (match[1] !== '3') {
    diagnostics.push(
      diagnostic(
        'PR_VERSION_UNSUPPORTED_MAJOR',
        'error',
        `Pricing2Yaml major version ${match[1]} is not supported.`,
        'syntaxVersion',
      ),
    );
    return undefined;
  }
  if (match[2] !== '1') {
    diagnostics.push(
      diagnostic(
        'PR_VERSION_BEST_EFFORT',
        'warning',
        `Pricing2Yaml ${value} is rendered using the compatible 3.1 subset.`,
        'syntaxVersion',
      ),
    );
  }
  return value;
}

function normalizePrice(
  input: unknown,
  path: string,
  diagnostics: PricingDiagnostic[],
): PriceSource {
  if (typeof input === 'number') {
    if (Number.isFinite(input) && input >= 0) {
      return { kind: 'fixed', amount: input };
    }
    diagnostics.push(
      diagnostic('PR_PRICE_INVALID', 'error', 'Price must be finite and non-negative.', path),
    );
    return { kind: 'label', text: 'Unavailable' };
  }
  if (typeof input === 'string') {
    const source = input.trim();
    if (source.includes('#')) {
      try {
        return {
          kind: 'expression',
          source,
          dependencies: collectExpressionDependencies(source),
        };
      } catch (error) {
        diagnostics.push(
          diagnostic(
            'PR_EXPRESSION_INVALID',
            'error',
            error instanceof Error ? error.message : 'Invalid price expression.',
            path,
          ),
        );
        return {
          kind: 'expression',
          source,
          dependencies: [...source.matchAll(/#([A-Za-z_$][\w$]*)/g)].map((match) => match[1]!),
        };
      }
    }
    return { kind: 'label', text: source || 'Unavailable' };
  }
  diagnostics.push(
    diagnostic(
      'PR_PRICE_MISSING',
      'warning',
      'Price is missing; the renderer will request a quote.',
      path,
    ),
  );
  return { kind: 'label', text: 'Contact sales' };
}

function normalizeBilling(
  input: unknown,
  diagnostics: PricingDiagnostic[],
): NormalizedBillingPeriod[] {
  const billing = entries(input)
    .map(([id, value]): NormalizedBillingPeriod | undefined => {
      const multiplier = asFiniteNumber(value);
      if (multiplier === undefined || multiplier <= 0) {
        diagnostics.push(
          diagnostic(
            'PR_BILLING_INVALID',
            'warning',
            `Billing multiplier "${id}" must be a positive finite number.`,
            `billing.${id}`,
          ),
        );
        return undefined;
      }
      return { id, label: humanizeIdentifier(id), multiplier };
    })
    .filter((period): period is NormalizedBillingPeriod => period !== undefined);

  return billing.length > 0 ? billing : [{ id: 'base', label: 'Base', multiplier: 1 }];
}

function normalizeFeatures(input: unknown): NormalizedFeature[] {
  return entries(input).map(([id, value]) => {
    const raw = asRecord(value);
    return {
      id,
      name: asString(raw.name) ?? humanizeIdentifier(id),
      ...(asString(raw.description) ? { description: asString(raw.description) } : {}),
      tag: asString(raw.tag) ?? 'General',
      ...(asString(raw.type) ? { type: asString(raw.type) } : {}),
      ...(asString(raw.subtype) ? { subtype: asString(raw.subtype) } : {}),
      ...(asString(raw.valueType) ? { valueType: asString(raw.valueType) } : {}),
      ...('defaultValue' in raw ? { defaultValue: raw.defaultValue } : {}),
      ...(asString(raw.expression) ? { expression: asString(raw.expression) } : {}),
      ...(asString(raw.serverExpression)
        ? { serverExpression: asString(raw.serverExpression) }
        : {}),
      ...(asString(raw.automationType) ? { automationType: asString(raw.automationType) } : {}),
      ...(asString(raw.docUrl) ? { docUrl: asString(raw.docUrl) } : {}),
      ...(asString(raw.integrationType) ? { integrationType: asString(raw.integrationType) } : {}),
      pricingUrls: asStringArray(raw.pricingUrls),
      render: normalizeRenderMode(raw.render),
      raw,
    };
  });
}

function normalizeUsageLimits(input: unknown): NormalizedUsageLimit[] {
  return entries(input).map(([id, value]) => {
    const raw = asRecord(value);
    const renewable = asString(raw.type) ?? (raw.renewable === true ? 'renewable' : undefined);
    return {
      id,
      name: asString(raw.name) ?? humanizeIdentifier(id),
      ...(asString(raw.description) ? { description: asString(raw.description) } : {}),
      tag: asString(raw.tag) ?? 'Usage limits',
      ...(renewable ? { type: renewable } : {}),
      ...(asString(raw.period) ? { period: asString(raw.period) } : {}),
      ...(typeof raw.trackable === 'boolean' ? { trackable: raw.trackable } : {}),
      ...(asString(raw.valueType) ? { valueType: asString(raw.valueType) } : {}),
      ...('defaultValue' in raw ? { defaultValue: raw.defaultValue } : {}),
      ...(asString(raw.unit) ? { unit: asString(raw.unit) } : {}),
      linkedFeatures: asStringArray(raw.linkedFeatures),
      render: normalizeRenderMode(raw.render),
      raw,
    };
  });
}

function normalizeValueMap(input: unknown): Record<string, unknown> {
  return Object.fromEntries(entries(input));
}

function normalizePlans(input: unknown, diagnostics: PricingDiagnostic[]): NormalizedPlan[] {
  return entries(input).map(([id, value]) => {
    const raw = asRecord(value);
    return {
      id,
      name: asString(raw.name) ?? humanizeIdentifier(id),
      ...(asString(raw.description) ? { description: asString(raw.description) } : {}),
      private: asBoolean(raw.private),
      price: normalizePrice(raw.price, `plans.${id}.price`, diagnostics),
      ...(asString(raw.unit) ? { unit: asString(raw.unit) } : {}),
      features: normalizeValueMap(raw.features),
      usageLimits: normalizeValueMap(raw.usageLimits),
      raw,
    };
  });
}

function normalizeSubscriptionConstraints(
  input: unknown,
  path: string,
  diagnostics: PricingDiagnostic[],
): SubscriptionConstraints | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const min = asFiniteNumber(input.minQuantity) ?? asFiniteNumber(input.min) ?? 1;
  const max = asFiniteNumber(input.maxQuantity) ?? asFiniteNumber(input.max);
  const step = asFiniteNumber(input.quantityStep) ?? asFiniteNumber(input.step) ?? 1;

  if (min < 0 || step <= 0 || (max !== undefined && max < min)) {
    diagnostics.push(
      diagnostic(
        'PR_ADDON_CONSTRAINTS_INVALID',
        'error',
        'Add-on subscription constraints require min >= 0, step > 0 and max >= min.',
        path,
      ),
    );
    return undefined;
  }
  return {
    minQuantity: min,
    ...(max !== undefined ? { maxQuantity: max } : {}),
    quantityStep: step,
  };
}

function normalizeAddOns(input: unknown, diagnostics: PricingDiagnostic[]): NormalizedAddOn[] {
  return entries(input).map(([id, value]) => {
    const raw = asRecord(value);
    const constraints = normalizeSubscriptionConstraints(
      raw.subscriptionConstraints,
      `addOns.${id}.subscriptionConstraints`,
      diagnostics,
    );
    return {
      id,
      name: asString(raw.name) ?? humanizeIdentifier(id),
      ...(asString(raw.description) ? { description: asString(raw.description) } : {}),
      private: asBoolean(raw.private),
      availableFor: asStringArray(raw.availableFor),
      dependsOn: asStringArray(raw.dependsOn),
      excludes: asStringArray(raw.excludes),
      price: normalizePrice(raw.price, `addOns.${id}.price`, diagnostics),
      ...(asString(raw.unit) ? { unit: asString(raw.unit) } : {}),
      features: normalizeValueMap(raw.features),
      usageLimits: normalizeValueMap(raw.usageLimits),
      usageLimitsExtensions: normalizeValueMap(raw.usageLimitsExtensions),
      ...(constraints ? { subscriptionConstraints: constraints } : {}),
      raw,
    };
  });
}

function validateAddOnReferences(
  addOns: NormalizedAddOn[],
  plans: NormalizedPlan[],
  diagnostics: PricingDiagnostic[],
): void {
  const addOnIds = new Set(addOns.map((addOn) => addOn.id));
  const planIds = new Set(plans.map((plan) => plan.id));

  for (const addOn of addOns) {
    for (const dependency of addOn.dependsOn) {
      if (!addOnIds.has(dependency)) {
        diagnostics.push(
          diagnostic(
            'PR_ADDON_DEPENDENCY_MISSING',
            'error',
            `Add-on "${addOn.id}" references missing dependency "${dependency}".`,
            `addOns.${addOn.id}.dependsOn`,
          ),
        );
      }
    }
    for (const excluded of addOn.excludes) {
      if (!addOnIds.has(excluded)) {
        diagnostics.push(
          diagnostic(
            'PR_ADDON_EXCLUSION_MISSING',
            'warning',
            `Add-on "${addOn.id}" references missing exclusion "${excluded}".`,
            `addOns.${addOn.id}.excludes`,
          ),
        );
      }
    }
    for (const plan of addOn.availableFor) {
      if (!planIds.has(plan)) {
        diagnostics.push(
          diagnostic(
            'PR_ADDON_PLAN_MISSING',
            'warning',
            `Add-on "${addOn.id}" references missing plan "${plan}".`,
            `addOns.${addOn.id}.availableFor`,
          ),
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(addOns.map((addOn) => [addOn.id, addOn]));
  const visit = (id: string, path: string[]): void => {
    if (visiting.has(id)) {
      diagnostics.push(
        diagnostic(
          'PR_ADDON_DEPENDENCY_CYCLE',
          'error',
          `Add-on dependency cycle detected: ${[...path, id].join(' → ')}.`,
          `addOns.${id}.dependsOn`,
        ),
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const addOn = byId.get(id);
    addOn?.dependsOn.forEach((dependency) => visit(dependency, [...path, id]));
    visiting.delete(id);
    visited.add(id);
  };
  addOns.forEach((addOn) => visit(addOn.id, []));
}

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((tag): tag is string => typeof tag === 'string');
  }
  return Object.keys(asRecord(input));
}

export function normalizePricing(pricing: IPricingLike): PricingResult<NormalizedPricing> {
  const diagnostics: PricingDiagnostic[] = [];
  if (!isRecord(pricing)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic('PR_INPUT_INVALID', 'error', 'Pricing input must be an object.', '$'),
      ],
    };
  }

  const syntaxVersion = normalizeSyntaxVersion(pricing.syntaxVersion, diagnostics);
  if (!syntaxVersion) {
    return { ok: false, diagnostics };
  }

  const plans = normalizePlans(pricing.plans, diagnostics);
  const addOns = normalizeAddOns(pricing.addOns, diagnostics);
  validateAddOnReferences(addOns, plans, diagnostics);
  if (plans.length === 0) {
    diagnostics.push(
      diagnostic('PR_PLANS_EMPTY', 'warning', 'The pricing does not define any plans.', 'plans'),
    );
  }

  const normalized: NormalizedPricing = {
    metadata: {
      syntaxVersion,
      saasName: asString(pricing.saasName) ?? 'Pricing',
      ...(asString(pricing.version) ? { version: asString(pricing.version) } : {}),
      ...(asString(pricing.createdAt) ? { createdAt: asString(pricing.createdAt) } : {}),
      ...(asString(pricing.url) ? { url: asString(pricing.url) } : {}),
      tags: normalizeTags(pricing.tags),
      currency: asString(pricing.currency) ?? 'USD',
    },
    billing: normalizeBilling(pricing.billing, diagnostics),
    variables: normalizeValueMap(pricing.variables),
    features: normalizeFeatures(pricing.features),
    usageLimits: normalizeUsageLimits(pricing.usageLimits),
    plans,
    addOns,
    custom: asRecord(pricing.custom),
    raw: pricing,
  };

  return {
    ok: !diagnostics.some((item) => item.severity === 'error'),
    value: normalized,
    diagnostics,
  };
}

export function getPricingRendererCustom(pricing: NormalizedPricing): UnknownRecord {
  return asRecord(pricing.custom.pricingRenderer);
}
