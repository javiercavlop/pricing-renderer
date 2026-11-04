import { PricingRenderer } from 'pricing-renderer/react';
import { Link } from 'react-router';
import { YAML } from './pricing-config';
import { useSubscription } from './subscription';

export function PricingPage() {
  const { current, notice } = useSubscription();

  return (
    <>
      {/* Always rendered, so a screen reader announces the text when it appears. */}
      <p role="status">{notice}</p>
      <PricingRenderer
        yaml={YAML}
        currentSelection={current}
        renderPlanCta={({ planId, label, relation, current: isCurrent, anyPending, trigger }) =>
          // The plan the customer already has is not a link: there is nothing to change to.
          isCurrent ? (
            <span aria-disabled="true" data-relation={relation}>
              {label}
            </span>
          ) : (
            // The target is built from the plan id, not from `context.href`: the links of the
            // pricing document point to the vendor's site, this route belongs to the app.
            <Link
              to={`/change?plan=${encodeURIComponent(planId)}`}
              data-relation={relation}
              aria-disabled={anyPending}
              onClick={(event) => {
                if (anyPending) {
                  event.preventDefault();
                  return;
                }
                // trigger() only dispatches the cancelable `pricing-action`; it never navigates, so
                // the router does it. Cancel the navigation only when the element ignored the
                // action. An `onAction` handler on the renderer must not cancel the event here,
                // or the element would report the action as refused.
                if (!trigger()) event.preventDefault();
              }}
            >
              {label}
            </Link>
          )
        }
      />
    </>
  );
}
