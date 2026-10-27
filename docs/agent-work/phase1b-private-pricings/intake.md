# Intake: phase1b-private-pricings, loading public and private pricings safely

- Origin: owner request `own-0a8bc0e65ad74eec86dcfa5c8c0ebf1a` (phase 1b). Planner intake, 2026-10-27.
- Base: `465e248` (task branch `task/fc479a51645243e6`).
- INTENT link: **O3, "a stable public API and package across the integrations"** (`INTENT.md:62-64`:
  "the same package serves the Web Component, React, Next and the Vue example"). Constraint: a
  public API change needs a CRP first (`INTENT.md:108-109`). Non-goal kept: the core stays DOM-free
  and SSR-safe (`INTENT.md:96`). The new code goes in `pricing-renderer/yaml`, not in the core.
- No release: every slice adds a pending changeset (`.changeset/README.md:3`). Nothing goes to
  `main` (`INTENT.md:137-138`).

## Objective

1. A security guide, `docs/private-pricings.md`.
2. `createSpherePublicLoader` in `pricing-renderer/yaml`, with unit tests that replay recorded
   responses.
3. An optional ETag cache hook for the built-in `src` loader.
4. A Next.js guide, `docs/nextjs.md`.
5. A guide on which pricing version a page should show. The owner has already decided this policy.

## Verified facts in the repository (file:line at `465e248`)

Loader and element:

- The built-in loader is `loadPricingFromUrl` (`src/yaml/load.ts:42-119`). It accepts only
  `http:`/`https:` (`:52-54`). Credentials default to `'omit'` (`:66,85`). The timeout defaults to
  15 s and the size limit to 2 MiB (`:6-7,56-57`, enforced at `:95-102`). There is an external abort
  signal (`:22-40`). Headers can be a value or an async function (`:16-20`; type at
  `src/yaml/types.ts:9`). A host `loadPricing` receives `{ url, signal, request }`, with the headers
  already resolved (`load.ts:61-71`, `types.ts:16-24`).
- The loader keeps no cache and sends no `If-None-Match`. Grep for `etag|If-None-Match` in `src/`:
  no match.
- **Security, error text:** when a host `loadPricing` or `fetch` throws, its `error.message` becomes
  the diagnostic message (`load.ts:106-114`). The element shows that message on screen
  (`src/element/pricing-renderer-element.ts:957-959`) and dispatches it in `pricing-diagnostic`. A
  loader must never put a token or a signed URL in an error message.
- **Security, `src` is reflected:** `src` is declared `{ type: String, reflect: true }`
  (`pricing-renderer-element.ts:104`), so a signed URL or token in `src` ends up in the DOM
  attribute. `request` and `loadPricing` are property-only (`:105-106`), which matches
  `README.md:373` ("Secrets are property-only"). The README also suggests `loadPricing` for signed
  URLs (`README.md:387`).
- `README.md:375-385` shows `credentials: 'include'` together with a bearer token for a
  cross-origin URL. S1 replaces it with the same-origin default.
- The element reloads whenever `pricing`, `yaml`, `src`, `request`, `loadPricing` or
  `normalizeOptions` changes (`pricing-renderer-element.ts:235-245`). The first load runs in
  `firstUpdated` (`:216-225`), so it never runs on the server. `loadPricing` is used only together
  with `src` (`:253-257,291-297`). The React union types enforce the same pairing
  (`src/react/index.ts:38-59`).
- React passes props through `createComponent` (`src/react/index.ts:26-36,95-101`). A `request` or
  `loadPricing` value that gets a new identity on every render therefore reloads the pricing on
  every render. This is the evidence for the `useMemo` advice in S4.
- `configurePricingRenderer` is module-global (`src/core/config.ts:12,86-91`). The element reads it
  in its constructor (`pricing-renderer-element.ts:184-190`). The docs already say "Do not mutate it
  per request in a shared SSR process" (`docs/configuration.md:244-248`). The Next example calls it
  at the top of the client module (`examples/next/app/pricing-client.tsx:1-12`).
- The Next example passes a YAML string from a Server Component to the client island
  (`examples/next/app/pricing/page.tsx:3,82`). It pins Next 16.4.3
  (`examples/next/package.json:9`). The React entry is `'use client'` (`src/react/index.ts:1`). Full
  content appears after hydration (`README.md:245-247`, `docs/architecture.md:94-99`).
- `docs/architecture.md:97-98` says "The library does not fetch remote sources on the server".
  Once host server code can call the SPHERE loader, this sentence must be narrowed to the element
  (S2).
- Exports: `./yaml` already exists (`package.json:37-40`; `src/yaml/index.ts:1-10`), so no new
  entry point is needed. The runtime dependencies are `@lit/react`, `lit` and `yaml`
  (`package.json:83-87`). "Dependency-free" means no new dependency.
- Typecheck covers `src/` only (`tsconfig.json:3-7`; `tsconfig.yaml.json:4,10` has `DOM` in `lib`,
  so `fetch`, `Headers` and `Response` types are available). Vitest runs only
  `tests/unit/**/*.test.ts` in `node` (`vitest.config.ts:5-6`). The existing loader tests inject
  `fetch` and use no network (`tests/unit/load.test.ts:14-25`).
- **Coupling:** every quoted `'PR_*'` code in `src/` must have a row in `docs/events.md`, and no
  other `PR_` token may appear in `src/` (`tests/unit/docs-examples.test.ts:59-64,81-82,101-106`).
  A slice that adds a diagnostic code also owns `docs/events.md`.
- The custom-elements manifest names the types `PricingRequestOptions` and `PricingLoader`
  (`custom-elements.json:22,24`). S3 keeps both names, so the manifest does not change.
- SPACE today: `docs/preload-current-subscription.md:8-31` and
  `examples/space-contract/map-contract.ts:3-6` model only `subscriptionPlans` and
  `subscriptionAddOns`. Neither has `contractedServices` (the version).
- The checks the owner listed exist as scripts: `typecheck`, `lint`, `test` and `format:check`
  (`package.json:122-126`). `openspec/` does not exist at the base (glob: no match). Earlier changes
  kept their specs in `docs/agent-work/<id>/spec.md`
  (`docs/agent-work/delivera-2-load-current-contract/spec.md`).

## External facts (lookup answers; data, medium confidence)

- SPHERE v2.6.0 is tag commit `8472610744ad5fdab474e4ab0533ce7f5425d521`. The repository may now
  be `SCORELabUS/SPHERE`.
- `GET {base}/api/v1/public/pricings/:pricingId` returns
  `{ pricingId, name, permanentUrl, latestVersionId, versions[] }`. Each version is
  `{ versionId, version, createdAt, contentHash }`. Only `private: false` versions are listed.
  Source: `api/src/main/routes/PermanentLinkRoutes.ts` and
  `api/src/main/services/PermanentLinkService.ts` at v2.6.0.
- `GET {base}/api/v1/public/pricings/:pricingId/versions/:versionId/yaml` returns the raw YAML
  (`application/yaml`). Unknown or private versions get 404 `{"error":"Resource unavailable"}`.
  Other errors get 503.
- `respond()` sets `Cache-Control: private, no-cache` and a strong, quoted ETag (the SHA-256 hex of
  the body). It answers 304 only when `If-None-Match` is exactly equal to that value.
- Ids are checked with `mongoose.isObjectIdOrHexString`, so they are 24-hex.
- CORS is `app.use(cors())` with no options (`GlobalMiddlewaresLoader.ts`). The `cors` defaults
  allow any origin and set **no `Access-Control-Expose-Headers`** (expressjs/cors README). So
  **browser code on another origin cannot read `ETag`.** Manual ETag revalidation only works in
  server code or behind a same-origin proxy. In the browser, the HTTP cache revalidates by itself,
  because the response is `no-cache` with an ETag.
- Permanent link: `{SPHERE_PUBLIC_URL}/p/{pricingId}`. `SPHERE_PUBLIC_URL` defaults to
  `https://sphere.score.us.es`. The README documents `/api/v1` on the same origin as the site.
  Production nginx was not read.
- SPACE (main branch): a contract has `contractedServices` (service to pricing version),
  `subscriptionPlans`, `subscriptionAddOns`, `userInformation`, `billingPeriod`, `usageLevels` and
  `history[]` (SPHERE iSubscription docs).
- A SPACE service has `source: 'manual' | 'sphere'` and `sphere.target` (a computed `SphereVersion`,
  driven by `sphere.policy` and `selectedVersionId`). New contracts are forced to the target. The
  sync runs every 5 minutes with jitter, is opt-in (`SPHERE_SYNC_ENABLED=true`) and allows
  `pollIntervalMinutes` of 1, 5 or 15. Source: `docs/sphere-synchronization.md`,
  `api/src/main/services/sphere/types.ts`.
- SPACE authenticates with `x-api-key`. User keys (`usr_`) and organisation keys (`org_`) both
  exist. `GET /api/v1/services/:name/pricings/:version` accepts organisation keys only. The
  organisation-scoped route accepts user keys. No short-lived token for reading a pricing was
  found.
- **`showPricing` returns JSON (`res.json(pricing)`), not YAML.** No "default version for new
  contracts" exists for manual services. Source: `AuthMiddleware.ts`, `config/permissions.ts`,
  `ServiceController.ts`, `models/Service.ts`.
- Corrections to the research summary:
  - "SPACE has only organisation keys": user keys also exist, but they are long-lived too, so the
    conclusion (no short-lived token) holds.
  - "SPACE syncs every 5 minutes": that is the default, and the sync is opt-in.
  - Private SPHERE access ("sk- key or 24h JWT") was **not** verified here. S1 verifies it before it
    names the formats.

## Scope and slices

Five capabilities, five PRs into `develop`, each independently mergeable. No feature flag: every
API addition is additive and unreleased (changesets stay pending). Gating it would add API surface
for nothing. Requirement ids are proposals. The spec task (S0) fixes them in
`docs/agent-work/phase1b-private-pricings/spec.md`.

Common checks (argv):

- C-install: `["pnpm","install","--frozen-lockfile"]`
- C-type: `["pnpm","run","typecheck"]`
- C-lint: `["pnpm","run","lint"]`
- C-test: `["pnpm","run","test"]`
- C-fmt: `["pnpm","run","format:check"]`

No Playwright in the lab.

### S0: spec (after CRP-1 and CRP-2 are answered)

- Role: specifier. Turn budget 30. Risk: medium (spec only, but it fixes a public API).
- Owns: `docs/agent-work/phase1b-private-pricings/spec.md`.
- Content: EARS requirements and Given/When/Then for S2 and S3 (ids below). Include the
  documentation requirements of S1, S4 and S5 if the coordinator wants them traced.
- Checks: C-install, `["pnpm","exec","prettier","--check","docs/agent-work/phase1b-private-pricings/spec.md"]`.

### S1: security guide `docs/private-pricings.md` (owner item 1)

- Role: doc-steward. Turn budget 40. Wave 1, in parallel with S2a and S5.
- Owns:
  - `docs/private-pricings.md` (new).
  - `README.md`: only the "Private remote sources" section (`README.md:371-389`) and one line in the
    Documentation list (`:432-447`).
  - `.changeset/docs-private-pricings.md` (patch, following `.changeset/docs-events-vue.md`).
- Read-only context: `src/yaml/load.ts`, `src/yaml/types.ts`,
  `src/element/pricing-renderer-element.ts:100-132,251-303,950-973`, `docs/architecture.md:101-111`,
  this intake.
- Content:
  - Never put a SPHERE or SPACE key in browser code. That includes `NEXT_PUBLIC_*` variables.
  - `request.headers` is only for short-lived tokens of the signed-in user.
  - Never put a token in `src`, because it is reflected (`:104`).
  - Loader error messages are shown on screen and dispatched (`load.ts:112-113`,
    `element.ts:957-959`), so no secrets in error messages or logs.
  - Default: a same-origin server route that holds the key and serves YAML (or the JSON pricing
    from SPACE), with `credentials` `'same-origin'` instead of `'include'`. This rewrites
    `README.md:375-385`.
  - Recipes: a Next.js Route Handler, a Server Component, and Express.
  - Pin a `versionId` in production and revalidate with ETag on the server. The route forwards
    `ETag`, answers `304`, and does not cache per-user responses in a shared cache.
  - One sentence with the SPACE rule from owner item 5: a SPACE-managed service is always read
    through SPACE.
  - SPACE returns JSON, so the route passes `pricing`, not `yaml`. Do not claim that SPACE JSON
    normalizes until F5 has a test; say "check it with `normalizePricing` diagnostics".
  - Recipes use plain `fetch` (no dependency on S2). S4 adds the loader cross-link later.
  - Before writing, verify with lookup: Next 16 Route Handler signature, `server-only`, the
    `NEXT_PUBLIC_` inlining rule, and SPHERE private-access credential types. Cite the sources in
    the PR.
- Size: about 250 lines of Markdown.
- Risk: **high**. The score is 1 (auth area +3, docs only -2), but the owner says security matters,
  and the higher level wins. Panel: reviewer and security-auditor.
- Checks: C-install, C-test (the docs-examples test reads `README.md`), C-fmt.
- Requirement ids (optional): `req~doc-private-no-browser-keys~1`, `req~doc-private-server-route~1`.

### S2: `createSpherePublicLoader` (owner item 2), split into S2a (red tests) and S2b (implementation)

The public API shape depends on **CRP-1**.

- S2a, red tests.
  - Role: implementer writing tests first. test-designer writes only `acceptance/**`, and Vitest
    does not run that folder (`vitest.config.ts:6`). This follows the precedent in
    `docs/agent-work/delivera-2-load-current-contract/plan.md:1`. Turn budget 35. Wave 1.
  - Owns: `tests/unit/sphere-loader.test.ts` and `tests/fixtures/sphere/**`: `README.md` with the
    provenance, `manifest.json`, `latest.yml`, `pinned.yml`.
  - Fixtures: recorded responses if the owner supplies them (N1). Otherwise derive them from the
    v2.6.0 source at `8472610`, and say so in the fixture README. The tests compute the ETag the way
    the server does (`"` + SHA-256 hex of the body + `"`, with `node:crypto`). They inject `fetch` and
    use no network.
  - The test imports `* as yaml from '../../src/yaml/index.js'`, and every test first asserts
    `expect(yaml.createSpherePublicLoader).toBeTypeOf('function')`. This way the base fails by
    assertion, not by import.
  - Red-before check (G3):
    `{"argv":["pnpm","exec","vitest","run","tests/unit/sphere-loader.test.ts"],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError","reject_pattern":"is not a function|Cannot find module|SyntaxError","overlay":["tests/unit/sphere-loader.test.ts","tests/fixtures/sphere/README.md","tests/fixtures/sphere/manifest.json","tests/fixtures/sphere/latest.yml","tests/fixtures/sphere/pinned.yml"]}`
  - Other checks: C-install, C-lint, C-fmt.
- S2b, implementation.
  - Role: implementer. Turn budget 50. Wave 2, after S2a is integrated and CRP-1 is answered.
  - Owns:
    - `src/yaml/sphere.ts` (new; its types live in the same file).
    - `src/yaml/index.ts` (export lines).
    - `src/yaml/load.ts`: only to export the abort and limit helpers internally (`:22-40`) for
      reuse.
    - `docs/api-reference.md`: the `pricing-renderer/yaml` section, `:286-314`.
    - `docs/architecture.md:94-111`: narrow "does not fetch on the server" to the element, and add
      the SPHERE loader to the security boundaries.
    - `docs/events.md`: only if CRP-1 picks new codes.
    - `.changeset/sphere-public-loader.md` (minor).
  - Read-only: `tests/unit/sphere-loader.test.ts` (frozen once S2a is integrated), this intake,
    `spec.md`.
- Behaviour (proposed ids):
  - `req~sphere-id-format~1`: `pricingId` and `versionId` must match `/^[0-9a-f]{24}$/i`.
    Otherwise creation throws `TypeError`, as `src/core/config.ts:16,20,32` does.
  - `req~sphere-permanent-link~1`: accept `https://<host>/p/<24hex>`, with an optional trailing
    slash. Reject any other path, a query, a fragment, or a username or password. The link's origin
    is the base unless `baseUrl` is given.
  - `req~sphere-https-origin~1`: `baseUrl` must be an `https:` origin with no path, query, hash or
    userinfo. The default is `https://sphere.score.us.es`. Allowing `http://localhost` is part of
    CRP-1.
  - `req~sphere-latest-version~1`: without `versionId`, GET the manifest, then use
    `latestVersionId`. That id must be 24-hex and present in `versions[]`, so a manifest cannot
    inject a path.
  - `req~sphere-pinned-version~1`: with `versionId`, GET the YAML of that version directly, with no
    manifest request. A 404 means unknown or private. (D3; confirmed in CRP-1.)
  - `req~sphere-etag-cache~1`: cache `{ etag, body }` per request URL only when `ETag` is readable.
    Send `If-None-Match` only when an entry exists. On 304, return the cached body. A browser on
    another origin cannot read ETag, so there it relies on the HTTP cache. The default cache is an
    in-memory map that is bounded (for example 32 entries) and per loader instance.
  - `req~sphere-no-credentials~1`: `credentials: 'omit'` and `redirect: 'error'`. The options take
    no headers or credentials.
  - `req~sphere-limits~1`: the timeout, size limit and abort signal apply to both requests. The
    defaults are those of `load.ts:6-7`.
  - `req~sphere-errors~1`: an HTTP error or an invalid body gives an `Error` whose message holds the
    status and the public ids only, never the response body. Through the element it becomes
    `PR_SOURCE_LOAD_FAILED` (`load.ts:108-114`), unless CRP-1 picks new codes.
  - `req~sphere-element-integration~1`: the returned `src` and `loadPricing` render through the
    element and through `<PricingRenderer>`.
  - `req~sphere-no-dependency~1`: `package.json` dependencies are unchanged.
- Size: about 180 lines of source and about 60 lines of docs (S2b); about 250 lines of tests (S2a).
- Risk: **high**, score 10:
  - public API +3
  - pricing area +3
  - external HTTP input +2
  - caching +1
  - more than one module +1
  - Panel: reviewer, test-reviewer, security-auditor and arch-reviewer.
- Checks (S2b): C-install, C-type, C-lint,
  `["pnpm","exec","vitest","run","tests/unit/sphere-loader.test.ts","tests/unit/load.test.ts","tests/unit/docs-examples.test.ts"]`,
  C-test, C-fmt. Optional, for the coordinator to decide: `["pnpm","run","package:check"]`
  (`package.json:132`; it builds into the ignored `dist/`). It confirms the `./yaml` types.

### S3: ETag cache hook for the `src` loader (owner item 3), split into S3a and S3b

The shape depends on **CRP-2**. It reuses the cache type from S2.

- S3a, red tests.
  - Role: implementer. Turn budget 25. Wave 2, in parallel with S2b; its files do not overlap.
  - Owns: `tests/unit/load-cache.test.ts`.
  - Red-before:
    `{"argv":["pnpm","exec","vitest","run","tests/unit/load-cache.test.ts"],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError","reject_pattern":"Cannot find module|SyntaxError","overlay":["tests/unit/load-cache.test.ts"]}`
  - Other checks: C-install, C-lint, C-fmt.
- S3b, implementation.
  - Role: implementer. Turn budget 35. Wave 3, after S2b is merged: it shares `load.ts`,
    `index.ts`, `api-reference.md` and the cache type.
  - Owns:
    - `src/yaml/load.ts`
    - `src/yaml/types.ts`
    - `src/yaml/index.ts`
    - `docs/api-reference.md`: the `LoadPricingOptions` list, `:303-314`.
    - `.changeset/src-etag-cache.md` (minor).
- Behaviour (proposed):
  - `req~src-cache-revalidate~1`: with `request.cache`, a load sends `If-None-Match` for a cached
    URL and uses the cached body on 304.
  - `req~src-cache-anonymous-only~1`: the cache is not read or written when `headers` are set,
    `credentials` is not `'omit'`, or `loadPricing` is used.
  - `req~src-cache-fault-tolerant~1`: if `get` or `set` throws, the load continues uncached, and the
    error text never reaches a diagnostic.
  - `req~src-cache-size-limit~1`: a cached body still counts against `maxBytes`.
- Risk: **high**, score 9:
  - public API +3
  - pricing area +3
  - external HTTP input +2
  - caching +1
  - Panel: reviewer, test-reviewer and security-auditor.
- Checks (S3b): C-install, C-type, C-lint,
  `["pnpm","exec","vitest","run","tests/unit/load-cache.test.ts","tests/unit/load.test.ts"]`, C-test,
  C-fmt.

### S4: `docs/nextjs.md` (owner item 4)

- Role: doc-steward. Turn budget 35. Wave 3, after S1, S2 and S5 are merged. It may run in parallel
  with S3b; their files do not overlap.
- Owns:
  - `docs/nextjs.md` (new).
  - `README.md`: the "React and Next" section (`:218-247`) and the Documentation list, which gets
    the `nextjs.md` and `pricing-versions.md` lines.
  - `docs/configuration.md:244-248`.
  - One "See also" line each in `docs/private-pricings.md` and `docs/pricing-versions.md`.
  - `.changeset/docs-nextjs.md` (patch).
- Content:
  - The client island (`'use client'` at `src/react/index.ts:1`).
  - Server-side loading of the pricing: a Server Component calls the same-origin route logic, or
    `createSpherePublicLoader(...).fetchYaml()` for public SPHERE pricings.
  - Server-side loading of the user's subscription. Pass only the mapped selection and the version
    to the client (`selectionFromContract`, `examples/space-contract/map-contract.ts:14-33`), never
    the contract: it has `userInformation` and `history`.
  - Pass a `yaml` string (`examples/next/app/pricing/page.tsx:82`) or a plain `pricing` object.
  - Call `configurePricingRenderer` only in client code (`config.ts:12,86-91`, read in the
    constructor at `element.ts:184`; `configuration.md:246-247`).
  - Wrap `useMemo` around `request` and `loadPricing` (`element.ts:235-245`).
  - SSR limits (`README.md:245-247`, `architecture.md:94-99`).
  - Verify the Next 16 APIs with lookup.
- Risk: **medium**. Docs only, score 0-1. Raised because it governs which user data crosses to the
  client. Panel: reviewer and security-auditor (data exposure).
- Checks: C-install, C-test, C-fmt.

### S5: `docs/pricing-versions.md`, which version a page shows (owner item 5, owner-decided)

- Role: doc-steward. Turn budget 30. Wave 1, in parallel with S1 and S2a.
- Owns:
  - `docs/pricing-versions.md` (new).
  - `docs/preload-current-subscription.md`: a short section on `contractedServices` and the version
    mismatch, which links to the new guide.
  - `.changeset/docs-pricing-versions.md` (patch).
- Content (owner decision, as given):
  - Signed-out visitors see the version that SPACE assigns to new contracts. For a SPHERE-linked
    service, that is `sphere.target`. For a manual service, the host decides until SPACE has a
    default version.
  - A signed-in user with a contract sees `contract.contractedServices[service]`, with a notice
    when new contracts use a newer version.
  - A SPACE-managed service is always read through SPACE via the host backend, never straight from
    SPHERE: the sync runs every 5 minutes by default and is opt-in, and the policy can pin a
    version.
  - Plan names come from the contract's version. A different shown version can give
    `PR_SELECTION_UNKNOWN_PLAN` (`docs/preload-current-subscription.md:182-183`).
  - Do not state the shape of `SphereVersion` until N2 confirms it.
- Risk: **medium**. Docs only, but the pricing area +3 -2 gives a score of 1, and the owner policy
  decides what customers are billed against. Panel: reviewer.
- Checks: C-install, C-test, C-fmt. The docs-examples test does not scan the new guide
  (`docs-examples.test.ts:154-162`), so any `PR_` code the guide names is checked only in review.

## Order and ownership

- Wave 0: CRP-1 and CRP-2 go to the owner. N1 and N2 are requested. S0 runs after the CRPs are
  answered.
- Wave 1, in parallel: S1, S5 and S2a. S2a needs only the CRP-1 answer for the name and the return
  shape.
- Wave 2, in parallel: S2b and S3a.
- Wave 3, in parallel: S3b and S4.
- Shared files are only edited in sequence:
  - `README.md`: S1, then S4.
  - `src/yaml/load.ts`, `src/yaml/index.ts`, `docs/api-reference.md`: S2b, then S3b.
  - `docs/private-pricings.md`: S1, then S4.
  - `docs/pricing-versions.md`: S5, then S4.
- No two slices in the same wave own the same file.

## Gates per slice

- G1 (OpenSpec): `openspec/` is absent. The coordinator decides whether `spec.md` stands in, as in
  earlier changes.
- G2 (EPIC): S0.
- G3 (red-before): S2a and S3a; the checks are above.
- G4 (acceptance freeze): N/A. The tests live in `tests/unit`; S2b and S3b treat them as read-only.
- G5 and G7: not defined in the skills I read; the coordinator maps them.
- G6 (trace): S2b and S3b tag the code `[impl->req~...~1]` and the tests `[utest->...]`, as in
  `map-contract.ts:10-13`.
- G8 (mutation): S2b and S3b, if registered.
- G9 (dependencies): S2 must add none.
- G10 (secrets): all slices. The docs show only placeholders such as `process.env.SPACE_API_KEY`,
  never values.
- G11: panels as listed per slice.
- G12 (ui-qa): N/A.
- G13 (how-to-test): S2 and S3 get a guide with unit tests as evidence; there is no live endpoint
  in the lab. S1, S4 and S5 use how_to_review.

## Decisions taken in this intake

- D1. Five PRs, one per capability. Reason: each slice is independently mergeable, and docs PRs
  need no code review panel.
- D2. No feature flag. Reason: the API additions are additive and unreleased.
- D3. A pinned `versionId` fetches the YAML directly, with no manifest request. Reason: one
  request, and the `/yaml` route already returns 404 for private or unknown versions. My reading is
  that "reads the manifest" applies to "latest". This is confirmed in CRP-1 (c).
- D4. The ETag cache is used only when the `ETag` header is readable, and the browser relies on
  its HTTP cache. Reason: `cors()` exposes no headers.
- D5. The SPHERE loader takes no headers or credentials options. Reason: public versions only;
  private pricings go through the server route of S1.
- D6. Red tests are written by an implementer in `tests/unit`. Reason: `vitest.config.ts:6`, and
  the precedent in delivera-2 `plan.md:1`.
- D7. `examples/next` is not changed in this change. Reason: no registered check builds Next in
  the lab (F4).

## Owner CRPs (public API, `INTENT.md:108-109`)

- **CRP-1: shape of `createSpherePublicLoader`.**
  - (a) Recommended. It returns
    `{ src, loadPricing, fetchYaml(options?: { signal?: AbortSignal }) }`.
    - `src` is the permanent link URL, so it is safe to reflect.
    - `loadPricing` is a `PricingLoader` for the element and React
      (`<PricingRenderer {...sphere} />`).
    - `fetchYaml` is for server code and resolves `{ yaml, pricingId, versionId, etag? }`.
  - (b) It returns a bare `PricingLoader`, and the host sets `src` itself.
  - (c) Only an async `fetchSpherePublicYaml()`, with no element integration.
  - Sub-choices:
    - (i) Errors: reuse `PR_SOURCE_LOAD_FAILED` (recommended; `docs/events.md` stays as it is), or
      add `PR_SPHERE_*` codes.
    - (ii) `baseUrl`: https only (recommended, as asked), or also `http://localhost`.
    - (iii) Pinned versions skip the manifest (D3), or always read it.
- **CRP-2: the cache hook.**
  - (a) Recommended. Add `request.cache?: PricingEtagCache`, where
    `PricingEtagCache = { get(url): Entry | undefined | Promise<...>; set(url, entry): void | Promise<void> }`
    and `Entry = { etag, body }`. It is shared with S2 and used only for anonymous loads.
  - (b) Like (a), plus authenticated loads with a `cacheKey` that the host provides.
  - (c) No hook: document only the browser HTTP cache, and drop item 3.

## Needs (facts)

- N1. Recorded SPHERE responses, sanitised: a public pricing's manifest (200 with headers), one
  version's YAML (200), a 304 and a 404, from `https://sphere.score.us.es`. The lookup could not
  fetch them (403). Fallback: fixtures derived from the source at `8472610`, labelled as derived.
- N2. Recorded SPACE responses: `GET /api/v1/services/{name}` (the shape of `sphere.target`) and
  `GET /api/v1/services/{name}/pricings/{version}` (JSON). S5 needs the first. F5 needs the second.

## Followups (outside this change)

- F1. Sanitise host-loader error messages before they become diagnostics that the element shows
  (`load.ts:112-113`, `element.ts:957-959`). This changes behaviour, so it needs a CRP.
- F2. Stop reflecting `src` (`element.ts:104`), or document it as non-secret. This is a public API
  change, so it needs a CRP.
- F3. Upstream SPHERE: `cors({ exposedHeaders: ['ETag'] })` would allow browser revalidation.
- F4. `examples/next`: a server Route Handler and server loading, once a Next build check exists.
- F5. A unit test that SPACE pricing JSON (N2) normalizes with `normalizePricing`, before the docs
  claim it.
