'use client';

import { createComponent, type EventName } from '@lit/react';
import * as React from 'react';
import { mergePresentationOptions } from '../core/index.js';
import {
  PricingRendererContext,
  filterProviderRequest,
  type PricingRendererContextValue,
} from './provider.js';
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
  type PricingSelectionChangeEvent,
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
  // [impl->req~react-classname~1]
  className?: string;
  // [impl->req~react-style-prop~1] CSS properties plus custom properties such as `--pr-color-accent`
  style?: PricingRendererStyle;
  id?: string;
  'aria-label'?: string;
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

export const PricingRenderer = React.forwardRef<PricingRendererElement, PricingRendererProps>(
  (props, ref) =>
    React.createElement(PricingRendererBase, {
      ...applyProvider(props, React.useContext(PricingRendererContext)),
      ref,
    }),
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
} from '../element/index.js';
// [impl->req~cta-event-types~1]
export type { SelectionRelation } from '../core/index.js';
export type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';
