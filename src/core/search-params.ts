import { applySelectionInput, type ApplySelectionInputResult } from './apply-selection.js';
import { createDefaultSelection } from './resolve.js';
import type { AddOnSelection, NormalizedPricing, PricingSelection } from './types.js';
import { isRecord } from './utils.js';

export interface SelectionToSearchParamsOptions {
  /** Text put before every key, so several renderers can share one query string. */
  prefix?: string;
}

export interface SelectionFromSearchParamsOptions {
  /** Text that every key read must start with; entries without it are ignored. */
  prefix?: string;
  /** Selection whose plan or billing period replaces an unknown one; defaults to the pricing's defaults. */
  current?: PricingSelection;
}

const MAX_ENTRIES = 100;
const MAX_VALUE_LENGTH = 2048;
const MAX_DEPTH = 8;
const MAX_DIAGNOSTIC_ID_LENGTH = 64;
const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const CANONICAL_INDEX = /^(0|[1-9]\d*)$/;
const DIGITS = /^\d+$/;
const ADDON_PATH = 'selection.addOns.';

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

// [impl->req~search-params-write~1] [impl->req~search-params-write-variables~1]
// [impl->req~search-params-prefix~1] [impl->req~search-params-round-trip~2]
// [impl->req~search-params-round-trip-variables~1] [impl->req~search-params-no-dom~1]
export function selectionToSearchParams(
  selection: PricingSelection,
  options: SelectionToSearchParamsOptions = {},
): [string, string][] {
  const prefix = options.prefix ?? '';
  const pairs: [string, string][] = [];
  if (selection.planId !== undefined) pairs.push([`${prefix}plan`, selection.planId]);
  if (selection.billingPeriod !== undefined) {
    pairs.push([`${prefix}billing`, selection.billingPeriod]);
  }
  for (const [id, entry] of Object.entries(selection.addOns)) {
    if (!entry.selected) continue;
    // an id with a colon keeps its quantity, so the reader's split at the last colon gives it back
    const value = entry.quantity !== 1 || id.includes(':') ? `${id}:${entry.quantity}` : id;
    pairs.push([`${prefix}addon`, value]);
  }
  for (const [name, value] of Object.entries(selection.variables)) {
    const text = JSON.stringify(value) as string | undefined;
    if (text !== undefined) pairs.push([`${prefix}var.${name}`, text]);
  }
  return pairs;
}

// [impl->req~search-params-var-path-split~1]
function pathSegments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

// [impl->req~search-params-var-path-safe~3] [impl->req~search-params-var-depth-limit~1]
function isSafePath(variables: Record<string, unknown>, segments: string[]): boolean {
  if (segments.length === 0 || segments.length > MAX_DEPTH) return false;
  let parent: unknown = variables;
  for (const segment of segments) {
    if (UNSAFE_SEGMENTS.has(segment)) return false;
    if (Array.isArray(parent)) {
      if (!CANONICAL_INDEX.test(segment) || Number(segment) >= parent.length) return false;
    } else {
      if (DIGITS.test(segment)) return false;
      // a scalar cannot hold a key; a missing parent is created as a record
      if (parent !== undefined && !isRecord(parent)) return false;
    }
    parent =
      parent !== undefined && hasOwn(parent as object, segment)
        ? (parent as Record<string, unknown>)[segment]
        : undefined;
  }
  return true;
}

// [impl->req~search-params-var-path-split~1]
function setAtSegments(
  variables: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  let current = variables;
  for (const segment of segments.slice(0, -1)) {
    let next = hasOwn(current, segment) ? current[segment] : undefined;
    if (next === undefined) {
      next = {};
      current[segment] = next;
    }
    current = next as Record<string, unknown>;
  }
  current[segments[segments.length - 1]!] = value;
}

function depthOf(value: unknown): number {
  const members = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : undefined;
  if (members === undefined) return 0;
  return 1 + members.reduce<number>((deepest, member) => Math.max(deepest, depthOf(member)), 0);
}

// [impl->req~search-params-var-text~1] [impl->req~search-params-var-proto-keys~1]
// [impl->req~search-params-var-length-limit~1] [impl->req~search-params-var-depth-limit~1]
// [impl->req~search-params-var-type-unchecked~1]
function parseVariableValue(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text.length > MAX_VALUE_LENGTH) return { ok: false };
  let value: unknown;
  try {
    value = JSON.parse(text, (key: string, item: unknown) =>
      key === '__proto__' ? undefined : item,
    );
  } catch {
    return { ok: true, value: text };
  }
  return depthOf(value) > MAX_DEPTH ? { ok: false } : { ok: true, value };
}

function cutId(id: string): string {
  if (id.length <= MAX_DIAGNOSTIC_ID_LENGTH) return id;
  const code = id.charCodeAt(MAX_DIAGNOSTIC_ID_LENGTH - 1);
  const end =
    code >= 0xd800 && code <= 0xdbff ? MAX_DIAGNOSTIC_ID_LENGTH - 1 : MAX_DIAGNOSTIC_ID_LENGTH;
  return id.slice(0, end);
}

function isStringPair(entry: unknown): entry is [string, string] {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === 'string' &&
    typeof entry[1] === 'string'
  );
}

// [impl->req~search-params-read~1] [impl->req~search-params-read-no-throw~1]
// [impl->req~search-params-prefix~1] [impl->req~search-params-unknown-ids~1]
// [impl->req~search-params-round-trip~2] [impl->req~search-params-round-trip-variables~1]
// [impl->req~search-params-no-dom~1]
export function selectionFromSearchParams(
  pricing: NormalizedPricing,
  params: Iterable<[string, string]>,
  options: SelectionFromSearchParamsOptions = {},
): ApplySelectionInputResult {
  const prefix = options.prefix ?? '';
  const variables = createDefaultSelection(pricing).variables;
  // a null prototype keeps ids such as __proto__ ordinary keys for applySelectionInput to report
  const addOns = Object.create(null) as Record<string, AddOnSelection>;
  let planId: string | undefined;
  let billingPeriod: string | undefined;

  let taken = 0;
  for (const entry of params as Iterable<unknown>) {
    taken += 1;
    if (isStringPair(entry) && entry[0].startsWith(prefix)) {
      const key = entry[0].slice(prefix.length);
      const value = entry[1];
      if (key === 'plan') {
        planId ??= value;
      } else if (key === 'billing') {
        billingPeriod ??= value;
      } else if (key === 'addon') {
        // [impl->req~search-params-read-addon-quantity-nan~1] [impl->req~search-params-read-repeated-addon~1]
        const colon = value.lastIndexOf(':');
        const id = colon === -1 ? value : value.slice(0, colon);
        const quantity = colon === -1 ? 1 : Number(value.slice(colon + 1));
        addOns[id] = { selected: true, quantity };
      } else if (key.startsWith('var.')) {
        const segments = pathSegments(key.slice('var.'.length));
        if (isSafePath(variables, segments)) {
          const parsed = parseVariableValue(value);
          if (parsed.ok) setAtSegments(variables, segments, parsed.value);
        }
      }
    }
    // [impl->req~search-params-entry-limit~1]
    if (taken >= MAX_ENTRIES) break;
  }

  const input: Partial<PricingSelection> = { variables, addOns };
  if (planId !== undefined) input.planId = planId;
  if (billingPeriod !== undefined) input.billingPeriod = billingPeriod;
  const result = applySelectionInput(
    pricing,
    options.current ?? createDefaultSelection(pricing),
    input,
  );

  // [impl->req~search-params-diagnostic-id-length~2] the whole id was matched; only the report is cut
  const diagnostics = result.diagnostics.map((diagnostic) => {
    let id: string | undefined;
    if (diagnostic.code === 'PR_SELECTION_UNKNOWN_PLAN') id = planId;
    else if (diagnostic.code === 'PR_SELECTION_UNKNOWN_BILLING_PERIOD') id = billingPeriod;
    else if (diagnostic.code === 'PR_SELECTION_UNKNOWN_ADDON' && diagnostic.path) {
      id = diagnostic.path.slice(ADDON_PATH.length);
    }
    if (id === undefined || id.length <= MAX_DIAGNOSTIC_ID_LENGTH) return diagnostic;
    const cut = cutId(id);
    return {
      ...diagnostic,
      message: diagnostic.message.split(`"${id}"`).join(`"${cut}"`),
      ...(diagnostic.path !== undefined ? { path: diagnostic.path.split(id).join(cut) } : {}),
    };
  });
  return { ...result, diagnostics };
}
