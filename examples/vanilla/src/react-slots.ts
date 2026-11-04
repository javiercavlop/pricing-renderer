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
import { compareSelections, type SelectionComparison } from 'pricing-renderer';
import {
  PricingChangeReview,
  PricingRenderer,
  usePricingRendererState,
  type PricingRendererElement,
  type PricingRendererProps,
} from 'pricing-renderer/react';
import { parsePricingYaml } from 'pricing-renderer/yaml';
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
    // Mounts and effect cleanups of the render prop outputs, by kind (plan, summary, ...).
    __mounts?: Record<string, number>;
    __unmounts?: Record<string, number>;
    // The return value of each ctx.trigger() call.
    __triggerResults?: boolean[];
    // One entry per commit of a plan CTA output: what it saw, and whether its slot node was in the page.
    __ctaCalls?: { planId: string; selected: boolean; slotConnected: boolean }[];
    // JSON of the selection and resolved state of each renderSummaryActions call.
    __summaryContexts?: string[];
    // The hydrate-late mode: the host's light DOM just before hydrateRoot, whether hydrateRoot ran,
    // the commits of the sibling probe and the host node itself, to see if hydration kept it.
    __lateBefore?: { childCount: number; innerHTML: string };
    __lateCommits?: number;
    __lateHost?: Element | null;
    __lateHydrateCalled?: boolean;
    // Whether the host tag was already defined when the server HTML was set.
    __lateDefinedAtHtml?: boolean;
    // The host's child nodes right after the server HTML was set, before any microtask could run.
    __lateServerChildCount?: number;
    // The host's confirm button (wrapper=review), to see if hydration and updates keep it.
    __lateConfirm?: Element | null;
    // Set by the inline script of react-slots.html; releases the held customElements.define calls.
    __releaseDefinitions?: () => void;
  }
}

const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'all';
const root = document.querySelector<HTMLElement>('#root')!;
window.__actions = [];
window.__errorContexts = [];
window.__mounts = {};
window.__unmounts = {};
window.__triggerResults = [];
window.__ctaCalls = [];
window.__summaryContexts = [];

// Wraps the output of a render prop, so that an unmounted portal is visible to a page script even
// when its slot node is detached and no locator can reach it.
function Tracked(props: { kind: string; children: ReactNode }): ReactNode {
  const { kind } = props;
  useEffect(() => {
    const bump = (counts: Record<string, number>): void => {
      counts[kind] = (counts[kind] ?? 0) + 1;
    };
    bump(window.__mounts!);
    return () => bump(window.__unmounts!);
  }, [kind]);
  return props.children;
}
const tracked = (kind: string, child: ReactNode): ReactNode => h(Tracked, { kind }, child);

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
  // Recorded at commit, from the node the output is portalled into: a detached node is visible here.
  const record = (node: HTMLElement | null): void => {
    if (node === null) return;
    window.__ctaCalls!.push({
      planId: ctx.planId,
      selected: ctx.selected,
      slotConnected: node.closest('[data-pr-slot]')?.isConnected ?? false,
    });
  };
  return tracked(
    'plan',
    h(
      'button',
      {
        ref: record,
        type: 'button',
        'data-rp': '1',
        'data-testid': `cta-${ctx.planId}`,
        'data-plan-id': ctx.planId,
        'data-label': ctx.label,
        'data-href': ctx.href ?? '',
        'data-selected': String(ctx.selected),
        'data-current': String(ctx.current),
        'data-pending': String(ctx.pending),
        'data-any-pending': String(ctx.anyPending),
        'data-relation': str(ctx.relation),
        onClick: () => {
          window.__triggerResults!.push(ctx.trigger());
        },
      },
      `Pick ${ctx.planName}`,
    ),
  );
};

const renderSummaryActions: PricingRendererProps['renderSummaryActions'] = (ctx) => {
  counted('summary');
  window.__summaryContexts!.push(
    JSON.stringify({ selection: ctx.selection, resolved: ctx.resolved }),
  );
  return tracked(
    'summary',
    h(
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
    ),
  );
};

const renderLoading: PricingRendererProps['renderLoading'] = () => {
  counted('loading');
  return tracked('loading', h('p', { 'data-rp': '1', 'data-testid': 'loading' }, 'Loading prices'));
};

// Each call to this factory gives a new function, so a re-render can change the identity.
const makeRenderError =
  (version: number): PricingRendererProps['renderError'] =>
  (ctx) => {
    counted('error');
    window.__errorContexts!.push({ version, diagnostics: ctx.diagnostics });
    return tracked(
      'error',
      h(
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
  reviewPending: boolean;
} = {
  errorVersion: 1,
  reviewPending: true,
  renderError: makeRenderError(1),
  // The `current` mode starts with a current plan, to test it at mount.
  ...(mode === 'current' && { currentSelection: { planId: 'starter' } }),
};

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
  'hydrate-late': everySlot,
  late: ['summary'],
  state: [],
  current: ['plan'],
};
// `mode` comes from the URL: only own keys count, never `__proto__` or `constructor`.
const modeSlotNames = (): readonly string[] => {
  if (mode === 'hydrate-late' && params.get('slots') === 'none') return [];
  return Object.hasOwn(slotNamesByMode, mode) ? slotNamesByMode[mode]! : everySlot;
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
    ...slots(propsState.slotNames ?? modeSlotNames()),
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

// Counts its commits; it is a sibling of the renderer, so it says nothing about the host node.
function LateProbe(): ReactNode {
  useIsomorphicLayoutEffect(() => {
    window.__lateCommits = (window.__lateCommits ?? 0) + 1;
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

// hydrate-late hosts: `wrapper=review` mounts <PricingChangeReview> instead of the renderer, and
// `wrapper=raw` a bare <pricing-renderer> element (a negative control, no wrapper).
const wrapperParam = params.get('wrapper');
const lateTag = wrapperParam === 'review' ? 'pricing-change-review' : 'pricing-renderer';

// A small Growth to Enterprise comparison, computed in the page from the fixture.
let reviewComparison: SelectionComparison | undefined;
const comparisonOfReview = (): SelectionComparison => {
  if (reviewComparison === undefined) {
    const pricing = parsePricingYaml(pricingYaml).value!;
    const contract = { planId: 'growth' } as const;
    reviewComparison = compareSelections({
      before: { pricing, selection: contract },
      after: { pricing, selection: { planId: 'enterprise' } },
    });
  }
  return reviewComparison;
};

const lateMain = (): ReactNode => {
  if (wrapperParam === 'review') {
    return h(PricingChangeReview, {
      comparison: comparisonOfReview(),
      pending: propsState.reviewPending,
      locale: 'en-US',
    });
  }
  // No source on the bare element: it still renders a light DOM (its error state), which is all
  // the control needs.
  return wrapperParam === 'raw' ? h('pricing-renderer') : renderer();
};

// The tree of the current props state; the hydrate mode adds the probe after the renderer.
const buildTree = (): ReactNode => {
  if (mode === 'hydrate-late') return h(Fragment, null, lateMain(), h(LateProbe));
  const main = mode === 'state' ? h(StateHarness) : renderer();
  return mode === 'hydrate' ? h(Fragment, null, main, h(Probe)) : main;
};

let reactRoot: { render(children: ReactNode): void };

// Hydrates after the element may have rendered its light DOM. `define=before|after` says whether
// the element is defined when the server HTML is set; `hydrate=update|task|sync` says when
// hydrateRoot runs: after the element's first update, in a later task, or inside flushSync.
async function hydrateLate(): Promise<void> {
  const defineAfter = params.get('define') === 'after';
  const hydrate = params.get('hydrate') ?? 'update';
  window.__recoverable = [];
  window.__lateCommits = 0;
  const host = (): PricingRendererElement | null =>
    root.querySelector<PricingRendererElement>(lateTag);
  const start = (): void => {
    const element = host();
    window.__lateBefore = {
      childCount: element?.childElementCount ?? 0,
      innerHTML: element?.innerHTML ?? '',
    };
    window.__lateHost = element;
    window.__lateConfirm = element?.querySelector('[data-pr-part="review-confirm"]') ?? null;
    window.__lateHydrateCalled = true;
    reactRoot = hydrateRoot(root, buildTree(), {
      onRecoverableError: (error) => {
        window.__recoverable!.push(error instanceof Error ? error.message : String(error));
      },
    });
  };
  root.innerHTML = renderToString(buildTree());
  // Nothing has run since the assignment: the server tag is still empty.
  window.__lateServerChildCount = host()?.childNodes.length ?? -1;
  window.__lateDefinedAtHtml = customElements.get(lateTag) !== undefined;
  if (wrapperParam === 'review') {
    // The server HTML has no comparison, so the element would never render before hydration. Give
    // it one, as a host that sets the property itself would, so its light DOM exists by then.
    Object.assign(host()!, {
      comparison: comparisonOfReview(),
      pending: propsState.reviewPending,
    });
  }
  resetCounts();
  if (hydrate === 'sync') {
    flushSync(() => {
      if (defineAfter) window.__releaseDefinitions?.();
      start();
    });
    return;
  }
  if (defineAfter) window.__releaseDefinitions?.();
  if (hydrate === 'task') {
    await new Promise<void>((done) => {
      setTimeout(done, 0);
    });
  } else {
    await host()?.updateComplete;
  }
  start();
}

if (mode === 'hydrate-late') {
  void hydrateLate();
} else if (mode === 'hydrate') {
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
// Removes the render props of the group, or gives them again when they are all gone.
const toggleSlot = (name: string): void => {
  const names = propsState.slotNames ?? modeSlotNames();
  propsState.slotNames = names.includes(name)
    ? names.filter((entry) => entry !== name)
    : [...names, name];
};
// These two buttons are made here, not in react-slots.html.
const toggles: [string, string][] = [
  ['toggle-plan-cta', 'Toggle plan CTA render prop'],
  ['toggle-summary', 'Toggle summary render prop'],
  ['toggle-review-pending', 'Toggle the pending prop of the review (wrapper=review)'],
];
for (const [id, label] of toggles) {
  const button = document.createElement('button');
  button.id = id;
  button.type = 'button';
  button.textContent = label;
  document.body.append(button);
}
onClick('toggle-plan-cta', () => toggleSlot('plan'));
onClick('toggle-summary', () => toggleSlot('summary'));
onClick('toggle-review-pending', () => {
  propsState.reviewPending = !propsState.reviewPending;
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
