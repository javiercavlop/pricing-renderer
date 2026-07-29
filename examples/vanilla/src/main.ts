import { formatCurrency, humanizeIdentifier, type NormalizedPricing } from 'pricing-renderer';
import 'pricing-renderer/define';
import type {
  PricingActionEvent,
  PricingDiagnosticEvent,
  PricingReadyEvent,
  PricingRendererElement,
  PricingSelectionChangeEvent,
} from 'pricing-renderer/element';
import 'pricing-renderer/styles.css';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';
import './page.css';

const renderer = document.querySelector<PricingRendererElement>('pricing-renderer')!;
const locale = document.querySelector<HTMLSelectElement>('#locale')!;
const theme = document.querySelector<HTMLSelectElement>('#theme')!;
const mode = document.querySelector<HTMLSelectElement>('#mode')!;
const reset = document.querySelector<HTMLButtonElement>('#reset-demo')!;
const output = document.querySelector<HTMLOutputElement>('#action-output')!;
const rendererStatus = document.querySelector<HTMLElement>('#renderer-status')!;
const selectedPlan = document.querySelector<HTMLElement>('#selected-plan')!;
const knownSubtotal = document.querySelector<HTMLElement>('#known-subtotal')!;
const lastEvent = document.querySelector<HTMLElement>('#last-event')!;

let normalizedPricing: NormalizedPricing | undefined;
let toastTimer: number | undefined;

renderer.yaml = pricingYaml;
renderer.locale = locale.value;
renderer.theme = 'light';
renderer.mode = 'commercial';

function setLastEvent(name: string): void {
  lastEvent.textContent = name;
}

function showToast(message: string): void {
  output.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    output.value = '';
  }, 4_500);
}

locale.addEventListener('change', () => {
  renderer.locale = locale.value;
  setLastEvent('locale-change');
});

theme.addEventListener('change', () => {
  renderer.theme = theme.value as 'light' | 'dark' | 'auto';
  document.documentElement.dataset.theme = theme.value;
  setLastEvent('theme-change');
});

mode.addEventListener('change', () => {
  renderer.mode = mode.value as 'commercial' | 'catalog';
  setLastEvent('mode-change');
});

reset.addEventListener('click', () => {
  void renderer.reload();
  setLastEvent('renderer-reload');
  showToast('The YAML fixture and interactive selection were reset.');
});

renderer.addEventListener('pricing-ready', ((event: PricingReadyEvent) => {
  normalizedPricing = event.detail.pricing;
  rendererStatus.innerHTML = '<i></i> Ready';
  setLastEvent('pricing-ready');
}) as EventListener);

renderer.addEventListener('pricing-selection-change', ((event: PricingSelectionChangeEvent) => {
  const planId = event.detail.selection.planId;
  selectedPlan.textContent =
    normalizedPricing?.plans.find((plan) => plan.id === planId)?.name ??
    (planId ? humanizeIdentifier(planId) : 'None');
  knownSubtotal.textContent = formatCurrency(
    event.detail.resolved.subtotal,
    normalizedPricing?.metadata.currency ?? 'EUR',
    locale.value,
  );
  setLastEvent('pricing-selection-change');
}) as EventListener);

renderer.addEventListener('pricing-action', ((event: PricingActionEvent) => {
  event.preventDefault();
  setLastEvent('pricing-action');
  showToast(
    `Action “${event.detail.actionId}” captured by the host · ${formatCurrency(
      event.detail.resolved.subtotal,
      normalizedPricing?.metadata.currency ?? 'EUR',
      locale.value,
    )}`,
  );
}) as EventListener);

renderer.addEventListener('pricing-diagnostic', ((event: PricingDiagnosticEvent) => {
  setLastEvent('pricing-diagnostic');
  const errors = event.detail.diagnostics.filter((item) => item.severity === 'error').length;
  if (errors > 0) showToast(`${errors} pricing diagnostic${errors === 1 ? '' : 's'} reported.`);
}) as EventListener);
