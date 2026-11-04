// Harness for the browser specs of the React render props and usePricingRendererState. No JSX:
// the demo has no JSX transform. The query `mode` picks what the page mounts.
import { createElement as h, useRef, type ReactNode, type Ref } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  PricingRenderer,
  usePricingRendererState,
  type PricingRendererElement,
  type PricingRendererProps,
} from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

declare global {
  interface Window {
    __actions?: { actionId: string; planId?: string }[];
    __renderCalls?: number;
    __recoverable?: string[];
  }
}

const mode = new URLSearchParams(location.search).get('mode') ?? 'all';
const root = document.querySelector<HTMLElement>('#root')!;
window.__actions = [];

const counted = (): void => {
  window.__renderCalls = (window.__renderCalls ?? 0) + 1;
};
const str = (value: unknown): string => (value === undefined ? '' : String(value));

const renderPlanCta: PricingRendererProps['renderPlanCta'] = (ctx) => {
  counted();
  return h(
    'button',
    {
      type: 'button',
      'data-testid': `cta-${ctx.planId}`,
      'data-label': ctx.label,
      'data-href': ctx.href ?? '',
      'data-selected': String(ctx.selected),
      'data-current': String(ctx.current),
      'data-pending': String(ctx.pending),
      'data-any-pending': String(ctx.anyPending),
      'data-relation': str(ctx.relation),
      onClick: () => {
        ctx.trigger();
      },
    },
    `Pick ${ctx.planName}`,
  );
};

const renderSummaryActions: PricingRendererProps['renderSummaryActions'] = (ctx) => {
  counted();
  return h(
    'div',
    {
      'data-testid': 'summary',
      'data-plan': ctx.selection.planId ?? '',
      'data-subtotal': String(ctx.resolved.subtotal),
      'data-pending': String(ctx.pending),
      'data-relation': str(ctx.relation),
    },
    'summary',
  );
};

const renderLoading: PricingRendererProps['renderLoading'] = () => {
  counted();
  return h('p', { 'data-testid': 'loading' }, 'Loading prices');
};

const renderError: PricingRendererProps['renderError'] = (ctx) => {
  counted();
  return h(
    'div',
    { 'data-testid': 'error', 'data-codes': ctx.diagnostics.map((item) => item.code).join(',') },
    h(
      'button',
      {
        type: 'button',
        'data-testid': 'error-reload',
        onClick: () => {
          void ctx.reload();
        },
      },
      'Retry',
    ),
  );
};

const slots = (names: readonly string[]): Partial<PricingRendererProps> => ({
  ...(names.includes('plan') && { renderPlanCta }),
  ...(names.includes('summary') && { renderSummaryActions }),
  ...(names.includes('rest') && { renderLoading, renderError }),
});

const slotsByMode: Record<string, Partial<PricingRendererProps>> = {
  all: slots(['plan', 'summary', 'rest']),
  plan: slots(['plan']),
  summary: slots(['summary']),
  none: {},
  error: slots(['plan', 'summary', 'rest']),
  loading: slots(['plan', 'summary', 'rest']),
  hydrate: slots(['plan', 'summary', 'rest']),
  late: {},
  state: {},
};

// The loader rejects a relative `src`, so the paths are resolved against the page origin.
const absolute = (path: string): string => new URL(path, location.href).href;
const source =
  mode === 'error'
    ? { src: absolute('/missing-pricing.yml') }
    : mode === 'loading'
      ? { src: absolute('/slow-pricing.yml?gate') }
      : { yaml: pricingYaml };

function renderer(
  extra: Partial<PricingRendererProps> = {},
  ref?: Ref<PricingRendererElement>,
): ReactNode {
  return h(PricingRenderer, {
    ...source,
    selectionEnabled: true,
    ctaEnabled: true,
    locale: 'en-US',
    ...(slotsByMode[mode] ?? slotsByMode.all),
    ...extra,
    ref,
  } as PricingRendererProps);
}

function StateHarness(): ReactNode {
  const ref = useRef<PricingRendererElement>(null);
  const snapshot = usePricingRendererState(ref);
  return h(
    'div',
    null,
    renderer({}, ref),
    h('output', { 'data-testid': 'state-name' }, snapshot?.pricing.metadata.saasName ?? 'none'),
    h('output', { 'data-testid': 'state-plan' }, snapshot?.selection.planId ?? 'none'),
  );
}

root.addEventListener(
  'pricing-action',
  (event) => {
    event.preventDefault();
    const { actionId, planId } = (event as CustomEvent<{ actionId: string; planId?: string }>)
      .detail;
    window.__actions!.push({ actionId, planId });
  },
  true,
);

const tree = mode === 'state' ? h(StateHarness) : renderer();

if (mode === 'hydrate') {
  root.innerHTML = renderToString(tree);
  window.__renderCalls = 0;
  window.__recoverable = [];
  hydrateRoot(root, tree, {
    onRecoverableError: (error) => {
      window.__recoverable!.push(error instanceof Error ? error.message : String(error));
    },
  });
} else {
  const reactRoot = createRoot(root);
  reactRoot.render(tree);
  document.querySelector('#add-render-prop')?.addEventListener('click', () => {
    reactRoot.render(renderer(slots(['plan', 'summary'])));
  });
}
