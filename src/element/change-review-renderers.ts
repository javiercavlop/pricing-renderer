// `html` is aliased so that the layout of the templates below stays as written.
import { html as tpl, nothing, type TemplateResult } from 'lit';
import {
  formatCurrency,
  translate,
  type AddOnChange,
  type AddOnRemoval,
  type ComparedPlan,
  type ComparedValue,
  type MessageCatalog,
  type NormalizedBillingPeriod,
  type PriceBreakdown,
  type SelectionComparison,
  type SelectionRelation,
} from '../core/index.js';
import { formatUnit } from '../core/units.js';

// The templates of <pricing-change-review>. Every name, notice and error is bound as text (a Lit
// text binding), never as HTML: nothing here sets or parses markup from data.

type Tone = 'success' | 'warning' | 'accent';
type Params = Record<string, string | number>;
type Content = TemplateResult | typeof nothing;

// The parts of the review a host can hide. The content sections are deliberately absent: a review
// without its plan or its price is not a review.
export const REVIEW_SECTION_NAMES = [
  // For a host whose own heading already names what is being compared.
  'title',
  // The badge that reads a plan change as Upgrade or Downgrade. It follows the declaration order
  // of `pricing.plans`, which is a ladder only inside a subscription: two configurations compared
  // side by side have no such order, and the badge would assert one they do not have.
  'relation',
  // Confirm and Back, for a diff that is not actionable.
  'actions',
] as const;
export type ReviewSectionName = (typeof REVIEW_SECTION_NAMES)[number];

export interface ReviewRenderState {
  comparison: SelectionComparison;
  locale: string;
  messages: MessageCatalog;
  notices: readonly string[];
  error?: string;
  pending: boolean;
  // pending, or nothing to confirm
  blocked: boolean;
  // the text of Confirm when the host replaces pricing.reviewConfirm
  confirmLabel?: string;
  /** Parts the host hides; absent means none. */
  hiddenSections?: ReadonlySet<ReviewSectionName>;
  // a prefix for the ids of the headings, unique per element
  idPrefix: string;
  onConfirm: () => void;
  onBack: () => void;
}

const relationKeys: Record<SelectionRelation, string> = {
  upgrade: 'pricing.reviewRelationUpgrade',
  downgrade: 'pricing.reviewRelationDowngrade',
  change: 'pricing.reviewRelationChange',
  current: 'pricing.reviewRelationCurrent',
};

const relationTones: Record<SelectionRelation, Tone | undefined> = {
  upgrade: 'success',
  downgrade: 'warning',
  change: 'accent',
  current: undefined,
};

const removalKeys = {
  'unavailable-for-plan': 'pricing.reviewRemovedUnavailable',
  'dependency-removed': 'pricing.reviewRemovedDependency',
  'not-in-version': 'pricing.reviewRemovedNotInVersion',
} as const;

const differenceKeys = {
  quote: 'pricing.reviewDifferenceQuote',
  currency: 'pricing.reviewDifferenceCurrency',
} as const;

const dash = '—';

// Intl rejects the underscore of a locale such as es_ES.
function intlLocale(locale: string): string {
  return locale.replace(/_/g, '-');
}

function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(intlLocale(locale), options).format(value);
  } catch {
    return String(value);
  }
}

// Mirrors renderValue of the renderer, as text: no value and false are "Not included", unlimited
// is "Unlimited", numbers use Intl for the locale and carry the unit, text is kept, and arrays and
// objects are written as JSON.
export function formatComparedValue(
  value: ComparedValue,
  messages: MessageCatalog,
  locale: string,
  unit?: string,
): string {
  switch (value.kind) {
    case 'none':
      return translate(messages, 'pricing.notIncluded');
    case 'unlimited':
      return translate(messages, 'pricing.unlimited');
    case 'boolean':
      return translate(messages, value.value ? 'pricing.included' : 'pricing.notIncluded');
    case 'number': {
      const formatted = formatNumber(value.value, locale);
      if (!unit) return formatted;
      return `${formatted} ${formatUnit(unit, value.value, intlLocale(locale))}`;
    }
    case 'text':
      return value.value;
    case 'json':
      return JSON.stringify(value.value);
  }
}

// The difference of two subtotals with its sign ("+€2", "-€5", "€0"), with the fraction digits of
// formatCurrency.
export function formatSignedCurrency(amount: number, currency: string, locale = 'en-US'): string {
  const maximumFractionDigits = amount % 1 === 0 ? 0 : 2;
  const base = { signDisplay: 'exceptZero', maximumFractionDigits } as const;
  try {
    const options = { ...base, style: 'currency', currency } as const;
    return new Intl.NumberFormat(intlLocale(locale), options).format(amount);
  } catch {
    return formatNumber(amount, locale, base);
  }
}

function t(state: ReviewRenderState, key: string, parameters?: Params): string {
  return translate(state.messages, key, parameters);
}

function arrow(state: ReviewRenderState, before: string, after: string): string {
  return t(state, 'pricing.reviewChangeArrow', { before, after });
}

function badge(text: string, tone?: Tone): TemplateResult {
  return tpl`<span data-pr-part="change-badge" data-tone=${tone ?? nothing}>${text}</span>`;
}

function reviewSection(
  state: ReviewRenderState,
  part: string,
  titleKey: string,
  body: unknown,
): TemplateResult {
  const titleId = `${state.idPrefix}-${part}`;
  return tpl`<section data-pr-part=${part} aria-labelledby=${titleId}>
    <h3 id=${titleId}>${t(state, titleKey)}</h3>
    ${body}
  </section>`;
}

interface RowParts {
  /** Markup as well as text: a usage-limit row tones its delta. */
  detail?: Content | string;
  badge?: TemplateResult;
  reason?: string;
  warning?: string;
}

function changeRow(name: string, parts: RowParts = {}): TemplateResult {
  const { detail, badge: tag, reason, warning } = parts;
  return tpl`<li data-pr-part="change-row">
    <span class="pr-cr-row__name">${name}</span>
    ${detail ? tpl`<span class="pr-cr-row__detail">${detail}</span>` : nothing}
    ${tag ?? nothing}
    ${reason ? tpl`<span class="pr-cr-row__reason">${reason}</span>` : nothing}
    ${warning ? tpl`<p class="pr-cr-warning" role="note">${warning}</p>` : nothing}
  </li>`;
}

function list(rows: TemplateResult[]): TemplateResult {
  return tpl`<ul>${rows}</ul>`;
}

function planName(plan: ComparedPlan): string {
  return plan.name ?? plan.id ?? dash;
}

function periodName(period?: NormalizedBillingPeriod): string {
  return period?.label ?? period?.id ?? dash;
}

function renderPlan(state: ReviewRenderState): TemplateResult {
  const { plan, relation, version } = state.comparison;
  let name = planName(plan.after);
  if (plan.changed) name = arrow(state, planName(plan.before), planName(plan.after));
  let banner: Content = nothing;
  if (version.changed) {
    const text = t(state, 'pricing.reviewVersionChange', {
      before: version.before ?? dash,
      after: version.after ?? dash,
    });
    banner = tpl`<p class="pr-cr-banner">${text}</p>`;
  }
  const relationBadge = state.hiddenSections?.has('relation')
    ? nothing
    : badge(t(state, relationKeys[relation]), relationTones[relation]);
  const body = tpl`<div data-pr-part="change-row">
      <span class="pr-cr-row__name">${name}</span>
      ${relationBadge}
    </div>
    ${banner}`;
  return reviewSection(state, 'review-plan', 'pricing.reviewPlan', body);
}

// formatCurrency throws for a locale that Intl rejects; a plain number is the fallback then.
function formatSubtotal(amount: number, currency: string, locale: string): string {
  try {
    return formatCurrency(amount, currency, intlLocale(locale));
  } catch {
    return formatNumber(amount, locale, { maximumFractionDigits: amount % 1 === 0 ? 0 : 2 });
  }
}

// A subtotal in its currency. A part that requires a quote is named, and a price that is only a
// quote reads "Contact sales".
function renderMoney(state: ReviewRenderState, price: PriceBreakdown): TemplateResult {
  const quote = price.requiresQuote;
  let amount = formatSubtotal(price.subtotal, price.currency, state.locale);
  if (quote && price.subtotal === 0) amount = t(state, 'pricing.contactSales');
  let partial: Content = nothing;
  if (quote && price.subtotal !== 0) {
    partial = tpl` <small>${t(state, 'pricing.requiresQuote')}</small>`;
  }
  // What an amount is per: the plan's own unit, the same text the plan card shows. A real
  // billing period is named too; the one invented for a pricing that declares none is not,
  // since "Base" tells the reader nothing the author ever chose.
  let period: Content = nothing;
  if (price.unit) {
    period = tpl` <small>${t(state, 'pricing.per', { unit: price.unit })}</small>`;
  } else if (price.billingPeriod && price.billingPeriod.synthesized !== true) {
    period = tpl` <small>${price.billingPeriod.label}</small>`;
  }
  return tpl`${amount}${partial}${period}`;
}

function renderDifference(state: ReviewRenderState): Content {
  const { price } = state.comparison;
  if (price.difference === undefined) return nothing;
  const signed = formatSignedCurrency(price.difference, price.after.currency, state.locale);
  // The reason the screen exists, so it is marked for the stylesheet and carries its direction.
  // "same" is a real outcome: a plan swap can leave the bill untouched.
  const direction = price.difference > 0 ? 'increase' : price.difference < 0 ? 'decrease' : 'same';
  return tpl`<div data-pr-part="price-difference" data-direction=${direction}>
    <dt>${t(state, 'pricing.reviewPriceDifference')}</dt>
    <dd>${signed}</dd>
  </div>`;
}

function renderPrice(state: ReviewRenderState): TemplateResult {
  const { price } = state.comparison;
  let omitted: Content = nothing;
  if (price.differenceOmitted) {
    const text = t(state, differenceKeys[price.differenceOmitted]);
    omitted = tpl`<p class="pr-cr-note">${text}</p>`;
  }
  let billing: Content = nothing;
  if (price.billingPeriodChanged) {
    const text = t(state, 'pricing.reviewBillingChange', {
      before: periodName(price.before.billingPeriod),
      after: periodName(price.after.billingPeriod),
    });
    billing = tpl`<p class="pr-cr-note">${text}</p>`;
  }
  const body = tpl`<dl class="pr-cr-price">
      <div>
        <dt>${t(state, 'pricing.reviewPriceBefore')}</dt>
        <dd>${renderMoney(state, price.before)}</dd>
      </div>
      <div>
        <dt>${t(state, 'pricing.reviewPriceAfter')}</dt>
        <dd>${renderMoney(state, price.after)}</dd>
      </div>
      ${renderDifference(state)}
    </dl>
    ${omitted}
    ${billing}`;
  return reviewSection(state, 'review-price', 'pricing.reviewPrice', body);
}

function addOnRow(
  state: ReviewRenderState,
  item: AddOnChange,
  labelKey: string,
  tone: Tone,
  reason?: string,
): TemplateResult {
  const detail = item.quantity > 1 ? `× ${formatNumber(item.quantity, state.locale)}` : undefined;
  return changeRow(item.name, { detail, badge: badge(t(state, labelKey), tone), reason });
}

function removalReason(state: ReviewRenderState, item: AddOnRemoval): string {
  const plan = planName(state.comparison.plan.after);
  return t(state, removalKeys[item.reason], { plan });
}

function renderAddOns(state: ReviewRenderState): Content {
  const { addOns } = state.comparison;
  const added = 'pricing.reviewAddOnAdded';
  const removed = 'pricing.reviewAddOnRemoved';
  const rows: TemplateResult[] = [];
  for (const item of addOns.added) rows.push(addOnRow(state, item, added, 'success'));
  for (const item of addOns.removedByUser) rows.push(addOnRow(state, item, removed, 'warning'));
  for (const item of addOns.removedByReconciliation) {
    rows.push(addOnRow(state, item, removed, 'warning', removalReason(state, item)));
  }
  for (const item of addOns.quantityChanged) {
    const before = formatNumber(item.before, state.locale);
    const after = formatNumber(item.after, state.locale);
    const detail = t(state, 'pricing.reviewQuantityChange', { before, after });
    rows.push(changeRow(item.name, { detail }));
  }
  if (rows.length === 0) return nothing;
  return reviewSection(state, 'review-add-ons', 'pricing.reviewAddOns', list(rows));
}

function renderFeatures(state: ReviewRenderState): Content {
  const { features } = state.comparison;
  const format = (value: ComparedValue): string =>
    formatComparedValue(value, state.messages, state.locale);
  const gained = badge(t(state, 'pricing.reviewFeatureGained'), 'success');
  const lost = badge(t(state, 'pricing.reviewFeatureLost'), 'warning');
  const changed = badge(t(state, 'pricing.reviewFeatureChanged'), 'accent');
  const rows: TemplateResult[] = [];
  for (const item of features.gained) rows.push(changeRow(item.name, { badge: gained }));
  for (const item of features.lost) rows.push(changeRow(item.name, { badge: lost }));
  for (const item of features.changed) {
    const detail = arrow(state, format(item.before), format(item.after));
    rows.push(changeRow(item.name, { detail, badge: changed }));
  }
  if (rows.length === 0) return nothing;
  return reviewSection(state, 'review-features', 'pricing.reviewFeatures', list(rows));
}

function renderLimits(state: ReviewRenderState): Content {
  const rows: TemplateResult[] = [];
  for (const item of state.comparison.usageLimits.changed) {
    const format = (value: ComparedValue): string =>
      formatComparedValue(value, state.messages, state.locale, item.unit);
    const moved = arrow(state, format(item.before), format(item.after));
    // The delta is the part a reader scans for, and its sign is the whole message: more of a
    // limit is a gain, less of one is what they are giving up. It carries its direction so the
    // stylesheet can tone it without the reader parsing a minus sign.
    let detail: Content | string = moved;
    if (item.delta !== undefined) {
      const sign = formatNumber(item.delta, state.locale, { signDisplay: 'exceptZero' });
      const unit = item.unit
        ? ` ${formatUnit(item.unit, Math.abs(item.delta), intlLocale(state.locale))}`
        : '';
      const direction = item.delta > 0 ? 'increase' : item.delta < 0 ? 'decrease' : 'same';
      detail = tpl`${moved} <span class="pr-cr-row__delta" data-direction=${direction}
        >(${sign}${unit})</span
      >`;
    }
    let warning: string | undefined;
    if (item.exceedsCurrentUsage && item.currentUsage !== undefined) {
      const usage = format({ kind: 'number', value: item.currentUsage });
      warning = t(state, 'pricing.reviewLimitExceeded', { usage });
    }
    rows.push(changeRow(item.name, { detail, warning }));
  }
  if (rows.length === 0) return nothing;
  return reviewSection(state, 'review-limits', 'pricing.reviewLimits', list(rows));
}

function renderUnchanged(state: ReviewRenderState): Content {
  const { addOns, features, usageLimits } = state.comparison;
  const counts = [addOns.unchanged, features.unchanged, usageLimits.unchanged];
  if (counts.every((ids) => ids.length === 0)) return nothing;
  // Add-ons are left out of this line: what a reader checks here is whether the entitlements
  // they rely on survive the change, and an add-on they did not touch is not news. The section
  // still appears when only add-ons are unchanged, because something did stay the same.
  const [, featureCount = 0, limitCount = 0] = counts.map((ids) => ids.length);
  const summary = t(state, 'pricing.reviewUnchangedSummary', {
    features: formatNumber(featureCount, state.locale),
    limits: formatNumber(limitCount, state.locale),
  });
  const body = tpl`<p>${summary}</p>`;
  return reviewSection(state, 'review-unchanged', 'pricing.reviewUnchanged', body);
}

function renderNotices(state: ReviewRenderState): Content {
  if (state.notices.length === 0) return nothing;
  const items = state.notices.map((notice) => tpl`<li class="pr-cr-notice">${notice}</li>`);
  return reviewSection(state, 'review-notices', 'pricing.reviewNotices', list(items));
}

function renderError(state: ReviewRenderState): Content {
  if (state.error === undefined) return nothing;
  return tpl`<div class="pr-cr-error" data-pr-part="review-error" role="alert">
    <strong>${t(state, 'pricing.reviewErrorTitle')}</strong>
    ${state.error}
  </div>`;
}

function renderActions(state: ReviewRenderState): Content {
  if (state.hiddenSections?.has('actions')) return nothing;
  const status = state.pending ? t(state, 'pricing.reviewPending') : nothing;
  const confirm = state.confirmLabel || t(state, 'pricing.reviewConfirm');
  return tpl`<div data-pr-part="change-actions">
    <p class="pr-cr-status" data-pr-part="review-status" role="status">${status}</p>
    <button
      class="pr-button pr-button--secondary"
      data-pr-part="review-back"
      type="button"
      @click=${state.onBack}
    >${t(state, 'pricing.reviewBack')}</button>
    <button
      class="pr-button pr-button--primary"
      data-pr-part="review-confirm"
      type="button"
      aria-disabled=${state.blocked ? 'true' : nothing}
      aria-busy=${state.pending ? 'true' : nothing}
      @click=${state.onConfirm}
    >${confirm}</button>
  </div>`;
}

// The sections in the order of design.md, each only when it has content. Nothing changes: a note.
function renderBody(state: ReviewRenderState): unknown {
  if (state.comparison.relation === 'current') {
    const note = t(state, 'pricing.reviewNoChanges');
    return tpl`<p class="pr-cr-notice" data-pr-part="review-no-changes">${note}</p>`;
  }
  return [
    renderPlan(state),
    renderPrice(state),
    renderAddOns(state),
    renderFeatures(state),
    renderLimits(state),
    renderUnchanged(state),
  ];
}

// The root with its title, the body, the notices of the host, the alert region and the actions
// with the status region.
export function renderChangeReview(state: ReviewRenderState): TemplateResult {
  const titleId = `${state.idPrefix}-title`;
  const title = t(state, 'pricing.reviewTitle');
  // A host that hides the title labels the region with its own heading, so the reference goes with
  // it: aria-labelledby pointing at an absent id leaves the section claiming a name it has not.
  const untitled = state.hiddenSections?.has('title') === true;
  const header = untitled
    ? nothing
    : tpl`<header class="pr-cr-header">
      <h2 id=${titleId} data-pr-part="review-title" tabindex="-1">${title}</h2>
    </header>`;
  return tpl`<section
    data-pr-part="change-review"
    aria-labelledby=${untitled ? nothing : titleId}
  >
    ${header}
    ${renderBody(state)}
    ${renderNotices(state)}
    ${renderError(state)}
    ${renderActions(state)}
  </section>`;
}
