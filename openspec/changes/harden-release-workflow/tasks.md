# Tasks: harden-release-workflow

Rules for every slice:

- One capability (`release-workflow`), at most 300 diff lines per slice without tests. Order: S0,
  then T1, then I1. T2 and I2 wait for the owner decision on finding 1 (design.md D5).
- Tests first: the test-designer task writes the static test and proves it red before (G3); the
  implementer task runs the frozen test and touches no test file (G4).
- Every requirement is traced: `[utest->req~…~1]` in `tests/unit/release-workflow.test.ts`,
  `[impl->req~…~1]` as `#` comments in `release.yml` (or next to the test cases if the trace tool
  does not scan `.github/`; the coordinator confirms).
- No feature flag, no ADR, no changeset (design.md D8). Nothing is released; the workflow is first
  exercised in the owner's next release.
- No change to `ci.yml`, `.npmrc`, `scripts/check-release-ready.mjs`, `INTENT.md` or `ROADMAP.md`.

Checks (the coordinator registers them; names are the commands):

- `spec`: `["sh", "-c", "openspec validate harden-release-workflow --strict"]`
- `release-test`: `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`
- `red_before`: the `release-test` argv, expected exit 1, pattern `AssertionError`, overlay
  `tests/unit/release-workflow.test.ts`
- `unit`: `["pnpm", "run", "test"]`
- `lint`: `["pnpm", "run", "lint"]`
- `release-ready`: `["node", "scripts/check-release-ready.mjs", "v0.1.0"]`
- `format`: `["pnpm", "exec", "prettier", "--check", <owned files>]`

## S0: OpenSpec change

- [x] S0 Spec (specifier).
  - Files: `openspec/changes/harden-release-workflow/**`.
  - Checks: `spec`. Gates G1, G2.

## Slice 1: dist-tag through env, one unit-test run

Requirements: `req~release-dist-tag-env~1`, `req~release-single-unit-test-run~1`,
`req~release-check-substrings-kept~1`. Risk medium (intake, I1: score 4).

- [x] T1 Tests (test-designer).
  - Files: `tests/unit/release-workflow.test.ts` (new).
  - Read only: `specs/release-workflow/spec.md`, `.github/workflows/release.yml`, `package.json`,
    `scripts/check-release-ready.mjs`.
  - Cases: every scenario, statically (design.md D7). Parse `release.yml` with `yaml`, read
    `package.json` as JSON, never execute a workflow script. The cases for "No expression in any run
    script of the publish job", "Dist-tag mapped through the step env", "prepublishOnly checks the
    package without the unit tests" and "Exactly one publish-job step runs pnpm test" fail on the
    base by assertion. Match `pnpm test` as a whole command line, so `pnpm test:browser` does not
    count.
  - Tags: `// [utest->req~release-dist-tag-env~1]`, `// [utest->req~release-single-unit-test-run~1]`,
    `// [utest->req~release-check-substrings-kept~1]`.
  - Checks: `red_before`, `release-test` (after I1), `lint`, `format`.
- [x] I1 Implementation (implementer, after T1 is frozen).
  - Files: `.github/workflows/release.yml` (the publish step, `:130-131`), `package.json`
    (`scripts.prepublishOnly` only, `:147`), `docs/audit-report.md` (findings 3 and 4 resolved,
    "Open items" updated; finding 1 stays open, finding 2 stays accepted; the workflow is not
    exercised until the next release).
  - Change: design.md D2 and D3, keeping D4.
  - Checks: `release-test`, `unit`, `release-ready`, `format` on the three files, CI on the PR.
  - Gates: G4, G6, G11 (medium panel with the security-auditor), G13 (how-to-review: the
    `release.yml` diff, the static test and the `release-ready` run).

## Pending owner decision: finding 1

Not part of this change until the owner answers intake Q1 and Q3 (design.md D5).

- [ ] S1 Amend this change with `req~release-npm-cli-verified~1` for the chosen option (specifier);
      run `spec` again.
- [ ] T2 Static guard for finding 1 in `tests/unit/release-workflow.test.ts` (test-designer, after
      T1).
- [ ] I2 Implementation in `release.yml`, `docs/releasing.md:32` and `docs/audit-report.md`
      (implementer, after I1; risk high, score 7).

## Ownership and order

1. S0 owns `openspec/changes/harden-release-workflow/**`.
2. T1 owns `tests/unit/release-workflow.test.ts`.
3. I1 owns `release.yml`, `package.json` (`scripts.prepublishOnly`), `docs/audit-report.md`.

- Later: S1, T2 and I2 in that order, each after the previous one; none runs in parallel with the
  slices above.

## Traceability checklist

- `req~release-dist-tag-env~1`: impl in `.github/workflows/release.yml`, utest in
  `tests/unit/release-workflow.test.ts`.
- `req~release-single-unit-test-run~1`: impl in `package.json` and `release.yml`, utest in
  `tests/unit/release-workflow.test.ts`.
- `req~release-check-substrings-kept~1`: impl in `.github/workflows/release.yml`, utest in
  `tests/unit/release-workflow.test.ts`.
