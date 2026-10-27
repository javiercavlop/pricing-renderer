import {
  formatCurrency,
  getPlanCta,
  isSafeLink,
  translate,
  type NormalizedPlan,
  type PricingCta,
  type PricingViewModel,
  type SelectionRelation,
} from '../core/index.js';
import { planRelation } from '../core/plan-relation.js';

export const REVIEW_CHANGE_ACTION_ID = 'review-change';
export const CONTACT_SALES_ACTION_ID = 'contact-sales';

/** What the CTAs need to know about the customer's contract and the host's pending work. */
export interface PricingActionContext {
  /** The current plan id, only when the loaded pricing defines it. */
  currentPlanId?: string;
  pendingActionId?: string;
}

/** The summary action, computed by the element and rendered by `renderSummary`. */
export interface SummaryActionState {
  actionId: typeof REVIEW_CHANGE_ACTION_ID | typeof CONTACT_SALES_ACTION_ID;
  label: string;
  relation: SelectionRelation;
  disabled: boolean;
}

export interface PlanCtaView {
  actionId: string;
  label: string;
  /** Expanded and safe; absent for a button. */
  href?: string;
  /** The expanded `href` of the configured CTA, safe or not, for the `pricing-action` detail. */
  eventHref?: string;
  target?: '_self' | '_blank';
  kind: 'primary' | 'secondary';
  metadata?: PricingCta['metadata'];
  /** Set only while the current plan is known. */
  relation?: SelectionRelation;
  /** The current plan's CTA: a button with the `disabled` attribute. */
  disabled: boolean;
  /** `aria-disabled`: any action of the host is pending. */
  ariaDisabled: boolean;
  /** This control is the pending action. */
  pending: boolean;
}

// [impl->req~cta-pending-state~1] [impl->req~cta-pending-others~1]
export function isPendingActionId(pendingActionId: string | undefined, actionId: string): boolean {
  return pendingActionId !== undefined && pendingActionId === actionId;
}

// [impl->req~cta-href-template~1]
// The plan id is encoded here, before the caller checks the safety of the result.
export function expandCtaHref(href: string | undefined, planId: string): string | undefined {
  return href?.split('{planId}').join(encodeURIComponent(planId));
}

function relationLabel(
  viewModel: PricingViewModel,
  plan: NormalizedPlan,
  cta: PricingCta | undefined,
  relation: SelectionRelation,
): string | undefined {
  // [impl->req~cta-contact-sales~1]
  const price = viewModel.resolved.planPrices[plan.id];
  if (price?.kind === 'label' || price?.kind === 'error') {
    return cta?.labels?.contactSales ?? translate(viewModel.messages, 'pricing.contactSales');
  }
  // [impl->req~current-selection-relation-labels~1]
  if (relation === 'upgrade') {
    return (
      cta?.labels?.upgrade ??
      translate(viewModel.messages, 'pricing.upgradeTo', { plan: plan.name })
    );
  }
  if (relation === 'downgrade') {
    return (
      cta?.labels?.downgrade ??
      translate(viewModel.messages, 'pricing.downgradeTo', { plan: plan.name })
    );
  }
  return undefined;
}

/** The label, link and state of one plan CTA. */
// [impl->req~current-selection-plan-cta~1] [impl->req~current-selection-unknown-plan~1]
// [impl->req~cta-event-unchanged~1]
export function planCtaView(
  viewModel: PricingViewModel,
  plan: NormalizedPlan,
  context: PricingActionContext,
): PlanCtaView {
  const cta = getPlanCta(viewModel.presentation, plan.id);
  const actionId = cta?.id ?? `choose-${plan.id}`;
  const { currentPlanId, pendingActionId } = context;
  const kind: PlanCtaView['kind'] = cta?.kind === 'secondary' ? 'secondary' : 'primary';
  // [impl->req~cta-href-template-unsafe~1] an unsafe expanded link renders as a button
  const eventHref = expandCtaHref(cta?.href, plan.id) || undefined;
  const href = isSafeLink(eventHref) ? eventHref : undefined;
  const base = {
    actionId,
    kind,
    ...(cta?.target ? { target: cta.target } : {}),
    ...(cta?.metadata ? { metadata: cta.metadata } : {}),
    ...(eventHref ? { eventHref } : {}),
    ariaDisabled: pendingActionId !== undefined,
    pending: isPendingActionId(pendingActionId, actionId),
  };
  const defaultLabel = (): string =>
    cta?.label ?? translate(viewModel.messages, 'pricing.choosePlan', { plan: plan.name });

  if (currentPlanId === undefined) {
    return { ...base, label: defaultLabel(), ...(href ? { href } : {}), disabled: false };
  }

  const relation = planRelation(viewModel.pricing, currentPlanId, plan.id);
  if (relation === 'current') {
    return {
      ...base,
      label: cta?.labels?.current ?? translate(viewModel.messages, 'pricing.currentPlanCta'),
      relation,
      disabled: true,
    };
  }
  return {
    ...base,
    label: relationLabel(viewModel, plan, cta, relation) ?? defaultLabel(),
    ...(href ? { href } : {}),
    relation,
    disabled: false,
  };
}

/** The summary action for a known current plan and the relation of the selection in effect. */
// [impl->req~cta-summary-action~1] [impl->req~cta-summary-action-quote~1]
// [impl->req~cta-summary-action-current~1]
export function summaryActionState(
  viewModel: PricingViewModel,
  relation: SelectionRelation,
): SummaryActionState {
  const quote = viewModel.resolved.requiresQuote;
  return {
    actionId: quote ? CONTACT_SALES_ACTION_ID : REVIEW_CHANGE_ACTION_ID,
    label: quote
      ? translate(viewModel.messages, 'pricing.contactSales')
      : translate(viewModel.messages, 'pricing.reviewChangeCta', {
          total: formatCurrency(
            viewModel.resolved.subtotal,
            viewModel.pricing.metadata.currency,
            viewModel.locale,
          ),
        }),
    relation,
    disabled: relation === 'current',
  };
}
