import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import {
  applySelectionChange,
  cloneValue,
  compareSelections,
  createPriceStabilizer,
  createPricingViewModel,
  deepEqual,
  getMessages,
  getPricingRendererConfig,
  mergePresentationOptions,
  mergeSelection,
  planSelectionChange,
  reconcileSelection,
  selectionInEffect,
  selectionWithAddOnQuantity,
  selectionWithVariable,
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
  type ViewModelOptions,
} from '../core/index.js';
import { applySelectionInput } from '../core/apply-selection.js';
import { summaryActionState, type SummaryActionState } from './cta.js';
import { currentSelectionDiagnostics, deriveCurrentContext } from './current-selection.js';
import { inputChanged } from './same-input.js';
import {
  loadPricingSource,
  type PricingLoader,
  type PricingRequestOptions,
} from '../yaml/index.js';
import { pricingSourceError } from '../yaml/source.js';
import type {
  ApplySelectionResult,
  PendingAddOnChange,
  PricingActionDetail,
  PricingActionEvent,
  PricingDiagnosticDetail,
  PricingReadyDetail,
  PricingSelectionChangeDetail,
} from './events.js';
import {
  comparisonRowTotal,
  DEFAULT_ADDON_FILTER_THRESHOLD,
  DEFAULT_TOOLBAR_THRESHOLD,
  renderAddOns,
  renderBilling,
  renderCatalogMetadata,
  renderComparison,
  renderHeader,
  renderPendingDialog,
  renderPlans,
  renderSummary,
  renderVariables,
  resolveOnlyDifferences,
  toolbarThresholdOf,
  addOnFilterThresholdOf,
  instanceId,
  heroTitle,
  PRICING_SECTION_NAMES,
  type ActionOrigin,
  type PricingSectionName,
  type RenderActions,
  type RenderState,
} from './renderers.js';

// [impl->req~sticky-summary-position~1] Everything after the plans lives in one flex column, so a
// sticky summary has the whole column as its containing block (a grid item would only have its own
// row). Without add-ons, in the table layout and with a plan selected, the summary is the first
// child and sticks near the plans while the comparison scrolls. In every other case it keeps its
// place: with add-ons inside the add-on layout (renderAddOns), otherwise last in the content, where
// the mobile bottom bar sticks to the viewport. The top dock also needs a container at least 840px
// wide (`wide`), because layout="table" can render the table in a narrower container, where the
// bottom bar is still the summary position (RenderState lives in renderers.ts and has no such field).
export function renderAfterPlans(state: RenderState, wide = true): TemplateResult {
  const { viewModel, selection, compact } = state;
  const hidden = state.hiddenSections;
  // [impl->req~hide-sections-addons-summary~1] hidden add-ons count as no add-ons, so the summary
  // keeps a place outside the add-on layout
  const withoutAddOns = viewModel.addOns.length === 0 || Boolean(hidden?.has('addOns'));
  const docked = withoutAddOns && !compact && wide && selection.planId !== undefined;
  const summary = withoutAddOns && !hidden?.has('summary') ? renderSummary(state) : nothing;
  const parts = [
    docked ? summary : nothing,
    hidden?.has('comparison') ? nothing : renderComparison(state),
    renderAddOns(state),
  ];
  return html`<div class="pr-flow">${parts}</div>
    ${docked ? nothing : summary}`;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const breakdownToggleSelector = '[data-pr-part="breakdown-toggle"]';
const comparisonRowSelector = '[data-pr-part="comparison-row"]';
const addOnCardSelector = '[data-pr-part="add-on-card"]';
const breakdownPanelSelector = '[data-pr-part="breakdown"]';
let breakdownPanelCount = 0;

// [impl->req~error-state-human-message~1] the sentence is chosen by the first error diagnostic.
// The code prefix is cut off so that no partial code is spelled out: the docs test treats every
// full code token of the source as a code to document.
function errorMessageKey(diagnostics: PricingDiagnostic[]): string {
  const first = diagnostics.find((item) => item.severity === 'error');
  const name = (first?.code ?? '').replace(/^PR_/, '');
  if (name.startsWith('SOURCE_') || name === 'FETCH_UNAVAILABLE') return 'pricing.errorSource';
  if (name.startsWith('YAML_') || name === 'INPUT_INVALID') return 'pricing.errorFormat';
  if (name.startsWith('VERSION_')) return 'pricing.errorVersion';
  return 'pricing.errorGeneric';
}

// [impl->req~shorter-page-only-differences~2] absent is automatic, `false` is off, anything else is on
export const onlyDifferencesConverter = {
  fromAttribute(value: string | null): boolean | undefined {
    if (value === null) return undefined;
    return value !== 'false';
  },
};

// [impl->req~hide-sections-attribute-converter~1] [impl->req~hide-sections-unknown~2]
// Whitespace separated; only tokens that exactly match a section name are kept, in order.
export const hideSectionsConverter = {
  fromAttribute(value: string | null): PricingSectionName[] | undefined {
    if (value === null) return undefined;
    return value
      .split(/[\t\n\f\r ]+/)
      .filter((token): token is PricingSectionName =>
        (PRICING_SECTION_NAMES as readonly string[]).includes(token),
      );
  },
};

// A value that is not an array hides nothing, and neither does an item that is not a section name.
function hiddenSectionsOf(value: unknown): ReadonlySet<PricingSectionName> {
  const names = new Set<PricingSectionName>();
  if (!Array.isArray(value)) return names;
  for (const item of value) {
    if ((PRICING_SECTION_NAMES as readonly unknown[]).includes(item)) {
      names.add(item as PricingSectionName);
    }
  }
  return names;
}

export class PricingRendererElement extends LitElement {
  static properties = {
    // [impl->req~element-input-structural-compare~1] a host that builds these objects in its render
    // function does not reload on every render; call reload() to force a load. loadPricing, yaml
    // and src keep the identity compare.
    pricing: { attribute: false, hasChanged: inputChanged },
    yaml: { attribute: false },
    src: { type: String, reflect: true },
    request: { attribute: false, hasChanged: inputChanged },
    loadPricing: { attribute: false },
    normalizeOptions: { attribute: false, hasChanged: inputChanged },
    expressionOptions: { attribute: false },
    selection: { attribute: false },
    defaultSelection: { attribute: false },
    // the getter returns a copy, so the default identity check would see every set as a change
    currentSelection: {
      attribute: false,
      hasChanged: (value: unknown, previous: unknown) => !deepEqual(value, previous),
    },
    pendingActionId: { type: String, attribute: 'pending-action-id' },
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
    // [impl->req~density-attribute~1]
    // The accessor below is the class's own, so Lit reads it on the first update and would reflect
    // density="comfortable" onto every host; useDefault records that value as the default instead.
    density: { type: String, reflect: true, noAccessor: true, useDefault: true },
    loadingLabel: { type: String, attribute: 'loading-label' },
    onlyDifferences: { attribute: 'only-differences', converter: onlyDifferencesConverter },
    toolbarThreshold: { type: Number, attribute: 'toolbar-threshold' },
    addOnFilterThreshold: { type: Number, attribute: 'add-on-filter-threshold' },
    // [impl->req~hide-sections-property~1] a host that builds the array in its render function does
    // not re-render on every render
    hideSections: {
      attribute: 'hide-sections',
      converter: hideSectionsConverter,
      hasChanged: (value: unknown, previous: unknown) => !deepEqual(value, previous),
    },
  };

  static {
    // elementProperties is complete without defining the tag
    this.finalize();
  }

  declare pricing?: IPricingLike;
  declare yaml?: string;
  declare src?: string;
  declare request?: PricingRequestOptions;
  declare loadPricing?: PricingLoader;
  declare normalizeOptions?: NormalizePricingOptions;
  declare expressionOptions?: ExpressionOptions;
  declare selection?: PricingSelection;
  declare defaultSelection?: Partial<PricingSelection>;
  // [impl->req~cta-pending-property~1]
  declare pendingActionId?: string;
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
  declare onlyDifferences?: boolean;
  declare toolbarThreshold: number;
  // [impl->req~addon-grid-threshold-attribute~1]
  declare addOnFilterThreshold: number;
  // [impl->req~hide-sections-property~1]
  declare hideSections?: readonly PricingSectionName[];

  private _status: LoadStatus = 'idle';
  private readonly _projectPresentation: PricingPresentation;
  private _normalized?: NormalizedPricing;
  private _diagnostics: PricingDiagnostic[] = [];
  private _internalSelection?: PricingSelection;
  private _currentSelection?: Partial<PricingSelection>;
  // what the last current-selection diagnostics were computed for
  private _diagnosedSelection?: Partial<PricingSelection>;
  private _diagnosedPricing?: NormalizedPricing;
  private _compact = true;
  private _wide = false;
  private _search = '';
  // The checkbox state set by the user; it replaces the initial state until a reload or a change of
  // the onlyDifferences property.
  private _onlyDifferencesOverride?: boolean;
  private _expandedGroups = new Set<string>();
  private _revealedGroups = new Set<string>();
  private _addOnSearch = '';
  private _addOnsRevealed = false;
  private _pendingAddOnChange?: PendingAddOnChange;
  // [impl->req~breakdown-element-stabilized~1] [impl->req~breakdown-in-element~1]
  // [impl->req~element-subtotal-excludes-removed~1] every view model the element builds goes
  // through the stabilizer, which keeps the last valid prices and folds the subtotal from the
  // breakdown, so a removed add-on has no line and no share of the subtotal
  private readonly _priceStabilizer = createPriceStabilizer();
  private _resizeObserver?: ResizeObserver;
  private _abortController?: AbortController;
  private _loadSequence = 0;
  private _loadedOnce = false;
  private _reloadOnPropertyChange = false;
  private _previousFocus?: HTMLElement;
  private _breakdownOpen = false;
  // [impl->req~summary-breakdown-unique-ids~1] the element renders in light DOM, so ids are global
  private readonly _instanceNumber = ++breakdownPanelCount;
  private readonly _breakdownId = `pr-breakdown-${this._instanceNumber}`;
  // [impl->req~element-instance-ids~2] the prefix of every other id of this instance
  private readonly _idPrefix = `pr-${this._instanceNumber}`;

  constructor() {
    super();
    const configuration = getPricingRendererConfig();
    this.locale = configuration.locale;
    this.pricingPath = configuration.pricingPath;
    this.selectionEnabled = configuration.selectionEnabled;
    this.ctaEnabled = configuration.ctaEnabled;
    this.variablesEnabled = configuration.variablesEnabled;
    this._projectPresentation = configuration.presentation;
    this.mode = 'commercial';
    this.layout = 'auto';
    this.visibility = 'public-only';
    this.theme = 'light';
    this.toolbarThreshold = DEFAULT_TOOLBAR_THRESHOLD;
    this.addOnFilterThreshold = DEFAULT_ADDON_FILTER_THRESHOLD;
  }

  // Unset until the host sets it. Any value other than compact reads as comfortable; the stored
  // value is not validated.
  private _density: unknown;

  get density(): 'comfortable' | 'compact' {
    return this._density === 'compact' ? 'compact' : 'comfortable';
  }

  set density(value: unknown) {
    // The old value is the one read back: Lit takes the first old value as the default that a
    // removed attribute restores, and it must be comfortable.
    const previous = this.density;
    const wasSet = this._density !== undefined && this._density !== null;
    this._density = value;
    // Unsetting, for example a React prop that becomes undefined, removes the attribute instead of
    // reflecting density="comfortable". A value set and unset before the same update is still
    // reflected, as comfortable.
    if (value === undefined || value === null) {
      if (wasSet) this.removeAttribute('density');
      return;
    }
    this.requestUpdate('density', previous);
  }

  // [impl->req~current-selection-property~1] [impl->req~current-selection-detached~1]
  // The element keeps a deep copy, so a later change of the host's object is not seen until the
  // host sets the property again, and the getter returns a copy, so a change of what it returns is
  // not seen either. An equal value keeps the stored copy: a host that assigns its props on every
  // render does not report the diagnostics again. It never becomes the selection in effect, so
  // setting it emits no `pricing-selection-change` [impl->req~current-selection-keeps-selection~1].
  get currentSelection(): Partial<PricingSelection> | undefined {
    return cloneValue(this._currentSelection);
  }

  set currentSelection(value: Partial<PricingSelection> | undefined) {
    if (deepEqual(value, this._currentSelection)) return;
    this._currentSelection = cloneValue(value);
  }

  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('data-pr-root', '');
    this.addEventListener('keydown', this._handleDialogKeyboard);
    if (this.hasUpdated) this._resumeAfterReconnect();
  }

  disconnectedCallback(): void {
    this._resizeObserver?.disconnect();
    this._abortController?.abort();
    this.removeEventListener('keydown', this._handleDialogKeyboard);
    super.disconnectedCallback();
  }

  // [impl->req~element-reconnect-resumes~1]
  // The disconnect stopped the observer and aborted the load in flight; an aborted load is dropped
  // without a result, so a status still `loading` would never end. A ready or failed element keeps
  // what it shows.
  private _resumeAfterReconnect(): void {
    this._observeSize();
    if (this._status === 'loading') void this.reload();
  }

  // Observes the size of the element with a new observer and measures its width once.
  private _observeSize(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? this.getBoundingClientRect().width;
        this._updateCompactLayout(width);
      });
      this._resizeObserver.observe(this);
    }
    this._updateCompactLayout(this.getBoundingClientRect().width);
  }

  protected firstUpdated(): void {
    this._observeSize();
    void this.reload();
    queueMicrotask(() => {
      this._reloadOnPropertyChange = true;
    });
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('onlyDifferences')) this._onlyDifferencesOverride = undefined;
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
    this._reportCurrentSelection();
  }

  // [impl->req~current-selection-diagnostics~1]
  // Once per change of the current selection or of the loaded pricing; not in the rendered list.
  private _reportCurrentSelection(): void {
    if (!this._isReady()) return;
    if (
      this._diagnosedSelection === this._currentSelection &&
      this._diagnosedPricing === this._normalized
    ) {
      return;
    }
    this._diagnosedSelection = this._currentSelection;
    this._diagnosedPricing = this._normalized;
    this._dispatchSelectionDiagnostics(
      currentSelectionDiagnostics(this._normalized!, this._currentSelection),
    );
  }

  public async reload(): Promise<void> {
    this._loadedOnce = true;
    const input = {
      ...(this.pricing !== undefined ? { pricing: this.pricing } : {}),
      ...(this.yaml !== undefined ? { yaml: this.yaml } : {}),
      ...(this.src !== undefined ? { src: this.src } : {}),
    };

    const sourceError = pricingSourceError(input);
    if (sourceError) {
      // [impl->req~reload-source-error-cancels-load~1] the load in flight must neither finish nor be
      // applied after this error
      this._abortController?.abort();
      this._abortController = undefined;
      this._loadSequence += 1;
      this._applyLoadResult(sourceError);
      return;
    }

    this._abortController?.abort();
    const controller = new AbortController();
    this._abortController = controller;
    const sequence = ++this._loadSequence;
    this._status = 'loading';
    this.requestUpdate();

    let result = loadPricingSource(input, {
      ...(this.request ? { request: this.request } : {}),
      ...(this.loadPricing ? { loadPricing: this.loadPricing } : {}),
      ...(this.normalizeOptions ? { normalizeOptions: this.normalizeOptions } : {}),
      signal: controller.signal,
    });
    if (result instanceof Promise) {
      result = await result;
    }
    if (sequence !== this._loadSequence || controller.signal.aborted) {
      return;
    }
    this._applyLoadResult(result);
  }

  // [impl->req~resolved-state-not-ready~1] [impl->req~resolved-state-snapshot~1]
  // [impl->req~resolved-state-detached~1] [impl->req~resolved-state-controlled~1]
  // [impl->req~resolved-state-read-only~1] [impl->req~react-ref-load-api~1]
  public get resolvedState(): PricingSelectionChangeDetail | undefined {
    return this._snapshot();
  }

  // [impl->req~apply-selection-replaces~1] [impl->req~apply-selection-result~1]
  // [impl->req~react-ref-load-api~1]
  public applySelection(selection: Partial<PricingSelection>): ApplySelectionResult {
    // [impl->req~apply-selection-not-ready~1] [impl->req~apply-selection-refusal-keeps-state~1]
    if (!this._isReady()) {
      return this._refuseSelection(undefined, {
        code: 'PR_SELECTION_NOT_READY',
        severity: 'error',
        message: 'The pricing is not ready; applySelection was ignored.',
      });
    }
    // [impl->req~apply-selection-controlled~1]
    if (this.selection !== undefined) {
      return this._refuseSelection(this._snapshot(), {
        code: 'PR_SELECTION_CONTROLLED',
        severity: 'error',
        message: 'The selection property is set; applySelection was ignored.',
      });
    }
    // [impl->req~apply-selection-uses-selection-in-effect~1] [impl->req~apply-selection-input-unmutated~1]
    // [impl->req~apply-selection-input-detached~1]
    const { removedAddOnIds, diagnostics, ...next } = applySelectionInput(
      this._normalized!,
      this._selectionInEffect()!,
      cloneValue(selection),
    );
    // [impl->req~apply-selection-silent~1] [impl->req~apply-selection-no-dialog~1]
    this._internalSelection = next.selection;
    // [impl->req~apply-selection-discards-pending~1]
    if (this._pendingAddOnChange) this._cancelAddOnChange();
    this.requestUpdate();
    const state = this._snapshot()!;
    const result: ApplySelectionResult = {
      applied: true,
      selection: state.selection,
      resolved: state.resolved,
      removedAddOnIds,
      diagnostics,
    };
    this._dispatchSelectionDiagnostics(diagnostics);
    return result;
  }

  private _isReady(): boolean {
    return this._status === 'ready' && this._normalized !== undefined;
  }

  private _selectionInEffect(): PricingSelection | undefined {
    const selection = this._effectiveSelection();
    if (!selection || !this._normalized) return selection;
    return reconcileSelection(this._normalized, selection).selection;
  }

  private _snapshot(): PricingSelectionChangeDetail | undefined {
    if (!this._isReady()) return undefined;
    const selection = this._selectionInEffect();
    if (!selection) return undefined;
    const { resolved } = this._priceStabilizer.stabilize(
      createPricingViewModel(this._normalized!, selection, { ...this._viewModelOptions() }),
    );
    return cloneValue({ selection, resolved });
  }

  private _refuseSelection(
    state: PricingSelectionChangeDetail | undefined,
    diagnostic: PricingDiagnostic,
  ): ApplySelectionResult {
    const result: ApplySelectionResult = {
      applied: false,
      selection: state?.selection,
      resolved: state?.resolved,
      removedAddOnIds: [],
      diagnostics: [diagnostic],
    };
    this._dispatchSelectionDiagnostics(result.diagnostics);
    return result;
  }

  // [impl->req~apply-selection-diagnostic-event~1] [impl->req~apply-selection-no-empty-diagnostic~1]
  // [impl->req~apply-selection-diagnostics-not-rendered~1] the rendered list is left unchanged
  private _dispatchSelectionDiagnostics(diagnostics: PricingDiagnostic[]): void {
    if (diagnostics.length === 0) return;
    this.dispatchEvent(
      new CustomEvent<PricingDiagnosticDetail>('pricing-diagnostic', {
        detail: { diagnostics: cloneValue(diagnostics) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _applyLoadResult(result: PricingResult<NormalizedPricing>): void {
    this._diagnostics = result.diagnostics;
    if (result.value) {
      this._normalized = result.value;
      this._priceStabilizer.reset();
      // [impl->req~default-selection-reconciled~1] [impl->req~apply-selection-reload-restarts~1]
      this._internalSelection = reconcileSelection(
        result.value,
        mergeSelection(result.value, this.defaultSelection),
      ).selection;
      this._expandedGroups = new Set();
      // [impl->req~addon-grid-cap~1] the add-on search and reveal state start over with a new pricing
      this._addOnSearch = '';
      this._addOnsRevealed = false;
      this._onlyDifferencesOverride = undefined;
      this._pendingAddOnChange = undefined;
      this._previousFocus = undefined;
      // [impl->req~summary-breakdown-closes-on-load~1]
      this._breakdownOpen = false;
      const viewModel = createPricingViewModel(
        result.value,
        this._effectiveSelection(),
        this._viewModelOptions(),
      );
      if (viewModel.comparisonGroups[0]) {
        this._expandedGroups.add(viewModel.comparisonGroups[0].id);
      }
      this._status = 'ready';
      // [impl->req~ready-detail-selection~1] [impl->req~apply-selection-in-ready-listener~1]
      // Ready state and internal selection are set before the dispatch and not assigned after it,
      // so a listener's applySelection call stays in effect for this load.
      this.dispatchEvent(
        new CustomEvent<PricingReadyDetail>('pricing-ready', {
          detail: { pricing: result.value, diagnostics: result.diagnostics, ...this._snapshot()! },
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

  // [impl->req~core-selection-in-effect~1] the core treats only `false` as off, the element any
  // falsy value
  private _effectiveSelection(): PricingSelection | undefined {
    const selection = this.selection ?? this._internalSelection;
    if (!selection || !this._normalized) return selection;
    return selectionInEffect(this._normalized, selection, {
      variablesEnabled: Boolean(this.variablesEnabled),
    });
  }

  private _viewModelOptions(): ViewModelOptions {
    return {
      locale: this.locale,
      mode: this.mode,
      visibility: this.visibility,
      ...(this.messages ? { messages: this.messages } : {}),
      presentation: mergePresentationOptions(this._projectPresentation, this.presentation),
      ...(this.expressionOptions ? { expression: this.expressionOptions } : {}),
    };
  }

  private _viewModel(): PricingViewModel | undefined {
    if (!this._normalized) return undefined;
    return this._priceStabilizer.stabilize(
      createPricingViewModel(this._normalized, this._effectiveSelection(), {
        ...this._viewModelOptions(),
      }),
    );
  }

  // [impl->req~cta-summary-action~1] the relation between the current side and the selection in
  // effect, both on the loaded pricing
  private _summaryAction(
    viewModel: PricingViewModel,
    pricing: NormalizedPricing,
  ): SummaryActionState {
    const { relation } = compareSelections({
      before: { pricing, selection: this._currentSelection! },
      after: { pricing, selection: viewModel.resolved.selection },
      ...(this.expressionOptions ? { expression: this.expressionOptions } : {}),
    });
    return summaryActionState(viewModel, relation);
  }

  private _updateCompactLayout(width: number): void {
    const next = this.layout === 'compact' ? true : this.layout === 'table' ? false : width < 840;
    const wide = width >= 840;
    if (next !== this._compact || wide !== this._wide) {
      this._compact = next;
      this._wide = wide;
      this.requestUpdate();
    }
  }

  private _setSelection(input: PricingSelection): void {
    // [impl->req~events-reconciled-selection~1] [impl->req~controlled-selection-untouched~1]
    const next = this._normalized ? reconcileSelection(this._normalized, input).selection : input;
    if (this.selection === undefined) {
      this._internalSelection = next;
    }
    const resolved = this._normalized
      ? this._priceStabilizer.stabilize(
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

  // [impl->req~core-plan-change-immediate~1] [impl->req~core-plan-change-pending~1]
  private _selectPlan = (planId: string): void => {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    const change = planSelectionChange(this._normalized, selection, { type: 'plan', planId });
    if (change.kind === 'apply') {
      // [impl->req~plan-change-immediate~1]
      this._setSelection(change.selection);
      return;
    }
    // [impl->req~plan-change-confirmation~1] [impl->req~pending-plan-change-shape~1]
    this._openChangeDialog(change.pending);
  };

  // Keeps the focused element for the cancel and confirm paths, then focuses the dialog's default
  // button once it is rendered.
  private _openChangeDialog(pending: PendingAddOnChange): void {
    this._pendingAddOnChange = pending;
    this._previousFocus =
      this.ownerDocument.activeElement instanceof HTMLElement
        ? this.ownerDocument.activeElement
        : undefined;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      this.querySelector<HTMLElement>('.pr-dialog button[autofocus]')?.focus();
    });
  }

  private _selectBilling = (billingPeriod: string): void => {
    const selection = this._effectiveSelection();
    if (!selection) return;
    this._setSelection({ ...selection, billingPeriod });
  };

  // [impl->req~core-selection-with-variable~1]
  private _updateVariable = (path: string, value: unknown): void => {
    const selection = this._effectiveSelection();
    if (!selection) return;
    this._setSelection(selectionWithVariable(selection, path, value));
  };

  private _resetVariables = (): void => {
    const selection = this._effectiveSelection();
    if (!selection || !this._normalized) return;
    this._setSelection({ ...selection, variables: cloneValue(this._normalized.variables) });
  };

  // [impl->req~core-addon-select-change~1] [impl->req~core-addon-deselect-change~1]
  // [impl->req~core-addon-change-direct~1] the dependencies to add are the transitive closure of
  // dependsOn, so a two-level chain is added whole
  private _toggleAddOn = (addOnId: string, selected: boolean): void => {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    // an unknown add-on changes nothing and dispatches no event
    if (!this._normalized.addOns.some((candidate) => candidate.id === addOnId)) return;

    const change = planSelectionChange(this._normalized, selection, {
      type: 'addOn',
      addOnId,
      selected,
    });
    if (change.kind === 'confirm') {
      this._openChangeDialog(change.pending);
      return;
    }
    this._pendingAddOnChange = undefined;
    this._setSelection(change.selection);
    void this.updateComplete.then(() => this._restoreDialogFocus());
  };

  // [impl->req~core-apply-selection-change~1]
  private _applyAddOnChange(change: PendingAddOnChange): void {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    // [impl->req~plan-change-apply~1]
    const next = applySelectionChange(this._normalized, selection, change);
    this._pendingAddOnChange = undefined;
    this._setSelection(next);
    void this.updateComplete.then(() => this._restoreDialogFocus());
  }

  // [impl->req~core-selection-with-addon-quantity~1]
  private _updateAddOnQuantity = (addOnId: string, quantity: number): void => {
    if (!this._normalized) return;
    const selection = this._effectiveSelection();
    if (!selection) return;
    this._setSelection(selectionWithAddOnQuantity(this._normalized, selection, addOnId, quantity));
  };

  private _confirmAddOnChange = (): void => {
    if (this._pendingAddOnChange) {
      this._applyAddOnChange(this._pendingAddOnChange);
    }
  };

  // [impl->req~plan-change-cancel~1]
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
    origin?: ActionOrigin,
  ): boolean => {
    // [impl->req~cta-pending-no-event~1] a link CTA sees `false` and cancels its navigation
    if (this.pendingActionId) return false;
    const current = this._viewModel();
    if (!current || !this._normalized) return false;
    // [impl->req~events-reconciled-selection~1]
    const reconciled = reconcileSelection(this._normalized, current.resolved.selection).selection;
    const viewModel = this._priceStabilizer.stabilize(
      createPricingViewModel(this._normalized, reconciled, { ...this._viewModelOptions() }),
    );
    const detail: PricingActionDetail = {
      actionId,
      ...(planId ? { planId } : {}),
      ...(href ? { href } : {}),
      selection: reconciled,
      resolved: viewModel.resolved,
      ...(metadata ? { metadata } : {}),
      // [impl->req~cta-event-relation~1] [impl->req~cta-summary-action-event~1]
      ...(origin ? { relation: origin.relation, source: origin.source } : {}),
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

  // [impl->req~reveal-focus-comparison~1] focus moves to the first row the reveal adds
  private _revealGroup = (groupId: string, origin?: HTMLElement, byKeyboard = false): void => {
    const container = origin?.closest('tbody, .pr-comparison-group') ?? undefined;
    const before = container?.querySelectorAll(comparisonRowSelector).length ?? 0;
    this._revealedGroups = new Set([...this._revealedGroups, groupId]);
    this.requestUpdate();
    if (!container) return;
    void this.updateComplete.then(() => {
      const rows = container.querySelectorAll<HTMLElement>(comparisonRowSelector);
      if (rows.length > before) this._focusRevealed(rows[before]!, byKeyboard);
    });
  };

  private _focusRevealed(target: HTMLElement, byKeyboard: boolean): void {
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      // the attribute is only a focus aid for the reveal, so it goes away on blur
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    // Firefox keeps the cause of the earlier mouse click on the removed button and then skips
    // :focus-visible for a script focus, so a keyboard activation asks for it explicitly.
    // lib.dom has no focusVisible member in FocusOptions yet.
    if (byKeyboard)
      target.focus({ focusVisible: true } as FocusOptions & { focusVisible: boolean });
    else target.focus();
  }

  // [impl->req~summary-breakdown-stays-open~1] no selection change resets the open state
  private _toggleBreakdown = (): void => {
    this._breakdownOpen = !this._breakdownOpen;
    this.requestUpdate();
  };

  // [impl->req~summary-breakdown-escape~1] [impl->req~summary-breakdown-escape-scope~1]
  // Escape closes the panel only from the toggle or from inside the panel; the dialog, which makes
  // the rest inert, keeps its own Escape handling and leaves the panel as it is.
  private _closeBreakdownOnEscape(event: KeyboardEvent): void {
    if (!this._breakdownOpen || event.key !== 'Escape') return;
    const target = event.target instanceof Element ? event.target : undefined;
    const origin = target?.closest(`${breakdownToggleSelector}, ${breakdownPanelSelector}`);
    if (!origin || !this.contains(origin)) return;
    event.preventDefault();
    this._breakdownOpen = false;
    this.querySelector<HTMLElement>(breakdownToggleSelector)?.focus();
    this.requestUpdate();
  }

  private _handleDialogKeyboard = (event: KeyboardEvent): void => {
    if (!this._pendingAddOnChange) {
      this._closeBreakdownOnEscape(event);
      return;
    }
    if (event.key === 'Escape') {
      // [impl->req~plan-change-cancel~1]
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
      this._onlyDifferencesOverride = value;
      this.requestUpdate();
    },
    toggleGroup: this._toggleGroup,
    setAllGroups: this._setAllGroups,
    revealGroup: this._revealGroup,
    updateAddOnSearch: (value) => {
      this._addOnSearch = value;
      this.requestUpdate();
    },
    // [impl->req~reveal-focus-addons~1] focus moves to the first add-on card the reveal adds
    revealAddOns: (byKeyboard = false) => {
      const shown = (): HTMLElement[] => [...this.querySelectorAll<HTMLElement>(addOnCardSelector)];
      const before = new Set(shown().map((card) => card.dataset.addOnId));
      this._addOnsRevealed = true;
      this.requestUpdate();
      void this.updateComplete.then(() => {
        const added = shown().find((card) => !before.has(card.dataset.addOnId));
        if (added) this._focusRevealed(added, byKeyboard);
      });
    },
    confirmAddOnChange: this._confirmAddOnChange,
    cancelAddOnChange: this._cancelAddOnChange,
    toggleBreakdown: this._toggleBreakdown,
  };

  protected render(): TemplateResult {
    if (this._status === 'loading' || this._status === 'idle') {
      const loadingTitleId = `${this._idPrefix}-loading-title`;
      // [impl->req~loading-label-localized~1]
      const loadingLabel =
        this.loadingLabel ?? translate(getMessages(this.locale, this.messages), 'pricing.loading');
      return html`
        <section class="pr-shell pr-shell--loading" aria-labelledby=${loadingTitleId}>
          <h2 id=${loadingTitleId} class="pr-sr-only">${loadingLabel}</h2>
          <div class="pr-skeleton" role="status" aria-live="polite">
            <span>${loadingLabel}</span>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </section>
      `;
    }
    if (!this._normalized || this._status === 'error') {
      const messages = getMessages(this.locale, this.messages);
      // [impl->req~error-state-human-message~1] the codes and messages stay inside a closed details
      return html`
        <section class="pr-shell pr-error" role="alert">
          <h2>${translate(messages, 'pricing.error')}</h2>
          <p>${translate(messages, errorMessageKey(this._diagnostics))}</p>
          <details class="pr-diagnostics" data-pr-part="diagnostics">
            <summary>${translate(messages, 'pricing.errorDetails')}</summary>
            <ul>
              ${this._diagnostics.map(
                (item) =>
                  html`<li>
                    <strong>${item.code}</strong>:
                    ${item.message}${item.path ? ` (${item.path})` : ''}
                  </li>`,
              )}
            </ul>
          </details>
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
    const toolbarThreshold = toolbarThresholdOf(this.toolbarThreshold);
    // Without a toolbar the user cannot undo a filter, so the search text and the checkbox override
    // are ignored while it is hidden (the stored values are kept).
    const toolbarShown = comparisonRowTotal(viewModel) > toolbarThreshold;
    // [impl->req~shorter-page-only-differences~2] a forced value is ignored without the toolbar,
    // because no checkbox exists to undo it
    const initialOnlyDifferences =
      this._onlyDifferencesOverride ??
      resolveOnlyDifferences(viewModel, this.onlyDifferences, toolbarThreshold);
    // [impl->req~current-selection-private-plan~1] the pricing, not the visible plans, defines it
    const current = deriveCurrentContext(this._normalized, this._currentSelection);
    const hidden = hiddenSectionsOf(this.hideSections);
    const state: RenderState = {
      viewModel,
      ...(hidden.size > 0 ? { hiddenSections: hidden } : {}),
      selection: viewModel.resolved.selection,
      compact: this._compact,
      search: toolbarShown ? this._search : '',
      onlyDifferences: toolbarShown && initialOnlyDifferences,
      toolbarThreshold,
      selectionEnabled: this.selectionEnabled,
      ctaEnabled: this.ctaEnabled,
      variablesEnabled: this.variablesEnabled,
      expandedGroups: this._expandedGroups,
      revealedGroups: this._revealedGroups,
      addOnSearch: this._addOnSearch,
      addOnsRevealed: this._addOnsRevealed,
      addOnFilterThreshold: addOnFilterThresholdOf(this.addOnFilterThreshold),
      ...(this._pendingAddOnChange ? { pendingAddOnChange: this._pendingAddOnChange } : {}),
      breakdownOpen: this._breakdownOpen,
      breakdownId: this._breakdownId,
      idPrefix: this._idPrefix,
      ...(current ? { currentPlanId: current.planId, currentAddOnIds: current.addOnIds } : {}),
      ...(this.pendingActionId ? { pendingActionId: this.pendingActionId } : {}),
      ...(current && this.ctaEnabled
        ? { summaryAction: this._summaryAction(viewModel, this._normalized) }
        : {}),
      actions: this._actions,
    };
    const warnings = this._diagnostics.filter((item) => item.severity !== 'info');
    return html`
      <section class="pr-shell" aria-labelledby=${instanceId(state, 'title')}>
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
          ${
            // [impl->req~hide-sections-render~1] [impl->req~hide-sections-hero-name~1]
            // the shell stays labelled by the title when the hero is hidden
            hidden.has('hero')
              ? html`<h2 class="pr-sr-only" id=${instanceId(state, 'title')}>
                  ${heroTitle(viewModel)}
                </h2>`
              : renderHeader(state)
          }
          ${hidden.has('metadata') ? nothing : renderCatalogMetadata(state)}
          ${hidden.has('billing') ? nothing : renderBilling(state)}
          ${hidden.has('variables') ? nothing : renderVariables(state)}
          ${hidden.has('plans') ? nothing : renderPlans(state)}
          ${renderAfterPlans(state, this._wide)}
        </div>
        ${renderPendingDialog(state)}
        <p class="pr-sr-only" aria-live="polite">
          ${translate(viewModel.messages, 'pricing.configurationUpdated')}
        </p>
      </section>
    `;
  }
}
