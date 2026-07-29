import { html, nothing, type TemplateResult } from 'lit';
import {
  deepEqual,
  formatCurrency,
  formatDate,
  getAtPath,
  getPlanCta,
  getPlanHighlights,
  humanizeIdentifier,
  isSafeLink,
  translate,
  unwrapValue,
  type NormalizedAddOn,
  type PricingComparisonGroup,
  type PricingComparisonRow,
  type PricingSelection,
  type PricingViewModel,
  type ResolvedPrice,
  type VariableControl,
} from '../core/index.js';
import type { PendingAddOnChange } from './events.js';

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
  ): boolean;
  updateSearch(value: string): void;
  updateOnlyDifferences(value: boolean): void;
  toggleGroup(groupId: string): void;
  setAllGroups(expanded: boolean): void;
  revealGroup(groupId: string): void;
  confirmAddOnChange(): void;
  cancelAddOnChange(): void;
}

export interface RenderState {
  viewModel: PricingViewModel;
  selection: PricingSelection;
  compact: boolean;
  search: string;
  onlyDifferences: boolean;
  selectionEnabled: boolean;
  ctaEnabled: boolean;
  variablesEnabled: boolean;
  expandedGroups: ReadonlySet<string>;
  revealedGroups: ReadonlySet<string>;
  pendingAddOnChange?: PendingAddOnChange;
  actions: RenderActions;
}

function t(
  viewModel: PricingViewModel,
  key: string,
  parameters?: Record<string, string | number>,
): string {
  return translate(viewModel.messages, key, parameters);
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

function renderValue(viewModel: PricingViewModel, value: unknown, unit?: string): TemplateResult {
  if (value === true) {
    return html`<span class="pr-value pr-value--included"
      ><span aria-hidden="true">✓</span
      ><span class="pr-sr-only">${t(viewModel, 'pricing.included')}</span></span
    >`;
  }
  if (value === false || value === null || value === undefined) {
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
    return html`<span class="pr-value">${formatted}${unit ? ` ${unit}` : ''}</span>`;
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

export function renderHeader(state: RenderState): TemplateResult {
  const { viewModel } = state;
  const title =
    viewModel.presentation.title ??
    viewModel.pricing.metadata.saasName ??
    t(viewModel, 'pricing.title');
  const subtitle = viewModel.presentation.subtitle ?? t(viewModel, 'pricing.description');
  return html`
    <header class="pr-hero" data-pr-part="hero">
      <div class="pr-hero__eyebrow">${t(viewModel, 'pricing.title')}</div>
      <h2 class="pr-hero__title" id="pr-title">${title}</h2>
      ${subtitle ? html`<p class="pr-hero__subtitle">${subtitle}</p>` : nothing}
      ${
        viewModel.pricing.metadata.tags.length
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
                name="pr-billing"
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

export function renderPlans(state: RenderState): TemplateResult {
  const { viewModel, selection, selectionEnabled, ctaEnabled, actions } = state;
  return html`
    <section class="pr-section" aria-labelledby="pr-plans-title" data-pr-part="plans">
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.plans')}</p>
          <h3 id="pr-plans-title">${t(viewModel, 'pricing.plans')}</h3>
        </div>
      </div>
      ${
        viewModel.plans.length === 0
          ? html`<p class="pr-empty">${t(viewModel, 'pricing.noPlans')}</p>`
          : html`<div
              class="pr-plan-grid"
              role=${selectionEnabled ? 'radiogroup' : nothing}
              aria-labelledby=${selectionEnabled ? 'pr-plans-title' : nothing}
            >
              ${viewModel.plans.map((plan) => {
                const selected = selection.planId === plan.id;
                const recommended = viewModel.presentation.recommendedPlanId === plan.id;
                const cta = getPlanCta(viewModel.presentation, plan.id);
                const highlights = getPlanHighlights(viewModel, plan.id);
                const actionId = cta?.id ?? `choose-${plan.id}`;
                return html`
                  <article
                    class="pr-plan-card ${selectionEnabled ? 'pr-selectable-card' : ''} ${
                      selected ? 'is-selected' : ''
                    } ${recommended ? 'is-recommended' : ''}"
                    data-pr-part="plan-card"
                    data-plan-id=${plan.id}
                    data-selected=${String(selected)}
                    @click=${(event: MouseEvent) =>
                      selectionEnabled
                        ? selectFromCard(event, () => actions.selectPlan(plan.id))
                        : undefined}
                  >
                    <div class="pr-plan-card__top">
                      ${
                        recommended || selectionEnabled
                          ? html`<div class="pr-plan-card__status">
                              ${
                                recommended
                                  ? html`<span class="pr-badge"
                                      >${t(viewModel, 'pricing.recommended')}</span
                                    >`
                                  : nothing
                              }
                              ${
                                selectionEnabled
                                  ? html`<label
                                      class="pr-selection-control pr-plan-card__selector"
                                      data-pr-part="selection-control"
                                    >
                                      <input
                                        type="radio"
                                        name="pr-plan"
                                        value=${plan.id}
                                        aria-label=${t(viewModel, 'pricing.choosePlan', {
                                          plan: plan.name,
                                        })}
                                        .checked=${selected}
                                        @change=${() => actions.selectPlan(plan.id)}
                                      />
                                      <span
                                        class="pr-selection-control__icon"
                                        aria-hidden="true"
                                      ></span>
                                      <span class="pr-selection-control__label" aria-hidden="true"
                                        >${
                                          selected
                                            ? t(viewModel, 'pricing.selected')
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
                      highlights.length
                        ? html`<ul class="pr-highlight-list">
                            ${highlights.map((row) => {
                              const value = row.values.find(
                                (cell) => cell.planId === plan.id,
                              )?.value;
                              return html`<li>
                                <span class="pr-highlight-list__icon" aria-hidden="true">✓</span>
                                <span>${row.name}</span>
                                <span class="pr-highlight-list__value"
                                  >${renderValue(viewModel, value, row.unit)}</span
                                >
                              </li>`;
                            })}
                          </ul>`
                        : nothing
                    }
                    ${
                      !ctaEnabled
                        ? nothing
                        : cta?.href && isSafeLink(cta.href)
                          ? html`<a
                              class="pr-button ${
                                cta.kind === 'secondary'
                                  ? 'pr-button--secondary'
                                  : 'pr-button--primary'
                              }"
                              data-pr-part="cta"
                              href=${cta.href}
                              target=${cta.target ?? '_self'}
                              rel=${cta.target === '_blank' ? 'noopener noreferrer' : nothing}
                              @click=${(event: MouseEvent) => {
                                if (
                                  !actions.triggerAction(actionId, plan.id, cta.href, cta.metadata)
                                ) {
                                  event.preventDefault();
                                }
                              }}
                              >${cta.label}</a
                            >`
                          : html`<button
                              class="pr-button ${
                                cta?.kind === 'secondary'
                                  ? 'pr-button--secondary'
                                  : 'pr-button--primary'
                              }"
                              data-pr-part="cta"
                              type="button"
                              @click=${() =>
                                actions.triggerAction(actionId, plan.id, cta?.href, cta?.metadata)}
                            >
                              ${cta?.label ?? t(viewModel, 'pricing.choosePlan', { plan: plan.name })}
                            </button>`
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
  const id = `pr-variable-${control.path.replace(/[^\w-]+/g, '-')}`;
  if (control.type === 'boolean') {
    return html`<label class="pr-switch" for=${id}>
      <input
        id=${id}
        type="checkbox"
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
      id=${id}
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
        id=${id}
        type="range"
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
    id=${id}
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
  return html`
    <section class="pr-configurator" aria-labelledby="pr-variables-title" data-pr-part="variables">
      <div class="pr-section__heading">
        <h3 id="pr-variables-title">${t(viewModel, 'pricing.variables')}</h3>
        <button class="pr-button pr-button--quiet" type="button" @click=${actions.resetVariables}>
          ${t(viewModel, 'pricing.reset')}
        </button>
      </div>
      <div class="pr-variable-grid">
        ${viewModel.variableControls.map((control) => {
          const id = `pr-variable-${control.path.replace(/[^\w-]+/g, '-')}`;
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
                  ? html`<p class="pr-field__error" role="alert">
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

function renderComparisonToolbar(
  state: RenderState,
  totalRows: number,
): TemplateResult | typeof nothing {
  if (state.viewModel.comparisonGroups.flatMap((group) => group.rows).length <= 40) return nothing;
  const { viewModel, actions } = state;
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
      <div class="pr-toolbar-actions">
        <button type="button" @click=${() => actions.setAllGroups(true)}>
          ${t(viewModel, 'pricing.expandAll')}
        </button>
        <button type="button" @click=${() => actions.setAllGroups(false)}>
          ${t(viewModel, 'pricing.collapseAll')}
        </button>
      </div>
      <span aria-live="polite">${t(viewModel, 'pricing.rowsShown', { count: totalRows })}</span>
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
      const expanded = state.expandedGroups.has(group.id) || Boolean(state.search);
      const rows = visibleRows(state, group);
      return html`
        <section class="pr-comparison-group">
          <h4>
            <button
              type="button"
              aria-expanded=${expanded}
              aria-controls="pr-group-${group.id}"
              @click=${() => actions.toggleGroup(group.id)}
            >
              <span>${group.name}</span><span aria-hidden="true">${expanded ? '−' : '+'}</span>
            </button>
          </h4>
          ${
            expanded
              ? html`<div id="pr-group-${group.id}">
                  ${rows.map(
                    (row) => html`
                      <article class="pr-feature-card" data-pr-part="comparison-row">
                        <div>
                          <h5>${row.name}</h5>
                          ${row.description ? html`<p>${row.description}</p>` : nothing}
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
                              <dd>${renderValue(viewModel, cell.value, row.unit)}</dd>
                            </div>`;
                          })}
                        </dl>
                      </article>
                    `,
                  )}
                  ${
                    group.rows.length > rows.length
                      ? html`<button
                          class="pr-button pr-button--quiet"
                          type="button"
                          @click=${() => actions.revealGroup(group.id)}
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
          const expanded = state.expandedGroups.has(group.id) || Boolean(state.search);
          const rows = visibleRows(state, group);
          return html`
            <tbody>
              <tr class="pr-category-row">
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
              </tr>
              ${
                expanded
                  ? rows.map(
                      (row) => html`
                        <tr data-pr-part="comparison-row">
                          <th scope="row">
                            <span>${row.name}</span>
                            ${row.description ? html`<small>${row.description}</small>` : nothing}
                            ${renderRowMetadata(viewModel, row)}
                          </th>
                          ${row.values.map(
                            (cell) =>
                              html`<td>${renderValue(viewModel, cell.value, row.unit)}</td>`,
                          )}
                        </tr>
                      `,
                    )
                  : nothing
              }
              ${
                expanded && group.rows.length > rows.length
                  ? html`<tr>
                      <td colspan=${viewModel.plans.length + 1}>
                        <button
                          class="pr-button pr-button--quiet"
                          type="button"
                          @click=${() => actions.revealGroup(group.id)}
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
  const totalRows = groups.reduce((total, group) => total + group.rows.length, 0);
  if (viewModel.comparisonGroups.length === 0) return nothing;
  return html`
    <section
      class="pr-section pr-comparison"
      aria-labelledby="pr-comparison-title"
      data-pr-part="comparison"
    >
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.details')}</p>
          <h3 id="pr-comparison-title">${t(viewModel, 'pricing.comparison')}</h3>
        </div>
      </div>
      ${renderComparisonToolbar(state, totalRows)}
      ${
        state.compact
          ? renderCompactComparison(state, groups)
          : renderTableComparison(state, groups)
      }
    </section>
  `;
}

function addOnAvailability(addOn: NormalizedAddOn, planId: string | undefined): boolean {
  return (
    addOn.availableFor.length === 0 || (planId !== undefined && addOn.availableFor.includes(planId))
  );
}

function renderAddOnEffects(
  viewModel: PricingViewModel,
  addOn: NormalizedAddOn,
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

export function renderAddOns(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel, selection, selectionEnabled, actions } = state;
  if (viewModel.addOns.length === 0) return nothing;
  return html`
    <section class="pr-section" aria-labelledby="pr-addons-title" data-pr-part="add-ons">
      <div class="pr-section__heading">
        <div>
          <p class="pr-section__eyebrow">${t(viewModel, 'pricing.addOns')}</p>
          <h3 id="pr-addons-title">${t(viewModel, 'pricing.addOns')}</h3>
        </div>
      </div>
      <div class="pr-addon-layout">
        <div class="pr-addon-grid">
          ${viewModel.addOns.map((addOn) => {
            const selected = selection.addOns[addOn.id]?.selected ?? false;
            const quantity =
              selection.addOns[addOn.id]?.quantity ??
              addOn.subscriptionConstraints?.minQuantity ??
              1;
            const available = addOnAvailability(addOn, selection.planId);
            const constraints = addOn.subscriptionConstraints;
            return html`
              <article
                class="pr-addon-card ${selectionEnabled && available ? 'pr-selectable-card' : ''} ${
                  selected ? 'is-selected' : ''
                } ${available ? '' : 'is-unavailable'}"
                data-pr-part="add-on-card"
                data-add-on-id=${addOn.id}
                data-selected=${String(selected)}
                @click=${(event: MouseEvent) =>
                  selectionEnabled && available
                    ? selectFromCard(event, () => actions.toggleAddOn(addOn.id, !selected))
                    : undefined}
              >
                <div class="pr-addon-card__heading">
                  <div>
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
                            aria-label=${t(
                              viewModel,
                              selected ? 'pricing.removeAddOn' : 'pricing.addAddOn',
                              { addOn: addOn.name },
                            )}
                            aria-describedby="pr-addon-help-${addOn.id}"
                            @change=${(event: Event) =>
                              actions.toggleAddOn(
                                addOn.id,
                                (event.currentTarget as HTMLInputElement).checked,
                              )}
                          />
                          <span class="pr-selection-control__icon" aria-hidden="true"></span>
                          <span class="pr-selection-control__label" aria-hidden="true"
                            >${
                              selected ? t(viewModel, 'pricing.added') : t(viewModel, 'pricing.add')
                            }</span
                          >
                        </label>`
                      : nothing
                  }
                </div>
                <div class="pr-price pr-price--addon">
                  ${renderPrice(viewModel, viewModel.resolved.addOnPrices[addOn.id], addOn.unit)}
                </div>
                <div id="pr-addon-help-${addOn.id}" class="pr-addon-card__details">
                  ${
                    !available
                      ? html`<p class="pr-status">${t(viewModel, 'pricing.notAvailable')}</p>`
                      : nothing
                  }
                  ${
                    addOn.availableFor.length
                      ? html`<p>
                          ${t(viewModel, 'pricing.availableFor', {
                            plans: addOn.availableFor
                              .map(
                                (id) =>
                                  viewModel.pricing.plans.find((plan) => plan.id === id)?.name ??
                                  id,
                              )
                              .join(', '),
                          })}
                        </p>`
                      : nothing
                  }
                  ${
                    addOn.dependsOn.length
                      ? html`<p>
                          ${t(viewModel, 'pricing.dependsOn', {
                            items: addOn.dependsOn.join(', '),
                          })}
                        </p>`
                      : nothing
                  }
                  ${
                    addOn.excludes.length
                      ? html`<p>
                          ${t(viewModel, 'pricing.excludes', {
                            items: addOn.excludes.join(', '),
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
                </div>
                ${renderAddOnEffects(viewModel, addOn)}
                ${
                  selectionEnabled && selected && constraints
                    ? html`<div class="pr-stepper" data-pr-part="add-on-quantity">
                        <span>${t(viewModel, 'pricing.addOnQuantity', { addOn: addOn.name })}</span>
                        <div>
                          <button
                            type="button"
                            aria-label=${t(viewModel, 'pricing.decrease', { item: addOn.name })}
                            @click=${() =>
                              actions.updateAddOnQuantity(
                                addOn.id,
                                quantity - constraints.quantityStep,
                              )}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            aria-label=${t(viewModel, 'pricing.addOnQuantity', {
                              addOn: addOn.name,
                            })}
                            .value=${String(quantity)}
                            min=${constraints.minQuantity}
                            max=${constraints.maxQuantity ?? nothing}
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
                              actions.updateAddOnQuantity(
                                addOn.id,
                                quantity + constraints.quantityStep,
                              )}
                          >
                            +
                          </button>
                        </div>
                      </div>`
                    : nothing
                }
              </article>
            `;
          })}
        </div>
        ${renderSummary(state)}
      </div>
    </section>
  `;
}

export function renderSummary(state: RenderState): TemplateResult {
  const { viewModel } = state;
  const subtotal = formatCurrency(
    viewModel.resolved.subtotal,
    viewModel.pricing.metadata.currency,
    viewModel.locale,
  );
  return html`
    <aside class="pr-summary" data-pr-part="summary" aria-live="polite">
      <p>
        ${viewModel.resolved.requiresQuote ? t(viewModel, 'pricing.subtotal') : t(viewModel, 'pricing.total')}
      </p>
      <strong>${subtotal}</strong>
      ${
        viewModel.resolved.requiresQuote
          ? html`<span>${t(viewModel, 'pricing.requiresQuote')}</span>`
          : nothing
      }
    </aside>
  `;
}

export function renderCatalogMetadata(state: RenderState): TemplateResult | typeof nothing {
  const { viewModel } = state;
  if (viewModel.mode !== 'catalog') return nothing;
  const metadata = viewModel.pricing.metadata;
  return html`
    <section class="pr-metadata" aria-labelledby="pr-metadata-title" data-pr-part="metadata">
      <h3 id="pr-metadata-title">${t(viewModel, 'pricing.details')}</h3>
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

export function renderPendingDialog(state: RenderState): TemplateResult | typeof nothing {
  const pending = state.pendingAddOnChange;
  if (!pending) return nothing;
  const { viewModel, actions } = state;
  return html`
    <div class="pr-dialog-backdrop">
      <div
        class="pr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pr-dialog-title"
        aria-describedby="pr-dialog-description"
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Escape') actions.cancelAddOnChange();
        }}
      >
        <h3 id="pr-dialog-title">${t(viewModel, 'pricing.confirmChanges')}</h3>
        <p id="pr-dialog-description">${t(viewModel, 'pricing.confirmChangesDescription')}</p>
        ${
          pending.addIds.length
            ? html`<p>${t(viewModel, 'pricing.willAdd', { items: pending.addIds.join(', ') })}</p>`
            : nothing
        }
        ${
          pending.removeIds.length
            ? html`<p>
                ${t(viewModel, 'pricing.willRemove', { items: pending.removeIds.join(', ') })}
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
