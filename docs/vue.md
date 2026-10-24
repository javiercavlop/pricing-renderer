# Vue 3 and Vite

`<pricing-renderer>` is a standard custom element, so Vue 3 renders it without a
wrapper. This guide covers the Vite setup, how to pass data in, how to listen to
its events and the mistakes seen most often. For the event payloads see the
[events reference](./events.md). A runnable app, if present in the repository,
lives in `examples/vue`.

## Install and register

```bash
pnpm add pricing-renderer
```

Import the registration and the styles once, for example in `src/main.ts`:

```ts
import { createApp } from 'vue';
import 'pricing-renderer/define';
import 'pricing-renderer/styles.css';
import App from './App.vue';

createApp(App).mount('#app');
```

`pricing-renderer/define` registers the `pricing-renderer` tag and is safe to
import more than once. `pricing-renderer/styles.css` is the base and the theme
combined; `base.css` and `theme.css` are also exported.

## Tell Vue the tag is a custom element

Without this, Vue looks for a component called `pricing-renderer` and warns
`Failed to resolve component: pricing-renderer`. In `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'pricing-renderer',
        },
      },
    }),
  ],
});
```

## Pass data in: properties and attributes

Most inputs are JavaScript properties, not attributes. Bind them with the
`.prop` modifier so Vue sets `element.selection = value` instead of writing an
attribute.

Property only (no attribute exists), bind with `.prop`:

- `pricing`, `yaml`: `:pricing.prop="pricing"`
- `request`, `loadPricing`, `normalizeOptions`, `expressionOptions`
- `selection`, `defaultSelection`: `:selection.prop="selection"`
- `presentation`, `messages`: `:presentation.prop="presentation"`
- `selectionEnabled`, `ctaEnabled`, `variablesEnabled`: `:selectionEnabled.prop="false"`

String attributes, written as plain attributes:

- `src`, `mode`, `layout`, `visibility`, `theme`, `locale`
- `pricing-path` (property `pricingPath`) and `loading-label` (property
  `loadingLabel`)

Provide exactly one of `pricing`, `yaml` or `src`; otherwise the element reports
`PR_SOURCE_MISSING` or `PR_SOURCE_CONFLICT` in a `pricing-diagnostic` event.

```vue
<script setup lang="ts">
import { ref } from 'vue';

const pricing = ref<Record<string, unknown>>({});
const presentation = {
  ctas: [{ id: 'start', planId: 'growth', label: 'Start' }],
};
</script>

<template>
  <pricing-renderer
    :pricing.prop="pricing"
    :presentation.prop="presentation"
    locale="en-US"
    pricing-path="/pricing"
    theme="auto"
  />
</template>
```

Setting the `selection` property makes the selection controlled by the host:
the element renders it and reports changes, and your handler must store the new
value. Leave `selection` unset for an uncontrolled element and use
`defaultSelection` for the starting point.

## Listen to events

Vue listens to the custom event name as written, so use the hyphenated names
directly:

```vue
<script setup lang="ts">
import type {
  PricingActionEvent,
  PricingDiagnosticEvent,
  PricingReadyEvent,
  PricingSelectionChangeEvent,
} from 'pricing-renderer/element';

function onReady(event: PricingReadyEvent) {
  console.info(event.detail.resolved.subtotal);
}

function onSelectionChange(event: PricingSelectionChangeEvent) {
  console.info(event.detail.selection, event.detail.resolved);
}

function onDiagnostic(event: PricingDiagnosticEvent) {
  for (const diagnostic of event.detail.diagnostics) {
    console.warn(diagnostic.code, diagnostic.path);
  }
}

function onAction(event: PricingActionEvent) {
  event.preventDefault(); // the host owns checkout and navigation
  startCheckout(event.detail.actionId, event.detail.planId, event.detail.selection);
}
</script>

<template>
  <pricing-renderer
    src="/pricing.yml"
    @pricing-ready="onReady"
    @pricing-selection-change="onSelectionChange"
    @pricing-diagnostic="onDiagnostic"
    @pricing-action="onAction"
  />
</template>
```

- `pricing-action` is cancelable. Call `event.preventDefault()` to stop the
  default navigation to `href` and run your own checkout. The detail has
  `actionId`, `planId`, `href`, `selection`, `resolved` and `metadata`.
- `pricing-ready` fires after each successful load, with `pricing`,
  `diagnostics`, `selection` and `resolved`.
- `pricing-selection-change` fires when the user changes the selection, with
  `selection` and `resolved`.
- `pricing-diagnostic` carries `diagnostics`, a list of objects with `code`,
  `severity`, `message` and `path`.

The types are exported from `pricing-renderer/element`, together with the
`PricingRendererElement` class. Vue's template type checker may type `@` handlers
as `Event`; annotate the handler parameter as above, or cast inside the
handler, when your tooling does so.

## Load the current contract

To open the page on the plan and add-ons a customer has today, call
`applySelection` on the element once the pricing is ready. Get the element with a
template ref and call it from `@pricing-ready`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { PricingRendererElement } from 'pricing-renderer/element';
import { selectionFromContract } from './map-contract';

const props = defineProps<{ contract: Parameters<typeof selectionFromContract>[0] }>();
const renderer = ref<PricingRendererElement | null>(null);

function onReady() {
  renderer.value?.applySelection(selectionFromContract(props.contract, 'acme'));
}
</script>

<template>
  <pricing-renderer ref="renderer" src="/pricing.yml" @pricing-ready="onReady" />
</template>
```

`applySelection` is refused with `PR_SELECTION_NOT_READY` while the pricing is
loading, and with `PR_SELECTION_CONTROLLED` when you set the `selection`
property. See [Preload the current subscription](./preload-current-subscription.md)
for the contract mapping, the billing period, diagnostics and reloads.

## Common pitfalls

- **`Failed to resolve component: pricing-renderer`.** The `isCustomElement`
  option is missing or the tag name does not match. Restart the dev server after
  changing `vite.config.ts`.
- **An object shows as `[object Object]` or is ignored.** Without `.prop`, Vue
  may set an attribute, which is a string. Use `:pricing.prop="pricing"`,
  `:selection.prop="selection"` and the same for every object property in the
  list above.
- **The listener never runs.** Check the spelling: the names are
  `pricing-ready`, `pricing-selection-change`, `pricing-action` and
  `pricing-diagnostic`. There is no camel-case form to use in a Vue template.
- **`pricing-ready` does not fire for a listener added later.** The event fires
  once per load. If you attach the listener after the first load, read
  `renderer.value?.resolvedState` for the current state.
- **Checkout opens twice.** Call `event.preventDefault()` in `@pricing-action`,
  or the element also follows `href`.
- **Nothing is rendered on the server.** The element needs the browser. In a
  server-rendered app such as Nuxt, import `pricing-renderer/define` only on the
  client (for example in a client-only plugin or component) and render the tag
  inside `<ClientOnly>`. The library does not render pricing content on the
  server.

## See also

- [Events reference](./events.md)
- [Preload the current subscription](./preload-current-subscription.md)
- [API reference](./api-reference.md)
- [Configuration](./configuration.md)
