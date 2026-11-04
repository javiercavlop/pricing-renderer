'use client';

import Link from 'next/link';
import { PricingRenderer, type PricingPlanCtaContext } from 'pricing-renderer/react';
import { useSubscription } from './use-subscription';

// Module-level, so the render prop keeps one identity. Every string of the context is rendered as
// React text, never through an HTML sink.
function renderPlanCta(plan: PricingPlanCtaContext) {
  if (plan.current) return <span data-plan-cta="current">Your current plan</span>;
  const label = plan.relation === 'upgrade' ? `Upgrade to ${plan.planName}` : plan.label;
  if (plan.href !== undefined) {
    // `href` only passed the renderer's isSafeLink check: isSafeLink rejects `//host` but accepts
    // an absolute https:// link to another host, so a host that needs same-site links checks href
    // itself. next/link renders a plain anchor for an external value.
    return (
      <Link href={plan.href} data-plan-cta="link">
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      data-plan-cta="button"
      disabled={plan.anyPending}
      onClick={() => plan.trigger()}
    >
      {label}
    </button>
  );
}

export function PricingClient({ yaml }: { yaml: string }) {
  // The config, presentation and messages come from the provider of the layout.
  const { current } = useSubscription();
  return (
    <PricingRenderer
      yaml={yaml}
      theme="auto"
      currentSelection={current}
      renderPlanCta={renderPlanCta}
      onAction={(event) => {
        event.preventDefault();
        window.alert(`Host checkout received: ${event.detail.actionId}`);
      }}
    />
  );
}
