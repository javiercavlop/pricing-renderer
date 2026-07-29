import { getMessages } from './i18n.js';
import { getPricingRendererCustom } from './normalize.js';
import { resolvePricing } from './resolve.js';
import type {
  NormalizedPricing,
  PricingComparisonGroup,
  PricingComparisonRow,
  PricingCta,
  PricingPresentation,
  PricingSelection,
  PricingViewModel,
  UnknownRecord,
  VariableControl,
  ViewModelOptions,
} from './types.js';
import {
  asFiniteNumber,
  asRecord,
  asString,
  asStringArray,
  humanizeIdentifier,
  isRecord,
  unwrapValue,
} from './utils.js';

function normalizeCtas(input: unknown): PricingCta[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const ctas = input
    .map((value): PricingCta | undefined => {
      if (!isRecord(value)) return undefined;
      const id = asString(value.id);
      const label = asString(value.label);
      if (!id || !label) return undefined;
      const target =
        value.target === '_blank' ? '_blank' : value.target === '_self' ? '_self' : undefined;
      const kind =
        value.kind === 'secondary' ? 'secondary' : value.kind === 'primary' ? 'primary' : undefined;
      return {
        id,
        label,
        ...(asString(value.href) ? { href: asString(value.href) } : {}),
        ...(target ? { target } : {}),
        ...(asString(value.planId) ? { planId: asString(value.planId) } : {}),
        ...(kind ? { kind } : {}),
        ...(isRecord(value.metadata) ? { metadata: value.metadata } : {}),
      };
    })
    .filter((cta): cta is PricingCta => cta !== undefined);
  return ctas;
}

function normalizeVariableControl(input: unknown): VariableControl | undefined {
  if (!isRecord(input)) return undefined;
  const path = asString(input.path);
  const type = asString(input.type);
  if (!path || !type || !['boolean', 'number', 'text', 'select', 'slider'].includes(type)) {
    return undefined;
  }
  const options = Array.isArray(input.options)
    ? input.options
        .map((option) =>
          isRecord(option) && asString(option.label)
            ? { value: option.value, label: asString(option.label)! }
            : undefined,
        )
        .filter((option): option is { value: unknown; label: string } => option !== undefined)
    : undefined;
  return {
    path,
    type: type as VariableControl['type'],
    ...(asString(input.label) ? { label: asString(input.label) } : {}),
    ...(asString(input.description) ? { description: asString(input.description) } : {}),
    ...(asFiniteNumber(input.min) !== undefined ? { min: asFiniteNumber(input.min) } : {}),
    ...(asFiniteNumber(input.max) !== undefined ? { max: asFiniteNumber(input.max) } : {}),
    ...(asFiniteNumber(input.step) !== undefined ? { step: asFiniteNumber(input.step) } : {}),
    ...(options ? { options } : {}),
    ...(typeof input.hidden === 'boolean' ? { hidden: input.hidden } : {}),
  };
}

function normalizePresentation(input: unknown): PricingPresentation {
  const value = asRecord(input);
  const highlightedFeatureIds = Object.fromEntries(
    Object.entries(asRecord(value.highlightedFeatureIds)).map(([planId, ids]) => [
      planId,
      asStringArray(ids),
    ]),
  );
  const variableControls =
    value.variableControls === false || value.variableControls === 'auto'
      ? value.variableControls
      : Array.isArray(value.variableControls)
        ? value.variableControls
            .map(normalizeVariableControl)
            .filter((control): control is VariableControl => control !== undefined)
        : undefined;
  const ctas = normalizeCtas(value.ctas);
  const billingLabels = Object.fromEntries(
    Object.entries(asRecord(value.billingLabels)).flatMap(([id, label]) =>
      typeof label === 'string' ? [[id, label]] : [],
    ),
  );
  return {
    ...(asString(value.title) ? { title: asString(value.title) } : {}),
    ...(asString(value.subtitle) ? { subtitle: asString(value.subtitle) } : {}),
    ...(asString(value.recommendedPlanId)
      ? { recommendedPlanId: asString(value.recommendedPlanId) }
      : {}),
    ...(Object.keys(highlightedFeatureIds).length > 0 ? { highlightedFeatureIds } : {}),
    ...(ctas ? { ctas } : {}),
    ...(variableControls !== undefined ? { variableControls } : {}),
    ...(Object.keys(billingLabels).length > 0 ? { billingLabels } : {}),
    ...(asFiniteNumber(value.maxHighlights) !== undefined
      ? { maxHighlights: Math.max(0, Math.floor(asFiniteNumber(value.maxHighlights)!)) }
      : {}),
  };
}

export function mergePresentation(
  pricing: NormalizedPricing,
  provided?: PricingPresentation,
): PricingPresentation {
  const custom = normalizePresentation(getPricingRendererCustom(pricing));
  return {
    ...custom,
    ...provided,
    highlightedFeatureIds: {
      ...(custom.highlightedFeatureIds ?? {}),
      ...(provided?.highlightedFeatureIds ?? {}),
    },
    billingLabels: {
      ...(custom.billingLabels ?? {}),
      ...(provided?.billingLabels ?? {}),
    },
    ctas: provided?.ctas ?? custom.ctas,
    variableControls: provided?.variableControls ?? custom.variableControls ?? 'auto',
  };
}

function createAutoVariableControls(pricing: NormalizedPricing): VariableControl[] {
  const dependencies = new Set<string>();
  [...pricing.plans, ...pricing.addOns].forEach((item) => {
    if (item.price.kind === 'expression') {
      item.price.dependencies.forEach((dependency) => dependencies.add(dependency));
    }
  });

  return Object.entries(pricing.variables).flatMap(([path, value]): VariableControl[] => {
    if (!dependencies.has(path)) return [];
    if (typeof value === 'boolean') {
      return [{ path, type: 'boolean', label: humanizeIdentifier(path) }];
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return [{ path, type: 'number', label: humanizeIdentifier(path) }];
    }
    if (typeof value === 'string') {
      return [{ path, type: 'text', label: humanizeIdentifier(path) }];
    }
    return [];
  });
}

function createComparisonGroups(
  pricing: NormalizedPricing,
  planIds: Set<string>,
): PricingComparisonGroup[] {
  const rows: PricingComparisonRow[] = [];
  for (const feature of pricing.features) {
    if (feature.render === 'disabled') continue;
    rows.push({
      id: feature.id,
      kind: 'feature',
      name: feature.name,
      ...(feature.description ? { description: feature.description } : {}),
      category: feature.tag,
      ...(feature.docUrl ? { docUrl: feature.docUrl } : {}),
      values: pricing.plans
        .filter((plan) => planIds.has(plan.id))
        .map((plan) => ({
          planId: plan.id,
          value:
            plan.features[feature.id] !== undefined
              ? unwrapValue(plan.features[feature.id])
              : feature.defaultValue,
        })),
      raw: feature.raw,
    });
  }
  for (const usageLimit of pricing.usageLimits) {
    if (usageLimit.render === 'disabled') continue;
    rows.push({
      id: usageLimit.id,
      kind: 'usage-limit',
      name: usageLimit.name,
      ...(usageLimit.description ? { description: usageLimit.description } : {}),
      category: usageLimit.tag,
      ...(usageLimit.unit ? { unit: usageLimit.unit } : {}),
      values: pricing.plans
        .filter((plan) => planIds.has(plan.id))
        .map((plan) => ({
          planId: plan.id,
          value:
            plan.usageLimits[usageLimit.id] !== undefined
              ? unwrapValue(plan.usageLimits[usageLimit.id])
              : usageLimit.defaultValue,
        })),
      raw: usageLimit.raw,
    });
  }

  const groups = new Map<string, PricingComparisonGroup>();
  for (const row of rows) {
    const id = row.category || 'General';
    const existing = groups.get(id);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(id, { id, name: id, rows: [row] });
    }
  }
  return [...groups.values()];
}

export function createPricingViewModel(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
  options: ViewModelOptions = {},
): PricingViewModel {
  const visibility = options.visibility ?? 'public-only';
  const plans = pricing.plans.filter((plan) => visibility === 'all' || !plan.private);
  const addOns = pricing.addOns.filter((addOn) => visibility === 'all' || !addOn.private);
  const presentation = mergePresentation(pricing, options.presentation);
  const controls =
    presentation.variableControls === false
      ? []
      : presentation.variableControls === 'auto' || presentation.variableControls === undefined
        ? createAutoVariableControls(pricing)
        : presentation.variableControls.filter((control) => !control.hidden);

  return {
    pricing,
    resolved: resolvePricing(pricing, selection, {
      ...(options.expression ? { expression: options.expression } : {}),
    }),
    plans,
    addOns,
    comparisonGroups: createComparisonGroups(pricing, new Set(plans.map((plan) => plan.id))),
    variableControls: controls,
    presentation,
    locale: options.locale ?? 'en-US',
    messages: getMessages(options.locale, options.messages),
    mode: options.mode ?? 'commercial',
    visibility,
  };
}

export function getPlanHighlights(
  viewModel: PricingViewModel,
  planId: string,
): PricingComparisonRow[] {
  const configured = viewModel.presentation.highlightedFeatureIds?.[planId];
  const max = viewModel.presentation.maxHighlights ?? 5;
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
  if (configured?.length) {
    return configured
      .map((id) => rows.find((row) => row.id === id))
      .filter((row): row is PricingComparisonRow => row !== undefined)
      .slice(0, max);
  }
  return rows
    .filter((row) => {
      const value = row.values.find((cell) => cell.planId === planId)?.value;
      return value !== undefined && value !== null && value !== false && value !== 0;
    })
    .slice(0, max);
}

export function getPlanCta(
  presentation: PricingPresentation,
  planId: string,
): PricingCta | undefined {
  return presentation.ctas?.find((cta) => cta.planId === planId);
}

export function isSafeLink(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized || /^(?:javascript|data|vbscript|file):/.test(normalized)) return false;
  return /^(?:https?:|mailto:|\/|\.\/|\.\.\/|#)/.test(normalized);
}

export function getCustomDetails(pricing: NormalizedPricing): UnknownRecord {
  return asRecord(pricing.custom);
}
