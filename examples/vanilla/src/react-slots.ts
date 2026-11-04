// Harness for the browser specs of the React render props and usePricingRendererState. No JSX:
// the demo has no JSX transform. The query `mode` picks what the page mounts.
import {
  createElement as h,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { flushSync } from 'react-dom';
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
    __probe?: { plan: number; summary: number; loading: number; error: number; rp: number };
    __ref?: PricingRendererElement | null;
    __errorContexts?: { version: number; diagnostics: unknown }[];
  }
}

const mode = new URLSearchParams(location.search).get('mode') ?? 'all';
const root = document.querySelector<HTMLElement>('#root')!;
window.__actions = [];
window.__errorContexts = [];

// Calls per render prop; the total also goes to `window.__renderCalls`.
const callCounts = { plan: 0, summary: 0, loading: 0, error: 0 };
const counted = (name: keyof typeof callCounts): void => {
  callCounts[name] += 1;
  window.__renderCalls = (window.__renderCalls ?? 0) + 1;
};
const resetCounts = (): void => {
  Object.assign(callCounts, { plan: 0, summary: 0, loading: 0, error: 0 });
  window.__renderCalls = 0;
};
const str = (value: unknown): string => (value === undefined ? '' : String(value));

const renderPlanCta: PricingRendererProps['renderPlanCta'] = (ctx) => {
  counted('plan');
  return h(
    'button',
    {
      type: 'button',
      'data-rp': '1',
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
  counted('summary');
  return h(
    'div',
    {
      'data-rp': '1',
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
  counted('loading');
  return h('p', { 'data-rp': '1', 'data-testid': 'loading' }, 'Loading prices');
};

// Each call to this factory gives a new function, so a re-render can change the identity.
const makeRenderError =
  (version: number): PricingRendererProps['renderError'] =>
  (ctx) => {
    counted('error');
    window.__errorContexts!.push({ version, diagnostics: ctx.diagnostics });
    return h(
      'div',
      {
        'data-rp': '1',
        'data-testid': 'error',
        'data-codes': ctx.diagnostics.map((item) => item.code).join(','),
      },
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

// What the buttons change; every render of the root reads it.
const propsState: {
  errorVersion: number;
  renderError: PricingRendererProps['renderError'];
  pendingActionId?: string;
  currentSelection?: PricingRendererProps['currentSelection'];
  slotNames?: readonly string[];
} = { errorVersion: 1, renderError: makeRenderError(1) };

const slots = (names: readonly string[]): Partial<PricingRendererProps> => ({
  ...(names.includes('plan') && { renderPlanCta }),
  ...(names.includes('summary') && { renderSummaryActions }),
  ...(names.includes('rest') && { renderLoading, renderError: propsState.renderError }),
});

const everySlot = ['plan', 'summary', 'rest'];
const slotNamesByMode: Record<string, readonly string[]> = {
  all: everySlot,
  plan: ['plan'],
  summary: ['summary'],
  none: [],
  error: everySlot,
  'error-yaml': everySlot,
  loading: everySlot,
  hydrate: everySlot,
  late: ['summary'],
  state: [],
};

const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

// The loader rejects a relative `src`, so the paths are resolved against the page origin.
const absolute = (path: string): string => new URL(path, location.href).href;
const source =
  mode === 'error'
    ? { src: absolute('/missing-pricing.yml') }
    : mode === 'loading'
      ? { src: absolute('/slow-pricing.yml?gate') }
      : mode === 'error-yaml'
        ? { yaml: 'plans: [' }
        : { yaml: pricingYaml };

// A stable callback, so React does not call it again on every render.
const publishRef = (element: PricingRendererElement | null): void => {
  window.__ref = element;
};

function renderer(ref: Ref<PricingRendererElement> = publishRef): ReactNode {
  return h(PricingRenderer, {
    ...source,
    selectionEnabled: true,
    ctaEnabled: true,
    locale: 'en-US',
    ...slots(propsState.slotNames ?? slotNamesByMode[mode] ?? everySlot),
    ...(propsState.pendingActionId !== undefined && {
      pendingActionId: propsState.pendingActionId,
    }),
    ...(propsState.currentSelection !== undefined && {
      currentSelection: propsState.currentSelection,
    }),
    ref,
  } as PricingRendererProps);
}

// Reads the counters and the rendered render props on its first run, after the commit.
function Probe(): ReactNode {
  useIsomorphicLayoutEffect(() => {
    window.__probe = {
      ...callCounts,
      rp: document.getElementById('root')!.querySelectorAll('[data-rp]').length,
    };
  }, []);
  return null;
}

function StateHarness(): ReactNode {
  const ref = useRef<PricingRendererElement | null>(null);
  const setRef = useCallback((element: PricingRendererElement | null) => {
    ref.current = element;
    publishRef(element);
  }, []);
  const snapshot = usePricingRendererState(ref);
  return h(
    'div',
    null,
    renderer(setRef),
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

// The tree of the current props state; the hydrate mode adds the probe after the renderer.
const buildTree = (): ReactNode => {
  const main = mode === 'state' ? h(StateHarness) : renderer();
  return mode === 'hydrate' ? h(Fragment, null, main, h(Probe)) : main;
};

let reactRoot: { render(children: ReactNode): void };
if (mode === 'hydrate') {
  root.innerHTML = renderToString(buildTree());
  resetCounts();
  window.__recoverable = [];
  // Setting innerHTML upgrades <pricing-renderer>, and Lit renders its light DOM in a microtask.
  // flushSync hydrates before that microtask, so React sees only the server HTML.
  flushSync(() => {
    reactRoot = hydrateRoot(root, buildTree(), {
      onRecoverableError: (error) => {
        window.__recoverable!.push(error instanceof Error ? error.message : String(error));
      },
    });
  });
} else {
  reactRoot = createRoot(root);
  reactRoot.render(buildTree());
}

// Each button changes the props state and renders the same root again.
const onClick = (id: string, change: () => void): void => {
  document.querySelector(`#${id}`)?.addEventListener('click', () => {
    change();
    reactRoot.render(buildTree());
  });
};
onClick('add-render-prop', () => {
  propsState.slotNames = ['plan', 'summary'];
});
onClick('set-pending', () => {
  propsState.pendingActionId = 'start-growth';
});
onClick('set-current', () => {
  propsState.currentSelection = { planId: 'starter' };
});
onClick('rerender-error', () => {
  propsState.errorVersion += 1;
  propsState.renderError = makeRenderError(propsState.errorVersion);
});
