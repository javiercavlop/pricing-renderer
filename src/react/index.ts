'use client';

import { createComponent, type EventName } from '@lit/react';
import * as React from 'react';
import { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { mergePresentationOptions } from '../core/index.js';
import {
  PricingRendererContext,
  filterProviderRequest,
  type PricingRendererContextValue,
} from './provider.js';
import {
  acceptedSlotNodes,
  currentSlotNodes,
  slotEntriesOf,
  slotNamesOf,
  type SlotEntry,
} from './slots.js';
import type {
  PricingErrorContext,
  PricingPlanCtaContext,
  PricingSummaryActionsContext,
} from './slots-types.js';
import type {
  IPricingLike,
  ExpressionOptions,
  MessageCatalog,
  NormalizePricingOptions,
  PricingLayout,
  PricingMode,
  PricingPresentation,
  PricingSelection,
  PricingVisibility,
  SelectionComparison,
  PricingDiagnosticsMode,
} from '../core/index.js';
import {
  PricingChangeReviewElement,
  PricingRendererElement,
  definePricingChangeReview,
  type PricingActionEvent,
  type PricingChangeBackEvent,
  type PricingChangeConfirmEvent,
  type PricingDiagnosticEvent,
  type PricingReadyEvent,
  type PricingSectionName,
  type PricingSelectionChangeEvent,
  type PricingSlotsChangeEvent,
} from '../element/index.js';
import '../element/define.js';
import type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';

// The server HTML of the host is an empty tag, while the element renders its light DOM on the
// client in a microtask. An empty innerHTML makes React treat the children as text content: it
// neither hydrates nor deletes them, so hydrating after the element rendered is no mismatch. React
// compares the dangerouslySetInnerHTML object by identity, so each component keeps one object for
// its life (a new one per render would clear the element on every update). Not a public prop. A
// function, not a module-level object: this module holds no shared state.
function opaqueHostProps() {
  return {
    dangerouslySetInnerHTML: { __html: '' },
    suppressHydrationWarning: true,
  } as const;
}

const PricingRendererBase = createComponent({
  tagName: 'pricing-renderer',
  elementClass: PricingRendererElement,
  react: React,
  events: {
    onReady: 'pricing-ready' as EventName<PricingReadyEvent>,
    onSelectionChange: 'pricing-selection-change' as EventName<PricingSelectionChangeEvent>,
    onAction: 'pricing-action' as EventName<PricingActionEvent>,
    onDiagnostic: 'pricing-diagnostic' as EventName<PricingDiagnosticEvent>,
    // set by the wrapper itself, not a public prop
    onSlotsChange: 'pricing-slots-change' as EventName<PricingSlotsChangeEvent>,
  },
});

type PricingInputProps =
  | {
      pricing: IPricingLike;
      yaml?: never;
      src?: never;
      request?: never;
      loadPricing?: never;
    }
  | {
      yaml: string;
      pricing?: never;
      src?: never;
      request?: never;
      loadPricing?: never;
    }
  | {
      src: string;
      pricing?: never;
      yaml?: never;
      request?: PricingRequestOptions;
      loadPricing?: PricingLoader;
    };

export interface PricingRendererSharedProps {
  selection?: PricingSelection;
  defaultSelection?: Partial<PricingSelection>;
  // The customer's contract; marks the current plan.
  currentSelection?: Partial<PricingSelection>;
  // Action id of the CTA whose host work is pending.
  pendingActionId?: string;
  presentation?: PricingPresentation;
  normalizeOptions?: NormalizePricingOptions;
  expressionOptions?: ExpressionOptions;
  locale?: string;
  pricingPath?: string;
  selectionEnabled?: boolean;
  ctaEnabled?: boolean;
  variablesEnabled?: boolean;
  messages?: MessageCatalog;
  mode?: PricingMode;
  layout?: PricingLayout;
  visibility?: PricingVisibility;
  theme?: 'light' | 'dark' | 'auto';
  // Which diagnostics reach the page; every one still reaches onDiagnostic. Default 'auto'.
  diagnostics?: PricingDiagnosticsMode;
  density?: 'comfortable' | 'compact';
  loadingLabel?: string;
  // Absent is automatic, `false` is off, `true` is on.
  onlyDifferences?: boolean;
  // Number of comparison rows above which the comparison toolbar is shown.
  toolbarThreshold?: number;
  // Number of add-ons above which the add-on search and "Show more" are shown.
  addOnFilterThreshold?: number;
  // Sections that are not rendered.
  hideSections?: readonly PricingSectionName[];
  className?: string;
  // CSS properties plus custom properties such as `--pr-color-accent`
  style?: PricingRendererStyle;
  id?: string;
  'aria-label'?: string;
  // Each one fills the element's slot of that name. They are
  // called on the client only, after the element has rendered the slot node.
  /**
   * Replaces the built-in CTA of every plan card. The context strings (planName, label) may carry
   * text from the pricing document: render them as text, never through an HTML sink such as
   * dangerouslySetInnerHTML.
   */
  renderPlanCta?: (context: PricingPlanCtaContext) => React.ReactNode;
  /**
   * Replaces the built-in action of the summary. Any text taken from the context is plain text:
   * render it as text, never through an HTML sink.
   */
  renderSummaryActions?: (context: PricingSummaryActionsContext) => React.ReactNode;
  /** Replaces the content of the loading state. */
  renderLoading?: () => React.ReactNode;
  /**
   * Replaces the content of the error state. The diagnostic messages may carry text from the
   * pricing document: render them as text, never through an HTML sink such as
   * dangerouslySetInnerHTML.
   */
  renderError?: (context: PricingErrorContext) => React.ReactNode;
  onReady?: (event: PricingReadyEvent) => void;
  onSelectionChange?: (event: PricingSelectionChangeEvent) => void;
  onAction?: (event: PricingActionEvent) => void;
  onDiagnostic?: (event: PricingDiagnosticEvent) => void;
}

export type PricingRendererStyle = React.CSSProperties & {
  [property: `--${string}`]: string | number | undefined;
};

export type PricingRendererProps = PricingInputProps & PricingRendererSharedProps;

// Instance props win over the nearest provider, which wins over the global configuration (the
// element reads that one). Without a provider the props pass through unchanged.
function applyProvider(
  props: PricingRendererProps,
  provider: PricingRendererContextValue | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...props };
  if (provider === undefined) return merged;
  const providerConfigKeys = [
    'locale',
    'pricingPath',
    'selectionEnabled',
    'ctaEnabled',
    'variablesEnabled',
  ] as const;
  for (const key of providerConfigKeys) {
    const value = provider.config?.[key];
    if (merged[key] === undefined && value !== undefined) merged[key] = value;
  }
  const layers = [provider.config?.presentation, provider.presentation, props.presentation];
  if (layers.some((layer) => layer !== undefined)) {
    merged.presentation = mergePresentationOptions(
      mergePresentationOptions(layers[0], layers[1]),
      layers[2],
    );
  }
  if (provider.messages !== undefined) {
    merged.messages = { ...provider.messages, ...props.messages };
  }
  if (props.src === undefined) return merged;
  const loadPricing = props.loadPricing ?? provider.loadPricing;
  if (loadPricing !== undefined) merged.loadPricing = loadPricing;
  const request =
    props.request ?? filterProviderRequest(provider.request, props.src, provider.requestOrigins);
  if (request !== undefined) merged.request = request;
  return merged;
}

const useClientLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// The output of the render prop for one slot node, in a portal keyed as the entry says. A node that
// is no longer connected gets none.
function portalOf(props: PricingRendererProps, entry: SlotEntry): React.ReactPortal | null {
  if (!entry.node.isConnected) return null;
  switch (entry.slot) {
    case 'plan-cta':
      return typeof props.renderPlanCta === 'function'
        ? createPortal(props.renderPlanCta(entry.context), entry.node, entry.key)
        : null;
    case 'summary-actions':
      return typeof props.renderSummaryActions === 'function'
        ? createPortal(props.renderSummaryActions(entry.context), entry.node, entry.key)
        : null;
    case 'loading':
      return typeof props.renderLoading === 'function'
        ? createPortal(props.renderLoading(), entry.node, entry.key)
        : null;
    case 'error':
      return typeof props.renderError === 'function'
        ? createPortal(props.renderError(entry.context), entry.node, entry.key)
        : null;
  }
}

// The root of the wrapper stays one Fragment whose first child is the element, so portals appearing
// or disappearing never remount it.
export const PricingRenderer = React.forwardRef<PricingRendererElement, PricingRendererProps>(
  (props, ref) => {
    const baseProps = applyProvider(props, React.useContext(PricingRendererContext));
    delete baseProps.renderPlanCta;
    delete baseProps.renderSummaryActions;
    delete baseProps.renderLoading;
    delete baseProps.renderError;
    // A new array with the same names would set `slots` again on every render.
    const slotNames = slotNamesOf(props);
    const slotsKey = slotNames?.join(',');
    const slots = React.useMemo(() => slotNames, [slotsKey]);
    if (slots !== undefined) baseProps.slots = slots;

    // Entries exist only after the first effect, so the server render and the first client render
    // call no render prop and hold no portal.
    const [hostProps] = React.useState(opaqueHostProps);
    const elementRef = React.useRef<PricingRendererElement | null>(null);
    const [entries, setEntries] = React.useState<readonly SlotEntry[]>([]);
    const setElement = React.useCallback(
      (node: PricingRendererElement | null) => {
        elementRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref !== null) ref.current = node;
      },
      [ref],
    );
    const onSlotsChange = React.useCallback((event: PricingSlotsChangeEvent) => {
      const element = elementRef.current;
      if (element === null) return;
      const nodes = acceptedSlotNodes(element, event);
      if (nodes !== undefined) setEntries(slotEntriesOf(element, nodes, element.resolvedState));
    }, []);
    // The listener of the events map is set by the element's own layout effect, which runs before
    // this one; nodes rendered before it existed are read here.
    useClientLayoutEffect(() => {
      const element = elementRef.current;
      if (element === null) return;
      const nodes = currentSlotNodes(element);
      if (nodes.length > 0) setEntries(slotEntriesOf(element, nodes, element.resolvedState));
    }, []);

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(PricingRendererBase, {
        ...baseProps,
        ...hostProps,
        // Always attached: the element sends no event without slots, and the empty event that
        // follows the last render prop clears the stale entries.
        onSlotsChange,
        ref: setElement,
      }),
      entries.map((entry) => portalOf(props, entry)),
    );
  },
);

PricingRenderer.displayName = 'PricingRenderer';

const PricingChangeReviewBase = createComponent({
  tagName: 'pricing-change-review',
  elementClass: PricingChangeReviewElement,
  react: React,
  events: {
    onConfirm: 'pricing-change-confirm' as EventName<PricingChangeConfirmEvent>,
    onBack: 'pricing-change-back' as EventName<PricingChangeBackEvent>,
  },
});

export interface PricingChangeReviewProps {
  comparison?: SelectionComparison;
  notices?: string[];
  pending?: boolean;
  error?: string;
  locale?: string;
  messages?: MessageCatalog;
  confirmLabel?: string;
  className?: string;
  id?: string;
  onConfirm?: (event: PricingChangeConfirmEvent) => void;
  onBack?: (event: PricingChangeBackEvent) => void;
}

// The tag is registered when the component renders (a no-op without a registry), so a React host
// needs no extra import and apps that never render the component never register the tag.
export const PricingChangeReview = React.forwardRef<
  PricingChangeReviewElement,
  PricingChangeReviewProps
>((props, ref) => {
  definePricingChangeReview();
  const [hostProps] = React.useState(opaqueHostProps);
  return React.createElement(PricingChangeReviewBase, {
    ...props,
    ...hostProps,
    ref,
  });
});

PricingChangeReview.displayName = 'PricingChangeReview';

export { PricingChangeReviewElement, PricingRendererElement };
export {
  PricingRendererProvider,
  usePricingRendererState,
  usePricingSelection,
  usePricingSource,
} from './headless.js';
export type {
  PricingRendererProviderProps,
  PricingSourceSnapshot,
  PricingSourceStatus,
  RendererState,
  UsePricingSelectionChange,
  UsePricingSelectionOptions,
  UsePricingSelectionResult,
  UsePricingSourceProps,
  UsePricingSourceResult,
} from './headless.js';
export type {
  ApplySelectionResult,
  PricingActionDetail,
  PricingActionEvent,
  PricingChangeBackDetail,
  PricingChangeBackEvent,
  PricingChangeConfirmDetail,
  PricingChangeConfirmEvent,
  PricingDiagnosticDetail,
  PricingDiagnosticEvent,
  PricingReadyDetail,
  PricingReadyEvent,
  PricingSelectionChangeDetail,
  PricingSelectionChangeEvent,
  PricingSectionName,
  PricingSlotName,
  PricingSlotsChangeDetail,
  PricingSlotsChangeEvent,
} from '../element/index.js';
export type {
  PricingErrorContext,
  PricingPlanCtaContext,
  PricingSummaryActionsContext,
} from './slots-types.js';
export type { SelectionRelation } from '../core/index.js';
export type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';
