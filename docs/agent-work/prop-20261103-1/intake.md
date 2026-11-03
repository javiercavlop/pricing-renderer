# Intake: P-20261103-1, choose the release dist-tag fail-closed

- Origin: proposal P-20261103-1 (kind reliability, size S, risk medium), approved by the owner.
  Planner intake, 2026-11-03.
- Base: HEAD `c0c926d` of the task branch `task/417660f0a5f548b3`. Every `file:line` below is at
  this base.
- INTENT link: O4, "supply-chain and CI health" (`INTENT.md:77-90`). The signal "Release workflow
  findings" (`INTENT.md:88-90`) does not list this item. The audit report records it as an open item
  (`docs/audit-report.md:139-142`).
- No release: nothing here versions, tags or publishes. The release stays on hold
  (`ROADMAP.md:165-175`). The changed step runs for the first time in the owner's single next
  release.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce, U = not verifiable from the repository.

- E1, how the tag is chosen. **R.** `.github/workflows/release.yml:58-62`:
  `if [ "$(jq -r '.isPrerelease' <<<"$release_json")" = "true" ]` writes `dist_tag=next`, and the
  `else` branch writes `dist_tag=latest`. So any other value ends up as `latest`: an empty string,
  `null` (a missing field gives `null` with `jq -r`) or any other text.
  - Why a failed `jq` read is not caught. The step has no `shell:` key, so it runs as `bash -e {0}`,
    without `pipefail`. Lookup, medium confidence, source
    https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsshell.
  - A command substitution used as an argument of `[` does not trigger `-e`. A failing `jq` there
    leaves an empty string, and the `else` branch writes `latest`.
  - Other failures do stop the step: the earlier `release_json="$(gh release view …)"` assignment
    (`:44-46`) under `-e`, and the `isDraft` and `tagName` checks (`:48-56`), which already fail
    closed.
- E2, the guard accepts `latest`. **R.** `release.yml:137-143`: `case "$DIST_TAG" in latest|next) ;;`
  with `*)` → `exit 1`. A wrong `latest` passes it.
- E3, audit open item. **R.** `docs/audit-report.md:139-142`: "selects `latest` for any
  `isPrerelease` value other than `true`, including a failed `jq` read … Noted, not changed here".
- E4, test coverage. **P.**
  - The proposal cites `tests/unit/release-workflow.test.ts:57-61`. The guard case actually spans
    `:57-67`. It checks only the publish step's `case` guard.
  - No case reads the `release` step (`id: release`, `release.yml:39-62`). The `Step` interface
    (`:18-21`) has no `id` field.
- E5, the guard regex accepts a commented-out `exit 1`. **R, by reading. Not executed.**
  - `tests/unit/release-workflow.test.ts:59-61` builds `\*\)` + `(?:(?!;;|esac)[\s\S])*?` +
    `\bexit 1\s*;;\s*esac`.
  - For an arm `*)` / `echo …` / `# exit 1` / `;;`, the lazy part stops after `# `, and `\b` matches
    before `exit`. The regex matches although the arm never exits.
- E6, followups 75b7a8b4ca1d4f5f, d4a5fdea79b4452c, 82e7efd94b9b4daf and df88f7feff5e41cb. **U.**
  These ids appear in no repository file (grep: 0 matches). They are task records of the factory.
- E7, "54 pending changesets". **R.** `.changeset/` has 55 `*.md` files, `README.md` included. The
  same count is in `INTENT.md:68` and `ROADMAP.md:219`. `ROADMAP.md:170` still says 45 at `47a7b05`
  (stale; followup).
- E8, not in the proposal: what else describes the mapping.
  - `docs/releasing.md:28-30,38-39` says that the Release determines `latest` or `next`. `:43` says
    "Any failed gate skips `npm publish`." Both stay true after the fix.
  - `scripts/check-release-ready.mjs:51-57` requires `gh release view "$RELEASE_TAG"`, among other
    substrings, which the fix must keep. `:65-69` forbids `secrets.` and the token names.
- E9, the OpenSpec state.
  - The capability `release-workflow` exists only in the unarchived change
    `openspec/changes/harden-release-workflow/` (`openspec/specs/release*`: no files).
  - That change still has the finding-1 slices S1, T2 and I2 open
    (`openspec/changes/harden-release-workflow/tasks.md:61-70`). They own the same three files as this
    proposal: `release.yml`, the test and `docs/audit-report.md`.
  - Its design D7 allows only static assertions on the workflow
    (`openspec/changes/harden-release-workflow/design.md:87-93`).
- E10, CI. `.github/workflows/release.yml` is not on the docs allowlist (`ci.yml:130`), so a PR
  touching it runs the browser shards. `tests/unit/*` and `docs/*` are on it. The `quality` job runs
  `pnpm test` on Node 22 and 24 (`ci.yml:27-48`), so the static test runs on every PR.

## Objective

Before the single next release, the `release` step writes `dist_tag=next` only for
`isPrerelease == true`, writes `dist_tag=latest` only for `isPrerelease == false`, and fails the job
before `npm publish` for any other value. The static test enforces this. The test also no longer
counts a commented-out `exit 1` as a guard. `docs/audit-report.md` records the item as resolved.

## Scope

- `release.yml:58-62`: an explicit mapping (`true` → `next`, `false` → `latest`, anything else →
  `::error::` and `exit 1`, with no `dist_tag` written).
- `tests/unit/release-workflow.test.ts`:
  - a red-first case for the mapping;
  - comment-proof matching for both the new case and the existing publish guard (`:57-67`).
- `docs/audit-report.md:139-142`: the open item becomes resolved, and the "Release workflow" list
  (`:88-114`) mentions it.
- A spec delta: one ADDED requirement in capability `release-workflow`.

## Non-goals

- Audit finding 1 (global npm install). It stays with the pending S1/T2/I2 of
  `harden-release-workflow` (`tasks.md:61-70`) and the owner's Q1/Q3 decision. Finding 2 stays
  accepted (`release.yml:24-32`).
- Executing the workflow script in a test (bash with a stubbed `gh`/`jq`). Design D7 of
  `harden-release-workflow` keeps release tests static. See Q2.
- Any release, `changeset version`, tag or npm publish (`ROADMAP.md:165-175`).
- `ci.yml`, `.npmrc`, `scripts/check-release-ready.mjs`, `docs/releasing.md`, `INTENT.md`,
  `ROADMAP.md`. `docs/releasing.md:43` already covers "a failed gate skips `npm publish`".
- A changeset, ADR or feature flag. No published file, public API or runtime behaviour changes.

## Slices

Order: S0, then T1, then I1. T1 is red by design, so T1 and I1 land in one PR (as `#77` did for
T1/I1 of `harden-release-workflow`). Nothing runs in parallel. The three slices share one small
capability, and T1 and I1 depend on each other's files.

Serialization with other work: the pending S1/T2/I2 of `harden-release-workflow` own the same
`release.yml`, test file and `docs/audit-report.md`. They must not run at the same time as T1/I1.
Either order works. Recommended: this change first, because it needs no owner decision.

### S0. Spec delta (specifier)

- Owns: `openspec/changes/release-dist-tag-fail-closed/**` (proposal.md, design.md, tasks.md,
  `specs/release-workflow/spec.md`). The change name is proposed. See Q1 on the alternative of
  amending `harden-release-workflow`.
- Read-only: `release.yml:39-62`, `tests/unit/release-workflow.test.ts`,
  `openspec/changes/harden-release-workflow/**`, `docs/audit-report.md:88-142`, this intake.
- Requirement (ADDED, EARS, proposed id `req~release-dist-tag-prerelease-map~1`):
  - When the `release` step of the publish job has read `isPrerelease` from the GitHub Release, it
    SHALL write `dist_tag=next` if the value read is exactly `true`, and `dist_tag=latest` if it is
    exactly `false`.
  - IF the value is anything else (empty after a failed read, `null`, `True`, or any other text),
    THEN the step SHALL write an `::error::` annotation, SHALL write no `dist_tag` output and SHALL
    exit non-zero, so the job stops before `npm publish`.
  - Scenarios:
    - `true` → `next`;
    - `false` → `latest`;
    - empty, `null` and `True` each fail;
    - static: no branch other than the `false` one writes `latest`, and the failing arm's exit is
      not inside a comment.
- `req~release-dist-tag-env~1` keeps revision 1. A commented-out `exit 1` does not "fail the step",
  so the existing text already rules it out. Only its test is tightened (T1).
- Checks: G1 `["sh", "-c", "openspec validate release-dist-tag-fail-closed --strict"]`. This is the
  same form as `harden-release-workflow/tasks.md:18`. The coordinator confirms that the `openspec`
  CLI is available in the lab (it is not in `package.json`).
- Expected diff: about 50-80 lines of docs. Risk **low** (docs only, score 0). Budget 20 turns.

### T1. Static guard for the mapping and a comment-proof guard regex (test-designer)

- Depends on: S0.
- Owns: `tests/unit/release-workflow.test.ts`.
- Read-only: `.github/workflows/release.yml`, the S0 delta,
  `openspec/changes/harden-release-workflow/specs/release-workflow/spec.md`.
- Cases (static, never executing a script; tags `// [utest->req~…~1]`):
  1. **Red-first**, `req~release-dist-tag-prerelease-map~1`.
     - Select the step with `id: release` (add `id?: string` to `Step`, `:18-21`).
     - Remove full-line `#` comments from its `run`, then assert:
       - `dist_tag=next` is written only in a branch selected by the literal `true`;
       - `dist_tag=latest` is written only in a branch selected by the literal `false`;
       - a default branch (`*)` arm or final `else`) contains `exit 1` and writes no `dist_tag`;
       - no `else` writes `latest`.
     - It must fail on the base by assertion: `:60-62` is an `else` that writes `latest`.
  2. Hardening, `req~release-dist-tag-env~1`.
     - Apply the same comment stripping to `publishRun` before the guard regex (`:59-66`).
     - Add a fixture case: a synthetic publish script whose `*)` arm holds `# exit 1` must not match
       the guard. This is the df88f7feff5e41cb followup.
     - This case is not red on the base, because the base guard has a real `exit 1`. G3 applies to
       case 1.
  - Keep cases `:39-54`, `:69-98` and the header comment (`:1-5`) consistent. The header names
    design D7.
- Checks:
  - release-test: `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`
  - red before (G3): the same argv, `type: red_before`, `expect_exit: [1]`,
    `expect_pattern: "AssertionError"`, `overlay: ["tests/unit/release-workflow.test.ts"]`
  - `["pnpm", "exec", "prettier", "--check", "tests/unit/release-workflow.test.ts"]`
  - `["pnpm", "run", "lint"]`
- Expected diff: about 30-60 lines of tests. Risk **low** (tests only, score 0). Budget 25 turns.

### I1. Fail-closed mapping and audit report (implementer)

- Depends on: S0, and T1 frozen (G4).
- Owns: `.github/workflows/release.yml` (only the `release` step, `:39-62`), `docs/audit-report.md`.
- Read-only: `tests/unit/release-workflow.test.ts`, `scripts/check-release-ready.mjs`.
- Change:
  - `release.yml:58-62`:
    - Read `is_prerelease="$(jq -r '.isPrerelease' <<<"$release_json")"`. Under `bash -e`, a failed
      `jq` in a plain assignment stops the step, which is also fail-closed.
    - Then `case "$is_prerelease" in true) dist_tag=next ;; false) dist_tag=latest ;; *) echo "::error::…"; exit 1 ;; esac`.
    - Then write `echo "dist_tag=$dist_tag" >>"$GITHUB_OUTPUT"`.
    - Add `# [impl->req~release-dist-tag-prerelease-map~1]` above the step, like `:109,131-132`.
    - Keep `gh release view "$RELEASE_TAG"` (`check-release-ready.mjs:51-57`), and add no
      `${{ … }}` to `run` (`req~release-dist-tag-env~1`).
  - `docs/audit-report.md`:
    - mark `:139-142` resolved;
    - add one line to the "Release workflow" section (`:112-114`) saying the static test now also
      checks the mapping;
    - keep "not exercised until the owner's next release".
- Checks:
  - release-test: `["pnpm", "exec", "vitest", "run", "tests/unit/release-workflow.test.ts"]`. All
    cases pass.
  - `["pnpm", "run", "test"]`
  - `["node", "scripts/check-release-ready.mjs", "v0.1.0"]` (`package.json:3` is `0.1.0`). Not run
    in this intake.
  - `["pnpm", "exec", "prettier", "--check", ".github/workflows/release.yml", "docs/audit-report.md"]`
  - CI on the PR: quality and browser shards (`ci.yml:27-52,142+`).
- Expected diff: about 10-20 lines. Risk **medium**, score 4: CI configuration +3, and more than one
  module (workflow, docs) +1. If the coordinator also counts it as security configuration (it
  decides what consumers install by default), the score is 7 and the high panel applies. Budget 20
  turns.

## Gates per slice

| Gate | S0 | T1 | I1 |
|---|---|---|---|
| G1 openspec validate --strict | yes | - | re-run if the delta changes |
| G2 EPIC | yes | - | - |
| G3 red before | - | yes (case 1) | - |
| G4 frozen tests | - | - | T1 |
| G5, G7, G10 | registry | registry | registry |
| G6 trace | ids | utest tags | `# [impl->…]` in `release.yml` |
| G8 mutation | - | - | N/A (YAML and shell) |
| G9 dependencies | N/A | N/A (`yaml` exists, `package.json:97`) | N/A |
| G11 review | one reviewer | test-reviewer | medium panel with security-auditor |
| G12 ui-qa | N/A | N/A | N/A (no UI) |
| G13 | how-to-review | - | how-to-review |

- "Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies
  its own registry.
- G6: whether the trace tool scans `.github/` is not verified. The `#` impl tags at
  `release.yml:109,131-132` follow the same assumption as `harden-release-workflow`
  (`tasks.md:9-11`).
- G13: there is no runtime to demo. The publish path runs only on a published GitHub Release. The
  how-to-review names:
  - the `release.yml` hunk;
  - the T1 cases;
  - the `check-release-ready.mjs` run;
  - that the first real run is the owner's next release, where a wrong value now stops before
    `npm publish`.

## Feature flags

None. This is one capability with a CI-only change and no runtime behaviour to switch. I1 is complete
by itself.

## Risks

- R1. Nothing exercises `release.yml` before the next release. A mistake in the new `case` (for
  example a typo in the `true` arm) would stop that release. A stop is safe: it happens before
  `npm publish`, and a re-run is possible (`docs/releasing.md:43`). It is still a delay. Mitigation:
  - T1 case 1;
  - the security-auditor review;
  - `check-release-ready.mjs` as an I1 check.
- R2. Static matching of shell text is brittle. A valid rewrite (for example `if/elif/else`) may fail
  T1. Mitigation: T1 accepts both the `case` and the `if/elif/else` forms. If static matching proves
  too fragile, Q2 is the fallback.
- R3. File contention with the pending finding-1 slices of `harden-release-workflow`. Mitigation: the
  coordinator serializes them (see "Slices").
- R4. `gh release view --json isPrerelease` is assumed to return a JSON boolean, so `jq -r` prints
  `true`/`false`. This is not verified against the gh documentation in this intake. If it ever
  returned something else, the step would fail closed and not publish under the wrong tag.

## Open questions

No question needs an owner CRP. The proposal is owner-approved and fixes the approach.

- Q1 (coordinator). Should this be a new OpenSpec change (`release-dist-tag-fail-closed`, ADDED
  requirement), or should `harden-release-workflow` be amended?
  - **Recommended: a new change.** `harden-release-workflow` is merged (#77) but unarchived, and it
    still waits on the owner's finding-1 decision.
  - Both changes ADD to `release-workflow`. Archiving `harden-release-workflow` first keeps the
    history readable; the reverse order also works for ADDED-only deltas.
- Q2 (coordinator). Should the mapping test stay static (design D7), or execute the step script with
  a stubbed `gh` and real `jq` in bash?
  - **Recommended: static.** It is consistent with D7 and needs no `bash`/`jq` in the lab.
  - A behavioural test would be stronger but would amend D7. That is the coordinator's call, not the
    owner's.
- Followups (doc-steward):
  - `ROADMAP.md:170` still says 45 changesets at `47a7b05` (54 now).
  - `INTENT.md:88-90` and `ROADMAP.md:217-218` do not list the dist-tag item. They need no change if
    it is resolved before the next INTENT refresh.
