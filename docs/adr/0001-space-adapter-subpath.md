# ADR 0001: SPACE adapter as the `pricing-renderer/space` subpath

- Status: accepted
- Deciders: the owner (CRP `crp-phase2-api-decisions`, answer id
  `own-27876d8d5ef5459e9bc6067536e2e5d4`, "approve", decisions D1 to D9)
- Supersedes: the delivera-2 decision "SPACE option A"
  (`docs/agent-work/delivera-2-load-current-contract/proposal.md:72-75`)
- Change: `openspec/changes/add-subscription-change-flow` (design.md, D7)

## Context and problem statement

Delivera-2 loaded a SPACE contract into the editor. The owner chose "SPACE option A":
the contract mapping stays an example in `examples/space-contract/`, tested from
`tests/unit/space-contract.test.ts` with a structural input type. The package exports no
mapping function and does not follow the SPACE contract format in its releases.

The subscription change flow needs more than the example gives. A host must read the
contract into a selection, build the SPACE novation body from a reconciled selection, read
the contracted version and read the usage levels. Copying an example file into every host
means each copy drifts from the others and from the comparison the package computes.

## Considered options

- Option A (kept until now): the mapping stays an example that hosts copy.
- Option B: a new subpath `pricing-renderer/space` with pure functions
  (`selectionFromContract`, `subscriptionFromSelection`, `contractedVersion`,
  `currentUsageFromContract`).
- Option C: a separate package for the SPACE adapter.

## Decision outcome

Option B. The subpath is `src/space/index.ts`:

- pure functions, zero runtime dependencies, no HTTP;
- a type-only import of the core (`import type { ... } from '../core/index.js'`), so the
  emitted `dist/space/index.js` has no `import` or `require`;
- structural input types (`SpaceContractLike`, `SpaceSelectionLike`), so the package does
  not depend on SPACE;
- side-effect free, so `sideEffects` in `package.json` is unchanged;
- `examples/space-contract/map-contract.ts` becomes a re-export.

Option C was not chosen: the adapter is four small functions, and a second package adds a
release and a version matrix for no gain. A separate subpath already keeps a SPACE format
change out of the renderer's other entry points.

## Consequences

- Releases of `pricing-renderer` now follow the SPACE contract format. Option A said the
  opposite.
- A change of the SPACE contracted-services format is handled as a semver decision per
  change: a compatible reading is a minor, an incompatible one is a major or a new
  function.
- Assumption A1 is unverified: SPACE accepts dotted versions in the novation body and
  stores them with `.` replaced by `_`. It was seen in `ContractService` for contract
  creation and not read for the novation path. `contractedVersion` turns `_` back into `.`
  on that assumption.
- The requirement `req~space-map-not-exported~1` of delivera-2 is superseded. It still
  holds literally (the four older entry points do not export the function), but its intent,
  no runtime SPACE export, is reversed by this subpath.
- Service keys are matched exactly (assumption A4): hosts pass the lowercase key SPACE
  stores.
