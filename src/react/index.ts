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

const PricingRendererBase = createComponent({
  tagName: 'pricing-renderer',
  elementClass: PricingRendererElement,
  react: React,
  events: {
    onReady: 'pricing-ready' as EventName<PricingReadyEvent>,
    onSelectionChange: 'pricing-selection-change' as EventName<PricingSelectionChangeEvent>,
    onAction: 'pricing-action' as EventName<PricingActionEvent>,
    onDiagnostic: 'pricing-diagnostic' as EventName<PricingDiagnosticEvent>,
    // [impl->req~react-slots-attach-read~1] set by the wrapper itself, not a public prop
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
  // [impl->req~current-selection-react~1] The customer's contract; marks the current plan.
  currentSelection?: Partial<PricingSelection>;
  // [impl->req~cta-pending-react-manifest~1] Action id of the CTA whose host work is pending.
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
  // [impl->req~density-react~1]
  density?: 'comfortable' | 'compact';
  loadingLabel?: string;
  // Absent is automatic, `false` is off, `true` is on.
  onlyDifferences?: boolean;
  // Number of comparison rows above which the comparison toolbar is shown.
  toolbarThreshold?: number;
  // Number of add-ons above which the add-on search and "Show more" are shown.
  addOnFilterThreshold?: number;
  // [impl->req~hide-sections-react-manifest~1] Sections that are not rendered.
  hideSections?: readonly PricingSectionName[];
  // [impl->req~react-classname~1]
  className?: string;
  // [impl->req~react-style-prop~1] CSS properties plus custom properties such as `--pr-color-accent`
  style?: PricingRendererStyle;
  id?: string;
  'aria-label'?: string;
  // [impl->req~react-render-props-slots~1] Each one fills the element's slot of that name. They are
  // called on the client only, after the element has rendered the slot node.
  /** Replaces the built-in CTA of every plan card. */
  renderPlanCta?: (context: PricingPlanCtaContext) => React.ReactNode;
  /** Replaces the built-in action of the summary. */
  renderSummaryActions?: (context: PricingSummaryActionsContext) => React.ReactNode;
  /** Replaces the content of the loading state. */
  renderLoading?: () => React.ReactNode;
  /** Replaces the content of the error state. */
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

// [impl->req~provider-config-precedence~1] [impl->req~provider-presentation-precedence~1]
// [impl->req~provider-messages-merge~1] [impl->req~provider-request-loader~1]
// [impl->req~provider-request-origin~1] [impl->req~provider-nearest~1]
// [impl->req~provider-absent-unchanged~2]
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

// [impl->req~react-slot-portals~2]
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

    // [impl->req~react-slots-client-only~1]
    // Entries exist only after the first effect, so the server render and the first client render
    // call no render prop and hold no portal.
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
    // [impl->req~react-slots-event-target~1]
    const onSlotsChange = React.useCallback((event: PricingSlotsChangeEvent) => {
      const element = elementRef.current;
      if (element === null) return;
      const nodes = acceptedSlotNodes(element, event);
      if (nodes !== undefined) setEntries(slotEntriesOf(element, nodes, element.resolvedState));
    }, []);
    // [impl->req~react-slots-attach-read~1]
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

// [impl->req~review-react~1] [impl->req~review-react-registers~1]
// The tag is registered when the component renders (a no-op without a registry), so a React host
// needs no extra import and apps that never render the component never register the tag.
export const PricingChangeReview = React.forwardRef<
  PricingChangeReviewElement,
  PricingChangeReviewProps
>((props, ref) => {
  definePricingChangeReview();
  return React.createElement(PricingChangeReviewBase, {
    ...props,
    ref,
  });
});

PricingChangeReview.displayName = 'PricingChangeReview';

export { PricingChangeReviewElement, PricingRendererElement };
// [impl->req~react-entry-reexports-headless~1]
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
// [impl->req~react-reexports-result-type~1]
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
// [impl->req~composition-types-manifest~1]
export type {
  PricingErrorContext,
  PricingPlanCtaContext,
  PricingSummaryActionsContext,
} from './slots-types.js';
// [impl->req~cta-event-types~1]
export type { SelectionRelation } from '../core/index.js';
export type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';
