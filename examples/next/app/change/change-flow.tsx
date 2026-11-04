'use client';

import { PricingChangeReview } from 'pricing-renderer/react';
import { usePricingSelection, usePricingSource } from 'pricing-renderer/react/headless';
import { useEffect, useState } from 'react';
import { LOCALE } from '../pricing-config';
import { useSubscription } from '../use-subscription';

export function ChangeFlow({ yaml }: { yaml: string }) {
  // Config, presentation and messages come from the provider of the layout.
  const source = usePricingSource({ yaml });
  const { current, error: loadError, save } = useSubscription();
  const selection = usePricingSelection(source.pricing, { currentSelection: current });
  const { apply, selectPlan, compareWithCurrent } = selection;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();

  // The store starts from the pricing's default selection; once the subscription has arrived, the
  // edit starts from it, so the comparison shows only what the customer changes.
  const pricing = source.pricing;
  useEffect(() => {
    if (pricing !== undefined && current !== undefined) apply(current);
  }, [pricing, current, apply]);

  if (source.status === 'error') return <p role="alert">The pricing could not be loaded.</p>;
  if (pricing === undefined || current === undefined) {
    return <p>{loadError ?? 'Loading your subscription…'}</p>;
  }

  const currentPlan = pricing.plans.find((plan) => plan.id === current.planId);
  const comparison = compareWithCurrent();
  const changed = comparison !== undefined && comparison.relation !== 'current';

  return (
    <section>
      <p>
        Current plan: <strong>{currentPlan?.name}</strong>
      </p>
      <div role="group" aria-label="Choose a plan">
        {pricing.plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            aria-pressed={selection.selection?.planId === plan.id}
            onClick={() => selectPlan(plan.id)}
          >
            {plan.name}
          </button>
        ))}
      </div>
      {changed ? (
        <PricingChangeReview
          comparison={comparison}
          locale={LOCALE}
          pending={saving}
          {...(saveError !== undefined && { error: saveError })}
          onBack={() => {
            setSaveError(undefined);
            apply(current);
          }}
          onConfirm={(event) => {
            // The example manages `pending` itself, so the element must not set it too.
            event.preventDefault();
            setSaving(true);
            setSaveError(undefined);
            const next = selection.selection;
            save({
              planId: next?.planId,
              billingPeriod: next?.billingPeriod,
              addOns: next?.addOns,
            })
              .catch((reason: unknown) => setSaveError(String(reason)))
              .finally(() => setSaving(false));
          }}
        />
      ) : (
        <p>Your selection equals the current subscription. Choose another plan to review it.</p>
      )}
    </section>
  );
}
