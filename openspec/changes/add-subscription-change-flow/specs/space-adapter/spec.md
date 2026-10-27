## ADDED Requirements

### Requirement: Space subpath export
`req~space-subpath-export~1`
The `package.json` of `pricing-renderer` SHALL map the export `./space` to `{ "types": "./dist/space/index.d.ts", "default": "./dist/space/index.js" }`.

Needs: impl, utest

#### Scenario: Package manifest
- **GIVEN** `package.json` parsed as JSON
- **WHEN** the test reads `exports['./space']`
- **THEN** it strictly equals `{ types: './dist/space/index.d.ts', default: './dist/space/index.js' }`

### Requirement: Space subpath is built and checked
`req~space-build~1`
The TypeScript build SHALL compile `src/space/index.ts` to `dist/space` through a project `tsconfig.space.json` referenced by `tsconfig.json`, with `./space` in the attw entrypoints of the `package:check` script.

Needs: impl, utest

#### Scenario: Build configuration
- **GIVEN** `tsconfig.json`, `tsconfig.space.json` and `package.json` parsed as JSON
- **WHEN** the test reads them
- **THEN** `tsconfig.json` has a reference with `path` `'./tsconfig.space.json'`, `tsconfig.space.json` has `rootDir` `'./src/space'` and `outDir` `'./dist/space'`, and `scripts['package:check']` contains `--entrypoints . ./yaml ./element ./define ./react ./space`

#### Scenario: Package check
- **GIVEN** the repository after `pnpm install --frozen-lockfile`
- **WHEN** `pnpm package:check` runs
- **THEN** it exits with code 0 and attw reports no problem for `pricing-renderer/space`

### Requirement: Dependency-free subpath
`req~space-no-runtime-deps~1`
The module `src/space/index.ts` SHALL import nothing at run time, using only type imports.

Needs: impl, utest

#### Scenario: Source imports
- **GIVEN** the text of `src/space/index.ts`
- **WHEN** the test lists its lines that start with `import` or `export ... from`
- **THEN** every such line starts with `import type` or `export type`

#### Scenario: No DOM needed
- **GIVEN** vitest in the node environment without DOM globals
- **WHEN** the test imports `src/space/index.ts`
- **THEN** the namespace keys are exactly `contractedVersion`, `currentUsageFromContract`, `selectionFromContract` and `subscriptionFromSelection`

### Requirement: Contract to selection
`req~space-select-from-contract~1`
The module `src/space/index.ts` SHALL export `selectionFromContract(contract, serviceKey)` with the behaviour of `req~space-map-plan~1`, `req~space-map-addons~1`, `req~space-map-service-only~1`, `req~space-map-missing-service~1`, `req~space-map-invalid-quantity~1`, `req~space-map-addons-only~1`, `req~space-map-result-keys~1` and `req~space-map-no-mutation~1`.

Needs: impl, utest

#### Scenario: Delivera contract
- **GIVEN** the contract `{ subscriptionPlans: { acme: 'growth' }, subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } } }`
- **WHEN** `selectionFromContract` from `src/space/index.ts` is called with it and `'acme'`
- **THEN** the result deeply equals C

#### Scenario: Earlier example tests
- **GIVEN** `tests/unit/space-contract.test.ts` unchanged
- **WHEN** vitest runs it
- **THEN** every test passes

### Requirement: Example file re-exports the subpath
`req~space-example-reexport~1`
The file `examples/space-contract/map-contract.ts` SHALL re-export `selectionFromContract` and `SpaceContractLike` from `src/space/index.ts` without its own implementation.

Needs: impl, utest

#### Scenario: Same function
- **GIVEN** both modules imported in node
- **WHEN** the test compares `selectionFromContract` of each
- **THEN** they are the same function (`toBe`)

### Requirement: Novation body
`req~space-subscription-body~1`
The function `subscriptionFromSelection(serviceKey, version, selection)` SHALL return an object with exactly the keys `contractedServices`, `subscriptionPlans` and `subscriptionAddOns`, each an object with the single key `serviceKey`, except `subscriptionPlans` when no plan is mapped.

Needs: impl, utest

#### Scenario: Delivera contract on Acme
- **GIVEN** `s = cmp(Side(Acme, C), Side(Acme, C)).selections.after`
- **WHEN** `subscriptionFromSelection('acme', '2026.07', s)` is called
- **THEN** the result strictly equals `{ contractedServices: { acme: '2026.07' }, subscriptionPlans: { acme: 'growth' }, subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } } }`

#### Scenario: Downgrade to Starter
- **GIVEN** `s = cmp(Side(Acme, C), Side(Acme, START)).selections.after`
- **WHEN** `subscriptionFromSelection('acme', '2026.07', s)` is called
- **THEN** the result strictly equals `{ contractedServices: { acme: '2026.07' }, subscriptionPlans: { acme: 'starter' }, subscriptionAddOns: { acme: {} } }`

### Requirement: Contracted version as given
`req~space-subscription-version~1`
The function `subscriptionFromSelection` SHALL set `contractedServices[serviceKey]` to the `version` argument unchanged.

Needs: impl, utest

#### Scenario: Dotted version of the target pricing
- **GIVEN** `s = cmp(Side(V1, M2), Side(V2, M2)).selections.after`
- **WHEN** `subscriptionFromSelection('mailer', V2.metadata.version, s)` is called
- **THEN** `contractedServices` strictly equals `{ mailer: '2.0' }`

### Requirement: Plan of the body
`req~space-subscription-plan~1`
The function `subscriptionFromSelection` SHALL set `subscriptionPlans` to `{ [serviceKey]: selection.planId }` when `selection.planId` is a non-empty string, and to `{}` otherwise.

Needs: impl, utest

#### Scenario: No plan and an empty plan
- **GIVEN** the selections `{ addOns: { extraStorage: { selected: true, quantity: 3 } } }` and `{ planId: '' }`
- **WHEN** `subscriptionFromSelection('acme', '2026.07', selection)` is called with each
- **THEN** both results have `subscriptionPlans` strictly equal to `{}`
- **AND** the first has `subscriptionAddOns` strictly equal to `{ acme: { extraStorage: 3 } }`

### Requirement: Add-ons of the body
`req~space-subscription-addons~1`
The function `subscriptionFromSelection` SHALL put in `subscriptionAddOns[serviceKey]`, in the key order of `selection.addOns`, each entry with `selected: true` and a finite quantity greater than 0, mapped to that quantity.

Needs: impl, utest

#### Scenario: Unselected, zero, negative and non-finite quantities
- **GIVEN** the selection `{ planId: 'growth', addOns: { a: { selected: false, quantity: 2 }, b: { selected: true, quantity: 0 }, c: { selected: true, quantity: Number.NaN }, d: { selected: true, quantity: Number.POSITIVE_INFINITY }, e: { selected: true, quantity: -1 }, f: { selected: true, quantity: 1.5 }, g: { selected: true, quantity: 4 } } }`
- **WHEN** `subscriptionFromSelection('acme', '1', selection)` is called
- **THEN** `subscriptionAddOns` strictly equals `{ acme: { f: 1.5, g: 4 } }` and `Object.keys(subscriptionAddOns.acme)` equals `['f', 'g']`

### Requirement: Round trip with the contract mapping
`req~space-roundtrip~1`
WHEN the `subscriptionPlans` and `subscriptionAddOns` of a body built by `subscriptionFromSelection` are passed to `selectionFromContract` with the same service key, the result SHALL have the plan and the selected add-ons with the quantities of the body.

Needs: impl, utest

#### Scenario: Upgrade to Enterprise
- **GIVEN** `body = subscriptionFromSelection('acme', '2026.07', cmp(Side(Acme, C), Side(Acme, ENT)).selections.after)`
- **WHEN** `selectionFromContract(body, 'acme')` is called
- **THEN** the result deeply equals `{ planId: 'enterprise', addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }`

### Requirement: Contracted version of a service
`req~space-contracted-version~1`
The function `contractedVersion(contract, serviceKey)` SHALL return `contract.contractedServices[serviceKey]` with every `_` replaced by `.`, or `undefined` when the contract has no entry for the service.

Needs: impl, utest

#### Scenario: Escaped, dotted and missing versions
- **GIVEN** the contract `{ contractedServices: { acme: '2026_07', mailer: '1.0' } }` and the contract `{}`
- **WHEN** `contractedVersion` is called with the first and `'acme'`, `'mailer'` and `'other'`, and with the second and `'acme'`
- **THEN** the results are `'2026.07'`, `'1.0'`, `undefined` and `undefined`

### Requirement: Current usage of a service
`req~space-current-usage~1`
The function `currentUsageFromContract(contract, serviceKey)` SHALL return an object that maps each usage-limit name of `contract.usageLevels[serviceKey]` whose `consumed` is a finite number of at least 0 to that number.

Needs: impl, utest

#### Scenario: SPACE usage levels
- **GIVEN** the contract `{ usageLevels: { acme: { storage: { consumed: 150, resetTimeStamp: '2026-11-01T00:00:00Z' }, apiCalls: { consumed: Number.NaN }, seats: { consumed: -1 }, exports: {} }, mailer: { emails: { consumed: 9 } } } }`
- **WHEN** `currentUsageFromContract` is called with `'acme'`, `'mailer'` and `'other'`
- **THEN** the results strictly equal `{ storage: 150 }`, `{ emails: 9 }` and `{}`

### Requirement: Space helpers do not mutate their arguments
`req~space-no-mutation~1`
The functions `subscriptionFromSelection`, `contractedVersion` and `currentUsageFromContract` SHALL NOT mutate their arguments.

Needs: impl, utest

#### Scenario: Deep copies compare equal
- **GIVEN** deep copies of the contract of the scenario "SPACE usage levels", of the contract `{ contractedServices: { acme: '2026_07' } }` and of the selection of the scenario "Unselected, zero, negative and non-finite quantities"
- **WHEN** the three functions are called with the originals and the test changes the returned objects
- **THEN** every original still deeply equals its copy
