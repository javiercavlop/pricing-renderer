// In-memory "subscription" of the demo. It lives in React state, so a reload starts again from the
// same value. A real app reads the signed-in customer's contract from its own backend.
import type { PricingSelection } from 'pricing-renderer';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type CurrentSubscription = Partial<PricingSelection>;

interface SubscriptionValue {
  current: CurrentSubscription;
  // Shown on the pricing page after a change, until the next change or a reload.
  notice: string | undefined;
  commit: (next: CurrentSubscription, notice: string) => void;
}

const INITIAL: CurrentSubscription = { planId: 'starter', billingPeriod: 'monthly', addOns: {} };

const SubscriptionContext = createContext<SubscriptionValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<CurrentSubscription>(INITIAL);
  const [notice, setNotice] = useState<string | undefined>();
  const value = useMemo<SubscriptionValue>(
    () => ({
      current,
      notice,
      commit: (next, message) => {
        setCurrent(next);
        setNotice(message);
      },
    }),
    [current, notice],
  );
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const value = useContext(SubscriptionContext);
  if (value === undefined) throw new Error('useSubscription needs a SubscriptionProvider');
  return value;
}

// Simulates the request that stores the new subscription. It settles after 600 ms; aborting the
// signal (for example when the page unmounts) clears the timer and rejects, so a stale timer never
// updates an unmounted component.
export function saveSubscription(selection: CurrentSubscription, signal: AbortSignal) {
  return new Promise<CurrentSubscription>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(selection);
    }, 600);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
