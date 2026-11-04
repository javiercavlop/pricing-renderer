# Tasks: release-dist-tag-fail-closed

Rules for every slice:

- One capability (`release-workflow`), at most 300 diff lines per slice without tests. Order: S0,
  then T1, then I1. T1 is red by design, so T1 and I1 land in one PR.
- Tests first: the test-designer task writes the static cases and proves the mapping case red
  before (G3); the implementer task runs the frozen test and touches no test file (G4).
- Every requirement is traced: `// [utest->req~release-dist-tag-prerelease-map~1]` in
  `tests/unit/release-workflow.test.ts`, `# [impl->req~release-dist-tag-prerelease-map~1]` as a
  comment above the `release` step in `release.yml` (same assumption about the trace tool as
  `harden-release-workflow/tasks.md:9-11`).
- No feature flag, no ADR, no changeset (design.md D5). Nothing is released; the workflow is first
  exercised in the owner's next release.
- No change to `ci.yml`, `.npmrc`, `docs/releasing.md`, `scripts/check-release-ready.mjs`,
  `INTENT.md` or `ROADMAP.md`.
- Never run at the same time as S1, T2 or I2 of `harden-release-workflow` (design.md R3).

Checks (the coordinator registers them; names are the commands):

- `spec`: `["sh", "-c", "openspec validate release-dist-tag-fail-closed --strict"]`
- `release-test`: `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`
- `red_before`: the `release-test` argv, expected exit 1, pattern `AssertionError`, overlay
  `tests/unit/release-workflow.test.ts`
- `unit`: `["pnpm", "run", "test"]`
- `lint`: `["pnpm", "run", "lint"]`
- `release-ready`: `["node", "scripts/check-release-ready.mjs", "v0.1.0"]`
- `format`: `["pnpm", "exec", "prettier", "--check", <owned files>]`

## S0: OpenSpec change

- [x] S0 Spec (specifier).
  - Files: `openspec/changes/release-dist-tag-fail-closed/**`.
  - Checks: `spec`. Gates G1, G2.

## Slice 1: fail-closed dist-tag mapping

Requirement: `req~release-dist-tag-prerelease-map~1`; hardening of the test of
`req~release-dist-tag-env~1` (unchanged, design.md D4). Risk medium (intake, I1: score 4).

- [ ] T1 Tests (test-designer).
  - Files: `tests/unit/release-workflow.test.ts`.
  - Read only: `specs/release-workflow/spec.md`, `.github/workflows/release.yml`,
    `openspec/changes/harden-release-workflow/specs/release-workflow/spec.md`.
  - Cases, statically (design.md D3), never executing a workflow script:
    1. Red first, `req~release-dist-tag-prerelease-map~1`, on the real workflow: select the step
       with `id: release` (add `id?: string` to the `Step` interface), remove full-line `#`
       comments from its `run`, and assert every scenario of the spec. Accept both the `case` and
       the `if/elif/else` forms (design.md R2). It fails on the base by assertion, because
       `release.yml:58-62` is an `else` branch that writes `latest`.
    2. Hardening, `req~release-dist-tag-env~1`: apply the same comment stripping to the publish
       step's `run` before the guard regex, and add a fixture case where a synthetic publish
       script's `*)` arm holds only `# exit 1`; it must not match the guard. Not red on the base.
  - Keep the other cases and the header comment (which names design D7 of
    `harden-release-workflow`) consistent.
  - Tags: `// [utest->req~release-dist-tag-prerelease-map~1]`, `// [utest->req~release-dist-tag-env~1]`.
  - Checks: `red_before` (case 1), `release-test` (after I1), `lint`, `format`.
- [ ] I1 Implementation (implementer, after T1 is frozen).
  - Files: `.github/workflows/release.yml` (only the `release` step, `:39-62`),
    `docs/audit-report.md` (`:139-142` resolved; one line in the "Release workflow" section,
    `:112-114`, saying the static test also checks the mapping; keep "not exercised until the
    owner's next release").
  - Change: design.md D2. Keep `gh release view "$RELEASE_TAG"` and add no `${{` to any `run`
    script.
  - Checks: `release-test`, `unit`, `release-ready` (`node scripts/check-release-ready.mjs v0.1.0`),
    `format` on the two files, CI on the PR.
  - Gates: G4, G6, G11 (medium panel with the security-auditor), G13 (how-to-review: the
    `release.yml` hunk, the T1 cases, the `release-ready` run, and that the first real run is the
    owner's next release).

## Ownership and order

1. S0 owns `openspec/changes/release-dist-tag-fail-closed/**`.
2. T1 owns `tests/unit/release-workflow.test.ts`.
3. I1 owns `.github/workflows/release.yml` (the `release` step) and `docs/audit-report.md`.

## Traceability checklist

- `req~release-dist-tag-prerelease-map~1`: impl in `.github/workflows/release.yml`, utest in
  `tests/unit/release-workflow.test.ts`.
