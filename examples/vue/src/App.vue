<script setup lang="ts">
import { ref } from 'vue';
import type {
  PricingActionEvent,
  PricingDiagnosticEvent,
  PricingReadyEvent,
  PricingSelectionChangeEvent,
} from 'pricing-renderer/element';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

const lastEvent = ref('none yet');
const lastDetail = ref('');
const lastTotal = ref<unknown>(null);
const diagnosticCodes = ref<string[]>([]);
const lastAction = ref('');

function record(name: string, detail: unknown) {
  lastEvent.value = name;
  lastDetail.value = JSON.stringify(detail, null, 2);
}

function onReady(event: PricingReadyEvent) {
  lastTotal.value = event.detail.resolved.subtotal;
  record('pricing-ready', event.detail.resolved);
}

function onSelectionChange(event: PricingSelectionChangeEvent) {
  lastTotal.value = event.detail.resolved.subtotal;
  record('pricing-selection-change', event.detail.selection);
}

function onAction(event: PricingActionEvent) {
  // The host owns checkout: stop the default navigation to `href`.
  event.preventDefault();
  lastAction.value = JSON.stringify(event.detail.selection);
  record('pricing-action', {
    actionId: event.detail.actionId,
    planId: event.detail.planId,
    href: event.detail.href,
  });
}

function onDiagnostic(event: PricingDiagnosticEvent) {
  diagnosticCodes.value = event.detail.diagnostics.map((diagnostic) => diagnostic.code);
  record('pricing-diagnostic', event.detail.diagnostics);
}
</script>

<template>
  <main>
    <!-- Objects and booleans are properties (.prop); locale and theme are attributes. -->
    <pricing-renderer
      :yaml.prop="pricingYaml"
      :selectionEnabled.prop="true"
      :ctaEnabled.prop="true"
      :variablesEnabled.prop="true"
      locale="en-US"
      pricing-path="/pricing"
      theme="light"
      @pricing-ready="onReady"
      @pricing-selection-change="onSelectionChange"
      @pricing-action="onAction"
      @pricing-diagnostic="onDiagnostic"
    />

    <section aria-label="Live events">
      <h2>Live events</h2>
      <p>Last event: {{ lastEvent }}</p>
      <p>Last total (resolved.subtotal): {{ lastTotal ?? 'n/a' }}</p>
      <p>Diagnostics: {{ diagnosticCodes.length ? diagnosticCodes.join(', ') : 'none' }}</p>
      <p v-if="lastAction">Checkout requested by the host with selection {{ lastAction }}</p>
      <pre>{{ lastDetail }}</pre>
    </section>
  </main>
</template>
