import Link from 'next/link';
import { pricingYaml } from '../pricing-yaml';
import { ChangeFlow } from './change-flow';

export default function ChangePage() {
  return (
    <main>
      <header>
        <p>Headless React API</p>
        <h1>Review a plan change before it is saved.</h1>
        <span>
          The selection comes from <code>usePricingSelection</code>, the comparison with the current
          subscription from <code>compareWithCurrent</code>, and the review from{' '}
          <code>PricingChangeReview</code>. The subscription lives in a route handler.
        </span>
      </header>
      <nav>
        <Link href="/pricing">Back to pricing</Link>
      </nav>
      <ChangeFlow yaml={pricingYaml} />
    </main>
  );
}
