import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import {
  cloneValue,
  createPricingViewModel,
  getPricingRendererConfig,
  mergeSelection,
  normalizeAddOnQuantity,
  normalizePricing,
  setAtPath,
  translate,
  type IPricingLike,
  type ExpressionOptions,
  type MessageCatalog,
  type NormalizedPricing,
  type NormalizePricingOptions,
  type PricingDiagnostic,
  type PricingLayout,
  type PricingMode,
  type PricingPresentation,
  type PricingResult,
  type PricingSelection,
  type PricingViewModel,
  type PricingVisibility,
  type ResolvedPrice,
  type ViewModelOptions,
} from '../core/index.js';
import {
  loadPricingFromUrl,
  parsePricingYaml,
  type PricingLoader,
  type PricingRequestOptions,
} from '../yaml/index.js';
import type {
  PendingAddOnChange,
  PricingActionDetail,
  PricingActionEvent,
  PricingDiagnosticDetail,
  PricingReadyDetail,
  PricingSelectionChangeDetail,
} from './events.js';
import {
  renderAddOns,
  renderBilling,
  renderCatalogMetadata,
  renderComparison,
  renderHeader,
  renderPendingDialog,
  renderPlans,
  renderSummary,
  renderVariables,
  type RenderActions,
  type RenderState,
} from './renderers.js';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export class PricingRendererElement extends LitElement {
  static properties = {
    pricing: { attribute: false },
    yaml: { attribute: false },
    src: { type: String, reflect: true },
    request: { attribute: false },
    loadPricing: { attribute: false },
    normalizeOptions: { attribute: false },
    expressionOptions: { attribute: false },
    selection: { attribute: false },
    defaultSelection: { attribute: false },
    presentation: { attribute: false },
    locale: { type: String },
    pricingPath: { type: String, attribute: 'pricing-path', reflect: true },
    selectionEnabled: { attribute: false },
    ctaEnabled: { attribute: false },
    variablesEnabled: { attribute: false },
    messages: { attribute: false },
    mode: { type: String, reflect: true },
    layout: { type: String, reflect: true },
    visibility: { type: String, reflect: true },
    theme: { type: String, reflect: true },
    loadingLabel: { type: String, attribute: 'loading-label' },
  };

  declare pricing?: IPricingLike;
  declare yaml?: string;
  declare src?: string;
  declare request?: PricingRequestOptions;
  declare loadPricing?: PricingLoader;
  declare normalizeOptions?: NormalizePricingOptions;
  declare expressionOptions?: ExpressionOptions;
  declare selection?: PricingSelection;
  declare defaultSelection?: Partial<PricingSelection>;
  declare presentation?: PricingPresentation;
  declare locale: string;
  declare pricingPath: string;
  declare selectionEnabled: boolean;
  declare ctaEnabled: boolean;
  declare variablesEnabled: boolean;
  declare messages?: MessageCatalog;
  declare mode: PricingMode;
  declare layout: PricingLayout;
  declare visibility: PricingVisibility;
  declare theme: 'light' | 'dark' | 'auto';
  declare loadingLabel?: string;

  private _status: LoadStatus = 'idle';
  private _normalized?: NormalizedPricing;
  private _diagnostics: PricingDiagnostic[] = [];
  private _internalSelection?: PricingSelection;
  private _compact = true;
  private _search = '';
  private _onlyDifferences = false;
  private _expandedGroups = new Set<string>();
  private _revealedGroups = new Set<string>();
  private _pendingAddOnChange?: PendingAddOnChange;
  private _lastValidPlanPrices: Record<string, ResolvedPrice> = {};
  private _lastValidAddOnPrices: Record<string, ResolvedPrice> = {};
  private _resizeObserver?: ResizeObserver;
  private _abortController?: AbortController;
  private _loadSequence = 0;
  private _loadedOnce = false;
  private _reloadOnPropertyChange = false;
  private _previousFocus?: HTMLElement;

  constructor() {
    super();
    const configuration = getPricingRendererConfig();
    this.locale = configuration.locale;
    this.pricingPath = configuration.pricingPath;
    this.selectionEnabled = configuration.selectionEnabled;
    this.ctaEnabled = configuration.ctaEnabled;
    this.variablesEnabled = configuration.variablesEnabled;
    this.mode = 'commercial';
    this.layout = 'auto';
    this.visibility = 'public-only';
    this.theme = 'light';
  }

  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('data-pr-root', '');
    this.addEventListener('keydown', this._handleDialogKeyboard);
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    this._abortController?.abort();
    this.removeEventListener('keydown', this._handleDialogKeyboard);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? this.getBoundingClientRect().width;
        this._updateCompactLayout(width);
      });
      this._resizeObserver.observe(this);
    }
    this._updateCompactLayout(this.getBoundingClientRect().width);
    void this.reload();
    queueMicrotask(() => {
      this._reloadOnPropertyChange = true;
    });
  }

  protected updated(changed: PropertyValues<this>): void {
    const inputChanged =
      changed.has('pricing') ||
      changed.has('yaml') ||
      changed.has('src') ||
      changed.has('request') ||
      changed.has('loadPricing') ||
      changed.has('normalizeOptions');
    if (this._loadedOnce && this._reloadOnPropertyChange && inputChanged) {
      void this.reload();
    }
    if (changed.has('layout')) {
      this._updateCompactLayout(this.getBoundingClientRect().width);
    }
  }

  public async reload(): Promise<void> {
    this._loadedOnce = true;
    const sources = [
      this.pricing !== undefined ? 'pricing' : undefined,
      this.yaml !== undefined ? 'yaml' : undefined,
      this.src ? 'src' : undefined,
    ].filter(Boolean);

    if (sources.length !== 1) {
      this._applyLoadResult({
        ok: false,
        diagnostics: [
          {
            code: sources.length === 0 ? 'PR_SOURCE_MISSING' : 'PR_SOURCE_CONFLICT',
            severity: 'error',
            message:
              sources.length === 0
                ? 'Provide exactly one pricing source: pricing, yaml or src.'
                : 'Only one pricing source can be provided at a time.',
            path: '$',
          },
        ],
      });
      return;
    }

    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    const sequence = ++this._loadSequence;
    this._status = 'loading';
    this.requestUpdate();

    let result: PricingResult<NormalizedPricing>;
    if (this.pricing !== undefined) {
      result = normalizePricing(this.pricing, this.normalizeOptions);
    } else if (this.yaml !== undefined) {
      result = parsePricingYaml(this.yaml, {
        ...(this.normalizeOptions ? { normalize: this.normalizeOptions } : {}),
      });
    } else {
      result = await loadPricingFromUrl(this.src!, {
        ...(this.request ?? {}),
        ...(this.loadPricing ? { loadPricing: this.loadPricing } : {}),
        ...(this.normalizeOptions ? { normalize: this.normalizeOptions } : {}),
        signal: controller.signal,
      });
    }
    if (sequence !== this._loadSequence || controller.signal.aborted) {
      return;
    }
    this._applyLoadResult(result);
  }

  private _applyLoadResult(result: PricingResult<NormalizedPricing>): void {
    this._diagnostics = result.diagnostics;
    if (result.value) {
      this._normalized = result.value;
      this._lastValidPlanPrices = {};
      this._lastValidAddOnPrices = {};
      this._internalSelection = mergeSelection(result.value, this.defaultSelection);
      this._expandedGroups = new Set();
      const viewModel = createPricingViewModel(
        result.value,
        this._effectiveSelection(),
        this._viewModelOptions(),
      );
      if (viewModel.comparisonGroups[0]) {
        this._expandedGroups.add(viewModel.comparisonGroups[0].id);
      }
      this._status = 'ready';
      this.dispatchEvent(
        new CustomEvent<PricingReadyDetail>('pricing-ready', {
          detail: { pricing: result.value, diagnostics: result.diagnostics },
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      this._status = this._normalized ? 'ready' : 'error';
    }
    if (result.diagnostics.length > 0) {
      this.dispatchEvent(
        new CustomEvent<PricingDiagnosticDetail>('pricing-diagnostic', {
          detail: { diagnostics: result.diagnostics },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this.requestUpdate();
  }

  private _effectiveSelection(): PricingSelection | undefined {
    const selection = this.selection ?? this._internalSelection;
    if (!selection || this.variablesEnabled || !this._normalized) return selection;
    return {
      ...selection,
      variables: cloneValue(this._normalized.variables),
    };
  }

  private _viewModelOptions(): ViewModelOptions {
    return {
      locale: this.locale,
      mode: this.mode,
      visibility: this.visibility,
      ...(this.messages ? { messages: this.messages } : {}),
      ...(this.presentation ? { presentation: this.presentation } : {}),
      ...(this.expressionOptions ? { expression: this.expressionOptions } : {}),
    };
  }

  private _stabilizeResolvedPrices(viewModel: PricingViewModel): PricingViewModel {
    for (const [id, price] of Object.entries(viewModel.resolved.planPrices)) {
      if (price.kind === 'amount') {
        this._lastValidPlanPrices[id] = price;
      } else if (price.kind === 'error' && this._lastValidPlanPrices[id]) {
        viewModel.resolved.planPrices[id] = this._lastValidPlanPrices[id]!;
      }
    }
    for (const [id, price] of Object.entries(viewModel.resolved.addOnPrices)) {
      if (price.kind === 'amount') {
        this._lastValidAddOnPrices[id] = price;
      } else if (price.kind === 'error' && this._lastValidAddOnPrices[id]) {
        viewModel.resolved.addOnPrices[id] = this._lastValidAddOnPrices[id]!;
      }
    }

    const planPrice = viewModel.resolved.selection.planId
      ? viewModel.resolved.planPrices[viewModel.resolved.selection.planId]
      : undefined;
    let subtotal = planPrice?.kind === 'amount' ? planPrice.amount : 0;
    for (const [id, state] of Object.entries(viewModel.resolved.selection.addOns)) {
      const addOnPrice = viewModel.resolved.addOnPrices[id];
      if (state.selected && addOnPrice?.kind === 'amount') {
        subtotal += addOnPrice.amount;
      }
    }
    viewModel.resolved.subtotal = subtotal;
    return viewModel;
  }

  private _viewModel(): PricingViewModel | undefined {
    if (!this._normalized) return undefined;
    return this._stabilizeResolvedPrices(
      createPricingViewModel(this._normalized, this._effectiveSelection(), {
        ...this._viewModelOptions(),
      }),
    );
  }

  private _updateCompactLayout(width: number): void {
    const next = this.layout === 'compact' ? true : this.layout === 'table' ? false : width < 840;
    if (next !== this._compact) {
      this._compact = next;
      this.requestUpdate();
    }
  }

  private _setSelection(next: PricingSelection): void {
    if (this.selection === undefined) {
      this._internalSelection = next;
    }
    const resolved = this._normalized
      ? this._stabilizeResolvedPrices(
          createPricingViewModel(this._normalized, next, {
            ...this._viewModelOptions(),
          }),
        ).resolved
      : undefined;
    if (resolved) {
      this.dispatchEvent(
        new CustomEvent<PricingSelectionChangeDetail>('pricing-selection-change', {
          detail: { selection: next, resolved },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this.requestUpdate();
  }

  private _selectPlan = (planId: string): void => {
    const selection = this._effectiveSelection();
    if (!selection) return;
    this._setSelection({ ...selection, planId });
  };

  private _selectBilling = (billingPeriod: string): void => {
    const selection = this._effectiveSelection();
    if (!selection) return;
    this._setSelection({ ...selection, billingPeriod });
  };

  private _updateVariable = (path: string, value: unknown): void => {
    const selection = this._effectiveSelection();
    if (!selection) return;
    const variables = cloneValue(selection.variables);
    setAtPath(variables, path, value);
    this._setSelection({ ...selection, variables });
  };

  private _resetVariables = (): void => {
    const selection = this._effectiveSelection();
    if (!selection || !this._normalized) return;
    this._setSelection({ ...selection, variables: cloneValue(this._normalized.variables) });
  };

  private _collectDependencies(addOnId: string, collected = new Set<string>()): Set<string> {
    if (!this._normalized || collected.has(addOnId)) return collected;
    const addOn = this._normalized.addOns.find((candidate) => candidate.id === addOnId);
    for (const dependency of addOn?.dependsOn ?? []) {
      if (!collected.has(dependency)) {
        collected.add(dependency);
        this._collectDependencies(dependency, collected);
      }
    }
    return collected;
  }

  private _selectedDependents(addOnId: string): string[] {
    if (!this._normalized) return [];
    const selection = this._effectiveSelection();
    const dependents = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const addOn of this._normalized.addOns) {
        if (!selection?.addOns[addOn.id]?.selected || dependents.has(addOn.id)) continue;
        if (addOn.dependsOn.some((id) => id === addOnId || dependents.has(id))) {
          dependents.add(addOn.id);
          changed = true;
        }
      }
    }
    return [...dependents];
  }

  private _toggleAddOn = (addOnId: string, selected: boolean): void => {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    const addOn = this._normalized.addOns.find((candidate) => candidate.id === addOnId);
    if (!addOn) return;

    let addIds: string[] = [];
    let removeIds: string[] = [];
    if (selected) {
      addIds = [...this._collectDependencies(addOnId)].filter(
        (id) => !selection.addOns[id]?.selected,
      );
      const conflicts = new Set(addOn.excludes);
      for (const candidate of this._normalized.addOns) {
        if (candidate.excludes.includes(addOnId)) conflicts.add(candidate.id);
      }
      for (const dependency of addIds) {
        const item = this._normalized.addOns.find((candidate) => candidate.id === dependency);
        item?.excludes.forEach((id) => conflicts.add(id));
      }
      removeIds = [...conflicts].filter((id) => selection.addOns[id]?.selected);
    } else {
      removeIds = this._selectedDependents(addOnId);
    }

    const pending: PendingAddOnChange = { addOnId, select: selected, addIds, removeIds };
    if (addIds.length || removeIds.length) {
      this._pendingAddOnChange = pending;
      this._previousFocus =
        this.ownerDocument.activeElement instanceof HTMLElement
          ? this.ownerDocument.activeElement
          : undefined;
      this.requestUpdate();
      void this.updateComplete.then(() => {
        this.querySelector<HTMLElement>('.pr-dialog button[autofocus]')?.focus();
      });
    } else {
      this._applyAddOnChange(pending);
    }
  };

  private _applyAddOnChange(change: PendingAddOnChange): void {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    const addOns = { ...selection.addOns };
    const setState = (id: string, selected: boolean): void => {
      const item = this._normalized!.addOns.find((candidate) => candidate.id === id);
      const current = addOns[id];
      addOns[id] = {
        selected,
        quantity: current?.quantity ?? item?.subscriptionConstraints?.minQuantity ?? 1,
      };
    };
    setState(change.addOnId, change.select);
    change.addIds.forEach((id) => setState(id, true));
    change.removeIds.forEach((id) => setState(id, false));
    this._pendingAddOnChange = undefined;
    this._setSelection({ ...selection, addOns });
    void this.updateComplete.then(() => this._restoreDialogFocus());
  }

  private _updateAddOnQuantity = (addOnId: string, quantity: number): void => {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    const current = selection.addOns[addOnId] ?? { selected: true, quantity };
    const normalized = normalizeAddOnQuantity(this._normalized, addOnId, {
      ...current,
      selected: true,
      quantity,
    });
    this._setSelection({
      ...selection,
      addOns: {
        ...selection.addOns,
        [addOnId]: { selected: true, quantity: normalized },
      },
    });
  };

  private _confirmAddOnChange = (): void => {
    if (this._pendingAddOnChange) {
      this._applyAddOnChange(this._pendingAddOnChange);
    }
  };

  private _cancelAddOnChange = (): void => {
    this._pendingAddOnChange = undefined;
    this.requestUpdate();
    void this.updateComplete.then(() => this._restoreDialogFocus());
  };

  private _restoreDialogFocus(): void {
    this._previousFocus?.focus();
    this._previousFocus = undefined;
  }

  private _triggerAction = (
    actionId: string,
    planId?: string,
    href?: string,
    metadata?: Record<string, unknown>,
  ): boolean => {
    const viewModel = this._viewModel();
    if (!viewModel) return false;
    const detail: PricingActionDetail = {
      actionId,
      ...(planId ? { planId } : {}),
      ...(href ? { href } : {}),
      selection: viewModel.resolved.selection,
      resolved: viewModel.resolved,
      ...(metadata ? { metadata } : {}),
    };
    const event: PricingActionEvent = new CustomEvent('pricing-action', {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    return this.dispatchEvent(event);
  };

  private _toggleGroup = (groupId: string): void => {
    const groups = new Set(this._expandedGroups);
    if (groups.has(groupId)) groups.delete(groupId);
    else groups.add(groupId);
    this._expandedGroups = groups;
    this.requestUpdate();
  };

  private _setAllGroups = (expanded: boolean): void => {
    const viewModel = this._viewModel();
    this._expandedGroups = expanded
      ? new Set(viewModel?.comparisonGroups.map((group) => group.id) ?? [])
      : new Set();
    this.requestUpdate();
  };

  private _revealGroup = (groupId: string): void => {
    this._revealedGroups = new Set([...this._revealedGroups, groupId]);
    this.requestUpdate();
  };

  private _handleDialogKeyboard = (event: KeyboardEvent): void => {
    if (!this._pendingAddOnChange) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this._cancelAddOnChange();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...this.querySelectorAll<HTMLElement>(
        '.pr-dialog button:not([disabled]), .pr-dialog a[href], .pr-dialog input:not([disabled])',
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && this.ownerDocument.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.ownerDocument.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  private _actions: RenderActions = {
    selectPlan: this._selectPlan,
    selectBilling: this._selectBilling,
    updateVariable: this._updateVariable,
    resetVariables: this._resetVariables,
    toggleAddOn: this._toggleAddOn,
    updateAddOnQuantity: this._updateAddOnQuantity,
    triggerAction: this._triggerAction,
    updateSearch: (value) => {
      this._search = value;
      this.requestUpdate();
    },
    updateOnlyDifferences: (value) => {
      this._onlyDifferences = value;
      this.requestUpdate();
    },
    toggleGroup: this._toggleGroup,
    setAllGroups: this._setAllGroups,
    revealGroup: this._revealGroup,
    confirmAddOnChange: this._confirmAddOnChange,
    cancelAddOnChange: this._cancelAddOnChange,
  };

  protected render(): TemplateResult {
    if (this._status === 'loading' || this._status === 'idle') {
      return html`
        <section class="pr-shell pr-shell--loading" aria-labelledby="pr-loading-title">
          <h2 id="pr-loading-title" class="pr-sr-only">
            ${this.loadingLabel ?? 'Loading pricing'}
          </h2>
          <div class="pr-skeleton" role="status" aria-live="polite">
            <span>${this.loadingLabel ?? 'Loading pricing…'}</span>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </section>
      `;
    }
    if (!this._normalized || this._status === 'error') {
      const messages = createPricingViewModel(
        {
          metadata: { syntaxVersion: '3.1', saasName: 'Pricing', tags: [], currency: 'USD' },
          billing: [],
          variables: {},
          features: [],
          usageLimits: [],
          plans: [],
          addOns: [],
          custom: {},
          raw: {},
        },
        undefined,
        { locale: this.locale, messages: this.messages },
      ).messages;
      return html`
        <section class="pr-shell pr-error" role="alert">
          <h2>${translate(messages, 'pricing.error')}</h2>
          <ul>
            ${this._diagnostics.map(
              (item) => html`<li><strong>${item.code}</strong>: ${item.message}</li>`,
            )}
          </ul>
          ${
            this.src
              ? html`<button
                  class="pr-button pr-button--primary"
                  type="button"
                  @click=${() => this.reload()}
                >
                  ${translate(messages, 'pricing.retry')}
                </button>`
              : nothing
          }
        </section>
      `;
    }

    const viewModel = this._viewModel()!;
    const state: RenderState = {
      viewModel,
      selection: viewModel.resolved.selection,
      compact: this._compact,
      search: this._search,
      onlyDifferences: this._onlyDifferences,
      selectionEnabled: this.selectionEnabled,
      ctaEnabled: this.ctaEnabled,
      variablesEnabled: this.variablesEnabled,
      expandedGroups: this._expandedGroups,
      revealedGroups: this._revealedGroups,
      ...(this._pendingAddOnChange ? { pendingAddOnChange: this._pendingAddOnChange } : {}),
      actions: this._actions,
    };
    const warnings = this._diagnostics.filter((item) => item.severity !== 'info');
    return html`
      <section class="pr-shell" aria-labelledby="pr-title">
        <div
          class="pr-content"
          aria-hidden=${this._pendingAddOnChange ? 'true' : nothing}
          ?inert=${Boolean(this._pendingAddOnChange)}
        >
          ${
            warnings.length
              ? html`<details class="pr-diagnostics" data-pr-part="diagnostics">
                  <summary>
                    ${translate(viewModel.messages, 'pricing.warning')} (${warnings.length})
                  </summary>
                  <ul>
                    ${warnings.map(
                      (item) =>
                        html`<li>
                          <strong>${item.code}</strong>:
                          ${item.message}${item.path ? ` (${item.path})` : ''}
                        </li>`,
                    )}
                  </ul>
                </details>`
              : nothing
          }
          ${renderHeader(state)} ${renderCatalogMetadata(state)} ${renderBilling(state)}
          ${renderVariables(state)} ${renderPlans(state)} ${renderComparison(state)}
          ${renderAddOns(state)} ${viewModel.addOns.length === 0 ? renderSummary(state) : nothing}
        </div>
        ${renderPendingDialog(state)}
        <p class="pr-sr-only" aria-live="polite">
          ${translate(viewModel.messages, 'pricing.configurationUpdated')}
        </p>
      </section>
    `;
  }
}
