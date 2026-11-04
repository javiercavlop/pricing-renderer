import { PricingChangeReview } from 'pricing-renderer/react';
import { usePricingSelection, usePricingSource } from 'pricing-renderer/react/headless';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LOCALE, YAML } from './pricing-config';
import { saveSubscription, useSubscription } from './subscription';

export function ChangePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { current, commit } = useSubscription();
  const source = usePricingSource({ yaml: YAML });
  const state = usePricingSelection(source.pricing, { currentSelection: current });
  const { apply, selectPlan, compareWithCurrent, selection } = state;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();

  // Aborts a save in flight when the page unmounts, so its timer never updates this component.
  const saveController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => saveController.current?.abort(), []);

  // The URL is the source of truth for the chosen plan. The edit starts from the current
  // subscription, then the plan of the URL is applied; an unknown id is ignored. The effect rebuilds
  // the edit from the same inputs each time it runs, so StrictMode's second run is harmless. A
  // page that edits more than the plan would apply the current subscription only once.
  const pricing = source.pricing;
  const planParam = params.get('plan');
  useEffect(() => {
    if (pricing === undefined) return;
    apply(current);
    if (planParam !== null && pricing.plans.some((plan) => plan.id === planParam)) {
      // selectPlan can return a pending change (a dependency or exclusion that needs confirmation).
      // The demo pricing has none; a real page would render `pending` with confirm and cancel.
      selectPlan(planParam);
    }
  }, [pricing, current, planParam, apply, selectPlan]);

  if (source.status === 'error') return <p role="alert">The pricing could not be loaded.</p>;
  if (pricing === undefined) return <p>Loading the pricing…</p>;

  const currentPlan = pricing.plans.find((plan) => plan.id === current.planId);
  const comparison = compareWithCurrent();

  return (
    <section>
      <h1>Change your plan</h1>
      <p>
        Current plan: <strong>{currentPlan?.name}</strong>
      </p>
      <div role="group" aria-label="Choose a plan">
        {pricing.plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            disabled={saving}
            aria-pressed={selection?.planId === plan.id}
            onClick={() => setParams({ plan: plan.id }, { replace: true })}
          >
            {plan.name}
          </button>
        ))}
      </div>
      {comparison !== undefined && comparison.relation !== 'current' ? (
        <PricingChangeReview
          comparison={comparison}
          locale={LOCALE}
          pending={saving}
          {...(saveError !== undefined && { error: saveError })}
          onBack={() => navigate('/')}
          onConfirm={(event) => {
            // The example manages `pending` itself, so the element must not set it too.
            event.preventDefault();
            const controller = new AbortController();
            saveController.current = controller;
            setSaving(true);
            setSaveError(undefined);
            saveSubscription(comparison.selections.after, controller.signal).then(
              (saved) => {
                commit(saved, 'Your subscription was updated.');
                navigate('/');
              },
              (reason: unknown) => {
                // An aborted save means the page is gone: leave its state alone.
                if (controller.signal.aborted) return;
                setSaveError(String(reason));
                setSaving(false);
              },
            );
          }}
        />
      ) : planParam !== null && !pricing.plans.some((plan) => plan.id === planParam) ? (
        <p>Unknown plan. Choose one of the plans above.</p>
      ) : (
        <p>Your selection equals the current subscription. Choose another plan to review it.</p>
      )}
    </section>
  );
}
