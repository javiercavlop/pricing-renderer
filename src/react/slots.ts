// The pure helpers behind the render props of PricingRenderer: they read slot nodes and build the
// contexts. They use no React and touch no DOM global, so a node unit test runs them with
// stand-in nodes.
import { isSafeLink } from '../core/index.js';
import type { PricingDiagnostic, SelectionRelation } from '../core/index.js';
import type {
  PricingRendererElement,
  PricingSelectionChangeDetail,
  PricingSlotName,
  PricingSlotsChangeDetail,
} from '../element/index.js';
import type {
  PricingErrorContext,
  PricingPlanCtaContext,
  PricingSummaryActionsContext,
} from './slots-types.js';

// No constant lives at module scope: the allow-list scan of the React modules refuses it.

// [impl->req~react-render-props-slots~1]
// The slot names of the render props given as functions, in the fixed order of `slots`, or
// undefined when there is none.
export function slotNamesOf(props: {
  renderPlanCta?: unknown;
  renderSummaryActions?: unknown;
  renderLoading?: unknown;
  renderError?: unknown;
}): PricingSlotName[] | undefined {
  const names: PricingSlotName[] = [];
  if (typeof props.renderPlanCta === 'function') names.push('plan-cta');
  if (typeof props.renderSummaryActions === 'function') names.push('summary-actions');
  if (typeof props.renderLoading === 'function') names.push('loading');
  if (typeof props.renderError === 'function') names.push('error');
  return names.length > 0 ? names : undefined;
}

function isSlotName(value: string | undefined): boolean {
  const names: readonly string[] = ['plan-cta', 'summary-actions', 'loading', 'error'];
  return value !== undefined && names.includes(value);
}

// [impl->req~react-slots-event-target~1] [impl->req~react-slot-node-accept~2]
// The nodes of the event that this wrapper's element owns, in their order; undefined for the event
// of another element. A node is left out when it is detached, is not a known slot, is a plan node
// without a plan id, or sits in a nested renderer or inside another slot node.
export function acceptedSlotNodes(
  element: HTMLElement,
  event: { target: EventTarget | null; detail: PricingSlotsChangeDetail },
): HTMLElement[] | undefined {
  if (event.target !== element) return undefined;
  const nodes: unknown = (event.detail as PricingSlotsChangeDetail | null | undefined)?.nodes;
  if (!Array.isArray(nodes)) return [];
  return (nodes as HTMLElement[]).filter(
    (node) =>
      node.isConnected &&
      isSlotName(node.dataset.prSlot) &&
      (node.dataset.prSlot !== 'plan-cta' || (node.dataset.planId ?? '') !== '') &&
      node.parentElement?.closest('pricing-renderer, [data-pr-slot]') === element,
  );
}

// [impl->req~react-slots-attach-read~1]
// The slot nodes that exist now, for an event that fired before the wrapper listened.
export function currentSlotNodes(element: HTMLElement): HTMLElement[] {
  const nodes = [...element.querySelectorAll<HTMLElement>('[data-pr-slot]')];
  return acceptedSlotNodes(element, { target: element, detail: { nodes } }) ?? [];
}

function relationOf(value: string | undefined): SelectionRelation | undefined {
  const relations: readonly string[] = ['current', 'upgrade', 'downgrade', 'change'];
  if (value === undefined || !relations.includes(value)) return undefined;
  return value as SelectionRelation;
}

// [impl->req~react-plan-context-reader~1] [impl->req~react-plan-context-any-pending~1]
// [impl->req~react-slot-href-safe~1] [impl->req~react-plan-context-trigger~1]
export function planCtaContextOf(
  element: Pick<PricingRendererElement, 'triggerPlanAction'>,
  node: HTMLElement,
): PricingPlanCtaContext {
  const data = node.dataset;
  const planId = data.planId ?? '';
  const href = isSafeLink(data.href) ? data.href : undefined;
  const relation = relationOf(data.relation);
  return {
    planId,
    planName: data.planName ?? '',
    label: data.label ?? '',
    ...(href !== undefined ? { href } : {}),
    ...(relation !== undefined ? { relation } : {}),
    selected: data.selected === 'true',
    current: data.current === 'true',
    pending: data.pending === 'true',
    anyPending: data.anyPending === 'true',
    trigger: () => element.triggerPlanAction(planId),
  };
}

// [impl->req~react-summary-context-reader~1]
export function summaryActionsContextOf(
  node: HTMLElement,
  state: Pick<PricingSelectionChangeDetail, 'selection' | 'resolved'>,
): PricingSummaryActionsContext {
  const relation = relationOf(node.dataset.relation);
  return {
    selection: state.selection,
    resolved: state.resolved,
    ...(relation !== undefined ? { relation } : {}),
    pending: node.dataset.pending === 'true',
  };
}

// [impl->req~react-error-context-reload~1]
export function errorContextOf(
  element: Pick<PricingRendererElement, 'reload'>,
  diagnostics: readonly PricingDiagnostic[],
): PricingErrorContext {
  return { diagnostics, reload: () => element.reload() };
}

function diagnosticOf(value: unknown): PricingDiagnostic | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { code, severity, message, path } = value as Record<string, unknown>;
  if (typeof code !== 'string' || typeof message !== 'string') return undefined;
  const severities: readonly string[] = ['error', 'warning', 'info'];
  if (typeof severity !== 'string' || !severities.includes(severity)) return undefined;
  if (path !== undefined && typeof path !== 'string') return undefined;
  return {
    code,
    severity: severity as PricingDiagnostic['severity'],
    message,
    ...(path !== undefined ? { path } : {}),
  };
}

// [impl->req~react-error-diagnostics-reader~1] [impl->req~react-error-diagnostics-source~1]
// The diagnostics of the failed load come from the error slot node only.
export function errorDiagnosticsOf(node: HTMLElement): PricingDiagnostic[] {
  const text = node.dataset.diagnostics;
  if (text === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => diagnosticOf(entry) ?? []);
}

// A slot node with the context its render prop receives, built when the event fired. `key` is the
// portal key: `plan:<plan id>` for a plan node, `slot:<name>` for the others.
export type SlotEntry =
  | { slot: 'plan-cta'; node: HTMLElement; key: string; context: PricingPlanCtaContext }
  | {
      slot: 'summary-actions';
      node: HTMLElement;
      key: string;
      context: PricingSummaryActionsContext;
    }
  | { slot: 'loading'; node: HTMLElement; key: string }
  | { slot: 'error'; node: HTMLElement; key: string; context: PricingErrorContext };

// [impl->req~react-plan-cta-context~2] [impl->req~react-other-slot-contexts~1]
// The summary context needs the state read when the event fired; without a state (the element is
// not ready) a summary node gets no entry.
export function slotEntriesOf(
  element: Pick<PricingRendererElement, 'triggerPlanAction' | 'reload'>,
  nodes: readonly HTMLElement[],
  state: Pick<PricingSelectionChangeDetail, 'selection' | 'resolved'> | undefined,
): SlotEntry[] {
  return nodes.flatMap((node): SlotEntry[] => {
    switch (node.dataset.prSlot) {
      case 'plan-cta':
        return [
          {
            slot: 'plan-cta',
            node,
            key: `plan:${node.dataset.planId ?? ''}`,
            context: planCtaContextOf(element, node),
          },
        ];
      case 'summary-actions':
        return state
          ? [
              {
                slot: 'summary-actions',
                node,
                key: 'slot:summary-actions',
                context: summaryActionsContextOf(node, state),
              },
            ]
          : [];
      case 'loading':
        return [{ slot: 'loading', node, key: 'slot:loading' }];
      case 'error':
        return [
          {
            slot: 'error',
            node,
            key: 'slot:error',
            context: errorContextOf(element, errorDiagnosticsOf(node)),
          },
        ];
      default:
        return [];
    }
  });
}
