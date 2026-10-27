# Handoff: phase1b-private-pricings

- Status: waiting on the owner (CRP-1 and CRP-2) · Updated: 2026-10-27
- Branch / head: task/fc479a51645243e6 / base `465e248` · PR: none

## Goal

Load public and private pricings safely. The change has five parts:

- a security guide;
- `createSpherePublicLoader` in `pricing-renderer/yaml`;
- an ETag cache hook for the `src` loader;
- a Next.js guide;
- the owner's pricing-version policy.

Objective O3. Owner request `own-0a8bc0e65ad74eec86dcfa5c8c0ebf1a`.

## State (with evidence)

- The intake is written: `docs/agent-work/phase1b-private-pricings/intake.md`. Nothing is
  implemented.
- The repository facts were verified at `465e248`:
  - The loader is in `src/yaml/load.ts:42-119`. It has no ETag code: grep `etag|If-None-Match` in
    `src/` finds nothing.
  - Loader error text appears on screen (`load.ts:106-114`, `pricing-renderer-element.ts:957-959`).
  - `src` is reflected (`element.ts:104`).
  - The element reloads when `request` or `loadPricing` changes (`element.ts:235-245`).
  - The global config is read in the constructor (`config.ts:12,86-91`, `element.ts:184`).
  - Every `PR_` code in `src/` needs a row in `docs/events.md`
    (`tests/unit/docs-examples.test.ts:59-64,101-106`).
- External facts were checked by lookup (medium confidence):
  - SPHERE v2.6.0 is commit `8472610744ad5fdab474e4ab0533ce7f5425d521`.
  - The manifest and `/yaml` routes exist, with a strong ETag and `304`.
  - `cors()` exposes no headers, so a browser on another origin cannot read `ETag`.
  - SPACE's `showPricing` returns JSON.
  - SPACE auth is `x-api-key`, with both `usr_` and `org_` keys and no short-lived token.
  - SPACE's sync is opt-in, every 5 minutes by default.

## Decisions

- Five PRs, one per capability: S1 security guide, S2 SPHERE loader, S3 cache hook, S4 Next guide,
  S5 versions guide. Reason: each one is independently mergeable (intake D1).
- No feature flag. Reason: the API additions are additive and unreleased (D2).
- A pinned `versionId` skips the manifest. This is confirmed in CRP-1 (iii) (D3).
- The ETag cache is used only when the header is readable. Reason: `cors()` exposes no headers
  (D4).
- The SPHERE loader takes no credentials or headers options (D5).
- Red tests are written by an implementer in `tests/unit`. Reason: `vitest.config.ts:6` (D6).
- `examples/next` stays as it is, because no Next build check exists (D7, F4).

## Ruled out

- Browser-side manual `If-None-Match` caching against SPHERE: the `ETag` header cannot be read
  across origins (cors defaults).
- New `PR_SPHERE_*` codes by default. They would couple the slice to `docs/events.md`. The owner
  can still choose them in CRP-1 (i).
- Tests in `acceptance/**`: Vitest does not run that folder.

## Open questions and risks

- CRP-1 (owner): the shape of `createSpherePublicLoader`. Recommended: return
  `{ src, loadPricing, fetchYaml }`, reuse `PR_SOURCE_LOAD_FAILED`, https only, and skip the
  manifest for a pinned version.
- CRP-2 (owner): a `request.cache` ETag hook used only for anonymous loads. The other options are
  allowing it for authenticated loads with a `cacheKey`, or no hook.
- N1 (owner): recorded SPHERE responses. The lookup got a 403. Fallback: fixtures derived from
  `8472610`, labelled as such.
- N2 (owner): recorded SPACE responses for the service (the shape of `sphere.target`) and for the
  pricing JSON.
- Coordinator:
  - Is `spec.md` the stand-in for G1 (`openspec/` is absent)?
  - Should `["pnpm","run","package:check"]` be registered for S2?
  - How are G5 and G7 mapped?
- Risk: S1 could state private SPHERE credential formats that are not verified ("sk-" and the 24h
  JWT). Mitigation: S1 checks them by lookup before it names them.
- Risk: the guides could claim that SPACE pricing JSON normalizes. Mitigation: they must not, until
  F5 has a test.

## Next three steps

1. The coordinator sends CRP-1 and CRP-2 to the owner, and asks for N1 and N2 (texts in the intake
   sections "Owner CRPs" and "Needs").
2. Wave 1, in parallel:
   - S1, doc-steward: owns `docs/private-pricings.md`, `README.md:371-389`, one docs-list line, and
     a changeset.
   - S5, doc-steward: owns `docs/pricing-versions.md`, `docs/preload-current-subscription.md`, and a
     changeset.
   - S2a, red tests, once the CRP-1 shape is known: owns `tests/unit/sphere-loader.test.ts` and
     `tests/fixtures/sphere/**`, with the red-before check in the intake.
3. Run S0 (spec) once the CRPs are answered. Then wave 2 (S2b and S3a), then wave 3 (S3b and S4),
   with the owned files and checks listed per slice in the intake.

## Evidence

- Task: this planner task. No checks are registered for it, so none were run. Base `465e248`. No
  CI.
- Lookup sources:
  - `isa-group/SPHERE` at v2.6.0: `PermanentLinkRoutes.ts`, `PermanentLinkService.ts`,
    `GlobalMiddlewaresLoader.ts`.
  - The expressjs/cors README.
  - `isa-group/SPACE` main: `AuthMiddleware.ts`, `config/permissions.ts`, `ServiceController.ts`,
    `services/sphere/types.ts`, `docs/sphere-synchronization.md`.
  - The SPHERE iSubscription docs.
