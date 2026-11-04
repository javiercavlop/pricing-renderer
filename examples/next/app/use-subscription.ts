'use client';

import type { PricingSelection } from 'pricing-renderer';
import { useCallback, useEffect, useState } from 'react';

export type CurrentSubscription = Partial<PricingSelection>;

async function readSubscription(signal: AbortSignal): Promise<CurrentSubscription> {
  const response = await fetch('/api/subscription', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Subscription request failed: ${response.status}`);
  return (await response.json()) as CurrentSubscription;
}

// The current subscription from the route handler. It is undefined until the first answer, so the
// server render and the first client render agree and no browser API runs at import time.
export function useSubscription() {
  const [current, setCurrent] = useState<CurrentSubscription | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    readSubscription(controller.signal).then(setCurrent, (reason: unknown) => {
      if (!controller.signal.aborted) setError(String(reason));
    });
    return () => controller.abort();
  }, []);

  const save = useCallback(async (selection: CurrentSubscription) => {
    const response = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(selection),
    });
    if (!response.ok) throw new Error(`Saving failed: ${response.status}`);
    setCurrent((await response.json()) as CurrentSubscription);
  }, []);

  return { current, error, save };
}
