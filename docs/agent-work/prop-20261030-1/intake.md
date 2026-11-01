# Intake: P-20261030-1, fix the open release-workflow findings before the next release

- Origin: proposal P-20261030-1 (kind security, size S, risk medium), approved by the owner.
  Planner intake, 2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/ea3ce7c80aa34647`. Every `file:line` below is at
  this base.
- INTENT link: O4, "supply-chain and CI health", signal "Release workflow findings"
  (`INTENT.md:88-90`). ROADMAP backlog row `ROADMAP.md:180-181`.
- No release: nothing here versions, tags or publishes. The release stays on hold
  (`ROADMAP.md:139-148`). The changed workflow therefore runs for the first time in the owner's
  single next release.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, finding 4, `dist_tag` in `run`. **R.** `.github/workflows/release.yml:131` is
  `npm publish --access public --provenance --tag "${{ steps.release.outputs.dist_tag }}"`. The
  value is only `next` or `latest`, set at `:58-62`. `RELEASE_TAG` already comes in through `env`
  (`:36-37`). Reported at `docs/audit-report.md:105-109` and `:127-129`.
- E2, finding 1, global npm without an integrity check. **R.** `release.yml:88-89` runs
  `npm install --global npm@11.18.0`. It runs before `pnpm install` (`:91-92`), in the job with
  `id-token: write` (`:33-35`). The workflow's own comment lists the fixes (`:80-87`). Reported at
  `docs/audit-report.md:90-93` and `:120-122`.
- E3, finding 3, `prepublishOnly` repeats work. **R.** `package.json:147` is
  `pnpm test && pnpm package:check`. `package:check` runs `pnpm build` (`package.json:143`), and
  `prepack` builds again (`:146`). The workflow already ran `pnpm test` (`release.yml:109-110`) and
  `pnpm package:check` (`:112-113`). So `npm publish` (`:131`) runs the unit tests a second time and
  builds twice more. Reported at `docs/audit-report.md:100-104`.
- E4, ROADMAP and INTENT. **P.**
  - `ROADMAP.md:180-181` lists the row with no state. It names only global npm and finding 2, not
    findings 3 and 4.
  - `INTENT.md:88-90` counts "3 listed": findings 1, 2 and 3. Finding 4 is not in that count, and
    finding 2 is accepted on purpose (`release.yml:24-32`, `docs/audit-report.md:123-126`). So
    "3 open" in the proposal means findings 1, 3 and 4, which is right, but it is not the number
    INTENT records. After this change: 0 open, 1 accepted (finding 2).
- E5, "52 pending changesets". **R.** `.changeset/` has 52 `*.md` files besides `README.md`.
  `ROADMAP.md:142` and `:182` still say 45 at `47a7b05`, which is stale (followup).
- E6, "drop the install if the runner's Node 24 npm already supports OIDC". **Not verifiable from
  the repository.** Lookup (deep, medium confidence; sources docs.npmjs.com/trusted-publishers,
  nodejs.org/dist/index.json):
  - npm Trusted Publishing needs npm CLI 11.5.1 or newer.
  - The latest Node 24.x is 24.22.2, which bundles npm 11.19.1. If `setup-node` with
    `node-version: 24` (`release.yml:74-78`) resolves to that version, the pinned 11.18.0 global
    install is a **downgrade**. This was not checked against the runner.
  - Managing dist-tags with trusted publishing reportedly needs npm 11.21.0 or newer. That applies
    to `npm dist-tag`, not to `npm publish --tag`. Not verified.
- E7, "`npm audit signatures` after the global npm install". **Does not do what the proposal
  needs.** Lookup (quick, medium confidence; sources docs.npmjs.com/cli/v11/commands/npm-audit,
  github.com/npm/cli/pull/4827): `npm audit signatures` checks only the project's installed tree.
  It has no `--global` mode, so it would not check the global npm CLI. Run in this project, it would
  check the pnpm-installed `node_modules`, which is a different control.
- E8, not in the proposal: what guards the workflow before the release.
  - `scripts/check-release-ready.mjs:51-63` requires the substrings `release:`, `workflow_call:`,
    `id-token: write`, `gh release view "$RELEASE_TAG"` and
    `npm publish --access public --provenance` in `release.yml`. `:65-75` forbids `NPM_TOKEN`,
    `NODE_AUTH_TOKEN` and `secrets.`. Every fix must keep those substrings and add no `secrets.`
    reference.
  - That script runs only inside the release job (`release.yml:94-95`). No CI job runs it, and no
    test reads `release.yml` (grep of `tests/`: 0 matches). No workflow linter (actionlint, zizmor)
    is configured (grep: 0 matches).
  - A PR that changes `.github/workflows/release.yml` or `package.json` runs the browser shards,
    because those paths are not on the docs allowlist (`ci.yml:125-139`).
- E9, docs that name the npm version. `docs/releasing.md:32` says "Node 24, npm 11.18.0". It must
  follow the finding-1 fix.

## Objective

Before the single next release, the publish job interpolates no step output into a script, uses
an npm CLI whose origin is verified or not downloaded at all, and runs the unit tests only once.
`docs/audit-report.md` records findings 1, 3 and 4 as resolved and finding 2 as accepted.

## Scope

- `release.yml`:
  - `dist_tag` comes in through a step `env`, and the step fails closed unless it is exactly
    `latest` or `next`;
  - the finding-1 fix chosen in Q1.
- `package.json` `scripts.prepublishOnly`: the repeated `pnpm test` goes (Q2).
- `docs/audit-report.md`: the release workflow list and "Open items" match the new state.
  `docs/releasing.md:32` follows Q1.
- A unit test that reads `release.yml` and `package.json` and fails if any finding comes back. It
  is the only check that can run before the release (E8).
- A spec delta for a new capability `release-workflow`. No living spec covers the release today
  (`openspec/` has only change folders).

## Non-goals

- Finding 2, splitting verify and publish into two jobs. It is accepted on purpose
  (`release.yml:24-32`) and needs its own owner approval.
- Any release, `changeset version`, tag or npm publish (`ROADMAP.md:147-148`).
- A workflow linter in CI, or making the `audit` job blocking (`ROADMAP.md:176-177`). Both are
  separate O4 rows. A linter would be a new dependency.
- Changes to `ci.yml`, `.npmrc` (`docs/audit-report.md:113-119`), `scripts/check-release-ready.mjs`
  or the Trusted Publisher configuration (`docs/releasing.md:53-60`).
- Editing `INTENT.md` or `ROADMAP.md`. Both are owner-accepted documents, so their update is a
  followup for a doc-steward task.
- A changeset. No published file or public API changes, and `prepublishOnly` is not a consumer
  surface.

## Slices

Order: S0, then T1, then I1, then T2 and I2 once Q1 is answered. T1 and T2 are red by design, so
each lands in the same PR as its implementation slice. Two PRs are possible: one for T1 and I1 and
one for T2 and I2, or both pairs in one PR. Slices that own the same file are serialized, never
parallel. Nothing here runs in parallel: the change is small, and release.yml is shared.

### S0. Spec delta `release-workflow` (specifier)

- Owns: `openspec/changes/harden-release-workflow/**` (proposal.md, design.md, tasks.md,
  `specs/release-workflow/spec.md`).
- Read-only: `release.yml`, `package.json:130-148`, `scripts/check-release-ready.mjs`,
  `docs/audit-report.md:88-129`, this intake.
- Requirements (EARS, proposed ids):
  - `req~release-dist-tag-env~1`. The publish step SHALL receive the dist-tag only through an
    `env` variable mapped from `steps.release.outputs.dist_tag`. No `run` script of the publish job
    SHALL contain a `${{ ... }}` expression. IF the value is not `latest` or `next`, THEN the step
    SHALL fail before `npm publish`.
  - `req~release-npm-cli-verified~1`. The text depends on Q1. With option A: the publish job SHALL
    NOT install an npm CLI from the registry, and it SHALL fail before `pnpm install` unless
    `npm --version` is 11.5.1 or newer. With option B: the job SHALL install npm only from a tarball
    whose SRI hash is written in the workflow, and SHALL fail on a mismatch.
  - `req~release-single-unit-test-run~1`. `scripts.prepublishOnly` SHALL NOT run `pnpm test`. The
    release job SHALL run `pnpm test` exactly once.
  - `req~release-check-substrings-kept~1`. `release.yml` SHALL keep every substring that
    `check-release-ready.mjs:51-57` requires, and SHALL NOT reference `secrets.`.
- Checks: G1 `["pnpm", "exec", "openspec", "validate", "harden-release-workflow", "--strict"]`.
  `openspec` is not a dependency in `package.json`, so the coordinator confirms that the CLI is
  available in the lab.
- Expected diff: about 50-80 lines of docs. Risk low (docs only, score 0). Budget 20 turns.

### T1. Static guard test for findings 3 and 4 (test-designer)

- Depends on: S0.
- Owns: `tests/unit/release-workflow.test.ts` (new).
- Read-only: `.github/workflows/release.yml`, `package.json`, `scripts/check-release-ready.mjs`,
  the S0 delta.
- Cases. Parse `release.yml` with the `yaml` dependency (`package.json:97`) and read
  `package.json` as JSON. Tag each case `// [utest->req~...~1]`.
  1. Red-first. No `run` value in `jobs.publish.steps` contains `${{`.
  2. Red-first. The step that runs `npm publish` has an `env` entry whose value is
     `${{ steps.release.outputs.dist_tag }}`, and its `run` uses that variable after `--tag`.
  3. The publish step's `run` rejects values other than `latest` and `next` before `npm publish`.
     Assert this statically: a `case` or `[ ... ]` guard appears before `npm publish` in the
     script. Do not execute the script.
  4. Red-first. `scripts.prepublishOnly` is missing or does not contain `pnpm test`, and exactly
     one step of `jobs.publish` runs `pnpm test`. Match the whole command: `pnpm test:browser`
     (`release.yml:119`) does not count.
  5. Regression. Every substring of `check-release-ready.mjs:51-57` is in the file, and `secrets.`
     is not. Read the list from the script's text, or copy it with a comment that names the lines.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`.
  - Red before (G3): the same argv, `type: red_before`, `expect_exit: [1]`,
    `expect_pattern: "AssertionError"`, `overlay: ["tests/unit/release-workflow.test.ts"]`.
    Cases 1, 2 and 4 must fail on the base.
  - `["pnpm", "exec", "prettier", "--check", "tests/unit/release-workflow.test.ts"]`, then
    `["pnpm", "run", "lint"]`. `pnpm typecheck` does not cover `tests/` (no `tsconfig*.json`
    includes it), so it is not listed.
- Expected diff: about 70-110 lines of tests. Risk low (tests only, score 0). Budget 30 turns.

### I1. `dist_tag` through `env`, one unit-test run, audit report (implementer)

- Depends on: S0, T1 frozen (G4).
- Owns: `.github/workflows/release.yml`, `package.json` (only `scripts.prepublishOnly`),
  `docs/audit-report.md`.
- Read-only: `tests/unit/release-workflow.test.ts`, `scripts/check-release-ready.mjs`.
- Change:
  - `release.yml:130-131`: add `env: DIST_TAG: ${{ steps.release.outputs.dist_tag }}`. Add a guard
    `case "$DIST_TAG" in latest|next) ;; *) echo "::error::..."; exit 1 ;; esac`. Then run
    `npm publish --access public --provenance --tag "$DIST_TAG"`, which keeps the substring that
    `check-release-ready.mjs:56` requires.
  - `package.json:147`: apply Q2 (recommended `"prepublishOnly": "pnpm package:check"`).
  - `docs/audit-report.md`: mark findings 3 and 4 as resolved (`:100-109`) and update "Open items"
    (`:120-129`). Finding 1 stays open until I2. Finding 2 stays accepted. Say that the workflow is
    not exercised until the next release.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`. Cases 1-5 pass.
    The finding-1 cases come in T2.
  - `["pnpm", "run", "test"]`
  - `["node", "scripts/check-release-ready.mjs", "v0.1.0"]`. It reads `release.yml` and must still
    pass. At the base, the version (`package.json:3`) and the README markers (`README.md:5,86,101`)
    match `v0.1.0`. Not run in this intake.
  - `["pnpm", "exec", "prettier", "--check", ".github/workflows/release.yml", "package.json", "docs/audit-report.md"]`
  - CI on the PR (quality and browser shards, `ci.yml:27-52,142+`).
- Expected diff: about 15-30 lines. Risk **medium**, score 4: CI configuration +3, and more than one
  module (workflow, package scripts, docs) +1. No public API, no new dependency. If the coordinator
  also counts "security config", the score is 7 (high) and the high panel applies.
- Budget 20 turns.

### T2. Static guard for finding 1 (test-designer, after Q1)

- Depends on: the Q1 answer and the S0 text amended to it. Serialized after T1, since it owns the
  same file.
- Owns: `tests/unit/release-workflow.test.ts`.
- Cases (red-first):
  - Option A: no step of `jobs.publish` runs `npm install --global` or `npm i -g`. A step before
    `pnpm install` checks `npm --version` against 11.5.1 and exits non-zero on failure. Optionally:
    `node-version` is an exact `24.x.y` (Q3).
  - Option B: the npm install step installs from a local tarball. A preceding step compares
    `sha512-` SRI text written in the workflow and exits non-zero on a mismatch.
- Checks: as in T1, including red before with the same overlay.
- Expected diff: about 25-40 lines. Risk low (tests only). Budget 20 turns.

### I2. npm CLI without an unverified download (implementer, after Q1)

- Depends on: T2 frozen, and I1 merged or in the same branch. Serialized after I1, since it owns the
  same files.
- Owns: `.github/workflows/release.yml`, `docs/releasing.md` (line 32 only),
  `docs/audit-report.md`.
- Change:
  - Option A (recommended): replace `release.yml:80-89` with a step that prints `npm --version` and
    fails unless the version is 11.5.1 or newer, using `node -e` with no download. Pin `node-version`
    only if Q3 says so. Set `docs/releasing.md:32` to the bundled npm with its minimum.
  - Option B: `npm pack npm@11.18.0` into `$RUNNER_TEMP`, compare its SRI with the hash written in
    the workflow, then `npm install --global` the local tarball. The hash must be read from the
    registry by lookup and cited in the PR. It must never be guessed.
  - Mark finding 1 as resolved in `docs/audit-report.md`.
- Checks: the T2 test, `["pnpm", "run", "test"]`, `["node", "scripts/check-release-ready.mjs", "v0.1.0"]`,
  and `["pnpm", "exec", "prettier", "--check", ".github/workflows/release.yml", "docs/releasing.md", "docs/audit-report.md"]`.
- Expected diff: about 15-30 lines. Risk **high**, score 7: CI configuration +3, security
  configuration +3 (it changes the supply-chain control of the binary that does the OIDC publish),
  and more than one module +1. Nothing can run it before the release. Budget 20 turns.

## Gates per slice

| Gate | S0 | T1 / T2 | I1 / I2 |
|---|---|---|---|
| G1 openspec validate --strict | yes | - | re-run if the delta changes |
| G2 EPIC | yes | - | - |
| G3 red before | - | yes | - |
| G4 frozen tests | - | - | T1 / T2 |
| G5, G7, G10 | registry | registry | registry |
| G6 trace | ids | utest | impl comments in release.yml (`# [impl->req~...~1]`) |
| G8 mutation | - | - | N/A (YAML and scripts) |
| G9 dependencies | N/A | N/A (`yaml` already a dependency) | N/A |
| G11 review | one reviewer | test-reviewer | I1 medium panel with security-auditor; I2 high panel |
| G12 ui-qa | N/A | N/A | N/A (no UI) |
| G13 | how-to-review | - | how-to-review (see below) |

- "Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies
  its own registry.
- G13: there is no runtime to demo. The publish path runs only on a published GitHub Release, and
  there is none until the owner says so. The how-to-review names the `release.yml` diff, the static
  test and the `check-release-ready.mjs` run. It also states that the first real run is the owner's
  next release, and that a failure there stops before `npm publish` (`docs/releasing.md:43-44`).
- G6: OFT tags in YAML comments are only useful if the trace tool scans `.github/`. Not verified.
  The coordinator confirms this, or the impl tag goes next to the T1 cases.

## Feature flags

None. These are CI and script changes with no runtime behaviour to switch. Each implementation slice
is complete by itself.

## Risks

- R1. Nothing exercises `release.yml` before the next release (`ROADMAP.md:139-148`). A mistake
  shows up only then. Mitigation: the T1/T2 static test, `check-release-ready.mjs` in I1/I2 checks,
  the security-auditor review, and every new step fails closed before `npm publish`.
- R2. Option A depends on what `setup-node` resolves for `node-version: 24`. A future 24.x could
  bundle a different npm. Mitigation: the version check fails closed, and Q3 decides about an exact
  pin.
- R3. Without `pnpm test` in `prepublishOnly`, a manual `npm publish` from a laptop skips the unit
  tests. Mitigation: `docs/releasing.md:3-6,73-75` makes CD the only publish path, and Q2 keeps
  `package:check`.
- R4. `docs/audit-report.md` is shared with any other audit task. Mitigation: the coordinator
  serializes owners of that file.
- R5. The release job also runs third-party code next to `id-token: write` (finding 2). This change
  does not reduce that exposure. It stays the owner's accepted risk.

## Open questions

- Q1 (**CRP to the owner**). How to close finding 1. It changes the publish toolchain, and nobody
  can test it before the release.
  - (A) Drop the global install. Use the npm bundled with Node 24, with a fail-closed check that it
    is 11.5.1 or newer. **Recommended**: it removes the download instead of verifying it. The
    current bundled npm (11.19.1 per lookup, medium confidence) is newer than the pinned 11.18.0.
  - (B) Keep npm 11.18.0 and verify its tarball against an SRI hash written in the workflow. It
    keeps an exact version, but every npm bump also needs a hash update.
  - (C) `npm audit signatures` as the proposal suggests. Not recommended: it does not check a
    global install (E7).
  - (D) Fix findings 3 and 4 only (I1), and leave finding 1 open and recorded in the audit report.
- Q2 (coordinator, no CRP). `prepublishOnly`:
  - (a) `pnpm package:check`. **Recommended**: it keeps a packed-artifact check for any publish
    path and removes only the repeated tests. The extra build remains.
  - (b) Remove the script. `prepack` still builds.
  - (c) Keep it, but skip it in CI with an env guard. Not recommended: it is shell-dependent.
- Q3 (owner, inside the same CRP as Q1, option A only). Pin `node-version` to an exact 24.x.y in
  `release.yml:76`? A pin is reproducible, but it needs a bump for Node security releases.
  Recommended: no pin, and rely on the version check.
- Already decided: finding 2 stays accepted (`release.yml:24-32`). The release stays on hold.
