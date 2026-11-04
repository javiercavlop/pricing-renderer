'use client';

import { PricingRendererProvider } from 'pricing-renderer/react';
import type { ReactNode } from 'react';
import { rendererConfig, rendererMessages, rendererPresentation } from './pricing-config';

// The client layout component. The provider only publishes its props to its tree and never writes
// the global configuration, so no configurePricingRenderer call is needed. The props are
// module-level constants: a stable identity keeps the context value stable.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PricingRendererProvider
      config={rendererConfig}
      presentation={rendererPresentation}
      messages={rendererMessages}
    >
      {children}
    </PricingRendererProvider>
  );
}
