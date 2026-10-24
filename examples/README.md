# Examples

Runnable integrations that use the real built package. Run each from the
repository root after `pnpm install`.

- [vanilla](./vanilla): full showcase with variables, billing, plans, add-ons,
  language, theme, rendering modes, resolved state and events.
  Run: `pnpm demo`
- [react](./react): the `pricing-renderer/react` wrapper with an `onAction`
  handler that owns checkout. Run: `pnpm demo:react`
- [next](./next): a server-rendered Next.js page with only the interactive
  renderer behind a client boundary. Run: `pnpm demo:next`
- [vue](./vue): Vue 3 and Vite using the web component with `isCustomElement`,
  `.prop` bindings and all four events. Run:
  `pnpm build && pnpm --filter pricing-renderer-vue-demo dev`, then open
  http://127.0.0.1:4176. See [Vue 3 and Vite](../docs/vue.md).
