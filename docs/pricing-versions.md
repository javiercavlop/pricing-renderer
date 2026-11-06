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
- **Manual SPACE service**: `GET /services/{serviceName}/pricings/new-contracts`, the version SPACE
  assigns to new contracts.

| Visitor and service                              | Version shown                              |
| ------------------------------------------------ | ------------------------------------------ |
| Signed out, any service                          | The version for new contracts (see above)  |
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

## Ask SPACE for the YAML, not for the parsed pricing

From SPACE 1.8.0 a version has two representations, and only one of them renders:

```text
GET /services/{serviceName}/pricings/{pricingVersion}?format=yaml   <- use this
GET /services/{serviceName}/pricings/{pricingVersion}               <- parsed JSON
```

`format=yaml` returns the stored Pricing2Yaml file **byte for byte**, with `ETag` (the SHA-256 of the
body) and `X-Pricing-Syntax-Version`, both exposed to browsers through CORS. Send the body to the
renderer as `yaml`, or let the browser fetch your proxy of it through `src`.

The parsed JSON of the other route does **not** render. It carries no `syntaxVersion`, so
`normalizePricing` rejects it with `PR_VERSION_INVALID` and nothing is drawn. It also stores a `name`
for every plan, add-on and feature equal to its own key, so even once a host supplies the missing
version by hand the page reads `basic` and `pomodoroTimer` instead of `Basic` and `Pomodoro Timer`:
the renderer honours an explicit `name` and never second-guesses it. The YAML has no such fields, so
the identifiers are humanized and the labels come out as the author wrote them.

Measured on the same version of the same pricing:

| Source         | Plans                                  | Features                            |
| -------------- | -------------------------------------- | ----------------------------------- |
| `?format=yaml` | Basic, Advanced, Premium               | Pomodoro Timer, Sound Notifications |
| parsed JSON    | does not render (`PR_VERSION_INVALID`) | —                                   |

`404` with `{"error": "PRICING_YAML_UNAVAILABLE"}` means the version exists but its file cannot be
served; fall back to your own copy or show the error. Despite its name, the `public-url` endpoint
returns this same authorized route with `requiresAuthentication: true`: SPACE does not serve pricing
files as static files, so a URL of that kind is not something a browser can fetch directly.

## What SPACE does (as looked up, not tested here)

- A service has a source, `manual` or `sphere`. For a `sphere` service, SPACE computes `sphere.target`
  from `sphere.policy` and `selectedVersionId`, and new contracts are forced to that target.
- Sync from SPHERE is opt-in (`SPHERE_SYNC_ENABLED`). When enabled, the default poll is every 5 minutes;
  `pollIntervalMinutes` can be 1, 5 or 15.
- `GET /services/{serviceName}/pricings/new-contracts` answers with the version SPACE assigns to new
  contracts, which is the one a signed-out visitor should see. It takes precedence over the version
  route, so a version literally named `new-contracts` cannot be read; avoid that name.
- SPACE authenticates with an `x-api-key` header, and organization keys are long-lived: the key stays
  on the host backend, never in the browser. For a credential a browser may hold, SPACE now issues
  **pricing tokens** from `POST /api/v1/features/{userId}/pricing-token`, signed with ES256 and
  verifiable against `GET /api/v1/.well-known/jwks.json`. They are short-lived and scoped to one
  user, which is what `request.headers` is for; see [Private pricings](./private-pricings.md).

Confirm these against the SPACE version you run; the routes above arrived in SPACE 1.8.0.

## Server-side example

A Server Component, in the style of [Next.js](./nextjs.md), which has the full flow. `getSpacePricingYaml`
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
  // ?format=yaml, so the document keeps its syntaxVersion and its own labels.
  const yaml = await getSpacePricingYaml('acme', version);

  return <PricingView yaml={yaml} />;
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
