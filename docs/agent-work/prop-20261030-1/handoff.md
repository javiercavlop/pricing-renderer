# Handoff: prop-20261030-1 (fix the open release-workflow findings before the next release)

- Status: waiting on the coordinator. One owner CRP is needed (Q1) for slices T2 and I2 only.
  Updated: 2026-11-01.
- Branch / head: planner task `task/ea3ce7c80aa34647`, base `a82cd88`. PR: none.

## Goal

Close audit findings 1, 3 and 4 of `release.yml` before the single next release. Finding 2 stays
accepted. This serves INTENT O4, signal "Release workflow findings" (`INTENT.md:88-90`).

## State (with evidence)

- The proposal is approved by the owner.
- The intake is written: `docs/agent-work/prop-20261030-1/intake.md`, with slices S0, T1, I1, T2
  and I2.
- The findings are confirmed at the base:
  - finding 4: `release.yml:131`;
  - finding 1: `release.yml:88-89`, in the job with `id-token: write` (`:35`);
  - finding 3: `package.json:147`, against `release.yml:110,113` and `package.json:143,146`.
- The 52 pending changesets are confirmed (`.changeset/*.md` minus README). `ROADMAP.md:142,182`
  still says 45.
- No code, test, spec, workflow or acceptance file was changed.

## Decisions

- Two implementation slices. I1 covers findings 4 and 3 and needs no decision. I2 covers finding 1
  and waits for Q1. Reason: findings 3 and 4 have one obvious fix, while finding 1 has several
  options that change the publish toolchain.
- A static unit test, `tests/unit/release-workflow.test.ts`, guards the fixes. Reason: no CI job
  and no test reads `release.yml` today, and the release is on hold (`ROADMAP.md:139-148`).
- Every fix keeps the substrings that `scripts/check-release-ready.mjs:51-57` requires. Reason: that
  script runs in the release job (`release.yml:94-95`) and would fail the release otherwise.
- No feature flag and no changeset. Reason: CI and script changes only, with no consumer-visible
  file or API.
- Slices run in sequence, never in parallel. Reason: `release.yml` and `docs/audit-report.md` are
  shared by I1 and I2, and the change is small.
- Risk: I1 is medium (score 4), I2 is high (score 7, it changes the security control of the
  publishing binary). S0, T1 and T2 are low.

## Ruled out

- `npm audit signatures` as the finding-1 fix, as the proposal suggests. It checks only the
  project's installed tree and has no global mode. Lookup, medium confidence; sources
  docs.npmjs.com/cli/v11/commands/npm-audit and github.com/npm/cli/pull/4827.
- Splitting verify and publish (finding 2). Accepted on purpose (`release.yml:24-32`); it needs its
  own owner approval.
- Editing `INTENT.md` or `ROADMAP.md` in this change. Both are owner-accepted documents, so their
  update is a followup for a doc-steward task.

## Open questions and risks

- Q1, CRP to the owner: how to close finding 1. Recommended option A: drop the global install and
  fail closed unless the bundled npm is 11.5.1 or newer.
  - Lookup, medium confidence: Node 24.22.2 bundles npm 11.19.1, so the pinned 11.18.0 may be a
    downgrade. Not checked against the runner.
  - Q3, an exact `node-version` pin, goes in the same CRP.
- Q2, the coordinator decides: `prepublishOnly` becomes `pnpm package:check` (recommended).
- Risk: the workflow runs for real only at the owner's next release. Mitigation: the static test,
  fail-closed steps before `npm publish`, and a security-auditor review.
- `openspec` is not a dependency in `package.json`. The coordinator confirms the G1 CLI.
- G5, G7 and G10 are not defined in the files read. Whether OFT scans `.github/` is not verified.

## Next three steps

1. The coordinator sends the Q1/Q3 CRP to the owner and creates contracts for S0, T1 and I1. These
   do not wait for the CRP. S0's finding-1 requirement is drafted for option A and amended if the
   owner chooses otherwise.
2. A specifier runs S0 (`openspec/changes/harden-release-workflow/**`, G1, G2). A test-designer then
   runs T1 with its red-before check.
3. An implementer runs I1: `release.yml:130-131` env and guard, `package.json:147`, and
   `docs/audit-report.md`. Its checks include `node scripts/check-release-ready.mjs v0.1.0`. After
   the CRP answer, T2 and then I2 follow.

## Evidence

- Files read: `.github/workflows/release.yml`, `.github/workflows/ci.yml:1-170`,
  `docs/audit-report.md`, `package.json:120-153` (and the `yaml`/`engines` lines),
  `scripts/check-release-ready.mjs`, `docs/releasing.md`, `INTENT.md:70-130`,
  `ROADMAP.md:120-187`, `vitest.config.ts`, `.prettierignore`, `README.md` (grep).
- Lookups: two (npm OIDC minimum and Node 24 bundled npm; `npm audit signatures` scope). Both
  medium confidence.
- Checks: none registered for this task, and none run.
