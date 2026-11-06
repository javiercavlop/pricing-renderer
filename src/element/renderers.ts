import { html, nothing, type TemplateResult } from 'lit';
import { keyed as keyedBy } from 'lit/directives/keyed.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  deepEqual,
  formatCurrency,
  formatDate,
  getAtPath,
  getPlanHighlightSummary,
  humanizeIdentifier,
  isSafeLink,
  normalizeAddOnQuantity,
  translate,
  unwrapValue,
  type NormalizedAddOn,
  type NormalizedPlan,
  type PriceBreakdownLine,
  type PricingComparisonGroup,
  type PricingComparisonRow,
  type PricingDiagnostic,
  type PricingSelection,
  type PricingViewModel,
  type ResolvedPrice,
  type SelectionRelation,
  type VariableControl,
} from '../core/index.js';
import { maxQuantityOnGrid } from '../core/resolve.js';
import { addOnProvidesForPlan, isAddOnOnlyRow } from '../core/view-model.js';
import { formatUnit } from '../core/units.js';
import { isPendingActionId, planCtaView, type SummaryActionState } from './cta.js';
import type { PendingAddOnChange, PricingSlotName } from './events.js';

/** Set on a `pricing-action` detail only while the current plan is known. */
export interface ActionOrigin {
  relation: SelectionRelation;
  source: 'plan' | 'summary';
}

export interface RenderActions {
  selectPlan(planId: string): void;
  selectBilling(periodId: string): void;
  updateVariable(path: string, value: unknown): void;
  resetVariables(): void;
  toggleAddOn(addOnId: string, selected: boolean): void;
  updateAddOnQuantity(addOnId: string, quantity: number): void;
  triggerAction(
    actionId: string,
    planId?: string,
    href?: string,
    metadata?: Record<string, unknown>,
    origin?: ActionOrigin,
  ): boolean;
  updateSearch(value: string): void;
  updateOnlyDifferences(value: boolean): void;
  toggleGroup(groupId: string): void;
  setAllGroups(expanded: boolean): void;
  revealGroup(groupId: string, origin?: HTMLElement, byKeyboard?: boolean): void;
  confirmAddOnChange(): void;
  cancelAddOnChange(): void;
  toggleBreakdown(): void;
  updateAddOnSearch?(value: string): void;
  revealAddOns?(byKeyboard?: boolean): void;
}

// the sections a host can hide
export const PRICING_SECTION_NAMES = [
  'hero',
  'metadata',
  'billing',
  'variables',
  'plans',
  'comparison',
  'addOns',
  'summary',
  // Pieces of the hero, for a page that already has its own title or lead paragraph.
  'saasName',
  'description',
  'tags',
] as const;
export type PricingSectionName = (typeof PRICING_SECTION_NAMES)[number];

// the slots a host can request
export const PRICING_SLOT_NAMES = ['plan-cta', 'summary-actions', 'loading', 'error'] as const;

export interface RenderState {
  viewModel: PricingViewModel;
  /** Sections the host hides; absent means none. */
  hiddenSections?: ReadonlySet<PricingSectionName>;
  /** Slots the host requests; absent means none. */
  slots?: ReadonlySet<PricingSlotName>;
  selection: PricingSelection;
  compact: boolean;
  search: string;
  onlyDifferences: boolean;
  toolbarThreshold?: number;
  selectionEnabled: boolean;
  ctaEnabled: boolean;
  variablesEnabled: boolean;
  expandedGroups: ReadonlySet<string>;
  revealedGroups: ReadonlySet<string>;
  addOnSearch?: string;
  addOnsRevealed?: boolean;
  addOnFilterThreshold?: number;
  pendingAddOnChange?: PendingAddOnChange;
  breakdownOpen: boolean;
  breakdownId: string;
  /** Prefix of every id the renderers write, `pr-<n>` per element instance; absent means `pr`. */
  idPrefix?: string;
  /** The current plan id, only when the loaded pricing defines it. */
  currentPlanId?: string;
  /** Add-ons of the reconciled current side; empty without a known current plan. */
  currentAddOnIds?: ReadonlySet<string>;
  pendingActionId?: string;
  summaryAction?: SummaryActionState;
  actions: RenderActions;
}

// ids are global in the light DOM, so every id carries the
// instance prefix. The data part (a path, a group or add-on id) keeps [A-Za-z0-9]; every other
// code point becomes _<lowercase hex>_, so distinct data never yields the same id.
export function instanceId(
  state: Pick<RenderState, 'idPrefix'>,
  name: string,
  data?: string,
): string {
  const base = `${state.idPrefix ?? 'pr'}-${name}`;
  if (data === undefined) return base;
  const escaped = data.replace(
    /[^A-Za-z0-9]/gu,
    (char) => `_${char.codePointAt(0)?.toString(16)}_`,
  );
  return `${base}-${escaped}`;
}

export const DEFAULT_TOOLBAR_THRESHOLD = 40;
export const AUTO_DIFFERENCES_MIN_ROWS = 100;
export const ADDON_DENSE_THRESHOLD = 8;
export const ADDON_VISIBLE_CAP = 8;
export const DEFAULT_ADDON_FILTER_THRESHOLD = 13;

export function comparisonRowTotal(viewModel: PricingViewModel): number {
  return viewModel.comparisonGroups.reduce((total, group) => total + group.rows.length, 0);
}

// a missing, non-finite or negative value gives 40
export function toolbarThresholdOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_TOOLBAR_THRESHOLD;
}

// a missing, non-finite or negative value gives 13
export function addOnFilterThresholdOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_ADDON_FILTER_THRESHOLD;
}

// An explicit initial state wins. Otherwise a long comparison with several plans starts with only
// the differences, as long as the toolbar is there to switch the filter off.
export function resolveOnlyDifferences(
  viewModel: PricingViewModel,
  initial: boolean | undefined,
  toolbarThreshold: number = DEFAULT_TOOLBAR_THRESHOLD,
): boolean {
  if (initial !== undefined) return initial;
  const total = comparisonRowTotal(viewModel);
  return (
    total > AUTO_DIFFERENCES_MIN_ROWS &&
    viewModel.plans.length >= 2 &&
    total > toolbarThresholdOf(toolbarThreshold)
  );
}

function t(
  viewModel: PricingViewModel,
  key: string,
  parameters?: Record<string, string | number>,
): string {
  return translate(viewModel.messages, key, parameters);
}

function addOnNames(viewModel: PricingViewModel, ids: readonly string[]): string {
  return ids
    .map((id) => viewModel.addOns.find((addOn) => addOn.id === id)?.name ?? humanizeIdentifier(id))
    .join(', ');
}

const interactiveCardContent =
  'a, button, input, select, textarea, label, summary, details, [contenteditable="true"]';

function selectFromCard(event: MouseEvent, select: () => void): void {
  if (event.defaultPrevented || event.button !== 0) return;
  const target = event.target;
  if (target instanceof Element && target.closest(interactiveCardContent)) return;
  select();
}

function renderPrice(
  viewModel: PricingViewModel,
  price: ResolvedPrice | undefined,
  unit?: string,
): TemplateResult {
  if (!price || price.kind === 'error') {
    return html`<span class="pr-price__quote">${t(viewModel, 'pricing.requiresQuote')}</span>`;
  }
  if (price.kind === 'label') {
    return html`<span class="pr-price__quote">${price.label}</span>`;
  }
  return html`
    <span class="pr-price__amount"
      >${formatCurrency(price.amount, viewModel.pricing.metadata.currency, viewModel.locale)}</span
    >
    ${
      unit
        ? html`<span class="pr-price__unit">${t(viewModel, 'pricing.per', { unit })}</span>`
        : nothing
    }
  `;
}

function renderValue(
  viewModel: PricingViewModel,
  value: unknown,
  unit?: string,
  addOnOnly = false,
): TemplateResult {
  if (value === true) {
    return html`<span class="pr-value pr-value--included"
      ><span aria-hidden="true">✓</span
      ><span class="pr-sr-only">${t(viewModel, 'pricing.included')}</span></span
    >`;
  }
  if (value === false || value === null || value === undefined) {
    if (addOnOnly) {
      return html`<span class="pr-value pr-value--addon"
        ><span aria-hidden="true">${t(viewModel, 'pricing.addOnOnly')}</span
        ><span class="pr-sr-only">${t(viewModel, 'pricing.addOnOnlySr')}</span></span
      >`;
    }
    return html`<span class="pr-value pr-value--excluded"
      ><span aria-hidden="true">—</span
      ><span class="pr-sr-only">${t(viewModel, 'pricing.notIncluded')}</span></span
    >`;
  }
  if (
    value === Number.POSITIVE_INFINITY ||
    value === '.inf' ||
    value === 'Infinity' ||
    value === 'unlimited'
  ) {
    return html`<span class="pr-value">${t(viewModel, 'pricing.unlimited')}</span>`;
  }
  if (typeof value === 'number') {
    const formatted = new Intl.NumberFormat(viewModel.locale).format(value);
    const label = unit
      ? ` ${formatUnit(unit, value, viewModel.locale, viewModel.presentation.unitLabels)}`
      : '';
    return html`<span class="pr-value">${formatted}${label}</span>`;
  }
  if (Array.isArray(value)) {
    return html`<span class="pr-value">${value.map(String).join(', ')}</span>`;
  }
  if (typeof value === 'object') {
    return html`<code class="pr-value pr-value--code">${JSON.stringify(value)}</code>`;
  }
  return html`<span class="pr-value">${String(value)}</span>`;
}

function resolvedValuesDiffer(row: PricingComparisonRow): boolean {
  const values = row.values.map((cell) => cell.value);
  return values.some((value) => !deepEqual(value, values[0]));
}

// A description that is empty or only repeats the row name adds nothing, so it is not rendered.
function rowDescription(row: PricingComparisonRow): string | undefined {
  const description = row.description?.trim();
  if (!description) return undefined;
  return description.toLowerCase() === row.name.trim().toLowerCase() ? undefined : row.description;
}

function renderRowMetadata(
  viewModel: PricingViewModel,
  row: PricingComparisonRow,
): TemplateResult | typeof nothing {
  if (viewModel.mode !== 'catalog') return nothing;
  const metadata = [
    row.kind === 'feature'
      ? t(viewModel, 'pricing.featureEffect')
      : t(viewModel, 'pricing.limitEffect'),
    typeof row.raw.type === 'string' ? row.raw.type : undefined,
    typeof row.raw.valueType === 'string' ? row.raw.valueType : undefined,
    typeof row.raw.period === 'string' ? row.raw.period : undefined,
    row.raw.trackable === true ? t(viewModel, 'pricing.trackable') : undefined,
  ].filter((item): item is string => Boolean(item));
  return metadata.length
    ? html`<span class="pr-row-metadata">${metadata.join(' · ')}</span>`
    : nothing;
}

// also the text of the title that stays when the hero is hidden
export function heroTitle(viewModel: PricingViewModel): string {
  return (
    viewModel.presentation.title ??
    viewModel.pricing.metadata.saasName ??
    t(viewModel, 'pricing.title')
  );
}

export function renderHeader(state: RenderState): TemplateResult {
  const { viewModel } = state;
  const hidden = state.hiddenSections;
  const title = heroTitle(viewModel);
  const subtitle = viewModel.presentation.subtitle ?? t(viewModel, 'pricing.description');
  // The title carries the id that labels the shell, so hiding the name keeps it for screen
  // readers instead of dropping the element.
  const titleHidden = hidden?.has('saasName') === true;
  return html`
    <header class="pr-hero" data-pr-part="hero">
      ${titleHidden ? nothing : html`<div class="pr-hero__eyebrow">${t(viewModel, 'pricing.title')}</div>`}
      <h2 class=${titleHidden ? 'pr-sr-only' : 'pr-hero__title'} id=${instanceId(state, 'title')}>
        ${title}
      </h2>
      ${
        subtitle && hidden?.has('description') !== true
          ? html`<p class="pr-hero__subtitle">${subtitle}</p>`
          : nothing
      }
      ${
        viewModel.pricing.metadata.tags.length && hidden?.has('tags') !== true
          ? html`<ul class="pr-tag-list" aria-label="${t(viewModel, 'pricing.tags')}">
              ${viewModel.pricing.metadata.tags.map((tag) => html`<li class="pr-tag">${tag}</li>`)}
            </ul>`
          : nothing
      }
    </header>
  `;
}

export function renderBilling(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel, selection, actions } = state;
  if (viewModel.pricing.billing.length <= 1) return nothing;
  return html`
    <fieldset class="pr-billing" data-pr-part="billing">
      <legend>${t(viewModel, 'pricing.billing')}</legend>
      <div class="pr-segmented">
        ${viewModel.pricing.billing.map((period) => {
          const label = viewModel.presentation.billingLabels?.[period.id] ?? period.label;
          const discount = Math.max(0, Math.round((1 - period.multiplier) * 100));
          return html`
            <label class="pr-segmented__option">
              <input
                type="radio"
                name=${instanceId(state, 'billing')}
                value=${period.id}
                .checked=${selection.billingPeriod === period.id}
                @change=${() => actions.selectBilling(period.id)}
              />
              <span>${label}</span>
              ${
                discount > 0
                  ? html`<small>${t(viewModel, 'pricing.discount', { percent: discount })}</small>`
                  : nothing
              }
            </label>
          `;
        })}
      </div>
    </fieldset>
  `;
}

// the pending text replaces the label of the busy control
function renderCtaLabel(
  viewModel: PricingViewModel,
  label: string,
  pending: boolean,
): TemplateResult | string {
  return pending
    ? html`<span data-pr-part="cta-pending">${t(viewModel, 'pricing.pending')}</span>`
    : label;
}

// aria-disabled replaces disabled while an action is pending, so
// the control that became pending keeps the focus
function renderPlanCta(state: RenderState, plan: NormalizedPlan): TemplateResult {
  const { viewModel, actions } = state;
  const cta = planCtaView(viewModel, plan, {
    currentPlanId: state.currentPlanId,
    pendingActionId: state.pendingActionId,
  });
  // data-kind agrees with the pr-button--<kind> class
  const kind = cta.kind === 'secondary' ? 'secondary' : 'primary';
  const origin: ActionOrigin | undefined = cta.relation
    ? { relation: cta.relation, source: 'plan' }
    : undefined;
  const content = renderCtaLabel(viewModel, cta.label, cta.pending);
  const trigger = (): boolean =>
    actions.triggerAction(cta.actionId, plan.id, cta.eventHref, cta.metadata, origin);
  return cta.href
    ? html`<a
        class="pr-button pr-button--${kind}"
        data-pr-part="cta"
        data-kind=${kind}
        data-relation=${cta.relation ?? nothing}
        data-pending=${cta.pending ? 'true' : nothing}
        aria-busy=${cta.pending ? 'true' : nothing}
        aria-disabled=${cta.ariaDisabled ? 'true' : nothing}
        href=${cta.href}
        target=${cta.target ?? '_self'}
        rel=${cta.target === '_blank' ? 'noopener noreferrer' : nothing}
        @click=${(event: MouseEvent) => {
          if (!trigger()) event.preventDefault();
        }}
        >${content}</a
      >`
    : html`<button
        class="pr-button pr-button--${kind}"
        data-pr-part="cta"
        data-kind=${kind}
        data-relation=${cta.relation ?? nothing}
        data-pending=${cta.pending ? 'true' : nothing}
        aria-busy=${cta.pending ? 'true' : nothing}
        aria-disabled=${cta.ariaDisabled ? 'true' : nothing}
        type="button"
        ?disabled=${cta.disabled}
        @click=${trigger}
      >
        ${content}
      </button>`;
}

// An empty node the host fills; it carries the state of the built-in CTA and card as data-*. The
// keyed directive gives each plan its own node, so a node never moves to another plan.
function renderPlanCtaSlot(
  state: RenderState,
  plan: NormalizedPlan,
  selected: boolean,
  current: boolean,
): ReturnType<typeof keyedBy> {
  const cta = planCtaView(state.viewModel, plan, {
    currentPlanId: state.currentPlanId,
    pendingActionId: state.pendingActionId,
  });
  return keyedBy(
    plan.id,
    html`<div
      data-pr-slot="plan-cta"
      data-pr-part="plan-cta-slot"
      data-plan-id=${plan.id}
      data-plan-name=${plan.name}
      data-label=${cta.label}
      data-href=${cta.href ?? nothing}
      data-relation=${cta.relation ?? nothing}
      data-selected=${String(selected)}
      data-current=${current ? 'true' : nothing}
      data-pending=${cta.pending ? 'true' : nothing}
      data-any-pending=${cta.ariaDisabled ? 'true' : nothing}
    ></div>`,
  );
}

export function renderPlans(state: RenderState): TemplateResult {
  const { viewModel, selection, selectionEnabled, ctaEnabled, actions } = state;
  const titleId = instanceId(state, 'plans-title');
  return html`
    <section class="pr-section" aria-labelledby=${titleId} data-pr-part="plans">
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.plans')}</p>
          <h3 id=${titleId}>${t(viewModel, 'pricing.plansTitle')}</h3>
        </div>
      </div>
      ${
        viewModel.plans.length === 0
          ? html`<p class="pr-empty">${t(viewModel, 'pricing.noPlans')}</p>`
          : html`<div
              class="pr-plan-grid"
              role=${selectionEnabled ? 'radiogroup' : nothing}
              aria-labelledby=${selectionEnabled ? titleId : nothing}
            >
              ${viewModel.plans.map((plan) => {
                const selected = selection.planId === plan.id;
                const current = state.currentPlanId === plan.id;
                const highlightSummary = getPlanHighlightSummary(viewModel, plan.id);
                const featured = highlightSummary.badges.some((badge) => badge.emphasize);
                return html`
                  <article
                    class="pr-plan-card ${selectionEnabled ? 'pr-selectable-card' : ''} ${
                      selected ? 'is-selected' : ''
                    } ${featured ? 'is-featured' : ''}"
                    data-pr-part="plan-card"
                    data-plan-id=${plan.id}
                    data-selected=${String(selected)}
                    data-current=${current ? 'true' : nothing}
                    data-featured=${String(featured)}
                    @click=${(event: MouseEvent) =>
                      selectionEnabled
                        ? selectFromCard(event, () => actions.selectPlan(plan.id))
                        : undefined}
                  >
                    <div class="pr-plan-card__top">
                      ${
                        highlightSummary.badges.length > 0 || selectionEnabled || current
                          ? html`<div class="pr-plan-card__status">
                              <div class="pr-plan-card__badges">
                                ${
                                  current
                                    ? html`<span
                                        class="pr-badge"
                                        data-pr-part="current-badge"
                                        data-tone="success"
                                        >${t(viewModel, 'pricing.currentPlanBadge')}</span
                                      >`
                                    : nothing
                                }
                                ${highlightSummary.badges.map(
                                  (badge) =>
                                    html`<span
                                      class="pr-badge"
                                      data-pr-part="plan-badge"
                                      data-badge-id=${badge.id}
                                      data-tone=${badge.tone ?? 'neutral'}
                                      >${badge.label}</span
                                    >`,
                                )}
                              </div>
                              ${
                                // live() resets the radio on cancel
                                selectionEnabled
                                  ? html`<label
                                      class="pr-selection-control pr-plan-card__selector"
                                      data-pr-part="selection-control"
                                    >
                                      <input
                                        type="radio"
                                        name=${instanceId(state, 'plan')}
                                        value=${plan.id}
                                        aria-label=${t(viewModel, 'pricing.choosePlan', {
                                          plan: plan.name,
                                        })}
                                        .checked=${live(selected)}
                                        @change=${() => actions.selectPlan(plan.id)}
                                      />
                                      <span
                                        class="pr-selection-control__icon"
                                        aria-hidden="true"
                                      ></span>
                                      <span class="pr-selection-control__label" aria-hidden="true"
                                        >${
                                          selected
                                            ? // On the contract's own plan the "your plan" badge
                                              // already says it, and the radio is visibly checked:
                                              // a third "Selected" adds nothing. It comes back as
                                              // soon as the visitor selects a different plan.
                                              current
                                              ? nothing
                                              : t(viewModel, 'pricing.selected')
                                            : t(viewModel, 'pricing.select')
                                        }</span
                                      >
                                    </label>`
                                  : nothing
                              }
                            </div>`
                          : nothing
                      }
                      <h4>${plan.name}</h4>
                      ${plan.description ? html`<p>${plan.description}</p>` : nothing}
                    </div>
                    <div class="pr-price" data-pr-part="price">
                      ${renderPrice(viewModel, viewModel.resolved.planPrices[plan.id], plan.unit)}
                    </div>
                    ${
                      highlightSummary.inheritedFrom
                        ? html`<p class="pr-plan-inheritance" data-pr-part="plan-inheritance">
                            ${highlightSummary.inheritedFrom.label}
                          </p>`
                        : nothing
                    }
                    ${
                      highlightSummary.rows.length
                        ? html`<ul class="pr-highlight-list">
                            ${highlightSummary.rows.map((row) => {
                              const value = row.values.find(
                                (cell) => cell.planId === plan.id,
                              )?.value;
                              return html`<li
                                data-pr-part="plan-highlight"
                                data-highlight-id=${row.id}
                                data-highlight-kind=${row.kind}
                              >
                                <span class="pr-highlight-list__icon" aria-hidden="true">✓</span>
                                <span>${row.name}</span>
                                <span class="pr-highlight-list__value"
                                  >${
                                    // The bullet already means "included", so a plain true adds
                                    // no visible information; only its screen-reader text stays.
                                    value === true
                                      ? html`<span class="pr-sr-only"
                                          >${t(viewModel, 'pricing.included')}</span
                                        >`
                                      : renderValue(viewModel, value, row.unit)
                                  }</span
                                >
                              </li>`;
                            })}
                          </ul>`
                        : nothing
                    }
                    ${
                      !ctaEnabled
                        ? nothing
                        : state.slots?.has('plan-cta')
                          ? renderPlanCtaSlot(state, plan, selected, current)
                          : renderPlanCta(state, plan)
                    }
                  </article>
                `;
              })}
            </div>`
      }
    </section>
  `;
}

function controlInput(
  state: RenderState,
  control: VariableControl,
  invalid: boolean,
): TemplateResult {
  const { selection, actions } = state;
  const value = getAtPath(selection.variables, control.path);
  const id = instanceId(state, 'variable', control.path);
  const describedBy =
    [control.description ? `${id}-help` : '', invalid ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || nothing;
  if (control.type === 'boolean') {
    return html`<label class="pr-switch" for=${id}>
      <input
        id="${id}"
        type="checkbox"
        aria-describedby="${describedBy}"
        aria-invalid=${invalid}
        .checked=${Boolean(value)}
        @change=${(event: Event) =>
          actions.updateVariable(control.path, (event.currentTarget as HTMLInputElement).checked)}
      />
      <span class="pr-switch__track" aria-hidden="true"></span>
    </label>`;
  }
  if (control.type === 'select') {
    return html`<select
      id="${id}"
      aria-describedby="${describedBy}"
      aria-invalid=${invalid}
      .value=${String(value ?? '')}
      @change=${(event: Event) => {
        const raw = (event.currentTarget as HTMLSelectElement).value;
        const option = control.options?.find((candidate) => String(candidate.value) === raw);
        actions.updateVariable(control.path, option?.value ?? raw);
      }}
    >
      ${(control.options ?? []).map(
        (option) =>
          html`<option value=${String(option.value)} .selected=${deepEqual(option.value, value)}>
            ${option.label}
          </option>`,
      )}
    </select>`;
  }
  if (control.type === 'slider') {
    const numericValue = typeof value === 'number' ? value : Number(value) || 0;
    return html`<div class="pr-slider">
      <input
        id="${id}"
        type="range"
        aria-describedby="${describedBy}"
        aria-invalid=${invalid}
        .value=${String(numericValue)}
        min=${control.min ?? 0}
        max=${control.max ?? 100}
        step=${control.step ?? 1}
        @input=${(event: Event) =>
          actions.updateVariable(
            control.path,
            Number((event.currentTarget as HTMLInputElement).value),
          )}
      />
      <input
        type="number"
        aria-describedby="${describedBy}"
        aria-invalid=${invalid}
        aria-label=${control.label ?? control.path}
        .value=${String(numericValue)}
        min=${control.min ?? nothing}
        max=${control.max ?? nothing}
        step=${control.step ?? 1}
        @change=${(event: Event) =>
          actions.updateVariable(
            control.path,
            Number((event.currentTarget as HTMLInputElement).value),
          )}
      />
    </div>`;
  }
  const isNumber = control.type === 'number';
  return html`<input
    id="${id}"
    aria-describedby="${describedBy}"
    aria-invalid=${invalid}
    type=${isNumber ? 'number' : 'text'}
    .value=${String(value ?? '')}
    min=${isNumber && control.min !== undefined ? control.min : nothing}
    max=${isNumber && control.max !== undefined ? control.max : nothing}
    step=${isNumber ? (control.step ?? 'any') : nothing}
    @input=${(event: Event) => {
      const raw = (event.currentTarget as HTMLInputElement).value;
      actions.updateVariable(control.path, isNumber ? Number(raw) : raw);
    }}
  />`;
}

export function renderVariables(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel, variablesEnabled, actions } = state;
  if (!variablesEnabled || viewModel.variableControls.length === 0) return nothing;
  const titleId = instanceId(state, 'variables-title');
  return html`
    <section class="pr-configurator" aria-labelledby=${titleId} data-pr-part="variables">
      <div class="pr-section__heading">
        <h3 id=${titleId}>${t(viewModel, 'pricing.variables')}</h3>
        <button class="pr-button pr-button--quiet" type="button" @click=${actions.resetVariables}>
          ${t(viewModel, 'pricing.reset')}
        </button>
      </div>
      <div class="pr-variable-grid">
        ${viewModel.variableControls.map((control) => {
          const id = instanceId(state, 'variable', control.path);
          const invalid = viewModel.resolved.diagnostics.some((item) => {
            const planMatch = item.path?.match(/^plans\.([^.]+)\.price$/)?.[1];
            const addOnMatch = item.path?.match(/^addOns\.([^.]+)\.price$/)?.[1];
            const price = planMatch
              ? viewModel.pricing.plans.find((plan) => plan.id === planMatch)?.price
              : addOnMatch
                ? viewModel.pricing.addOns.find((addOn) => addOn.id === addOnMatch)?.price
                : undefined;
            return price?.kind === 'expression' && price.dependencies.includes(control.path);
          });
          return html`
            <div class="pr-field ${invalid ? 'is-invalid' : ''}">
              <label for=${id}>${control.label ?? control.path}</label>
              ${control.description ? html`<p id="${id}-help">${control.description}</p>` : nothing}
              ${controlInput(state, control, invalid)}
              ${
                invalid
                  ? html`<p id="${id}-error" class="pr-field__error" role="alert">
                      ${t(viewModel, 'pricing.variableError')}
                    </p>`
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    </section>
  `;
}

function filterGroups(state: RenderState): PricingComparisonGroup[] {
  const query = state.search.trim().toLowerCase();
  return state.viewModel.comparisonGroups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => {
        const matchesQuery =
          !query ||
          row.name.toLowerCase().includes(query) ||
          row.description?.toLowerCase().includes(query);
        return matchesQuery && (!state.onlyDifferences || resolvedValuesDiffer(row));
      }),
    }))
    .filter((group) => group.rows.length > 0);
}

function visibleRows(state: RenderState, group: PricingComparisonGroup): PricingComparisonRow[] {
  return state.revealedGroups.has(group.id) ? group.rows : group.rows.slice(0, 30);
}

function isHeaderless(group: PricingComparisonGroup): boolean {
  return group.kind === 'untagged';
}

// a group with no header cannot be toggled
function isGroupExpanded(state: RenderState, group: PricingComparisonGroup): boolean {
  return isHeaderless(group) || state.expandedGroups.has(group.id) || Boolean(state.search);
}

// The rows that are on the page: those of expanded groups, after the cap per group.
function renderedRowCount(state: RenderState, groups: PricingComparisonGroup[]): number {
  return groups.reduce(
    (count, group) =>
      count + (isGroupExpanded(state, group) ? visibleRows(state, group).length : 0),
    0,
  );
}

function renderComparisonToolbar(
  state: RenderState,
  groups: PricingComparisonGroup[],
): TemplateResult | typeof nothing {
  const { viewModel, actions } = state;
  const total = comparisonRowTotal(viewModel);
  // a short comparison gets no toolbar and looks as before
  if (total <= toolbarThresholdOf(state.toolbarThreshold)) return nothing;
  const shown = renderedRowCount(state, groups);
  return html`
    <div class="pr-comparison-toolbar" data-pr-part="comparison-toolbar">
      <label class="pr-search">
        <span class="pr-sr-only">${t(viewModel, 'pricing.search')}</span>
        <input
          type="search"
          placeholder=${t(viewModel, 'pricing.search')}
          .value=${state.search}
          @input=${(event: Event) =>
            actions.updateSearch((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <label class="pr-check">
        <input
          type="checkbox"
          .checked=${state.onlyDifferences}
          @change=${(event: Event) =>
            actions.updateOnlyDifferences((event.currentTarget as HTMLInputElement).checked)}
        />
        <span>${t(viewModel, 'pricing.onlyDifferences')}</span>
      </label>
      ${
        viewModel.comparisonGroups.every(isHeaderless)
          ? nothing
          : html`<div class="pr-toolbar-actions">
              <button type="button" @click=${() => actions.setAllGroups(true)}>
                ${t(viewModel, 'pricing.expandAll')}
              </button>
              <button type="button" @click=${() => actions.setAllGroups(false)}>
                ${t(viewModel, 'pricing.collapseAll')}
              </button>
            </div>`
      }
      <span aria-live="polite">${t(viewModel, 'pricing.rowsShownOf', { shown, total })}</span>
    </div>
  `;
}

function renderCompactComparison(
  state: RenderState,
  groups: PricingComparisonGroup[],
): TemplateResult {
  const { viewModel, actions } = state;
  return html`<div class="pr-compact-comparison">
    ${groups.map((group) => {
      const expanded = isGroupExpanded(state, group);
      const rows = visibleRows(state, group);
      return html`
        <section class="pr-comparison-group">
          ${
            isHeaderless(group)
              ? nothing
              : html`<h4>
                  <button
                    type="button"
                    aria-expanded=${expanded}
                    aria-controls=${expanded ? instanceId(state, 'group', group.id) : nothing}
                    @click=${() => actions.toggleGroup(group.id)}
                  >
                    <span>${group.name}</span
                    ><span aria-hidden="true">${expanded ? '−' : '+'}</span>
                  </button>
                </h4>`
          }
          ${
            expanded
              ? html`<div id="${instanceId(state, 'group', group.id)}">
                  ${rows.map((row) => {
                    const addOnOnly = isAddOnOnlyRow(viewModel, row);
                    return html`
                      <article class="pr-feature-card" data-pr-part="comparison-row">
                        <div>
                          <h5>${row.name}</h5>
                          ${rowDescription(row) ? html`<p>${rowDescription(row)}</p>` : nothing}
                          ${renderRowMetadata(viewModel, row)}
                          ${
                            row.docUrl && isSafeLink(row.docUrl)
                              ? html`<a href=${row.docUrl} target="_blank" rel="noopener noreferrer"
                                  >${t(viewModel, 'pricing.documentation')}</a
                                >`
                              : nothing
                          }
                        </div>
                        <dl>
                          ${row.values.map((cell) => {
                            const plan = viewModel.plans.find(
                              (candidate) => candidate.id === cell.planId,
                            );
                            return html`<div>
                              <dt>${plan?.name ?? cell.planId}</dt>
                              <dd>
                                ${renderValue(
                                  viewModel,
                                  cell.value,
                                  row.unit,
                                  addOnOnly && addOnProvidesForPlan(viewModel, row, cell.planId),
                                )}
                              </dd>
                            </div>`;
                          })}
                        </dl>
                      </article>
                    `;
                  })}
                  ${
                    group.rows.length > rows.length
                      ? html`<button
                          class="pr-button pr-button--quiet"
                          type="button"
                          @click=${(event: MouseEvent) =>
                            actions.revealGroup(
                              group.id,
                              event.currentTarget as HTMLElement,
                              event.detail === 0,
                            )}
                        >
                          ${t(viewModel, 'pricing.showRemaining', {
                            count: group.rows.length - rows.length,
                          })}
                        </button>`
                      : nothing
                  }
                </div>`
              : nothing
          }
        </section>
      `;
    })}
  </div>`;
}

function renderTableComparison(
  state: RenderState,
  groups: PricingComparisonGroup[],
): TemplateResult {
  const { viewModel, actions } = state;
  return html`
    <div
      class="pr-table-scroll"
      tabindex="0"
      role="region"
      aria-label=${t(viewModel, 'pricing.comparison')}
    >
      <table class="pr-comparison-table" data-pr-part="comparison-table">
        <caption class="pr-sr-only">
          ${t(viewModel, 'pricing.comparison')}
        </caption>
        <thead>
          <tr>
            <th scope="col">${t(viewModel, 'pricing.features')}</th>
            ${viewModel.plans.map((plan) => html`<th scope="col">${plan.name}</th>`)}
          </tr>
        </thead>
        ${groups.map((group) => {
          const expanded = isGroupExpanded(state, group);
          const rows = visibleRows(state, group);
          return html`
            <tbody>
              ${
                isHeaderless(group)
                  ? nothing
                  : html`<tr class="pr-category-row">
                      <th colspan=${viewModel.plans.length + 1}>
                        <button
                          type="button"
                          aria-expanded=${expanded}
                          @click=${() => actions.toggleGroup(group.id)}
                        >
                          <span>${group.name}</span
                          ><span aria-hidden="true">${expanded ? '−' : '+'}</span>
                        </button>
                      </th>
                    </tr>`
              }
              ${
                expanded
                  ? rows.map((row) => {
                      const addOnOnly = isAddOnOnlyRow(viewModel, row);
                      return html`
                        <tr data-pr-part="comparison-row">
                          <th scope="row">
                            <span>${row.name}</span>
                            ${
                              rowDescription(row)
                                ? html`<small>${rowDescription(row)}</small>`
                                : nothing
                            }
                            ${renderRowMetadata(viewModel, row)}
                          </th>
                          ${row.values.map(
                            (cell) =>
                              html`<td>
                                ${renderValue(
                                  viewModel,
                                  cell.value,
                                  row.unit,
                                  addOnOnly && addOnProvidesForPlan(viewModel, row, cell.planId),
                                )}
                              </td>`,
                          )}
                        </tr>
                      `;
                    })
                  : nothing
              }
              ${
                expanded && group.rows.length > rows.length
                  ? html`<tr>
                      <td colspan=${viewModel.plans.length + 1}>
                        <button
                          class="pr-button pr-button--quiet"
                          type="button"
                          @click=${(event: MouseEvent) =>
                            actions.revealGroup(
                              group.id,
                              event.currentTarget as HTMLElement,
                              event.detail === 0,
                            )}
                        >
                          ${t(viewModel, 'pricing.showRemaining', {
                            count: group.rows.length - rows.length,
                          })}
                        </button>
                      </td>
                    </tr>`
                  : nothing
              }
            </tbody>
          `;
        })}
      </table>
    </div>
  `;
}

export function renderComparison(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel } = state;
  const groups = filterGroups(state);
  if (viewModel.comparisonGroups.length === 0) return nothing;
  const titleId = instanceId(state, 'comparison-title');
  return html`
    <section class="pr-section pr-comparison" aria-labelledby=${titleId} data-pr-part="comparison">
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.details')}</p>
          <h3 id=${titleId}>${t(viewModel, 'pricing.comparison')}</h3>
        </div>
      </div>
      ${
        viewModel.plans.length === 0
          ? html`<p class="pr-empty">${t(viewModel, 'pricing.noComparison')}</p>`
          : html`${renderComparisonToolbar(state, groups)}
            ${
              groups.length === 0
                ? html`<p class="pr-empty" role="status" data-pr-part="comparison-empty">
                    ${t(viewModel, 'pricing.noMatches')}
                  </p>`
                : state.compact
                  ? renderCompactComparison(state, groups)
                  : renderTableComparison(state, groups)
            }`
      }
    </section>
  `;
}

function addOnAvailability(addOn: NormalizedAddOn, planId: string | undefined): boolean {
  return (
    addOn.availableFor.length === 0 || (planId !== undefined && addOn.availableFor.includes(planId))
  );
}

function hasAddOnNotes(addOn: NormalizedAddOn): boolean {
  return (
    addOn.availableFor.length > 0 ||
    addOn.dependsOn.length > 0 ||
    addOn.excludes.length > 0 ||
    addOn.subscriptionConstraints !== undefined
  );
}

// The availability, dependency, exclusion and quantity paragraphs of an add-on card.
function renderAddOnNotes(viewModel: PricingViewModel, addOn: NormalizedAddOn): TemplateResult {
  const constraints = addOn.subscriptionConstraints;
  return html`
    ${
      addOn.availableFor.length
        ? html`<p>
            ${t(viewModel, 'pricing.availableFor', {
              plans: addOn.availableFor
                .map((id) => viewModel.pricing.plans.find((plan) => plan.id === id)?.name ?? id)
                .join(', '),
            })}
          </p>`
        : nothing
    }
    ${
      addOn.dependsOn.length
        ? html`<p>
            ${t(viewModel, 'pricing.dependsOn', {
              items: addOnNames(viewModel, addOn.dependsOn),
            })}
          </p>`
        : nothing
    }
    ${
      addOn.excludes.length
        ? html`<p>
            ${t(viewModel, 'pricing.excludes', {
              items: addOnNames(viewModel, addOn.excludes),
            })}
          </p>`
        : nothing
    }
    ${
      constraints
        ? html`<p>
            ${t(viewModel, 'pricing.quantityConstraints', {
              min: constraints.minQuantity,
              max: constraints.maxQuantity ?? t(viewModel, 'pricing.unbounded'),
              step: constraints.quantityStep,
            })}
          </p>`
        : nothing
    }
  `;
}

function renderAddOnEffects(
  viewModel: PricingViewModel,
  addOn: NormalizedAddOn,
  dense = false,
): TemplateResult | typeof nothing {
  const effects = [
    ...Object.entries(addOn.features).map(([id, value]) => ({
      kind: t(viewModel, 'pricing.featureEffect'),
      id,
      value: unwrapValue(value),
    })),
    ...Object.entries(addOn.usageLimits).map(([id, value]) => ({
      kind: t(viewModel, 'pricing.limitEffect'),
      id,
      value: unwrapValue(value),
    })),
    ...Object.entries(addOn.usageLimitsExtensions).map(([id, value]) => ({
      kind: t(viewModel, 'pricing.limitExtension'),
      id,
      value: unwrapValue(value),
    })),
  ];
  if (dense) {
    // the paragraphs join the effects behind one disclosure
    if (effects.length === 0 && !hasAddOnNotes(addOn)) return nothing;
    return html`
      <details class="pr-addon-effects">
        <summary>${t(viewModel, 'pricing.moreDetails')}</summary>
        ${
          hasAddOnNotes(addOn)
            ? html`<div class="pr-addon-notes">${renderAddOnNotes(viewModel, addOn)}</div>`
            : nothing
        }
        ${
          effects.length
            ? html`<dl>
                ${effects.map(
                  (effect) =>
                    html`<div>
                      <dt>${effect.kind}: ${humanizeIdentifier(effect.id)}</dt>
                      <dd>${renderValue(viewModel, effect.value)}</dd>
                    </div>`,
                )}
              </dl>`
            : nothing
        }
      </details>
    `;
  }
  if (effects.length === 0) return nothing;
  return html`
    <details class="pr-addon-effects">
      <summary>${t(viewModel, 'pricing.effects')}</summary>
      <dl>
        ${effects.map(
          (effect) =>
            html`<div>
              <dt>${effect.kind}: ${humanizeIdentifier(effect.id)}</dt>
              <dd>${renderValue(viewModel, effect.value)}</dd>
            </div>`,
        )}
      </dl>
    </details>
  `;
}

function renderAddOnCard(
  state: RenderState,
  addOn: NormalizedAddOn,
  dense: boolean,
): TemplateResult {
  const { viewModel, selection, selectionEnabled, actions } = state;
  const selected = selection.addOns[addOn.id]?.selected ?? false;
  const addOnSelection = selection.addOns[addOn.id];
  const quantity = addOnSelection
    ? normalizeAddOnQuantity(viewModel.pricing, addOn.id, {
        ...addOnSelection,
        selected: true,
      })
    : (addOn.subscriptionConstraints?.minQuantity ?? 1);
  const available = addOnAvailability(addOn, selection.planId);
  const constraints = addOn.subscriptionConstraints;
  const current = state.currentAddOnIds?.has(addOn.id) ?? false;
  // data-available is the negation of is-unavailable
  const helpId = instanceId(state, 'addon-help', addOn.id);
  return html`
    <article
      class="pr-addon-card ${selectionEnabled && available ? 'pr-selectable-card' : ''} ${
        selected ? 'is-selected' : ''
      } ${available ? '' : 'is-unavailable'}${dense ? ' pr-addon-card--dense' : ''}"
      data-pr-part="add-on-card"
      data-add-on-id=${addOn.id}
      data-selected=${String(selected)}
      data-current=${current ? 'true' : nothing}
      data-available=${String(available)}
      @click=${(event: MouseEvent) =>
        selectionEnabled && available
          ? selectFromCard(event, () => actions.toggleAddOn(addOn.id, !selected))
          : undefined}
    >
      <div class="pr-addon-card__heading">
        <div>
          ${
            current
              ? html`<span class="pr-badge" data-pr-part="current-add-on-badge" data-tone="success"
                  >${t(viewModel, 'pricing.currentAddOn')}</span
                >`
              : nothing
          }
          <h4>${addOn.name}</h4>
          ${addOn.description ? html`<p>${addOn.description}</p>` : nothing}
        </div>
        ${
          selectionEnabled
            ? html`<label
                class="pr-selection-control pr-addon-card__check"
                data-pr-part="selection-control"
              >
                <input
                  type="checkbox"
                  .checked=${selected}
                  ?disabled=${!available}
                  aria-label=${t(viewModel, selected ? 'pricing.removeAddOn' : 'pricing.addAddOn', {
                    addOn: addOn.name,
                  })}
                  aria-describedby="${helpId}"
                  @change=${(event: Event) =>
                    actions.toggleAddOn(
                      addOn.id,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
                <span class="pr-selection-control__icon" aria-hidden="true"></span>
                <span class="pr-selection-control__label" aria-hidden="true"
                  >${selected ? t(viewModel, 'pricing.added') : t(viewModel, 'pricing.add')}</span
                >
              </label>`
            : nothing
        }
      </div>
      <div class="pr-price pr-price--addon">
        ${renderPrice(viewModel, viewModel.resolved.addOnPrices[addOn.id], addOn.unit)}
      </div>
      <div id="${helpId}" class="pr-addon-card__details">
        ${
          !available
            ? html`<p class="pr-status">${t(viewModel, 'pricing.notAvailable')}</p>`
            : nothing
        }
        ${dense ? nothing : renderAddOnNotes(viewModel, addOn)}
      </div>
      ${renderAddOnEffects(viewModel, addOn, dense)}
      ${
        selectionEnabled && selected && constraints
          ? html`<div class="pr-stepper" data-pr-part="add-on-quantity">
              <span>${t(viewModel, 'pricing.addOnQuantity', { addOn: addOn.name })}</span>
              <div>
                <button
                  type="button"
                  aria-label=${t(viewModel, 'pricing.decrease', { item: addOn.name })}
                  @click=${() =>
                    actions.updateAddOnQuantity(addOn.id, quantity - constraints.quantityStep)}
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label=${t(viewModel, 'pricing.addOnQuantity', { addOn: addOn.name })}
                  .value=${String(quantity)}
                  min=${constraints.minQuantity}
                  max=${maxQuantityOnGrid(constraints) ?? nothing}
                  step=${constraints.quantityStep}
                  @change=${(event: Event) =>
                    actions.updateAddOnQuantity(
                      addOn.id,
                      Number((event.currentTarget as HTMLInputElement).value),
                    )}
                />
                <button
                  type="button"
                  aria-label=${t(viewModel, 'pricing.increase', { item: addOn.name })}
                  @click=${() =>
                    actions.updateAddOnQuantity(addOn.id, quantity + constraints.quantityStep)}
                >
                  +
                </button>
              </div>
            </div>`
          : nothing
      }
    </article>
  `;
}

function renderAddOnGrid(
  state: RenderState,
  addOns: readonly NormalizedAddOn[],
  dense: boolean,
  keyed = false,
): TemplateResult {
  // The visible cards of the filter mode change with the search and show-more, so they are keyed
  // by id: an open disclosure or the focus stays with its add-on.
  return html`<div class="pr-addon-grid${dense ? ' pr-addon-grid--dense' : ''}">
    ${
      keyed
        ? repeat(
            addOns,
            (addOn) => addOn.id,
            (addOn) => renderAddOnCard(state, addOn, dense),
          )
        : addOns.map((addOn) => renderAddOnCard(state, addOn, dense))
    }
  </div>`;
}

function renderFilteredAddOns(state: RenderState, dense: boolean): TemplateResult {
  const { viewModel, selection, actions } = state;
  const all = viewModel.addOns;
  const search = (state.addOnSearch ?? '').trim().toLowerCase();
  const isSelected = (addOn: NormalizedAddOn): boolean =>
    selection.addOns[addOn.id]?.selected ?? false;
  let visible: NormalizedAddOn[];
  if (search) {
    visible = all.filter(
      (addOn) =>
        isSelected(addOn) ||
        addOn.name.toLowerCase().includes(search) ||
        (addOn.description ?? '').toLowerCase().includes(search),
    );
  } else if (state.addOnsRevealed) {
    visible = [...all];
  } else {
    visible = all.filter((addOn, index) => index < ADDON_VISIBLE_CAP || isSelected(addOn));
  }
  const hidden = all.length - visible.length;
  const label = t(viewModel, 'pricing.searchAddOns');
  const counter = t(viewModel, 'pricing.rowsShownOf', { shown: visible.length, total: all.length });
  return html`<div class="pr-addon-main">
    <div class="pr-addon-toolbar" data-pr-part="addon-toolbar">
      <label class="pr-search">
        <span class="pr-sr-only">${label}</span>
        <input
          type="search"
          placeholder=${label}
          .value=${state.addOnSearch ?? ''}
          @input=${(event: Event) =>
            actions.updateAddOnSearch?.((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <span aria-live="polite">${counter}</span>
    </div>
    ${
      visible.length === 0
        ? html`<p class="pr-empty" role="status" data-pr-part="addon-empty">
            ${t(viewModel, 'pricing.noMatches')}
          </p>`
        : renderAddOnGrid(state, visible, dense, true)
    }
    ${
      !search && hidden > 0
        ? html`<button
            class="pr-button pr-button--quiet"
            type="button"
            @click=${(event?: MouseEvent) => actions.revealAddOns?.(event?.detail === 0)}
          >
            ${t(viewModel, 'pricing.showRemaining', { count: hidden })}
          </button>`
        : nothing
    }
  </div>`;
}

export function renderAddOns(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel } = state;
  if (viewModel.addOns.length === 0 || state.hiddenSections?.has('addOns')) return nothing;
  const dense = viewModel.addOns.length > ADDON_DENSE_THRESHOLD;
  const filtered = viewModel.addOns.length > addOnFilterThresholdOf(state.addOnFilterThreshold);
  const titleId = instanceId(state, 'addons-title');
  return html`
    <section class="pr-section" aria-labelledby=${titleId} data-pr-part="add-ons">
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.addOns')}</p>
          <h3 id=${titleId}>${t(viewModel, 'pricing.addOnsTitle')}</h3>
        </div>
      </div>
      <div class="pr-addon-layout">
        ${
          filtered
            ? renderFilteredAddOns(state, dense)
            : renderAddOnGrid(state, viewModel.addOns, dense)
        }
        ${state.hiddenSections?.has('summary') ? nothing : renderSummary(state)}
      </div>
    </section>
  `;
}

// The formula of a priced line, or the label or the quote note of a line that needs a quote.
function breakdownDetail(viewModel: PricingViewModel, line: PriceBreakdownLine): string {
  const { currency } = viewModel.resolved.breakdown;
  if (line.requiresQuote || line.unitAmount === undefined || line.amount === undefined) {
    return line.label ?? t(viewModel, 'pricing.requiresQuote');
  }
  const numbers = new Intl.NumberFormat(viewModel.locale);
  return t(viewModel, 'pricing.breakdownFormula', {
    unitPrice: formatCurrency(line.unitAmount, currency, viewModel.locale),
    quantity: numbers.format(line.quantity),
    multiplier: numbers.format(line.billingMultiplier),
    amount: formatCurrency(line.amount, currency, viewModel.locale),
  });
}

function renderBreakdownLine(
  viewModel: PricingViewModel,
  line: PriceBreakdownLine,
): TemplateResult {
  return html`<li
    class="pr-breakdown__line"
    data-pr-part="breakdown-line"
    data-line-kind=${line.kind}
    data-line-id=${line.id}
  >
    <div class="pr-breakdown__name">${line.name}</div>
    <div class="pr-breakdown__detail">${breakdownDetail(viewModel, line)}</div>
  </li>`;
}

// The panel is rendered from the element's open state whatever the selection, as a labelled group
// of a list and a definition list. The closed panel is a template without bindings in its content, so it has no child nodes.
function renderBreakdownPanel(state: RenderState): TemplateResult {
  const { viewModel, breakdownOpen, breakdownId } = state;
  if (!breakdownOpen) {
    return html`<div id=${breakdownId} data-pr-part="breakdown" hidden></div>`;
  }
  const { breakdown } = viewModel.resolved;
  const lines = [...(breakdown.plan ? [breakdown.plan] : []), ...breakdown.addOns];
  const period = viewModel.pricing.billing.length > 1 ? breakdown.billingPeriod : undefined;
  const periodLabel = period
    ? (viewModel.presentation.billingLabels?.[period.id] ?? period.label)
    : undefined;
  return html`
    <div
      class="pr-breakdown"
      id=${breakdownId}
      data-pr-part="breakdown"
      role="group"
      aria-labelledby="${breakdownId}-title"
    >
      <p class="pr-breakdown__title" id="${breakdownId}-title">
        ${t(viewModel, 'pricing.breakdownTitle')}
      </p>
      <ul class="pr-breakdown__lines">
        ${lines.map((line) => renderBreakdownLine(viewModel, line))}
      </ul>
      <dl class="pr-breakdown__totals">
        ${
          periodLabel !== undefined
            ? html`<div>
                <dt>${t(viewModel, 'pricing.billing')}</dt>
                <dd>${periodLabel}</dd>
              </div>`
            : nothing
        }
        <div>
          <dt>${t(viewModel, 'pricing.currency')}</dt>
          <dd>${breakdown.currency}</dd>
        </div>
        <div class="pr-breakdown__total">
          <dt>
            ${breakdown.requiresQuote ? t(viewModel, 'pricing.subtotal') : t(viewModel, 'pricing.total')}
          </dt>
          <dd>${formatCurrency(breakdown.subtotal, breakdown.currency, viewModel.locale)}</dd>
        </div>
      </dl>
      ${
        breakdown.requiresQuote
          ? html`<p class="pr-breakdown__quote">${t(viewModel, 'pricing.requiresQuote')}</p>`
          : nothing
      }
    </div>
  `;
}

// Rendered outside the live region, so a change of label is not announced by the summary.
function renderSummaryAction(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel, summaryAction, pendingActionId, selection, actions } = state;
  // The slot node stands in for the summary action with or without a current plan; data-pending
  // follows aria-disabled of the built-in action (any pending action), not its own-id state.
  if (state.ctaEnabled && state.slots?.has('summary-actions')) {
    return html`<div
      data-pr-slot="summary-actions"
      data-pr-part="summary-actions-slot"
      data-relation=${summaryAction?.relation ?? nothing}
      data-pending=${pendingActionId !== undefined ? 'true' : nothing}
    ></div>`;
  }
  if (!state.ctaEnabled || !summaryAction) return nothing;
  const pending = isPendingActionId(pendingActionId, summaryAction.actionId);
  const origin: ActionOrigin = { relation: summaryAction.relation, source: 'summary' };
  const trigger = (): boolean =>
    actions.triggerAction(summaryAction.actionId, selection.planId, undefined, undefined, origin);
  return html`<button
    class="pr-button pr-button--primary"
    data-pr-part="summary-action"
    data-relation=${summaryAction.relation}
    data-pending=${pending ? 'true' : nothing}
    aria-busy=${pending ? 'true' : nothing}
    aria-disabled=${pendingActionId !== undefined ? 'true' : nothing}
    type="button"
    ?disabled=${summaryAction.disabled}
    @click=${trigger}
  >
    ${renderCtaLabel(viewModel, summaryAction.label, pending)}
  </button>`;
}

export function renderSummary(state: RenderState): TemplateResult {
  const { viewModel, breakdownOpen, breakdownId, actions } = state;
  const subtotal = formatCurrency(
    viewModel.resolved.subtotal,
    viewModel.pricing.metadata.currency,
    viewModel.locale,
  );
  return html`
    <aside class="pr-summary" data-pr-part="summary">
      <div class="pr-summary__live" aria-live="polite">
        <p>
          ${viewModel.resolved.requiresQuote ? t(viewModel, 'pricing.subtotal') : t(viewModel, 'pricing.total')}
        </p>
        <strong>${subtotal}</strong>
        ${
          viewModel.resolved.requiresQuote
            ? html`<span>${t(viewModel, 'pricing.requiresQuote')}</span>`
            : nothing
        }
      </div>
      ${renderSummaryAction(state)}
      <button
        class="pr-breakdown-toggle"
        data-pr-part="breakdown-toggle"
        type="button"
        aria-label=${t(viewModel, 'pricing.breakdownToggle')}
        aria-expanded=${String(breakdownOpen)}
        aria-controls=${breakdownId}
        @click=${actions.toggleBreakdown}
      ></button>
      ${renderBreakdownPanel(state)}
    </aside>
  `;
}

export function renderCatalogMetadata(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel } = state;
  if (viewModel.mode !== 'catalog') return nothing;
  const metadata = viewModel.pricing.metadata;
  const titleId = instanceId(state, 'metadata-title');
  return html`
    <section class="pr-metadata" aria-labelledby=${titleId} data-pr-part="metadata">
      <h3 id=${titleId}>${t(viewModel, 'pricing.details')}</h3>
      <dl>
        <div>
          <dt>${t(viewModel, 'pricing.version')}</dt>
          <dd>${metadata.version ?? metadata.syntaxVersion}</dd>
        </div>
        ${
          metadata.createdAt
            ? html`<div>
                <dt>${t(viewModel, 'pricing.createdAt')}</dt>
                <dd>${formatDate(metadata.createdAt, viewModel.locale)}</dd>
              </div>`
            : nothing
        }
        <div>
          <dt>${t(viewModel, 'pricing.currency')}</dt>
          <dd>${metadata.currency}</dd>
        </div>
        ${
          metadata.url && isSafeLink(metadata.url)
            ? html`<div>
                <dt>URL</dt>
                <dd>
                  <a href=${metadata.url} target="_blank" rel="noopener noreferrer"
                    >${metadata.url}</a
                  >
                </dd>
              </div>`
            : nothing
        }
      </dl>
    </section>
  `;
}

// the shell keeps its labelled heading; the slot node replaces the skeleton
export function renderLoadingSlotShell(titleId: string, label: string): TemplateResult {
  return html`
    <section class="pr-shell pr-shell--loading" aria-labelledby=${titleId}>
      <h2 id=${titleId} class="pr-sr-only">${label}</h2>
      <div data-pr-slot="loading" data-pr-part="loading-slot"></div>
    </section>
  `;
}

// The slot node is the only child; the diagnostics travel as JSON in data-diagnostics.
export function renderErrorSlotShell(diagnostics: readonly PricingDiagnostic[]): TemplateResult {
  const entries = diagnostics.map((item) => ({
    code: item.code,
    severity: item.severity,
    message: item.message,
    ...(item.path !== undefined ? { path: item.path } : {}),
  }));
  return html`<section class="pr-shell pr-error" role="alert">
    <div
      data-pr-slot="error"
      data-pr-part="error-slot"
      data-diagnostics=${JSON.stringify(entries)}
    ></div>
  </section>`;
}

export function renderPendingDialog(state: RenderState): TemplateResult | typeof nothing {
  const pending = state.pendingAddOnChange;
  if (!pending) return nothing;
  const { viewModel, actions } = state;
  const titleId = instanceId(state, 'dialog-title');
  const descriptionId = instanceId(state, 'dialog-description');
  return html`
    <div class="pr-dialog-backdrop">
      <div
        class="pr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby=${titleId}
        aria-describedby=${descriptionId}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Escape') actions.cancelAddOnChange();
        }}
      >
        <h3 id=${titleId}>${t(viewModel, 'pricing.confirmChanges')}</h3>
        <p id=${descriptionId}>${t(viewModel, 'pricing.confirmChangesDescription')}</p>
        ${
          pending.addIds.length
            ? html`<p>
                ${t(viewModel, 'pricing.willAdd', { items: addOnNames(viewModel, pending.addIds) })}
              </p>`
            : nothing
        }
        ${
          pending.removeIds.length
            ? html`<p>
                ${t(viewModel, 'pricing.willRemove', {
                  items: addOnNames(viewModel, pending.removeIds),
                })}
              </p>`
            : nothing
        }
        <div class="pr-dialog__actions">
          <button
            class="pr-button pr-button--secondary"
            type="button"
            @click=${actions.cancelAddOnChange}
          >
            ${t(viewModel, 'pricing.cancel')}
          </button>
          <button
            class="pr-button pr-button--primary"
            type="button"
            autofocus
            @click=${actions.confirmAddOnChange}
          >
            ${t(viewModel, 'pricing.apply')}
          </button>
        </div>
      </div>
    </div>
  `;
}
