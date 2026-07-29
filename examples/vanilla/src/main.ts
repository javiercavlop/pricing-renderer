import 'pricing-renderer/define';
import 'pricing-renderer/styles.css';
import type { PricingActionEvent, PricingRendererElement } from 'pricing-renderer/element';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';
import './page.css';

const renderer = document.querySelector<PricingRendererElement>('pricing-renderer')!;
const locale = document.querySelector<HTMLSelectElement>('#locale')!;
const theme = document.querySelector<HTMLSelectElement>('#theme')!;
const output = document.querySelector<HTMLOutputElement>('#action-output')!;

renderer.yaml = pricingYaml;
renderer.locale = locale.value;
renderer.theme = 'light';

locale.addEventListener('change', () => {
  renderer.locale = locale.value;
});

theme.addEventListener('change', () => {
  renderer.theme = theme.value as 'light' | 'dark' | 'auto';
  document.documentElement.dataset.theme = theme.value;
});

renderer.addEventListener('pricing-action', ((event: PricingActionEvent) => {
  event.preventDefault();
  output.value = `Action: ${event.detail.actionId} — ${event.detail.resolved.subtotal}`;
}) as EventListener);
