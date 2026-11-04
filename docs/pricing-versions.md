# Which pricing version a page shows

A service can have several versions of its pricing. SPACE contracts pin the version a customer signed
up for, and new contracts can use a newer one. The page has to choose one version to render. This guide
gives the rule and the reasons for it.

## The rule

- **Signed out**: the version SPACE assigns to new contracts.
- **Signed in, with a contract**: the contract's version,
  `contract.contractedServices[service]`, with a notice when new contracts use a newer version.

The version that SPACE assigns to new contracts depends on how the service is registered:

- **SPHERE-linked SPACE service**: the service's `sphere.target`.
- **Manual SPACE service**: the host decides which version to show, until SPACE has a default version
  for new contracts.

| Visitor and service                              | Version shown                              |
| ------------------------------------------------ | ------------------------------------------ |
| Signed out, any service                          | The version for new contracts (see below)  |
| Signed in with a contract, SPHERE-linked service | The contract's version                     |
| Signed in with a contract, manual service        | The contract's version                     |
| Signed in with a contract, SPACE-managed service | The contract's version, read through SPACE |

For a signed-in customer the notice appears when the contract's version differs from the version for
new contracts. For a SPHERE-linked service that version is `sphere.target`; for a manual service it is
the host's choice.

A signed-out visitor is a prospect, so the page shows what they would get if they signed up today. A
customer is billed against the version in their contract, so the page shows that one. The notice tells
them a newer version exists for new contracts, so they are not surprised when a colleague's contract
differs.

## Read a managed service through SPACE

If SPACE manages the service, always get the pricing through SPACE, using your backend. Never read it
straight from SPHERE. Two reasons:

- By default, when sync is enabled, SPACE syncs from SPHERE every 5 minutes, so what SPACE serves can
  lag what SPHERE has just published. A page that reads SPHERE directly can show a version that SPACE does not offer yet.
- The SPACE policy can pin a version. A direct SPHERE read ignores the pin, so the page and the
  contract can disagree about what is on sale.

The renderer makes no call to SPACE. Your backend resolves the version for the visitor, fetches that
pricing from SPACE and serves it. Pass the result to `<pricing-renderer>` as `src` or as a document.

## What SPACE does (as looked up, not tested here)

- A service has a source, `manual` or `sphere`. For a `sphere` service, SPACE computes `sphere.target`
  from `sphere.policy` and `selectedVersionId`, and new contracts are forced to that target.
- Sync from SPHERE is opt-in (`SPHERE_SYNC_ENABLED`). When enabled, the default poll is every 5 minutes;
  `pollIntervalMinutes` can be 1, 5 or 15.
- SPACE's `showPricing` returns JSON, not YAML. The host backend therefore passes the result to the
  renderer as `pricing`, not as `yaml`. Check it with the diagnostics that `normalizePricing` returns.
- SPACE authenticates with an `x-api-key` header. User keys (`usr_`) and organization keys (`org_`)
  are both long-lived, and no short-lived token was found. The key stays on the host backend; see
  [Private pricings](./private-pricings.md).

Confirm these against the SPACE version you run.

## Server-side example

A Server Component, in the style of [Next.js](./nextjs.md), which has the full flow. `getSpacePricing`
and `getSession` stand for your backend code; the key is read there, never in the browser.

```tsx
import 'server-only';
import { contractedVersion } from 'pricing-renderer/space';
import { PricingView } from './pricing-view';

export default async function Page() {
  const session = await getSession(); // null when signed out
  const version = session
    ? contractedVersion(session.contract, 'acme') // contract's version, e.g. '2026.07'
    : undefined; // undefined: SPACE returns the version for new contracts
  const pricing = await getSpacePricing('acme', version); // JSON from SPACE, not YAML

  return <PricingView pricing={pricing} />;
}
```

## Planned: the SPHERE loader

A loader for public SPHERE pricings is planned ([Private pricings](./private-pricings.md#planned-a-sphere-public-loader)).
It will serve only services that SPACE does not manage. A SPACE-managed service is still read through
SPACE.

## Pick the version in the host

```ts
import { contractedVersion } from 'pricing-renderer/space';

// `newContractVersion` comes from your backend: sphere.target for a SPHERE-linked service,
// or your own choice for a manual one.
function versionToShow(contract, serviceKey, newContractVersion) {
  const contracted = contractedVersion(contract, serviceKey);
  if (!contracted) return { version: newContractVersion, notice: false }; // signed out, or no contract
  return { version: contracted, notice: contracted !== newContractVersion };
}
```

`contractedVersion` is described in [Preload the current subscription](./preload-current-subscription.md).
It returns the dotted version (`2026.07`), while SPACE stores `2026_07`. Compare versions in one form.
Showing the notice, and its wording, is up to the host: the renderer has no such element.

Equality is a simple check. If your versions have an order, compare them with that order to be sure
that the new contracts use a newer one, not just a different one.

## Plan names depend on the version

A contract's plan and add-on names belong to the version it was signed on. If the page shows another
version, a name can be missing there. `applySelection` then reports `PR_SELECTION_UNKNOWN_PLAN` or
`PR_SELECTION_UNKNOWN_ADDON` and keeps what is valid. For a signed-in customer, load the contract's
version, so the names match.

## See also

- [Preload the current subscription](./preload-current-subscription.md)
- [Private pricings](./private-pricings.md)
- [Next.js](./nextjs.md)
