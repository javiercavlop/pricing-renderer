import { Link, Route, Routes, useLocation } from 'react-router';
import { ChangePage } from './change-page';
import { PricingPage } from './pricing-page';
import { SubscriptionProvider, useSubscription } from './subscription';

// Lives outside <Routes> so the region stays mounted across navigations and a screen reader
// announces the text when it appears. The text shows only on the pricing page, never as a stale
// message on /change.
function Notice() {
  const { notice } = useSubscription();
  const { pathname } = useLocation();
  return <p role="status">{pathname === '/' ? notice : undefined}</p>;
}

export function App() {
  return (
    <SubscriptionProvider>
      <nav className="app-nav">
        <Link to="/">Pricing</Link>
      </nav>
      <Notice />
      <main>
        <Routes>
          <Route path="/" element={<PricingPage />} />
          <Route path="/change" element={<ChangePage />} />
          <Route
            path="*"
            element={
              <p>
                This page does not exist. <Link to="/">Back to the pricing</Link>
              </p>
            }
          />
        </Routes>
      </main>
    </SubscriptionProvider>
  );
}
