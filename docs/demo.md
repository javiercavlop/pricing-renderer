# Demo and visual validation

The Vanilla showcase is the acceptance surface for `0.1.0`. It uses the actual
package build and a Pricing2Yaml fixture; it is not a static mock-up.

## Run locally

```bash
pnpm install
pnpm demo
```

Open the URL printed by Vite. The showcase lets reviewers:

- change locale, theme, and commercial/catalog mode;
- switch billing periods;
- edit a numeric variable, boolean variable, and select variable;
- choose plans and observe add-on compatibility;
- inspect typed feature/usage-limit highlights, verified plan inheritance, and
  optional featured badges;
- select a multicontractable add-on and change its constrained quantity;
- trigger dependency/exclusion confirmation;
- inspect known subtotal and emitted event state;
- activate CTA events without performing a real checkout.

## React example

```bash
pnpm demo:react
```

This example exercises the React 18/19 adapter and typed event callbacks.

## Next App Router example

```bash
pnpm demo:next
```

Open `/pricing`; `/` redirects there to demonstrate the library's configurable
canonical default path. The page remains a Server Component and passes a
serializable YAML string to a small `PricingClient` boundary. This demonstrates
SSR-safe imports without claiming deep light-DOM SSR.

## Acceptance checklist

Before publishing a release:

1. Review the Vanilla demo at 320, 375, 599, 600, 839, 840, 1024, 1200, and
   1440 px.
2. Review light, dark, forced-colors, RTL, reduced-motion, long text, and 400%
   zoom.
3. Complete the interaction path above with keyboard only.
4. Run `pnpm test:browser` for Chromium, Firefox, WebKit, and Axe.
5. Confirm there is no document-level horizontal overflow.
6. Confirm the README screenshots match the current renderer.
7. Obtain explicit maintainer approval of this example.
8. Follow the [release guide](./releasing.md), including changing the README
   from pending to published wording before creating the version tag.

The npm publication workflow must not run before step 8. A source repository
push, tag, draft release, or documentation preview is not publication approval;
publishing the GitHub Release is.

## Updating screenshots

README captures are generated from the live Vanilla demo and stored in
`docs/assets/`. Use deterministic fixture data, default fonts, and the documented
viewports. Re-capture when the default theme or information architecture changes,
then run visual regression tests and review diffs rather than accepting them
blindly.
