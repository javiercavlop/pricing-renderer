# Handoff: prop-20261103-1 (choose the release dist-tag fail-closed)

- Status: waiting on the coordinator. No owner CRP is needed. Updated: 2026-11-03.
- Branch / head: planner task `task/417660f0a5f548b3`, base `c0c926d`. PR: none.

## Goal

The `release` step must write `dist_tag=next` only for `isPrerelease == true` and `latest` only for
`false`, and it must fail before `npm publish` otherwise. The static test must enforce this and must
no longer accept a commented-out `exit 1`. This serves INTENT O4 (`INTENT.md:77-90`).

## State (with evidence)

- The proposal is approved by the owner. The intake is written:
  `docs/agent-work/prop-20261103-1/intake.md`, with slices S0, T1 and I1.
- The defect reproduces at the base:
  - `release.yml:58-62` writes `latest` in the `else` branch;
  - the guard at `:137-143` accepts `latest`;
  - the audit open item is at `docs/audit-report.md:139-142`.
- The test weakness reproduces by reading (not executed): the guard regex at
  `tests/unit/release-workflow.test.ts:59-61` matches an arm whose `exit 1` is commented out.
- 54 pending changesets confirmed (55 `.changeset/*.md`, `README.md` included).
- The followup ids in the proposal are not in the repository (grep: 0 matches). They are factory
  task records.
- No code, test, spec, workflow or acceptance file was changed.

## Decisions

- Three serialized slices: S0 spec delta, T1 tests (red first), I1 workflow and audit report. T1 and
  I1 land in one PR. Reason: tests first (G3/G4), and the slices share one small capability.
- Proposed: a new OpenSpec change `release-dist-tag-fail-closed` with the ADDED requirement
  `req~release-dist-tag-prerelease-map~1`. Reason: `harden-release-workflow` is merged (#77) but
  unarchived and still waits on finding 1 (`tasks.md:61-70`). Coordinator Q1.
- `req~release-dist-tag-env~1` stays at revision 1. Only its test is tightened. Reason: a
  commented-out exit already fails its text ("a guard that fails the step").
- The tests stay static (`harden-release-workflow/design.md:87-93`, D7). Coordinator Q2.
- Risk: I1 medium (score 4: CI config +3, two modules +1), or high (7) if counted as security
  config. S0 and T1 are low.
- No feature flag, ADR, changeset, or `docs/releasing.md` edit. Reason: CI-only, and
  `docs/releasing.md:43` already says that a failed gate skips publish.

## Ruled out

- `jq -e` alone (the proposal's alternative). It still maps any non-`true` value, `null` included,
  to `latest`.
- Relying on `bash -e` alone. The default shell is `bash -e {0}` without pipefail (lookup, medium
  confidence, docs.github.com workflow-syntax `jobs.<job_id>.steps[*].shell`). A substitution inside
  `[ … ]` does not trigger `-e`.
- Doing nothing: a silent wrong-tag publish stays possible on the only planned release.

## Open questions and risks

- Q1 (coordinator): a new change or an amendment of `harden-release-workflow`. Recommended: a new
  change.
- Q2 (coordinator): a static test or execution of the step script. Recommended: static.
- Risk: the next release is the first real run, and a bad `case` would stop it before publish.
  Mitigation: T1 case 1, a security-auditor review, and `check-release-ready.mjs` in I1.
- Risk: file contention with the pending finding-1 slices of `harden-release-workflow`. Mitigation:
  serialize. Recommended: this change first.
- Not verified:
  - whether the trace tool scans `.github/`;
  - whether the `openspec` CLI is in the lab;
  - which gates G5, G7 and G10 are;
  - that `gh release view --json isPrerelease` returns a JSON boolean.

## Next three steps

1. The coordinator answers Q1/Q2 and creates the contracts for S0, T1 and I1 with the check argv
   arrays from the intake.
2. A specifier writes `openspec/changes/release-dist-tag-fail-closed/**` (G1, G2). A test-designer
   then writes T1 in `tests/unit/release-workflow.test.ts` and proves case 1 red before (G3).
3. An implementer runs I1: `release.yml:58-62` as an explicit `case` with an `::error::` default,
   plus `docs/audit-report.md:139-142` resolved. The checks include
   `node scripts/check-release-ready.mjs v0.1.0`. The review is the medium panel with the
   security-auditor.

## Evidence

- Files read:
  - `.github/workflows/release.yml`;
  - `.github/workflows/ci.yml:20-144`;
  - `tests/unit/release-workflow.test.ts`;
  - `docs/audit-report.md:85-148`;
  - `docs/releasing.md:20-47`;
  - `openspec/changes/harden-release-workflow/{design.md,tasks.md,specs/release-workflow/spec.md}`;
  - `INTENT.md:60-99`;
  - `ROADMAP.md` (grep);
  - `docs/agent-work/prop-20261030-1/{intake.md,handoff.md}`;
  - `scripts/check-release-ready.mjs` and `package.json` (grep).
- Lookups: one (the default shell of GitHub Actions `run` steps), medium confidence.
- Checks: none registered for this task, and none run.
