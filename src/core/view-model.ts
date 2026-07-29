import { getMessages, translate } from './i18n.js';
import { getPricingRendererCustom } from './normalize.js';
import { resolvePricing } from './resolve.js';
import type {
  NormalizedPricing,
  PricingComparisonGroup,
  PricingComparisonRow,
  PricingCta,
  PricingHighlightReference,
  PricingPlanBadge,
  PricingPlanHighlightConfiguration,
  PricingPlanHighlightSetting,
  PricingPlanHighlightSummary,
  PricingPlanInheritanceSetting,
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
  deepEqual,
  humanizeIdentifier,
  isRecord,
  unwrapValue,
} from './utils.js';

const highlightKinds = new Set(['feature', 'usage-limit']);
const highlightModes = new Set(['auto', 'manual', 'hybrid']);
const badgeTones = new Set(['accent', 'success', 'warning', 'neutral']);

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

function normalizeHighlightReference(
  input: unknown,
): string | PricingHighlightReference | undefined {
  if (typeof input === 'string' && input.trim()) return input.trim();
  if (!isRecord(input)) return undefined;
  const id = asString(input.id);
  if (!id) return undefined;
  const kind = asString(input.kind);
  return {
    id,
    ...(kind && highlightKinds.has(kind)
      ? { kind: kind as PricingHighlightReference['kind'] }
      : {}),
  };
}

function normalizePlanInheritance(input: unknown): PricingPlanInheritanceSetting | undefined {
  if (input === false || input === 'auto') return input;
  if (!isRecord(input)) return undefined;
  const planId = asString(input.planId);
  if (!planId) return undefined;
  return {
    planId,
    ...(asString(input.label) ? { label: asString(input.label) } : {}),
  };
}

function normalizePlanHighlightSetting(input: unknown): PricingPlanHighlightSetting | undefined {
  if (Array.isArray(input)) {
    return input
      .map(normalizeHighlightReference)
      .filter(
        (reference): reference is string | PricingHighlightReference => reference !== undefined,
      );
  }
  if (!isRecord(input)) return undefined;
  const mode = asString(input.mode);
  const items = Array.isArray(input.items)
    ? input.items
        .map(normalizeHighlightReference)
        .filter(
          (reference): reference is string | PricingHighlightReference => reference !== undefined,
        )
    : undefined;
  const inheritsFrom = normalizePlanInheritance(input.inheritsFrom);
  const maxItems = asFiniteNumber(input.maxItems);
  return {
    ...(mode && highlightModes.has(mode)
      ? { mode: mode as PricingPlanHighlightConfiguration['mode'] }
      : {}),
    ...(items ? { items } : {}),
    ...(inheritsFrom !== undefined ? { inheritsFrom } : {}),
    ...(maxItems !== undefined ? { maxItems: Math.max(0, Math.floor(maxItems)) } : {}),
  };
}

function normalizePlanBadge(input: unknown): PricingPlanBadge | undefined {
  if (!isRecord(input)) return undefined;
  const id = asString(input.id);
  const label = asString(input.label);
  if (!id || !label) return undefined;
  const tone = asString(input.tone);
  return {
    id,
    label,
    ...(tone && badgeTones.has(tone) ? { tone: tone as PricingPlanBadge['tone'] } : {}),
    ...(typeof input.emphasize === 'boolean' ? { emphasize: input.emphasize } : {}),
  };
}

function normalizePresentation(input: unknown): PricingPresentation {
  const value = asRecord(input);
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
  const planHighlights = Object.fromEntries(
    Object.entries(asRecord(value.planHighlights)).flatMap(([planId, setting]) => {
      const normalized = normalizePlanHighlightSetting(setting);
      return normalized === undefined ? [] : [[planId, normalized]];
    }),
  );
  const planBadges = Object.fromEntries(
    Object.entries(asRecord(value.planBadges)).flatMap(([planId, badges]) => {
      if (!Array.isArray(badges)) return [];
      return [
        [
          planId,
          badges.map(normalizePlanBadge).filter((badge): badge is PricingPlanBadge => !!badge),
        ],
      ];
    }),
  );
  return {
    ...(asString(value.title) ? { title: asString(value.title) } : {}),
    ...(asString(value.subtitle) ? { subtitle: asString(value.subtitle) } : {}),
    ...(Object.keys(planBadges).length > 0 ? { planBadges } : {}),
    ...(Object.keys(planHighlights).length > 0 ? { planHighlights } : {}),
    ...(value.planInheritance === false || value.planInheritance === 'auto'
      ? { planInheritance: value.planInheritance }
      : {}),
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
  const merged = mergePresentationOptions(custom, provided);
  return {
    ...merged,
    variableControls: merged.variableControls ?? 'auto',
  };
}

export function mergePresentationOptions(
  defaults?: PricingPresentation,
  provided?: PricingPresentation,
): PricingPresentation {
  const base = normalizePresentation(defaults);
  const override = normalizePresentation(provided);
  const ctas = override.ctas ?? base.ctas;
  const variableControls = override.variableControls ?? base.variableControls;
  return {
    ...base,
    ...override,
    planHighlights: {
      ...(base.planHighlights ?? {}),
      ...(override.planHighlights ?? {}),
    },
    planBadges: {
      ...(base.planBadges ?? {}),
      ...(override.planBadges ?? {}),
    },
    billingLabels: {
      ...(base.billingLabels ?? {}),
      ...(override.billingLabels ?? {}),
    },
    ...(ctas !== undefined ? { ctas } : {}),
    ...(variableControls !== undefined ? { variableControls } : {}),
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

function getPlanHighlightConfiguration(
  presentation: PricingPresentation,
  planId: string,
): PricingPlanHighlightConfiguration | undefined {
  const configured = presentation.planHighlights?.[planId];
  if (Array.isArray(configured)) {
    return { mode: 'manual', items: configured };
  }
  return configured;
}

function getRowValue(row: PricingComparisonRow, planId: string): unknown {
  return row.values.find((cell) => cell.planId === planId)?.value;
}

function hasCapability(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== 0 && value !== '';
}

function isAtLeastAsCapable(current: unknown, base: unknown): boolean {
  if (!hasCapability(base)) return true;
  if (!hasCapability(current)) return false;
  if (typeof current === 'number' && typeof base === 'number') return current >= base;
  if (typeof current === 'boolean' && typeof base === 'boolean') return current || !base;
  return deepEqual(current, base);
}

function isCapabilityImprovement(current: unknown, base: unknown): boolean {
  if (!hasCapability(current)) return false;
  if (!hasCapability(base)) return true;
  if (typeof current === 'number' && typeof base === 'number') return current > base;
  return !deepEqual(current, base) && isAtLeastAsCapable(current, base);
}

function resolveHighlightRow(
  rows: PricingComparisonRow[],
  reference: string | PricingHighlightReference,
): PricingComparisonRow | undefined {
  const normalized = typeof reference === 'string' ? { id: reference } : reference;
  return rows.find(
    (row) => row.id === normalized.id && (!normalized.kind || row.kind === normalized.kind),
  );
}

function getPlanBadges(viewModel: PricingViewModel, planId: string): PricingPlanBadge[] {
  return viewModel.presentation.planBadges?.[planId] ?? [];
}

export function getPlanHighlightSummary(
  viewModel: PricingViewModel,
  planId: string,
): PricingPlanHighlightSummary {
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
  const configuration = getPlanHighlightConfiguration(viewModel.presentation, planId);
  const inheritanceSetting =
    configuration?.inheritsFrom ?? viewModel.presentation.planInheritance ?? 'auto';
  const currentPlanIndex = viewModel.plans.findIndex((plan) => plan.id === planId);
  const requestedBasePlan =
    inheritanceSetting === 'auto'
      ? viewModel.plans[currentPlanIndex - 1]
      : inheritanceSetting && typeof inheritanceSetting === 'object'
        ? viewModel.plans.find((plan) => plan.id === inheritanceSetting.planId)
        : undefined;

  let inheritedFrom: PricingPlanHighlightSummary['inheritedFrom'];
  if (requestedBasePlan && requestedBasePlan.id !== planId) {
    const baseCapabilities = rows.filter((row) =>
      hasCapability(getRowValue(row, requestedBasePlan.id)),
    );
    const inheritsEverything =
      baseCapabilities.length > 0 &&
      baseCapabilities.every((row) =>
        isAtLeastAsCapable(getRowValue(row, planId), getRowValue(row, requestedBasePlan.id)),
      );
    if (inheritsEverything) {
      const customLabel =
        inheritanceSetting && typeof inheritanceSetting === 'object'
          ? inheritanceSetting.label
          : undefined;
      inheritedFrom = {
        planId: requestedBasePlan.id,
        planName: requestedBasePlan.name,
        label: customLabel
          ? customLabel.replaceAll('{plan}', requestedBasePlan.name)
          : translate(viewModel.messages, 'pricing.everythingInPlus', {
              plan: requestedBasePlan.name,
            }),
      };
    }
  }

  const max = configuration?.maxItems ?? viewModel.presentation.maxHighlights ?? 5;
  const mode = configuration?.mode ?? (configuration ? 'hybrid' : 'auto');
  const configuredRows = (configuration?.items ?? [])
    .map((reference) => resolveHighlightRow(rows, reference))
    .filter((row): row is PricingComparisonRow => row !== undefined)
    .filter(
      (row) =>
        !inheritedFrom ||
        isCapabilityImprovement(getRowValue(row, planId), getRowValue(row, inheritedFrom.planId)),
    );
  const automaticRows = rows.filter((row) => {
    const value = getRowValue(row, planId);
    if (!hasCapability(value)) return false;
    return !inheritedFrom || isCapabilityImprovement(value, getRowValue(row, inheritedFrom.planId));
  });
  const candidates =
    mode === 'manual'
      ? configuredRows
      : mode === 'auto'
        ? automaticRows
        : [...configuredRows, ...automaticRows];
  const selectedRows: PricingComparisonRow[] = [];
  const seen = new Set<string>();
  for (const row of candidates) {
    if (selectedRows.length >= max) break;
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selectedRows.push(row);
  }

  return {
    rows: selectedRows,
    badges: getPlanBadges(viewModel, planId),
    ...(inheritedFrom ? { inheritedFrom } : {}),
  };
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
