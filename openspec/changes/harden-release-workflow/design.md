# Design: harden-release-workflow

Decisions come from the planner intake (`docs/agent-work/prop-20261030-1/intake.md`, "Scope",
"Slices", "Open questions") and its handoff. Line numbers are at base `a82cd88`.

## Context

- `release.yml` has one job, `jobs.publish`, with `id-token: write` (`:33-35`) and the protected
  `npm` environment (`:23`). It runs on a published GitHub Release or through `workflow_call`
  (`:3-12`).
- The first step (`id: release`, `:39-62`) checks the GitHub Release and writes `dist_tag=next` for a
  prerelease, else `dist_tag=latest`, to `$GITHUB_OUTPUT`.
- The last step (`:130-131`) runs
  `npm publish --access public --provenance --tag "${{ steps.release.outputs.dist_tag }}"`. It is
  the only `run` script of the job with a `${{ ... }}` expression; the other expressions are in
  `env` (`:37`, `:42`) or `with` (`:67`, `:125`) values.
- `npm publish` runs the `prepublishOnly` lifecycle script, `pnpm test && pnpm package:check`
  (`package.json:147`), and `prepack`, `pnpm build` (`:146`). `package:check` runs `pnpm build`,
  `publint` and `attw` (`:143`).
- `scripts/check-release-ready.mjs` reads `release.yml` as text. It requires `release:`,
  `workflow_call:`, `id-token: write`, `gh release view "$RELEASE_TAG"` and
  `npm publish --access public --provenance` (`:51-57`), and forbids `\bNPM_TOKEN\b`,
  `\bNODE_AUTH_TOKEN\b` and `\bsecrets\.` (`:65-69`). It runs in the publish job (`release.yml:94-95`).

## Decisions

### D1. One capability, one implementation slice

`release-workflow` is new: no living spec covers the release. Findings 3 and 4 have one obvious fix
each and share `release.yml` and `docs/audit-report.md`, so one test slice (T1) and one
implementation slice (I1) cover all three requirements. Finding 1 is not in this change (D5).

### D2. Dist-tag through `env`, fail closed (finding 4)

The publish step gets `env: DIST_TAG: ${{ steps.release.outputs.dist_tag }}`. Its `run` first
checks the value with a shell `case` (`latest|next` pass; anything else writes an `::error::`
annotation and exits 1), then runs `npm publish --access public --provenance --tag "$DIST_TAG"`.
This keeps the substring `npm publish --access public --provenance` that the release check requires.

Options considered:

- Keep the expression in `run`: the value is safe today, but the audit finding stays. Rejected.
- `env` only, without a guard: removes the injection, but an empty or unexpected output (a later
  edit of the `release` step) would publish under a wrong tag or fall back to npm's default.
  Rejected.
- `env` plus a fail-closed guard. **Chosen.** The exact match (`latest`, `next`, case-sensitive, no
  surrounding whitespace) is the requirement; the `case` statement and the variable name `DIST_TAG`
  are the implementer's choice.

### D3. `prepublishOnly` is `pnpm package:check` (finding 3, intake Q2)

Options considered (the coordinator decides Q2; no owner decision):

- (a) `pnpm package:check`. **Chosen.** Any publish path, a manual one included, still checks the
  packed artifact; only the repeated unit tests go. The extra build of `package:check` and `prepack`
  remains (accepted cost, it does not run tests).
- (b) Remove the script: a manual `npm publish` would skip `publint` and `attw`. Rejected.
- (c) Keep it and skip it in CI with an environment guard: shell-dependent, keeps the duplicate
  path. Rejected.

"Exactly once" counts the steps of `jobs.publish` whose `run` has a command line equal to
`pnpm test` (trimmed). A step running `pnpm test:browser` (`release.yml:118-119`) is a different
command and does not count. With D3, `npm publish` adds no run.

### D4. Keep the release check green

Every edit of `release.yml` keeps the five required substrings and adds no forbidden reference
(`req~release-check-substrings-kept~1`). The static test reads the list from
`scripts/check-release-ready.mjs:51-57` (or copies it with a comment naming the lines), and I1 runs
`node scripts/check-release-ready.mjs v0.1.0` as a check.

### D5. Audit finding 1 is out of this change for now

The fix of `npm install --global npm@11.18.0` (`release.yml:80-89`) changes the security control of
the binary that does the OIDC publish, and several options exist (intake Q1: drop the global install
and fail closed unless the bundled npm is 11.5.1 or newer; or verify the tarball against an SRI
hash written in the workflow). It waits for the owner's decision, together with the `node-version`
pin (Q3). After the owner decides, this change is amended with `req~release-npm-cli-verified~1`,
written for the chosen option, and G1 is run again; T2 and I2 follow (tasks.md). No requirement for
finding 1 is written before that decision.

### D6. Finding 2 stays accepted

Splitting verify and publish into two jobs (`docs/audit-report.md:94-99`) is accepted on purpose
(`release.yml:24-32`) and is out of scope. This change neither reduces nor widens that exposure.

### D7. Tests first, static only

T1 adds `tests/unit/release-workflow.test.ts`. It parses `release.yml` with the existing `yaml`
dependency and reads `package.json` as JSON; it never executes a workflow script. The fail-closed
guard of D2 is asserted statically: a check on the dist-tag variable that exits non-zero appears in
the publish step's `run` before `npm publish`. On the base, the cases for D2 and D3 fail by assertion
(G3).

### D8. No feature flag, no ADR, no changeset

CI and package-script changes only, with no runtime behaviour to switch, no new dependency and no
consumer-visible file or API.

## Requirement notes

- "Publish job": `jobs.publish` of `.github/workflows/release.yml`. "Publish step": the step of that
  job whose `run` invokes `npm publish`.
- "`run` script": the `run` value of a step. Expressions in `env`, `with`, `if` or job keys are not
  `run` scripts.
- "Fail before `npm publish`": the step exits with a non-zero status and `npm publish` is not
  invoked, so nothing reaches the registry.
- `req~release-check-substrings-kept~1` names the substrings and patterns of
  `check-release-ready.mjs:51-69` at the base. If that script changes, the requirement gets a new
  revision.

## Risks

- R1. Nothing exercises `release.yml` before the owner's next release (`ROADMAP.md:139-148`); a
  mistake shows up only then. Mitigation: the static test, `check-release-ready.mjs` as an I1 check,
  the security-auditor review, and a guard that fails before `npm publish`.
- R2. Without `pnpm test` in `prepublishOnly`, a manual `npm publish` from a laptop skips the unit
  tests. Mitigation: CD is the only documented publish path (`docs/releasing.md:3-6,73-75`), and
  `package:check` stays.
- R3. `docs/audit-report.md` and `release.yml` are shared with the finding-1 slices. Mitigation: the
  slices are serialized, never parallel.
- R4. Finding 1 stays open until the owner decides (D5); the audit report keeps it marked open.

## Migration

None. Nothing is released by this change; no stored data, option, published file or API changes.

## Open questions

- Owner (intake Q1 and Q3, CRP sent by the coordinator): how to close finding 1, and whether to pin
  `node-version`. It does not block this change; it adds `req~release-npm-cli-verified~1` later.
