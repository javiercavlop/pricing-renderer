# Gate simulation: `browsers` check and change detection

This document covers slice S2 (`.github/workflows/ci.yml`). It explains the rule of the required
`browsers` check and records the output of `docs/agent-work/ci-speed/simulate-ci.sh`. The script
reads the real `run:` scripts from `ci.yml` with the repository's `yaml` package and runs them with
bash. The tables below are its real output, not predictions.

## Job layout

- `changes` decides whether anything rendered can have changed. It writes the job output
  `rendered`.
- `browser-shards` runs only when `rendered == 'true'`. It has three matrix jobs: chromium 1/2,
  chromium 2/2, and firefox+webkit. Each one uploads a blob report.
- `merge-report` merges the blobs into the `playwright-report` HTML artifact. It has
  `continue-on-error: true`, so it never decides the outcome.
- `browsers` always runs (`if: always()`). It is the required status check and keeps its old name,
  so branch protection does not change.

No step puts a `${{ }}` expression inside a `run:` block. Every value reaches the scripts through
`env:`.

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
- `git diff --no-renames --name-only BASE...HEAD` fails or is empty. `--no-renames` lists both
  paths of a moved file, so moving a file from `examples/` or `src/` into `docs/` still runs the
  browsers.
- Any changed file is under `examples/`, Markdown included.
- Any changed file matches none of these patterns: `*.md`, `docs/*`, `.changeset/*`, `openspec/*`,
  `tests/unit/*`, `LICENSE`, `.github/dependabot.yml`.

It emits `rendered=false` only when every changed file matches one of those patterns. Any doubt
resolves to running the browsers.

## Simulation output

Run with `bash docs/agent-work/ci-speed/simulate-ci.sh` (registered check 2). The scripts run as
`bash --noprofile --norc -eo pipefail`, which is how GitHub runs `shell: bash` steps. The change
detection runs inside a temporary git repository under `$TMPDIR`, which is removed on exit. The
SHA in the last row comes from that temporary repository and changes on every run.

The script prints Markdown tables. They are kept verbatim in a text block below, so the record is
the exact output of the run.

```text
## Gate: jobs.browsers.steps[0].run

| NEEDS_CHANGES | RENDERED | NEEDS_SHARDS | expected | actual | gate output |
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

| scenario | EVENT_NAME | BASE_REF | files | expected | actual | script output |
| --- | --- | --- | --- | --- | --- | --- |
| docs only | pull_request | develop | docs/a.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| docs, changeset and unit test | pull_request | develop | docs/a.md .changeset/x.md tests/unit/y.test.ts | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| README only | pull_request | develop | README.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| source file | pull_request | develop | src/element/x.ts | true | true | rendered=true: src/element/x.ts can change rendered output |
| docs and source | pull_request | develop | docs/a.md src/element/x.ts | true | true | rendered=true: src/element/x.ts can change rendered output |
| example README | pull_request | develop | examples/vanilla/README.md | true | true | rendered=true: examples/vanilla/README.md is part of an example |
| workflow | pull_request | develop | .github/workflows/ci.yml | true | true | rendered=true: .github/workflows/ci.yml can change rendered output |
| Playwright config | pull_request | develop | playwright.config.ts | true | true | rendered=true: playwright.config.ts can change rendered output |
| package.json | pull_request | develop | package.json | true | true | rendered=true: package.json can change rendered output |
| lockfile | pull_request | develop | pnpm-lock.yaml | true | true | rendered=true: pnpm-lock.yaml can change rendered output |
| browser test | pull_request | develop | tests/browser/a.spec.ts | true | true | rendered=true: tests/browser/a.spec.ts can change rendered output |
| SPECTRA fixture | pull_request | develop | tests/fixtures/spectra/a/b.yml | true | true | rendered=true: tests/fixtures/spectra/a/b.yml can change rendered output |
| push, docs only | push | (empty) | docs/a.md | true | true | rendered=true: event is push, not pull_request |
| pull request into main, docs only | pull_request | main | docs/a.md | true | true | rendered=true: pull request into main |
| example moved into docs | pull_request | develop | examples/vanilla/index.html -> docs/index.html | true | true | rendered=true: examples/vanilla/index.html is part of an example |
| empty diff | pull_request | develop | (none) | true | true | rendered=true: empty diff |
| missing SHAs | pull_request | develop | (none) | true | true | rendered=true: base or head SHA missing |
| unknown base SHA (git diff fails) | pull_request | develop | docs/a.md | true | true | fatal: Invalid symmetric difference expression 0000000000000000000000000000000000000000...7145ec8cef7596294b646ce9aa62536cce88e9b4 rendered=true: git diff failed |

SUMMARY: gate 48/48 cases as expected; change detection 18/18 scenarios as expected
```

## What the simulation does not cover

- How GitHub evaluates `if:` on jobs and fills `needs.<job>.result`. The simulation feeds the gate
  every possible result instead, so the gate is correct for any value GitHub can supply.
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

### A docs-only PR skips the shards and keeps `browsers` green

1. Open a separate pull request into `develop`, after `ci.yml` is on `develop`, that changes only a
   Markdown file under `docs/`.
2. Expected result:
   - `changes` is green, and its log shows
     `rendered=false: only docs, changesets, specs and unit tests changed`.
   - The three `browsers (...)` shard jobs and `merge-report` show as skipped.
   - `browsers` is green, and its log shows `PASS: no rendered change, browser shards skipped`.

The pull request that adds `ci.yml` itself changes `.github/workflows/ci.yml`, so it always runs
the shards. The docs-only proof needs a second pull request.
