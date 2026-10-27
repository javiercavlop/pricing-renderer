'use client';

import { createComponent, type EventName } from '@lit/react';
import * as React from 'react';
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
} from '../core/index.js';
import {
  PricingRendererElement,
  type PricingActionEvent,
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
  loadingLabel?: string;
  // Absent is automatic, `false` is off, `true` is on.
  onlyDifferences?: boolean;
  // Number of comparison rows above which the comparison toolbar is shown.
  toolbarThreshold?: number;
  // Number of add-ons above which the add-on search and "Show more" are shown.
  addOnFilterThreshold?: number;
  className?: string;
  id?: string;
  'aria-label'?: string;
  onReady?: (event: PricingReadyEvent) => void;
  onSelectionChange?: (event: PricingSelectionChangeEvent) => void;
  onAction?: (event: PricingActionEvent) => void;
  onDiagnostic?: (event: PricingDiagnosticEvent) => void;
}

export type PricingRendererProps = PricingInputProps & PricingRendererSharedProps;

export const PricingRenderer = React.forwardRef<PricingRendererElement, PricingRendererProps>(
  (props, ref) =>
    React.createElement(PricingRendererBase, {
      ...props,
      ref,
    }),
);

PricingRenderer.displayName = 'PricingRenderer';

export { PricingRendererElement };
// [impl->req~react-reexports-result-type~1]
export type {
  ApplySelectionResult,
  PricingActionDetail,
  PricingActionEvent,
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
