import Link from 'next/link';
import { PricingIsland } from '../pricing-island';
import { pricingYaml } from '../pricing-yaml';
import { SourceStatus } from './source-status';

export default function PricingPage() {
  return (
    <main>
      <header>
        <p>Next App Router example</p>
        <h1>Client-island pricing, server-owned source.</h1>
        <span>
          The page stays a Server Component. Only the interactive renderer crosses the client
          boundary.
        </span>
      </header>
      <SourceStatus />
      <nav>
        <Link href="/change">Review a plan change</Link>
      </nav>
      <PricingIsland yaml={pricingYaml} />
    </main>
  );
}
