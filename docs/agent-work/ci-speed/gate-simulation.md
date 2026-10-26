# Gate simulation: `browsers` check and change detection

This document covers slice S2 (`.github/workflows/ci.yml`). It explains the rule of the required
`browsers` check and records the output of `docs/agent-work/ci-speed/simulate-ci.sh`. The script
parses `ci.yml` with the repository's `yaml` package, asserts the wiring of the jobs, then runs the
real `run:` scripts with bash. The tables below are its output, not predictions; the section
"Simulation output" says which lines come from the check log.

## Job layout

- `changes` decides whether anything rendered can have changed. It writes the job output
  `rendered`.
- `browser-shards` runs only when `rendered == 'true'`. It has three matrix jobs: chromium 1/2,
  chromium 2/2, and firefox+webkit. Each one uploads a blob report (`overwrite: true`, so a re-run
  of a failed shard replaces its artifact instead of failing on the name).
- `merge-report` runs when the run is not cancelled and the shards were not skipped
  (`!cancelled() && needs.browser-shards.result != 'skipped'`). It merges the blobs into the
  `playwright-report` HTML artifact. It has `continue-on-error: true`, so it never decides the
  outcome.
- `browsers` always runs (`if: always()`). It is the required status check and keeps its old name,
  so branch protection does not change. It must not use `!cancelled()`: GitHub counts a skipped
  required check as passed, so the job must run and fail itself.

No step puts a `${{ }}` expression inside a `run:` block. Every value reaches the scripts through
`env:`. The checkout steps of `changes`, `browser-shards` and `merge-report` set
`persist-credentials: false`.

## Gate rule

`browsers` passes only when both of these hold:

1. `needs.changes.result` is `success`.
2. `needs.browser-shards.result` is `success`, or it is `skipped` and `rendered` is `false`.

Every other combination fails: a failed, cancelled or skipped `changes` job, a failed or cancelled
shard, or shards skipped while `rendered` is `true` or empty. A skipped shard job therefore counts
as a pass only when change detection succeeded and positively said that nothing rendered changed.

## Change detection rule

The `filter` step of `changes` emits `rendered=true` (run the browsers) in these cases:

- The event is not `pull_request`. Pushes to `main` and `develop` always run the browsers.
- The pull request targets `main`.
- The base or head SHA is missing.
- `git diff --no-renames --name-only BASE...HEAD` fails or is empty. The three-dot form diffs from
  the merge base, so commits that reached the base branch after the fork do not count. With
  unrelated roots there is no merge base, the diff fails, and the browsers run. `--no-renames`
  lists both paths of a moved file, so moving a file from `examples/` or `src/` into `docs/` still
  runs the browsers. A deletion lists the deleted path.
- Any changed file is under `examples/`, Markdown included.
- Any changed file matches none of these patterns: `docs/*`, `.changeset/*`, `openspec/*`,
  `tests/unit/*`, `LICENSE`, `.github/dependabot.yml`, or `*.md` at the repository root (a name
  without `/`). In a bash `case` pattern `*` also matches `/`, so the script first sends every
  other nested path (`*/*`) to `rendered=true` and only then allows root Markdown. A `.md` file
  under `src/` or `tests/` runs the browsers. The match is case-sensitive: `README.MD` and `Docs/`
  run the browsers.
- git quotes a path with non-ASCII bytes (`core.quotepath` is on by default, as on the GitHub
  runner). The quoted path starts with `"`, matches no allowlisted pattern, and runs the browsers.

It emits `rendered=false` only when every changed file matches one of those patterns. Any doubt
resolves to running the browsers. Rendering inputs must never live under an allowlisted path.

## Wiring assertions

Before it runs any script, the simulation checks the parsed `ci.yml` and fails with the name of
the broken assertion:

- `jobs.browsers.if` is `always()`.
- `jobs.browsers.needs` is exactly `changes` and `browser-shards`, in any order.
- The gate step env is exactly `NEEDS_CHANGES: ${{ needs.changes.result }}`,
  `RENDERED: ${{ needs.changes.outputs.rendered }}` and
  `NEEDS_SHARDS: ${{ needs.browser-shards.result }}`.
- `jobs.changes.outputs.rendered` is `${{ steps.filter.outputs.rendered }}`.
- `jobs.browser-shards.if` is `needs.changes.outputs.rendered == 'true'`, and its `needs` is
  `changes`.
- The gate step and the filter step both have `shell: bash`.
- No `run:` script of any job contains `${{`.
- The filter step env maps `EVENT_NAME`, `BASE_REF`, `BASE_SHA` and `HEAD_SHA` to
  `github.event_name`, `github.base_ref`, `github.event.pull_request.base.sha` and
  `github.event.pull_request.head.sha`.
- Every project named in the `projects` array of `playwright.config.ts` appears in the `args` of a
  `browser-shards` matrix entry.

The scripts then get their environment from the parsed `env:` maps: the simulation keys its test
values by expression (for example `${{ needs.browser-shards.result }}`) and passes each one under
the env name the workflow maps it to. A renamed or swapped env entry therefore fails the run.

## Simulation output

Run with `bash docs/agent-work/ci-speed/simulate-ci.sh` (registered check 2). The scripts run as
`bash --noprofile --norc -eo pipefail`, which is how GitHub runs `shell: bash` steps, with a clean
environment that holds only `PATH`, `HOME`, the `GIT_CONFIG_*` isolation variables, `GITHUB_OUTPUT`
(change detection only) and the step's env. git ignores the caller's global and
system config (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`,
`GIT_CONFIG_NOSYSTEM=1`, and `GIT_DIR` and related variables unset), so a setting such as
`diff.renames` cannot change an outcome. `core.quotepath` keeps git's default. The change detection
runs inside a temporary git repository under `$TMPDIR`, which is removed on exit. Its base commit
holds `src/element/x.ts`, `src/x.ts`, `docs/a.md`, `tests/browser/a.spec.ts` and
`examples/vanilla/index.html`, so the deletions and moves are real. The SHAs in the two `fatal:`
rows come from that temporary repository and change on every run.

The script prints Markdown tables. They are kept verbatim in a text block below. Check 2 shows
only the last 30 lines of the output. Those lines, from the `Playwright config` row to the
`SUMMARY` line, are copied from that run. The lines above them contain no SHA or timestamp and are
the same on every run. They were reconstructed from that deterministic output, not copied from the
check log.

```text
## Wiring of jobs.changes, jobs.browser-shards and jobs.browsers

- ok: jobs.browsers.if is 'always()'
- ok: jobs.browsers.needs is exactly [changes, browser-shards]
- ok: the gate step env is exactly NEEDS_CHANGES, RENDERED, NEEDS_SHARDS from needs
- ok: the gate step has shell 'bash'
- ok: jobs.browsers.steps[0] has a run script
- ok: jobs.changes.outputs.rendered is steps.filter.outputs.rendered
- ok: jobs.browser-shards.if is needs.changes.outputs.rendered == 'true'
- ok: jobs.browser-shards.needs is 'changes'
- ok: the filter step has shell 'bash'
- ok: jobs.changes has a step with id filter and a run script
- ok: the filter step env is exactly EVENT_NAME, BASE_REF, BASE_SHA, HEAD_SHA from github
- ok: no run: script of any job contains ${{
- ok: playwright.config.ts declares at least one project
- ok: every Playwright project (chromium, firefox, webkit) is in the args of a browser-shards matrix entry

WIRING: 14/14 assertions hold

## Gate: jobs.browsers.steps[0].run

| needs.changes.result | needs.changes.outputs.rendered | needs.browser-shards.result | expected | actual | gate output |
| --- | --- | --- | --- | --- | --- |
| success | true | success | pass | pass | PASS: every browser shard passed |
| success | true | failure | fail | fail | FAIL: browser shards result is failure |
| success | true | cancelled | fail | fail | FAIL: browser shards result is cancelled |
| success | true | skipped | fail | fail | FAIL: browser shards skipped but rendered is 'true' |
| success | false | success | pass | pass | PASS: every browser shard passed |
| success | false | failure | fail | fail | FAIL: browser shards result is failure |
| success | false | cancelled | fail | fail | FAIL: browser shards result is cancelled |
| success | false | skipped | pass | pass | PASS: no rendered change, browser shards skipped |
| success | (empty) | success | pass | pass | PASS: every browser shard passed |
| success | (empty) | failure | fail | fail | FAIL: browser shards result is failure |
| success | (empty) | cancelled | fail | fail | FAIL: browser shards result is cancelled |
| success | (empty) | skipped | fail | fail | FAIL: browser shards skipped but rendered is '' |
| failure | true | success | fail | fail | FAIL: changes job result is failure |
| failure | true | failure | fail | fail | FAIL: changes job result is failure |
| failure | true | cancelled | fail | fail | FAIL: changes job result is failure |
| failure | true | skipped | fail | fail | FAIL: changes job result is failure |
| failure | false | success | fail | fail | FAIL: changes job result is failure |
| failure | false | failure | fail | fail | FAIL: changes job result is failure |
| failure | false | cancelled | fail | fail | FAIL: changes job result is failure |
| failure | false | skipped | fail | fail | FAIL: changes job result is failure |
| failure | (empty) | success | fail | fail | FAIL: changes job result is failure |
| failure | (empty) | failure | fail | fail | FAIL: changes job result is failure |
| failure | (empty) | cancelled | fail | fail | FAIL: changes job result is failure |
| failure | (empty) | skipped | fail | fail | FAIL: changes job result is failure |
| cancelled | true | success | fail | fail | FAIL: changes job result is cancelled |
| cancelled | true | failure | fail | fail | FAIL: changes job result is cancelled |
| cancelled | true | cancelled | fail | fail | FAIL: changes job result is cancelled |
| cancelled | true | skipped | fail | fail | FAIL: changes job result is cancelled |
| cancelled | false | success | fail | fail | FAIL: changes job result is cancelled |
| cancelled | false | failure | fail | fail | FAIL: changes job result is cancelled |
| cancelled | false | cancelled | fail | fail | FAIL: changes job result is cancelled |
| cancelled | false | skipped | fail | fail | FAIL: changes job result is cancelled |
| cancelled | (empty) | success | fail | fail | FAIL: changes job result is cancelled |
| cancelled | (empty) | failure | fail | fail | FAIL: changes job result is cancelled |
| cancelled | (empty) | cancelled | fail | fail | FAIL: changes job result is cancelled |
| cancelled | (empty) | skipped | fail | fail | FAIL: changes job result is cancelled |
| skipped | true | success | fail | fail | FAIL: changes job result is skipped |
| skipped | true | failure | fail | fail | FAIL: changes job result is skipped |
| skipped | true | cancelled | fail | fail | FAIL: changes job result is skipped |
| skipped | true | skipped | fail | fail | FAIL: changes job result is skipped |
| skipped | false | success | fail | fail | FAIL: changes job result is skipped |
| skipped | false | failure | fail | fail | FAIL: changes job result is skipped |
| skipped | false | cancelled | fail | fail | FAIL: changes job result is skipped |
| skipped | false | skipped | fail | fail | FAIL: changes job result is skipped |
| skipped | (empty) | success | fail | fail | FAIL: changes job result is skipped |
| skipped | (empty) | failure | fail | fail | FAIL: changes job result is skipped |
| skipped | (empty) | cancelled | fail | fail | FAIL: changes job result is skipped |
| skipped | (empty) | skipped | fail | fail | FAIL: changes job result is skipped |

## Change detection: the step with id filter of jobs.changes

| scenario | github.event_name | github.base_ref | files | expected | actual | script output |
| --- | --- | --- | --- | --- | --- | --- |
| docs only | pull_request | develop | docs/a.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| docs, changeset and unit test | pull_request | develop | docs/a.md .changeset/x.md tests/unit/y.test.ts | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| README only | pull_request | develop | README.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| image under docs | pull_request | develop | docs/img/a.png | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| nested YAML under docs | pull_request | develop | docs/a/b/c.yml | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| changeset config | pull_request | develop | .changeset/config.json | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| OpenSpec metadata | pull_request | develop | openspec/changes/x/.openspec.yaml | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| LICENSE | pull_request | develop | LICENSE | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| Dependabot config | pull_request | develop | .github/dependabot.yml | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| docs file name with a space | pull_request | develop | docs/a b.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| nested unit test | pull_request | develop | tests/unit/sub/dir/y.test.ts | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| source file | pull_request | develop | src/element/x.ts | true | true | rendered=true: src/element/x.ts can change rendered output |
| docs and source | pull_request | develop | docs/a.md src/element/x.ts | true | true | rendered=true: src/element/x.ts can change rendered output |
| example README | pull_request | develop | examples/vanilla/README.md | true | true | rendered=true: examples/vanilla/README.md is part of an example |
| workflow | pull_request | develop | .github/workflows/ci.yml | true | true | rendered=true: .github/workflows/ci.yml can change rendered output |
| Playwright config | pull_request | develop | playwright.config.ts | true | true | rendered=true: playwright.config.ts can change rendered output |
| package.json | pull_request | develop | package.json | true | true | rendered=true: package.json can change rendered output |
| lockfile | pull_request | develop | pnpm-lock.yaml | true | true | rendered=true: pnpm-lock.yaml can change rendered output |
| browser test | pull_request | develop | tests/browser/a.spec.ts | true | true | rendered=true: tests/browser/a.spec.ts can change rendered output |
| SPECTRA fixture | pull_request | develop | tests/fixtures/spectra/a/b.yml | true | true | rendered=true: tests/fixtures/spectra/a/b.yml can change rendered output |
| Markdown under src | pull_request | develop | src/README.md | true | true | rendered=true: src/README.md can change rendered output |
| Markdown under tests/fixtures | pull_request | develop | tests/fixtures/stress/README.md | true | true | rendered=true: tests/fixtures/stress/README.md can change rendered output |
| upper-case .MD at the root | pull_request | develop | README.MD | true | true | rendered=true: README.MD can change rendered output |
| Docs/ with a capital D | pull_request | develop | Docs/a.png | true | true | rendered=true: Docs/a.png can change rendered output |
| tsconfig.json | pull_request | develop | tsconfig.json | true | true | rendered=true: tsconfig.json can change rendered output |
| .prettierignore | pull_request | develop | .prettierignore | true | true | rendered=true: .prettierignore can change rendered output |
| .gitignore | pull_request | develop | .gitignore | true | true | rendered=true: .gitignore can change rendered output |
| visual baseline | pull_request | develop | tests/browser/a.spec.ts-snapshots/b.png | true | true | rendered=true: tests/browser/a.spec.ts-snapshots/b.png can change rendered output |
| source file name with a space | pull_request | develop | src/a b.ts | true | true | rendered=true: src/a b.ts can change rendered output |
| non-ASCII name under docs (quoted by git) | pull_request | develop | docs/é.md | true | true | rendered=true: "docs/\303\251.md" can change rendered output |
| delete source file | pull_request | develop | delete src/element/x.ts | true | true | rendered=true: src/element/x.ts can change rendered output |
| delete browser test | pull_request | develop | delete tests/browser/a.spec.ts | true | true | rendered=true: tests/browser/a.spec.ts can change rendered output |
| delete example page | pull_request | develop | delete examples/vanilla/index.html | true | true | rendered=true: examples/vanilla/index.html is part of an example |
| delete docs page | pull_request | develop | delete docs/a.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| source moved into docs | pull_request | develop | src/x.ts -> docs/x.md | true | true | rendered=true: src/x.ts can change rendered output |
| example moved into docs | pull_request | develop | examples/vanilla/index.html -> docs/index.html | true | true | rendered=true: examples/vanilla/index.html is part of an example |
| push, docs only | push | (empty) | docs/a.md | true | true | rendered=true: event is push, not pull_request |
| pull request into main, docs only | pull_request | main | docs/a.md | true | true | rendered=true: pull request into main |
| empty diff | pull_request | develop | (none) | true | true | rendered=true: empty diff |
| missing SHAs | pull_request | develop | (none) | true | true | rendered=true: base or head SHA missing |
| unknown base SHA (git diff fails) | pull_request | develop | docs/a.md | true | true | fatal: Invalid symmetric difference expression 0000000000000000000000000000000000000000...e558850ae8fc1b4f179ed6395659da274e7035da rendered=true: git diff failed |
| diverged: base advanced with src/element/y.ts, PR changes docs/a.md | pull_request | develop | docs/a.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| unrelated roots (no merge base) | pull_request | develop | docs/a.md | true | true | fatal: b96dc1d1e4c551e9f738ea45e0a5ea0045a8d24e...babbeddc07c914cc68ec4a4ce2ede2a79bc63070: no merge base rendered=true: git diff failed |

SUMMARY: gate 48/48 cases as expected; change detection 43/43 scenarios as expected
```

## What the simulation does not cover

- How GitHub evaluates `if:` on jobs and fills `needs.<job>.result`. The simulation feeds the gate
  every possible result instead, so the gate is correct for any value GitHub can supply. The wiring
  assertions only check that the `if:`, `needs` and `env:` entries are the ones the gate expects.
- How `actions/checkout` sets up the repository on the runner. The simulation uses its own
  temporary repository. With `fetch-depth: 0` both the base and the head SHA of the pull request
  are present, which is what the three-dot diff needs.
- Whether `actions/download-artifact` v8 (`9000827ccba6bdab643e8b6fd33ac0654aef8333`) reads
  artifacts uploaded by `actions/upload-artifact` v6 (`b7c566a772e6b6bfb58ed0dc250532a479d7789f`).
  This is an open assumption. Both use the v4+ artifact backend, but no source found states it
  explicitly. The first pull request run confirms it. If `merge-report` fails, the gate is not
  affected (`continue-on-error: true`, and `browsers` does not depend on it). Only the merged HTML
  report would be missing; the per-shard `blob-report-*` artifacts remain.

## Proof on the PR

The owner runs this after pushing `ci.yml`, because the workflow push needs a Workflows token.

### A failing browser test turns `browsers` red

1. On the PR branch, add a commit with `tests/browser/zz-gate-proof.spec.ts`:

   ```ts
   import { expect, test } from '@playwright/test';

   test('gate proof: must fail', () => {
     expect(1).toBe(2);
   });
   ```

2. Push it. Expected result in the PR checks:
   - `changes` is green, and its log shows
     `rendered=true: tests/browser/zz-gate-proof.spec.ts can change rendered output`.
   - `browsers (firefox+webkit)` and one of the two chromium shard jobs are red after their
     retries. Sharding sends the single test to only one chromium shard, so the other chromium
     shard may stay green.
   - `browsers` is red, and its log shows `FAIL: browser shards result is failure`.
   - The PR cannot be merged while `browsers` is required.
3. Revert that commit (`git revert <sha>`) and push. `browsers` turns green again once the shards
   pass.
4. After reverting the failing test, re-run the failed shard job from the earlier run ("Re-run
   failed jobs"). Confirm that its upload step does not fail with an artifact name conflict on
   `blob-report-<id>` (`overwrite: true`), and that `merge-report` uploads `playwright-report`
   again without a conflict.

### A docs-only PR skips the shards and keeps `browsers` green

1. Open a separate pull request into `develop`, after `ci.yml` is on `develop`, that changes only a
   Markdown file under `docs/`.
2. Expected result:
   - `changes` is green, and its log shows
     `rendered=false: only docs, changesets, specs and unit tests changed`.
   - The shard matrix shows as one skipped entry, not three. A job skipped by its `if:` is not
     expanded, so its name keeps the unexpanded matrix expression (for example
     `browsers (${{ matrix.name }})`). `merge-report` also shows as skipped.
   - `browsers` is green, and its log shows `PASS: no rendered change, browser shards skipped`.

The pull request that adds `ci.yml` itself changes `.github/workflows/ci.yml`, so it always runs
the shards. The docs-only proof needs a second pull request.
