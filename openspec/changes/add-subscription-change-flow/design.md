# Design: subscription change flow

## Context

- Core today: `mergeSelection`, `reconcileSelection`, `normalizeAddOnQuantity` and `resolvePricing`
  in `src/core/resolve.ts`, and `buildBreakdown` in `src/core/breakdown.ts`. `resolvePricing`
  returns `breakdown`: currency, billing period, plan line and reconciled add-on lines in
  declaration order, with subtotal and `requiresQuote`. Optional keys are absent, not `undefined`.
  `applySelectionInput` (`src/core/apply-selection.ts`, internal) validates a partial selection
  and reports diagnostics instead of throwing.
- Effective values today: `createComparisonGroups` (`src/core/view-model.ts`) takes a feature or
  limit value as `unwrapValue(plan.features[id])` when the plan defines it, else the definition's
  `defaultValue`. `hasCapability` treats `undefined`, `null`, `false`, `0` and `''` as "no
  capability". Add-on `features`, `usageLimits` and `usageLimitsExtensions` are kept as raw value
  maps by `normalizeAddOns` (`src/core/normalize.ts`). Only `isAddOnOnlyRow` and the add-on
  "effects" list read them; nothing combines them with plan values yet. `renderValue`
  (`src/element/renderers.ts`) shows `Infinity`, `'.inf'`, `'Infinity'` and `'unlimited'` as
  "Unlimited". The `yaml` package parses `.inf` as `Infinity`, so acme Enterprise `storage` is
  `Infinity`.
- Element: `<pricing-renderer>` renders in light DOM. `pricing-action` is cancelable, and a
  canceled link CTA does not navigate (`renderPlans`). `isSafeLink` gates every `href`.
  `getPlanCta` maps `presentation.ctas` by `planId`.
- SPACE facts, from a lookup of the SPACE sources (`isa-group/space`, `api/src/main/types/models/Contract.ts`,
  `services/ContractService.ts`, `utils/helpers.ts`,
  `utils/feature-evaluation/evaluationContextsManagement.ts`):
  - The novation body (`PUT /contracts/{userId}`) is
    `{ contractedServices, subscriptionPlans, subscriptionAddOns }`.
  - `contractedServices` maps a service name to a pricing version string. Clients send dotted
    versions; SPACE stores them with `.` replaced by `_` (`escapeVersion`) and converts them back
    on read (`resetEscapeVersion`).
  - Service names are lowercased on create.
  - `usageLevels[service][limit] = { consumed, resetTimeStamp? }`.
  - Effective limit: start with the plan value. Each contracted add-on's `usageLimits` entry
    replaces it, and each `usageLimitsExtensions` entry adds `value * quantity`.

  The novation path and the add-on `features` override were not read line by line. They are
  assumptions A1 and A2 below.

## Definitions used by the scenarios

- **Acme**: `tests/fixtures/acme-pricing.yml` parsed and normalized. Currency EUR, version
  `2026.07`, billing `monthly` 1 and `yearly` 0.8, default variables (`seats: 5`, region `eu`).
  - Plans in order: `starter`, `growth`, `enterprise`. Monthly prices: 20, 45, 40.
  - Features in order: `projects`, `collaboration`, `auditLog`, `customRoles`, all with
    `defaultValue: false`. Starter has `projects` and `collaboration`; Growth adds `auditLog`;
    Enterprise adds `customRoles`.
  - Usage limit `storage` (unit `GB`, default 5): Starter 10, Growth 100, Enterprise `.inf`.
  - Add-ons in order:
    - `extraStorage` ("Extra Storage", 5 per pack, `growth` and `enterprise`, quantity 1 to 10,
      `usageLimitsExtensions.storage` 50);
    - `compliance` ("Compliance", label "Contact sales", `enterprise` only, `features.auditLog` true);
    - `prioritySuccess` ("Priority Success", 25, `growth` and `enterprise`, depends on
      `extraStorage`).
- **C**: `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }`.
  On Acme, monthly: subtotal 80 (45 + 2 × 5 + 25), effective `storage` 200 (100 + 50 × 2).
- More selections on Acme:
  - **ENT**: C with `planId: 'enterprise'`. Subtotal 75 (40 + 10 + 25), `storage` unlimited.
  - **START**: C with `planId: 'starter'`. Subtotal 20, because both add-ons are removed by
    reconciliation; `storage` 10.
  - **CY3**: `{ planId: 'growth', billingPeriod: 'yearly', addOns: { extraStorage: { selected: true, quantity: 3 }, prioritySuccess: { selected: true, quantity: 1 } } }`.
    Subtotal 68 (45 × 0.8 = 36, 5 × 0.8 × 3 = 12, 25 × 0.8 = 20; each exact in IEEE 754
    double precision); `storage` 250.
  - **QUOTE**: `{ planId: 'enterprise', addOns: { extraStorage: { selected: true, quantity: 2 }, compliance: { selected: true, quantity: 1 } } }`.
    Known subtotal 50, requires a quote.
- **Side(p, s)**: `{ pricing: p, selection: s }`. **cmp(b, a)** is
  `compareSelections({ before: b, after: a })`.
- **V1**: the inline pricing
  `{ syntaxVersion: '3.1', saasName: 'Mailer', version: '1.0', createdAt: '2026-01-01', currency: 'EUR', billing: { monthly: 1 }, features: { api: { valueType: 'BOOLEAN', defaultValue: false }, legacyExport: { valueType: 'BOOLEAN', defaultValue: false } }, usageLimits: { emails: { valueType: 'NUMERIC', defaultValue: 0, unit: 'email' } }, plans: { basic: { price: 10, features: { api: { value: true }, legacyExport: { value: true } }, usageLimits: { emails: { value: 1000 } } }, pro: { price: 30, features: { api: { value: true }, legacyExport: { value: true } }, usageLimits: { emails: { value: 10000 } } } }, addOns: { extraEmails: { price: 5, usageLimitsExtensions: { emails: { value: 500 } }, subscriptionConstraints: { minQuantity: 1, maxQuantity: 10, quantityStep: 1 } } } }`,
  normalized. `extraEmails` has no `availableFor`, so every plan can have it. Its name is
  "Extra Emails".
- **V2**: V1 with these changes:
  - `version: '2.0'`;
  - feature `legacyExport` removed from `features` and from both plans;
  - `basic` price 12 and `basic.usageLimits.emails` 800;
  - two more add-ons after `extraEmails`: `dedicatedIp: { availableFor: ['pro'], price: 20 }`
    (name "Dedicated Ip") and `ipWarmup: { price: 3, dependsOn: ['dedicatedIp'] }`
    (name "Ip Warmup", no `availableFor`).
- **V2U**: V2 with `currency: 'USD'`.
- **M2**: `{ planId: 'basic', addOns: { extraEmails: { selected: true, quantity: 2 } } }`. On V1:
  subtotal 20, `emails` 2000. On V2: subtotal 22, `emails` 1800.
- **F**: the inline pricing
  `{ syntaxVersion: '3.1', saasName: 'Flex', version: '1', createdAt: '2026-01-01', currency: 'EUR', features: { sso: { valueType: 'BOOLEAN', defaultValue: false } }, usageLimits: { seats: { valueType: 'NUMERIC', defaultValue: 3, unit: 'seat' } }, plans: { base: { price: 10, usageLimits: { seats: { value: 5 } } }, team: { price: 20, features: { sso: { value: null } }, usageLimits: { seats: { value: null } } } }, addOns: { ssoPack: { price: 5, features: { sso: { value: true } } }, seatPack: { price: 2, usageLimitsExtensions: { seats: { value: 5 } }, subscriptionConstraints: { minQuantity: 1, maxQuantity: 20, quantityStep: 1 } }, unlimitedSeats: { price: 50, usageLimits: { seats: { value: Number.POSITIVE_INFINITY } } } } }`,
  normalized. Names: `Sso`, `Seats`, `Base`, `Team`, `Sso Pack`, `Seat Pack`, `Unlimited Seats`.
- **PV**: `{ syntaxVersion: '3.1', saasName: 'Private', version: '1', createdAt: '2026-01-01', currency: 'EUR', plans: { basic: { price: 10 }, legacy: { price: 15, private: true }, pro: { price: 30 } } }`.
- **PQ**: `{ syntaxVersion: '3.1', saasName: 'Quote', version: '1', createdAt: '2026-01-01', currency: 'EUR', plans: { basic: { price: 10 }, pro: { price: 30 }, enterprise: { price: 'Contact us' } } }`.
  A string price without `#` is a label price, so Enterprise requires a quote.
- **PS**: `{ syntaxVersion: '3.1', saasName: 'Slash', version: '1', createdAt: '2026-01-01', currency: 'EUR', plans: { 'pro plus/x': { price: 5 }, 'javascript:alert(1)': { price: 6 } } }`.
- Comparisons for the review: R_ENT = `cmp(Side(Acme, C), Side(Acme, ENT))`; R_START =
  `compareSelections({ before: Side(Acme, C), after: Side(Acme, START), currentUsage: { storage: 150 } })`;
  R_CUR = `cmp(Side(Acme, C), Side(Acme, C))`; R_QUOTE = `cmp(Side(Acme, C), Side(Acme, QUOTE))`;
  R_V12 = `cmp(Side(V1, M2), Side(V2, M2))`. Each is computed in the Playwright test process with
  `compareSelections` from `src/core/index.ts` and passed to the page as JSON through
  `page.evaluate` (the results are JSON-safe).
- Review page: the demo page, whose entry `examples/vanilla/src/main.ts` also imports the
  `define-change-review` module (added by slice E1), where the test appends a new
  `<pricing-change-review>` with `locale: 'en-US'` and the properties of the scenario to
  `document.body`.
- Axe check: the definition of `docs/agent-work/delivera-3-price-breakdown/spec.md`
  (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`; no `serious` or `critical` violation).
- New element: a `<pricing-renderer>` created in the demo page with
  `document.createElement('pricing-renderer')`, given `pricing`, `locale: 'en-US'` and the
  properties of the scenario, then appended to `document.body`.
- JSON-safe: `JSON.parse(JSON.stringify(x))` strictly equals `x` (`toStrictEqual`): no
  `undefined`-valued keys, no `NaN` or `Infinity`, no functions.
- Demo page: `/` of the Playwright web server with Acme, `locale: 'en-US'`, showing Starter
  selected and `€20` in `.pr-summary` (as in the delivera specs).
- Number checks: integers and the exact sums above use `toBe`.

## Decision 1: comparison input and output shapes (`src/core/types.ts`)

```ts
export type JsonValue =
  | null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface SelectionComparisonSide {
  pricing: NormalizedPricing;
  selection: Partial<PricingSelection>;
}

export interface SelectionComparisonInput {
  before: SelectionComparisonSide;               // the contract (its pricing version)
  after: SelectionComparisonSide;                // the edit (same or newer version)
  currentUsage?: Readonly<Record<string, number>>; // usage-limit id -> consumed (SPACE usageLevels)
  expression?: ExpressionOptions;                // passed to resolvePricing on both sides
}

export type SelectionRelation = 'current' | 'upgrade' | 'downgrade' | 'change';
export type ItemPresence = 'both' | 'before-only' | 'after-only';

export type ComparedValue =
  | { kind: 'none' }                         // no value: absent, NaN, -Infinity; null for features
  | { kind: 'unlimited' }                    // Infinity, '.inf', 'Infinity', 'unlimited'; null for limits
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }        // finite only
  | { kind: 'text'; value: string }
  | { kind: 'json'; value: JsonValue };      // arrays and objects, JSON round-tripped

export interface ComparedPlan {
  id?: string;      // absent when the side's merged selection has no planId
  name?: string;    // present only when known
  known: boolean;   // id is a plan id of that side's pricing
}

export interface PlanComparison { before: ComparedPlan; after: ComparedPlan; changed: boolean }

export interface CatalogIds { plans: string[]; addOns: string[]; features: string[]; usageLimits: string[] }

export interface VersionComparison {
  before?: string;              // before.pricing.metadata.version
  after?: string;
  changed: boolean;             // before !== after (two absent versions are equal)
  onlyInBefore: CatalogIds;     // ids defined in before.pricing and not in after.pricing
  onlyInAfter: CatalogIds;
}

export interface AddOnChange { id: string; name: string; quantity: number; presence: ItemPresence }
export type AddOnRemovalReason = 'unavailable-for-plan' | 'dependency-removed' | 'not-in-version';
export interface AddOnRemoval extends AddOnChange { reason: AddOnRemovalReason }
export interface AddOnQuantityChange { id: string; name: string; before: number; after: number; delta: number }

export interface AddOnComparison {
  added: AddOnChange[];                    // quantity: after billed quantity
  removedByUser: AddOnChange[];            // quantity: before billed quantity
  removedByReconciliation: AddOnRemoval[]; // quantity: before billed quantity
  quantityChanged: AddOnQuantityChange[];
  unchanged: string[];
}

export interface FeatureChange {
  id: string; name: string; before: ComparedValue; after: ComparedValue; presence: ItemPresence;
}
export interface FeatureComparison {
  gained: FeatureChange[]; lost: FeatureChange[]; changed: FeatureChange[]; unchanged: string[];
}

export interface UsageLimitChange {
  id: string;
  name: string;
  unit?: string;
  before: ComparedValue;
  after: ComparedValue;
  delta?: number;                          // after - before, only when both are { kind: 'number' }
  direction: 'increased' | 'decreased' | 'changed';
  presence: ItemPresence;
  currentUsage?: number;                   // the valid currentUsage entry for this id
  exceedsCurrentUsage?: true;              // present only when flagged
}
export interface UsageLimitComparison {
  changed: UsageLimitChange[];
  unchanged: string[];
  exceeded: string[];                      // ids flagged, changed or not
}

export interface PriceComparison {
  before: PriceBreakdown;                  // copy of resolvePricing(before side).breakdown
  after: PriceBreakdown;
  billingPeriodChanged: boolean;           // before.billingPeriod?.id !== after.billingPeriod?.id
  difference?: number;                     // after.subtotal - before.subtotal
  differenceOmitted?: 'quote' | 'currency';
}

export interface SelectionComparison {
  relation: SelectionRelation;
  version: VersionComparison;
  plan: PlanComparison;
  addOns: AddOnComparison;
  features: FeatureComparison;
  usageLimits: UsageLimitComparison;
  price: PriceComparison;
  selections: { before: PricingSelection; after: PricingSelection };
  diagnostics: PricingDiagnostic[];
}

export function compareSelections(input: SelectionComparisonInput): SelectionComparison;
```

Options considered:

- Three positional arguments `(pricing, before, after)`, the form evaluated in delivera-3:
  rejected, because it cannot carry two pricing versions.
- One list of changes with a `kind` discriminator: rejected. A review screen renders sections,
  and grouped arrays map to them directly; one flat list would push the grouping into every host.
- `Infinity` for unlimited: rejected. It is not JSON-safe (`JSON.stringify(Infinity)` is
  `"null"`), and the preview route sends the comparison over HTTP.
- Tagged `ComparedValue`: a renderer switches on `kind` without guessing whether `0` means "none"
  or a real zero.

## Decision 2: how each side is derived (reuse, never throw)

For each side `S` with pricing `P`:

1. `merged = mergeSelection(P, input)`, where `input` is `S.selection` without its top-level keys
   whose value is `undefined` (as `applySelectionInput` does). `input.variables`, when present,
   is first replaced by `JSON.parse(JSON.stringify(input.variables))`, which drops `undefined`
   values (so those variables take their defaults in the merge) and turns `NaN` and `Infinity`
   into `null`. The side is resolved with the merged variables, so the result and the price agree
   and stay JSON-safe. Omitted fields take the schema defaults, as in `resolvePricing`, so a side
   without `planId` gets the first public plan. A host that compares an add-ons-only contract
   passes the plan explicitly.
2. Unknown ids are reported and handled; nothing throws.
   - When `merged.planId` is defined and is not a plan id of `P`: warning
     `PR_COMPARE_UNKNOWN_PLAN`, path `<side>.selection.planId`. The id is kept, so the breakdown
     has no plan line and `requiresQuote` is true, as `resolvePricing` already does.
   - When `merged.billingPeriod` is not a period id of `P`: warning
     `PR_COMPARE_UNKNOWN_BILLING_PERIOD`, path `<side>.selection.billingPeriod`. The id is kept, so
     the multiplier is 1 and the breakdown has no `billingPeriod` (existing behaviour).
   - For each `merged.addOns` key that is not an add-on id of `P`, in key order: warning
     `PR_COMPARE_UNKNOWN_ADDON`, path `<side>.selection.addOns.<id>`. The entry is dropped
     before resolving. This keeps a stale add-on id from an older version from turning the side
     into "requires quote" (breakdown rule `req~breakdown-requires-quote~1`).
   - `<side>` is `before` or `after`. Diagnostics are ordered: before side (plan, billing period,
     add-ons), after side, then `PR_COMPARE_ADDON_DROPPED`, then current usage.
3. Each kept add-on entry is rebuilt as a new `{ selected, quantity }` object, with no other keys.
   A selected entry gets quantity `normalizeAddOnQuantity(P, id, entry)`, so it carries the
   billed quantity. An unselected entry keeps its input quantity when it is a finite number, else
   0. Entries whose value is not an object with a boolean `selected` are dropped.
4. `{ selection, removedAddOnIds } = reconcileSelection(P, sanitized)`. `selections.<side>` is
   that `selection`.
5. `breakdown = resolvePricing(P, selection, { expression }).breakdown`. A copy goes into
   `price.<side>`. Its line quantities equal the quantities of step 3.

The function is pure: no clock, no randomness, no DOM. It does not apply the element's
last-valid-price stabilization: a failing expression shows as a quote line. The host's preview
route repeats the computation on the server.

Removal reason of an add-on removed in step 4 of the after side:

- `not-in-version`: the id was selected in the after input but is not an add-on of the after
  pricing (dropped in step 2).
- `unavailable-for-plan`: `availableFor` is not empty and does not contain the after plan id.
- `dependency-removed`: otherwise (`reconcileSelection` removed it because it depends on a
  removed add-on).

Add-on classification, over the union of add-on ids of both pricings. Order: after-pricing
declaration order, then before-only ids in before-pricing order. B and A are the selected ids of
`selections.before` and `selections.after`:

- `added`: in A and not in B.
- `quantityChanged`: in A and B with different quantities (delta = after − before).
- `unchanged`: in A and B with equal quantities.
- `removedByReconciliation`: in B and not in A, and the after input selected it (it was dropped
  as `not-in-version` or removed by step 4).
- `removedByUser`: in B and not in A, and the after input did not select it.
- An id selected in the after input and removed, but not in B, appears in no list. It gets an
  info diagnostic `PR_COMPARE_ADDON_DROPPED`, path `after.selection.addOns.<id>`, after the
  after-side warnings.
- `presence`: `both`, `before-only` or `after-only`, from the add-on lists of the two pricings.
- `name`: the after pricing's name when the add-on exists there, else the before pricing's.

## Decision 3: effective feature and usage-limit values

The existing semantics are reused and extended in a new internal module
`src/core/compare-values.ts`, which is not exported from `src/core/index.ts`:

- Feature `f` of pricing `P` and reconciled selection `s`:
  1. `raw = unwrapValue(plan.features[f])` when the selected plan is known and defines `f`, else
     `featureDefinition.defaultValue` (the rule of `createComparisonGroups`). An unknown plan
     gives the default.
  2. For each add-on of `P.addOns` in declaration order that is selected in `s` and defines
     `features[f]`: `raw = unwrapValue(addOn.features[f])`, so the last one wins.
  3. `toComparedValue(raw, 'feature')`.
- Usage limit `l`:
  1. `raw` from the plan or the default, as for features.
  2. For each selected add-on in declaration order:
     - when it defines `usageLimits[l]`, `raw = unwrapValue(...)` (override);
     - then, when it defines `usageLimitsExtensions[l]` and the unwrapped value is a finite
       number `e`: when the current value is unlimited it stays unlimited; when it is a finite
       number `n` it becomes `n + e * q`, where `q` is the add-on's billed quantity; when it is
       none it becomes `e * q` (SPACE gives `NaN` there, A3); any other kind is left unchanged.
  3. `toComparedValue(raw, 'usage-limit')`.
- `toComparedValue(raw, kind)`:
  - `undefined` → none;
  - `null` → unlimited for limits and none for features (owner rule: null limit = unlimited);
  - `Infinity`, `'.inf'`, `'Infinity'` and `'unlimited'` → unlimited (the `renderValue` set);
  - `NaN` and `-Infinity` → none;
  - another number → number;
  - another string → text;
  - a boolean → boolean;
  - an array or object → json, with value `JSON.parse(JSON.stringify(raw))`.
- Capability (features): none, `false`, number 0 and text `''` have no capability; everything
  else, including unlimited, has it (`hasCapability`). Classes:
  - `unchanged`: deep-equal values, or neither value has capability;
  - `gained`: no capability before, capability after;
  - `lost`: capability before, none after;
  - `changed`: both have capability and the values differ.
- Limit order: none < number (numeric order) < unlimited. Direction:
  - `increased` or `decreased` when both values are in that order and differ;
  - `changed` when either value is boolean, text or json.
  - `delta` only when both values are numbers.
  - Unchanged when the values are deep-equal.
- `currentUsage`: an entry is valid when its id is a usage-limit id of either pricing and the
  value is a finite number ≥ 0. A limit is flagged (`exceeded`) when the after value is a number
  `n` with `consumed > n`, or none with `consumed > 0`. Unlimited and other kinds are never
  flagged. Other entries are skipped:
  - an unknown id gives an info diagnostic `PR_COMPARE_UNKNOWN_USAGE_LIMIT`, path
    `currentUsage.<id>`;
  - an invalid value gives a warning `PR_COMPARE_INVALID_USAGE`, path `currentUsage.<id>`;
  - both in key order.
- Order of features and limits: after-pricing declaration order, then before-only ids.
  `presence` and `name` follow the add-on rule; `unit` comes from the same definition.

## Decision 4: relation (upgrade or downgrade)

Rule, evaluated in order:

1. `current` when all of these hold: equal version strings (or both absent), equal plan ids,
   equal billing period ids, equal sets of selected add-on ids with equal billed quantities, and
   deep-equal `variables`.
2. `change` when the plan ids are equal, both `undefined` included (add-ons, quantities, billing
   period, variables or version changed).
3. When both plan ids are plan ids of the after pricing: `upgrade` if the after plan's index in
   `after.pricing.plans` (declaration order, private plans included) is greater than the before
   plan's index, else `downgrade`.
4. `change` otherwise: one plan is unknown, or the before plan is not in the after version.

Why declaration order and not price:

- Pricing2Yaml and SPACE list plans from the entry tier upwards. The renderer already relies on
  that: `planInheritance: 'auto'` builds "Everything in {previous plan}, plus" from the previous
  plan in declaration order (`getPlanHighlightSummary`).
- Price breaks on real pricings. Acme Enterprise costs 40 with the default 5 seats and Growth
  costs 45, so a price rule would call Growth → Enterprise a downgrade. Label prices ("Contact
  sales", Slack `ENTERPRISE_GRID`, Zoom `ENTERPRISE`) have no amount at all, and expression prices
  change with variables.
- The rule is deterministic, needs no variables and gives the element the same answer for each
  plan card (`planRelation(pricing, currentPlanId, planId)` in the internal
  `src/core/plan-relation.ts`, also used by `compareSelections`).

The price direction stays visible separately in `price.difference`. Owner decision D2.

## Decision 5: element additions

`<pricing-renderer>`, all new properties with `attribute: false` unless stated:

- `currentSelection?: Partial<PricingSelection>`:
  - Accepted like `applySelection`'s input. The element keeps a deep copy (`cloneValue`) and
    derives the current side as in Decision 2, steps 1 to 4, on the loaded pricing.
  - Current plan: `currentSelection.planId` when it is a plan id of the loaded pricing. Current
    add-ons, only while the current plan is known: the selected ids of the reconciled current
    side. Without a known plan, step 1 would reconcile against the default plan, which is not the
    customer's, so no add-on is marked.
  - Never written into `selection` or the internal selection, and it emits no
    `pricing-selection-change`. To start the editor on the contract, the host also calls
    `applySelection(currentSelection)`, as in `docs/preload-current-subscription.md`.
  - Unknown plan id: nothing is marked and CTAs keep their 0.1.0 labels. Unknown add-on ids are
    ignored. Each update in which `currentSelection` or the loaded pricing changed dispatches one
    `pricing-diagnostic` with warnings `PR_CURRENT_SELECTION_UNKNOWN_PLAN` (path
    `currentSelection.planId`) and `PR_CURRENT_SELECTION_UNKNOWN_ADDON` (path
    `currentSelection.addOns.<id>`), when there is any. They are not rendered in the diagnostics
    list.
  - Private current plan with `visibility: 'public-only'`: its card is not rendered, so no card
    has `data-current`. The other plans are still labelled by relation, because the order is
    taken from `pricing.plans`, private plans included. With `visibility: 'all'` the private card
    is marked.
- `pendingActionId?: string` (also the attribute `pending-action-id`). While it is set:
  - every plan CTA and the summary action get `aria-disabled="true"`. Their activation dispatches
    no `pricing-action`, and link CTAs do not navigate (default prevented). `aria-disabled` is
    used rather than `disabled` so that focus stays on the activated CTA.
  - The plan CTA or summary action whose action id equals `pendingActionId` also gets
    `aria-busy="true"`,
    `data-pending="true"` and a child `[data-pr-part="cta-pending"]` with the text of
    `pricing.pending`.
  - Plan selection and add-on controls stay enabled. The host decides whether the edit may
    continue.
- `PricingCta.labels?: PricingCtaLabels`, with
  `PricingCtaLabels = { upgrade?: string; downgrade?: string; current?: string; contactSales?: string }`.
  `normalizeCtas` keeps only string values. Plan CTA label while the current plan is known:
  1. the plan is the current plan: `labels.current` ?? `pricing.currentPlanCta`, rendered as a
     `button` with the `disabled` attribute, never a link;
  2. the plan's resolved price is a label or an error: `labels.contactSales` ??
     `pricing.contactSales`;
  3. otherwise `labels[relation]` ?? `pricing.upgradeTo` or `pricing.downgradeTo`, with
     `{plan}` = plan name.

  Without a known current plan the 0.1.0 label rule applies: `cta.label` ?? `pricing.choosePlan`.
- href templates: in a plan CTA `href`, every `{planId}` becomes
  `encodeURIComponent(plan.id)`. `isSafeLink` is applied to the expanded value. The event's
  `href` is the expanded value. An unsafe expanded value renders the CTA as a button, the 0.1.0
  rule for unsafe links.
- Summary action: rendered in `.pr-summary` after the live region and before the breakdown
  toggle, as `button[data-pr-part="summary-action"]`. It appears while `ctaEnabled` is true and
  `currentSelection` is set with a known plan.
  - Relation: `compareSelections` of the current side and the selection in effect, both on the
    loaded pricing.
  - Requires quote: label `pricing.contactSales`, action id `contact-sales`.
  - Else label `pricing.reviewChangeCta` with `{total}` = the formatted subtotal, action id
    `review-change`.
  - Relation `current`: the `disabled` attribute.
  - Activation dispatches the cancelable `pricing-action` with `source: 'summary'`, the relation,
    `planId` = the planId of the selection in effect, `selection` and `resolved` (existing
    fields).
- `PricingActionDetail` gains optional `relation?: SelectionRelation` and
  `source?: 'plan' | 'summary'`. Both are present only while the current plan is known. On plan
  CTAs, `relation` is `planRelation(pricing, currentPlanId, planId)`. Without a known current
  plan the detail is exactly the 0.1.0 detail.
- New part hooks: `current-badge` (plan), `current-add-on-badge`, `summary-action`,
  `cta-pending`. New attributes: `data-current="true"` on the current plan card and current
  add-on cards (absent elsewhere), `data-relation` on plan CTAs while the current plan is known.
- React: `PricingRendererSharedProps` gains `currentSelection?` and `pendingActionId?`. They go
  through `createComponent` as properties. Type re-exports: `SelectionRelation` (from core) is
  re-exported by `src/element/index.ts` and `src/react/index.ts`.

## Decision 6: `<pricing-change-review>`

- Class `PricingChangeReviewElement` (LitElement, light DOM via `createRenderRoot() { return this; }`,
  styles from `src/styles/base.css`), exported from `src/element/index.ts`.
- Registration must not change what existing imports do. `src/element/define.ts`
  (`pricing-renderer/define`) and `src/react/index.ts` (`pricing-renderer/react`) register only
  `pricing-renderer`, as in 0.1.0:
  - `src/element/change-review-define.ts`: `PRICING_CHANGE_REVIEW_TAG` and
    `definePricingChangeReview()`. Same guard as `definePricingRenderer`: a no-op without
    `customElements`, idempotent, and an error naming the tag when another constructor holds it.
    No side effect on import. Exported from `src/element/index.ts`.
  - `src/element/define-change-review.ts`: a side-effect module that calls
    `definePricingChangeReview()` when `customElements` exists. It is published as the new
    subpath `pricing-renderer/define-change-review` (`package.json` `exports` and `sideEffects`,
    attw entrypoint).
  - The React wrapper calls `definePricingChangeReview()` when it renders, so React hosts need
    no extra import and the tag is registered only by apps that render the component.
- Properties:
  - `comparison?: SelectionComparison`;
  - `notices: string[]` (default `[]`);
  - `pending: boolean` (attribute `pending`, reflected, default false);
  - `error?: string` (attribute `error`);
  - `locale: string` (attribute, default `'en-US'`);
  - `messages?: MessageCatalog`;
  - `confirmLabel?: string` (attribute `confirm-label`; overrides `pricing.reviewConfirm`).
- Events (bubbles, composed, cancelable):
  - `pricing-change-confirm` with `PricingChangeConfirmDetail { comparison: SelectionComparison }`;
  - `pricing-change-back` with `PricingChangeBackDetail { comparison: SelectionComparison }`.
  - Both details are detached deep copies.
  - Default action of Confirm: when the event is not canceled, the element sets `pending = true`
    before `dispatchEvent` returns to the element. This guards against a double submit before the
    host reacts. A host that manages `pending` itself calls `preventDefault()`. Back has no
    default action; it is cancelable for symmetry, so a wrapper can veto navigation consistently.
  - No Confirm event while `pending` is true or `comparison.relation === 'current'` (the button
    has `aria-disabled="true"`).
- Base parts, not gated by the CRP, so the data contract can be built and tested first:
  - the buttons `review-confirm` and `review-back`;
  - the list `review-notices`, one `li` per notice;
  - the element `review-error`, holding the `error` text.

  Until the CRP slice lands, these parts are the element's only markup.
- Rendering ([pending CRP], subject to the mock):
  - `<section data-pr-part="change-review" aria-labelledby>` with an `h2` (`tabindex="-1"`) and
    an `h3` per section;
  - sections in order, each only when it has content: plan (`review-plan`), price
    (`review-price`), add-ons (`review-add-ons`), features (`review-features`), usage limits
    (`review-limits`), unchanged summary (`review-unchanged`), notices (`review-notices`);
  - then a status region (`review-status`, `role="status"`), an alert region (`review-error`,
    `role="alert"`) and actions (`review-back`, `review-confirm`).
  - Notices and `error` are bound as text (Lit text bindings), never as HTML.
  - Focus: when `comparison` changes from `undefined` to an object, or to another object, after
    the update the `h2` gets focus. When `error` is set, focus moves to the Confirm button (enabled
    again by `pending = false`).
  - Forced colors: sections, buttons and change markers keep visible borders, and every change is
    named in text (no colour-only meaning).
  - Values: the `ComparedValue` rendering mirrors `renderValue`: none → `pricing.notIncluded`,
    unlimited → `pricing.unlimited`, true → `pricing.included`, false → `pricing.notIncluded`,
    numbers with `Intl.NumberFormat(locale)` and the unit, text as is, json as `JSON.stringify`.
    Money uses `formatCurrency(value, breakdown.currency, locale)`. The difference is formatted
    with `Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: 'exceptZero' })`
    and the fraction digits of `formatCurrency` (en-US: `+€2`, `-€5`, `€0`).
- Headless path: `compareSelections` and its types come from the package root, with no DOM and no
  custom-element registration. A host can render its own screen from the same JSON (the preview
  route returns it).
- React: `PricingChangeReview` (createComponent, tag `pricing-change-review`), with props
  `comparison`, `notices`, `pending`, `error`, `locale`, `messages`, `confirmLabel`,
  `onConfirm`, `onBack`, `className`, `id`. Event types: `PricingChangeConfirmEvent`,
  `PricingChangeBackEvent`.

### i18n keys (en-US / es-ES)

Element (current-selection and plan-cta):

| Key | en-US | es-ES |
|---|---|---|
| `pricing.currentPlanBadge` | Your plan | Tu plan |
| `pricing.currentPlanCta` | Current plan | Plan actual |
| `pricing.upgradeTo` | Upgrade to {plan} | Mejorar a {plan} |
| `pricing.downgradeTo` | Downgrade to {plan} | Bajar a {plan} |
| `pricing.currentAddOn` | Current | Actual |
| `pricing.reviewChangeCta` | Review change ({total}) | Revisar cambio ({total}) |
| `pricing.pending` | Processing… | Procesando… |

`pricing.contactSales` already exists ("Contact sales" / "Contactar con ventas") and is reused.

Review ([pending CRP] texts):

| Key | en-US | es-ES |
|---|---|---|
| `pricing.reviewTitle` | Review your change | Revisa tu cambio |
| `pricing.reviewPlan` | Plan | Plan |
| `pricing.reviewChangeArrow` | {before} → {after} | {before} → {after} |
| `pricing.reviewRelationUpgrade` | Upgrade | Mejora de plan |
| `pricing.reviewRelationDowngrade` | Downgrade | Bajada de plan |
| `pricing.reviewRelationChange` | Change | Cambio |
| `pricing.reviewRelationCurrent` | No changes | Sin cambios |
| `pricing.reviewVersionChange` | Pricing version {before} → {after} | Versión de precios {before} → {after} |
| `pricing.reviewPrice` | Price | Precio |
| `pricing.reviewPriceBefore` | Current price | Precio actual |
| `pricing.reviewPriceAfter` | New price | Precio nuevo |
| `pricing.reviewPriceDifference` | Difference | Diferencia |
| `pricing.reviewDifferenceQuote` | The difference is not shown because part of the price requires a quote. | No se muestra la diferencia porque parte del precio requiere presupuesto. |
| `pricing.reviewDifferenceCurrency` | The difference is not shown because the currencies differ. | No se muestra la diferencia porque las monedas son distintas. |
| `pricing.reviewBillingChange` | Billing period {before} → {after} | Periodo de facturación {before} → {after} |
| `pricing.reviewAddOns` | Add-ons | Complementos |
| `pricing.reviewAddOnAdded` | Added | Se añade |
| `pricing.reviewAddOnRemoved` | Removed | Se elimina |
| `pricing.reviewRemovedUnavailable` | Not available with {plan} | No disponible con {plan} |
| `pricing.reviewRemovedDependency` | Requires an add-on that is removed | Requiere un complemento que se elimina |
| `pricing.reviewRemovedNotInVersion` | Not offered in the new pricing | No se ofrece en los nuevos precios |
| `pricing.reviewQuantityChange` | Quantity {before} → {after} | Cantidad {before} → {after} |
| `pricing.reviewFeatures` | Features | Características |
| `pricing.reviewFeatureGained` | Gained | Se obtiene |
| `pricing.reviewFeatureLost` | Lost | Se pierde |
| `pricing.reviewFeatureChanged` | Changed | Cambia |
| `pricing.reviewLimits` | Usage limits | Límites de uso |
| `pricing.reviewLimitExceeded` | Your current usage ({usage}) is above the new limit. | Tu uso actual ({usage}) supera el nuevo límite. |
| `pricing.reviewUnchanged` | Unchanged | Sin cambios |
| `pricing.reviewUnchangedSummary` | {addOns} add-ons, {features} features and {limits} usage limits stay the same. | {addOns} complementos, {features} características y {limits} límites de uso no cambian. |
| `pricing.reviewNotices` | Before you confirm | Antes de confirmar |
| `pricing.reviewConfirm` | Confirm change | Confirmar cambio |
| `pricing.reviewBack` | Back | Volver |
| `pricing.reviewPending` | Applying your change… | Aplicando tu cambio… |
| `pricing.reviewErrorTitle` | The change could not be applied. | No se pudo aplicar el cambio. |
| `pricing.reviewNoChanges` | Your selection is the same as your current subscription. | Tu selección es igual a tu suscripción actual. |

## Decision 7: `pricing-renderer/space`

- Files:
  - `src/space/index.ts`;
  - `tsconfig.space.json` (rootDir `src/space`, outDir `dist/space`, lib ES2021 without DOM,
    reference to `tsconfig.core.json`), added to `tsconfig.json` references;
  - `package.json` `exports["./space"] = { types: "./dist/space/index.d.ts", default: "./dist/space/index.js" }`,
    with `./space` added to the attw `--entrypoints` of `package:check`.
  - It is side-effect free, so `sideEffects` is unchanged.
- Type imports only: `import type { AddOnSelection, PricingSelection } from '../core/index.js'`.
  The emitted `dist/space/index.js` has no `import` or `require`.
- API:

```ts
export interface SpaceContractLike {
  contractedServices?: Record<string, string>;                 // service -> version
  subscriptionPlans?: Record<string, string>;                  // service -> plan name
  subscriptionAddOns?: Record<string, Record<string, number>>; // service -> add-on -> quantity
  usageLevels?: Record<string, Record<string, { consumed?: number }>>;
}

export interface SpaceSubscription {                           // SPACE novation body
  contractedServices: Record<string, string>;
  subscriptionPlans: Record<string, string>;
  subscriptionAddOns: Record<string, Record<string, number>>;
}

export interface SpaceSelectionLike {
  planId?: string;
  addOns?: Record<string, { selected: boolean; quantity: number }>;
}

export function selectionFromContract(contract: SpaceContractLike, serviceKey: string): Partial<PricingSelection>;
export function subscriptionFromSelection(serviceKey: string, version: string, selection: SpaceSelectionLike): SpaceSubscription;
export function contractedVersion(contract: SpaceContractLike, serviceKey: string): string | undefined;
export function currentUsageFromContract(contract: SpaceContractLike, serviceKey: string): Record<string, number>;
```

- `selectionFromContract`: the code of `examples/space-contract/map-contract.ts` moved as is,
  with its `req~space-map-*` tags. The example file becomes a one-line re-export, so
  `tests/unit/space-contract.test.ts` keeps passing unchanged.
- `subscriptionFromSelection(serviceKey, version, selection)`:
  - `contractedServices` = `{ [serviceKey]: version }`, the version as given (dotted, assumption
    A1);
  - `subscriptionPlans` = `{ [serviceKey]: planId }` when `planId` is a non-empty string, else
    `{}`;
  - `subscriptionAddOns` = `{ [serviceKey]: { id: quantity } }` for each entry with
    `selected: true` and a finite quantity > 0, in key order; `{ [serviceKey]: {} }` when there
    are none.
  - Pass `comparison.selections.after`, which is reconciled and has billed quantities, and
    `afterPricing.metadata.version`.
- `contractedVersion`: `contract.contractedServices?.[serviceKey]` with every `_` replaced by `.`
  (SPACE `resetEscapeVersion`, assumption A1), or `undefined`.
- `currentUsageFromContract`: for each `usageLevels[serviceKey][limit]` whose `consumed` is a
  finite number ≥ 0, `{ [limit]: consumed }`; `{}` for an unknown service.
- Service keys are matched exactly. SPACE lowercases service names on create, so hosts pass the
  lowercase key (documented; A4).

## Host flow guide (`docs/change-subscription-flow.md`) and error and race handling

The guide documents three host routes. The package makes no HTTP call; route names are examples.

1. `GET /subscription/current`. The backend reads the SPACE contract and returns:
   - `contract`: the `SpaceContractLike` subset for the user;
   - `contractVersion`: a concurrency token, for example the contract's `updatedAt` or history
     length;
   - `currentPricingYaml`: the YAML of `contractedVersion(contract, service)`;
   - `offerPricingYaml`: present only when the host offers a move to another version (the
     contract's version is retired, or a migration campaign runs).

   The editor shows the contract's version, as the owner request says ("sees the pricing version
   of their contract with their current plan marked"). The client sets
   `yaml = currentPricingYaml`, and on `pricing-ready` it calls
   `applySelection(selectionFromContract(contract, service))` and sets `currentSelection` to the
   same value. Both sides of `compareSelections` then use that pricing.

   When `offerPricingYaml` is present, the editor shows the offer version instead. The before side
   of `compareSelections` uses the normalized `currentPricingYaml`, and `currentSelection` marks
   the current plan only when its id exists in the offer version (else the
   `PR_CURRENT_SELECTION_UNKNOWN_PLAN` rule applies and the review shows the version change). The
   rule for when to offer another version is the host's (owner decision D9).

   The element's controls compare within the loaded pricing. When the customer keeps the same
   plan and add-ons on the offer version, the summary action reports `'current'` and is disabled,
   and so is the current plan's CTA. In the offer path the host therefore renders its own action
   (for example "Review the move to version 2.0") that calls route 2 with the selection in effect;
   the server comparison is the cross-version one.
2. `POST /subscription/preview { selection, contractVersion, pricingVersion }`. `pricingVersion`
   is the `metadata.version` of the pricing the editor shows. The backend:
   - rejects with 409 when the contract token or the pricing version is no longer current;
   - recomputes `compareSelections` with its own copy of both pricings and the SPACE
     `usageLevels` (`currentUsageFromContract`), so client prices are never trusted;
   - returns `{ comparison, notices }`.

   The client renders `<pricing-change-review>` with them. A client-side comparison may be shown
   while the preview loads, but Confirm stays `pending` until the server comparison arrives.
3. `POST /subscription/apply { selection, contractVersion, pricingVersion, idempotencyKey }`. The
   backend:
   - checks that the contract's current token equals `contractVersion` and that `pricingVersion`
     is the version it previewed and still offers, else returns 409;
   - recomputes `compareSelections` from `selection` on its own pricings (it never uses a
     comparison sent by the client);
   - calls the SPACE novation with
     `subscriptionFromSelection(service, pricingVersion, serverComparison.selections.after)`;
   - returns the new contract.

Error and race guidance:

- Never reset the user's edit on failure. Do not call `reload()`, `applySelection` or change
  `selection` after a failed preview or apply. Keep `<pricing-renderer>` mounted, or keep the
  edited selection from `resolvedState`, so Back returns to the same edit.
- Double submit: the Confirm default action sets `pending`, and the host keeps `pendingActionId`
  or `pending` set until the apply route answers. Send an `idempotencyKey` per Confirm, so a
  retried request after a timeout does not apply twice.
- Conflict, when the contract changed since `GET` (another tab, a billing job): the apply route
  returns 409. The host:
  1. fetches route 1 again;
  2. updates `currentSelection`;
  3. re-runs the preview with the user's unchanged edit;
  4. shows a notice ("Your subscription changed; review the new comparison"), and
  5. clears `pending`.
- Pricing version changed between preview and apply: the apply route compares the
  `pricingVersion` of the body with the version it offers and rejects with 409. The client then
  reloads route 1 and re-runs the preview with the user's edit. A comparison is never re-used
  across versions.
- Network failure or 5xx: set `error` (plain text), clear `pending`, keep the comparison and allow
  retry. `error` is announced in the `role="alert"` region and focus moves to Confirm.
- Out-of-order responses: tag each preview request with a sequence number and ignore a response
  that is not the latest, so a slow preview never overwrites a newer edit.
- Diagnostics: show `PR_COMPARE_*` warnings to support staff, not to customers. An unknown
  current plan means the contract and the pricing version disagree, which the backend must
  resolve.

## Risks

- `{planId}` expansion changes an `href` that already contains that literal text (D5). Braces are
  not valid unencoded URL characters, so such hrefs are unlikely. The changeset states it.
- Relation by declaration order is wrong for pricings that list plans out of tier order. Hosts can
  override the labels per plan (`labels`), and `price.difference` stays visible. D2 lets the
  owner choose another rule.
- Effective-value semantics (A2, A3) may differ from SPACE for add-on feature overrides and for a
  missing plan limit plus an extension. The review is informative; SPACE remains the authority
  after novation.
- Two pricing versions with different billing ids give `billingPeriodChanged: true` even when the
  periods mean the same thing.
- `compareSelections` does not apply the element's last-valid-price stabilization. A failing
  expression is a quote line in the review even when the element shows a kept price.
- Visual baselines: unchanged, because no baseline view sets the new properties. The responsive
  tests must pass against the committed baselines unchanged; if they fail, the slice stops and
  reports.
- `reconcileSelection` does not enforce `excludes`. A host that builds the after selection outside
  the element can compare a selection that the element's dialog would not allow.
- Bundle size: the core grows by the comparison module. `src/space` is a separate subpath, so it
  costs nothing unless imported.

## Migration

Additive. No expand or contract steps. `examples/space-contract/map-contract.ts` becomes a
re-export of `pricing-renderer/space`. `docs/preload-current-subscription.md` switches its import to
`pricing-renderer/space` and drops "copy the file". Minor changeset.

## Assumptions

- A1: the SPACE novation accepts dotted versions in `contractedServices` and SPACE escapes them
  itself. Seen in `ContractService` for contract creation; not read for `performNovation`.
- A2: SPACE applies add-on `features` as overrides, like add-on `usageLimits`, in contracted
  add-on order. The comparison uses pricing declaration order.
- A3: a missing plan limit plus an extension counts from 0. SPACE computes `NaN` there.
- A4: hosts pass SPACE's lowercase service key. The helpers do not lowercase.
- A5: "the pricing is private" in the owner request means the current plan is a private plan
  hidden by `visibility: 'public-only'`.

## Decisions pending (owner)

Each item is a public API addition or a semantic rule. The requirements of each item wait for
the decision.

- D1, core API: `compareSelections(input)` and the exported types `SelectionComparisonInput`,
  `SelectionComparisonSide`, `SelectionComparison`, `SelectionRelation`, `ComparedValue`,
  `ComparedPlan`, `ItemPresence`, `CatalogIds`, `VersionComparison`, `PlanComparison`,
  `AddOnComparison`, `AddOnChange`, `AddOnRemoval`, `AddOnRemovalReason`,
  `AddOnQuantityChange`, `FeatureComparison`, `FeatureChange`, `UsageLimitComparison`,
  `UsageLimitChange`, `PriceComparison`, `JsonValue`. Diagnostic codes
  `PR_COMPARE_UNKNOWN_PLAN`, `PR_COMPARE_UNKNOWN_BILLING_PERIOD`, `PR_COMPARE_UNKNOWN_ADDON`,
  `PR_COMPARE_ADDON_DROPPED`, `PR_COMPARE_UNKNOWN_USAGE_LIMIT` and `PR_COMPARE_INVALID_USAGE`.
- D2, relation rule: declaration order in the after pricing (Decision 4), with price as the
  rejected alternative. `current` requires equal variables.
- D3, effective values: add-on overrides in declaration order, extensions × billed quantity,
  `null` limit = unlimited, `null` feature = none, missing limit + extension from 0, the
  current-usage flag rule.
- D4, `currentSelection`: the property name, React prop, `data-current`, part hooks
  `current-badge` and `current-add-on-badge`, diagnostic codes
  `PR_CURRENT_SELECTION_UNKNOWN_PLAN` and `PR_CURRENT_SELECTION_UNKNOWN_ADDON`, the private-plan
  behaviour, and the i18n texts.
- D5, CTAs: `pendingActionId` (property, attribute `pending-action-id`, React prop),
  `aria-disabled` rather than `disabled`, `PricingCta.labels` (`PricingCtaLabels`), the summary
  action (part hook `summary-action`, action ids `review-change` and `contact-sales`), `{planId}`
  expansion for all hosts, and optional `PricingActionDetail.relation` and `source`.
- D6, review component: the tag `pricing-change-review`, class `PricingChangeReviewElement`,
  `definePricingChangeReview`, `PRICING_CHANGE_REVIEW_TAG`, the subpath
  `pricing-renderer/define-change-review`, registration on render by the React wrapper,
  properties, events `pricing-change-confirm` and
  `pricing-change-back`, detail types `PricingChangeConfirmDetail` and `PricingChangeBackDetail`,
  event types, the Confirm default action (`pending = true`), React `PricingChangeReview`, the
  review part hooks and the 36 keys of the "Review" i18n table. The UI itself waits for the CRP
  with a mock.
- D7, space subpath: `pricing-renderer/space` and its four functions and types. It reverses the
  delivera-2 decision "SPACE option A" (no runtime SPACE export). Also: dotted versions in the
  novation body (A1), exact service keys (A4), and the example becoming a re-export.
- D8, re-exports: `SelectionRelation` from `pricing-renderer/element` and `pricing-renderer/react`.
- D9, version shown in the editor: the contract's version by default (the owner request read
  literally), and another version only when the host offers a move (a retired version, a
  migration). Alternative: always show the latest version and compare across versions. This
  only changes the host-flow guide and the demo, not the package API.
