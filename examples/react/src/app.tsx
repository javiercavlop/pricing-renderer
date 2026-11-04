import { Link, Route, Routes } from 'react-router';
import { ChangePage } from './change-page';
import { PricingPage } from './pricing-page';
import { SubscriptionProvider } from './subscription';

export function App() {
  return (
    <SubscriptionProvider>
      <nav className="app-nav">
        <Link to="/">Pricing</Link>
      </nav>
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
