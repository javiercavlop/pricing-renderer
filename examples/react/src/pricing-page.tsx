import { PricingRenderer } from 'pricing-renderer/react';
import { Link } from 'react-router';
import { YAML } from './pricing-config';
import { useSubscription } from './subscription';

const REVIEW_LABEL = 'Review change';
const NO_CHANGE_LABEL = 'No changes';

export function PricingPage() {
  const { current } = useSubscription();

  return (
    <>
      <PricingRenderer
        yaml={YAML}
        currentSelection={current}
        // The built-in summary button does nothing without a handler, so replace it with a link to
        // the review. Only the chosen plan is carried over, not the period or the variables.
        renderSummaryActions={({ selection, relation, pending }) =>
          selection.planId === undefined || relation === 'current' ? (
            <span aria-disabled="true">{NO_CHANGE_LABEL}</span>
          ) : (
            <Link
              to={`/change?plan=${encodeURIComponent(selection.planId)}`}
              aria-disabled={pending}
              onClick={(event) => {
                if (pending) event.preventDefault();
              }}
            >
              {REVIEW_LABEL}
            </Link>
          )
        }
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
                // Guard for hosts that set `pendingActionId`; this demo never does.
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
