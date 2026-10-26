# Gate simulation: `browsers` check and change detection

This document covers slice S2 (`.github/workflows/ci.yml`). It explains the rule of the required
`browsers` check and records the output of `docs/agent-work/ci-speed/simulate-ci.sh`. The script
parses `ci.yml` with the repository's `yaml` package, asserts the wiring of the jobs, lists the
Playwright tests as a CI run would, then runs the real `run:` scripts with bash. The tables below
are its output, not predictions; the section "Simulation output" says which lines come from the
check log.

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
- `on-demand-specs` runs only on a manual dispatch (`if: github.event_name == 'workflow_dispatch'`,
  no `needs`). It runs `tests/browser/ux-stress.spec.ts` and `tests/browser/spectra-review.spec.ts`
  on chromium with `PW_UX_STRESS: '1'` and `--global-timeout=2400000` (job timeout 50 min), and
  uploads the `on-demand-specs-report` HTML artifact. It is not required, and `browsers` does not
  need it. `playwright.config.ts` ignores both specs on CI unless `PW_UX_STRESS` is `1`, so no
  shard runs them. See `on-demand-specs.md`.

The workflow also has `workflow_dispatch` in `on:`. On a manual dispatch every other job runs too:
`changes` emits `rendered=true` because the event is not `pull_request`.

The concurrency group is
`ci-${{ github.workflow }}-${{ github.event.pull_request.number || format('{0}-{1}', github.event_name, github.ref) }}`
with `cancel-in-progress` only for `pull_request`. Pull requests are grouped by number; other runs
by event and ref, so a dispatch never replaces a pending push run.

No step puts a `${{ }}` expression inside a `run:` block. Every value reaches the scripts through
`env:`. The checkout steps of `changes`, `browser-shards`, `merge-report` and `on-demand-specs` set
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
- The base or head SHA is missing (either one or both).
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
  under `src/` or `tests/` runs the browsers, and so does any other root file (`index.html`,
  `logo.png`). The match is case-sensitive: `README.MD` and `Docs/` run the browsers.
- git quotes a path with non-ASCII bytes (`core.quotepath` is on by default, as on the GitHub
  runner). The quoted path starts with `"`, matches no allowlisted pattern, and runs the browsers.
  `true` is the conservative result of that quoting, not a requirement.

It emits `rendered=false` only when every changed file matches one of those patterns. Any doubt
resolves to running the browsers. Rendering inputs must never live under an allowlisted path.

## Wiring assertions

Before it runs any script, the simulation checks the parsed `ci.yml` and fails with the name of
the broken assertion:

- Gate: `jobs.browsers.if` is `always()`; `jobs.browsers.needs` is exactly `changes` and
  `browser-shards`, in any order; the gate step env is exactly
  `NEEDS_CHANGES: ${{ needs.changes.result }}`, `RENDERED: ${{ needs.changes.outputs.rendered }}`
  and `NEEDS_SHARDS: ${{ needs.browser-shards.result }}`; the gate step has `shell: bash` and no
  `if`; `jobs.browsers` has no `name`, so the check keeps the name `browsers`.
- Change detection: `jobs.changes.outputs.rendered` is `${{ steps.filter.outputs.rendered }}`; the
  filter step has `shell: bash` and maps `EVENT_NAME`, `BASE_REF`, `BASE_SHA` and `HEAD_SHA` to
  `github.event_name`, `github.base_ref`, `github.event.pull_request.base.sha` and
  `github.event.pull_request.head.sha`; the checkout of `changes` has `fetch-depth: 0` and
  `persist-credentials: false`.
- Shards: `jobs.browser-shards.if` is `needs.changes.outputs.rendered == 'true'`, and its `needs`
  is `changes`. The step named `Run browser tests` runs exactly `pnpm exec playwright test ${ARGS}`.
- Shard coverage: for every project in the `projects` array of `playwright.config.ts`, the matrix
  entries that name it in their `args` either are a single entry without `--shard`, or carry
  `--shard=k/N` for exactly k = 1..N with one N. The `install` of every entry names every project
  in its `args` (project names equal browser names).
- Required path: no `continue-on-error` on the jobs `changes`, `browser-shards` and `browsers`, nor
  on any of their steps; no `run:` script in those jobs contains `|| true`.
- No `run:` script of any job contains `${{`.
- Triggers and runners: `on` contains `workflow_dispatch`; `on.pull_request.branches` and
  `on.push.branches` are `[main, develop]`; `concurrency.group` is the string above and
  `cancel-in-progress` is `${{ github.event_name == 'pull_request' }}`; every job has a numeric
  `timeout-minutes`; no `runs-on` label starts with `self-hosted`; the `browser-shards` timeout
  exceeds the 15 min `PW_BLOB` `globalTimeout` of the config.
- On-demand specs: `jobs.on-demand-specs.if` is `github.event_name == 'workflow_dispatch'`, and it
  has no `needs`; `jobs.browsers.needs` does not include it (also implied by the exact `needs`
  check, stated on its own so the reason is visible in the output); the JSON of
  `jobs.browser-shards`, of each of its steps and of the workflow-level `env` contains none of
  `PW_UX_STRESS`, `ux-stress` or `spectra-review`; no job other than `on-demand-specs` mentions
  `PW_UX_STRESS`, and neither does the workflow `env`; the on-demand run step sets
  `PW_UX_STRESS: '1'`, names both spec files and passes `--global-timeout=2400000`, and its job
  timeout exceeds 40 min.
- The text of `playwright.config.ts` contains `['**/ux-stress.spec.ts', '**/spectra-review.spec.ts']`,
  the condition `process.env.PW_UX_STRESS !== '1'` and a `testIgnore,` line that passes it to
  `defineConfig`. These match code, not the comment above `testIgnore`. They are text checks; the
  listing below tests the behaviour.

After the wiring, the script runs `CI=1 pnpm exec playwright test --list --reporter=list` from the
repository root (without the caller's `PW_UX_STRESS` and `PW_BLOB`) and fails if
`ux-stress.spec.ts` or `spectra-review.spec.ts` is listed. It then lists with
`CI=1 PW_UX_STRESS=1 --project=chromium` and the two files, and fails unless both are listed. Each
listing must end with a `Total:` line. The two listings took 2 s in the run below. Checks 3 and 4
of the task test the same behaviour on their own.

The script collects every failed wiring assertion and exits 1; removing the asserted entry fails
the matching assertion.

### Mutations

Not run. The task that added these assertions had no shell: it could run only its registered
checks, which execute the script against the repository files. The mutations below are the
procedure to run by hand in a copy under `$TMPDIR` (copy `.github/workflows/ci.yml`,
`playwright.config.ts`, `package.json`, `tests/browser/` and this directory with their relative
paths, and add a symlink to the repository's `node_modules`, which provides `yaml` and
`@playwright/test`), with the expected result of each:

- Delete `workflow_dispatch:` from `on:`. Expected: `WIRING FAILED: on contains workflow_dispatch`
  and exit 1.
- Delete the `chromium 2/2` matrix entry. Expected: a `WIRING FAILED:` line for "every Playwright
  project (chromium, firefox, webkit) runs once without --shard or as shards 1/N..N/N in
  browser-shards", and exit 1.
- Add `continue-on-error: true` to `browser-shards`. Expected: a `WIRING FAILED:` line for "no
  continue-on-error on jobs changes, browser-shards, browsers or their steps", and exit 1.
- Add `PW_UX_STRESS: '1'` to the env of the `Run browser tests` step. Expected: `WIRING FAILED:`
  lines for the `browser-shards` mention and for "only jobs.on-demand-specs sets PW_UX_STRESS", and
  exit 1.
- In `playwright.config.ts`, change `!== '1'` to `=== '1'`. Expected: `WIRING FAILED:` for
  "playwright.config.ts tests process.env.PW_UX_STRESS !== '1'"; with that assertion removed, the
  listing fails with `LIST FAILED: an on-demand spec is listed with CI=1 and no PW_UX_STRESS`.

The scripts then get their environment from the parsed `env:` maps: the simulation keys its test
values by expression (for example `${{ needs.browser-shards.result }}`) and passes each one under
the env name the workflow maps it to. A renamed or swapped env entry therefore fails the run.

## Simulation output

Run with `bash docs/agent-work/ci-speed/simulate-ci.sh` (registered check 5 of the task that
applied the round-2 findings). The scripts run as `bash --noprofile --norc -eo pipefail`, which is
how GitHub runs `shell: bash` steps, with a clean environment that holds only `PATH`, `HOME`, the
`GIT_CONFIG_*` isolation variables, `GITHUB_OUTPUT` (change detection only) and the step's env. git
ignores the caller's global and system config (`GIT_CONFIG_GLOBAL=/dev/null`,
`GIT_CONFIG_SYSTEM=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, and `GIT_DIR` and related variables unset),
so a setting such as `diff.renames` cannot change an outcome. `core.quotepath` keeps git's default.
The change detection runs inside a temporary git repository under `$TMPDIR`, which is removed on
exit. Its base commit holds `src/element/x.ts`, `src/x.ts`, `docs/a.md`, `tests/browser/a.spec.ts`
and `examples/vanilla/index.html`, so the deletions and moves are real. The SHAs in the two
`fatal:` rows come from that temporary repository and change on every run.

The script prints Markdown tables. They are kept verbatim in a text block below. Check 5 shows
only the end of the output. The lines from the gate row `| skipped | false | skipped |` to the
`SUMMARY` line are copied from that run. The lines above them contain no SHA or timestamp: the
wiring labels are fixed strings in the script, printed in the order of the assertions, and the
check exited 0, which the script does only when every assertion holds. The `SUMMARY` line states
the wiring count (40/40), the two `Total:` lines and the listing time (2 s) of that run. The lines
above the copied part were reconstructed from that deterministic output and the `SUMMARY` line,
not copied from the check log.

```text
## Wiring of on, concurrency and the jobs of ci.yml

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
- ok: every Playwright project (chromium, firefox, webkit) runs once without --shard or as shards 1/N..N/N in browser-shards
- ok: the install of every browser-shards matrix entry names every project in its args
- ok: no continue-on-error on jobs changes, browser-shards, browsers or their steps
- ok: no run: script in jobs changes, browser-shards, browsers contains || true
- ok: the gate step has no if
- ok: jobs.browsers has no name (the check is named browsers)
- ok: the shard step 'Run browser tests' runs exactly pnpm exec playwright test ${ARGS}
- ok: the jobs.changes checkout has fetch-depth 0 and persist-credentials false
- ok: on contains workflow_dispatch
- ok: on.pull_request.branches is [main, develop]
- ok: on.push.branches is [main, develop]
- ok: concurrency.group keys pull requests by number and other runs by event and ref
- ok: concurrency.cancel-in-progress is true only for pull_request
- ok: every job has a numeric timeout-minutes
- ok: no job runs on a self-hosted runner
- ok: jobs.browser-shards timeout-minutes exceeds the 15 min PW_BLOB globalTimeout
- ok: jobs.on-demand-specs.if is github.event_name == 'workflow_dispatch'
- ok: jobs.on-demand-specs has no needs
- ok: jobs.browsers.needs does not include on-demand-specs
- ok: jobs.browser-shards (matrix, env, steps) and the workflow env never mention PW_UX_STRESS, ux-stress or spectra-review
- ok: only jobs.on-demand-specs sets PW_UX_STRESS (no other job, not the workflow env)
- ok: the on-demand-specs playwright test step sets env PW_UX_STRESS '1'
- ok: the on-demand-specs playwright test step runs tests/browser/ux-stress.spec.ts and tests/browser/spectra-review.spec.ts
- ok: the on-demand-specs run stops at 40 min, before its job timeout
- ok: playwright.config.ts ignores ['**/ux-stress.spec.ts', '**/spectra-review.spec.ts']
- ok: playwright.config.ts tests process.env.PW_UX_STRESS !== '1'
- ok: playwright.config.ts passes testIgnore to defineConfig

WIRING: 40/40 assertions hold

## Playwright --list with CI=1

- ok: CI=1: neither ux-stress.spec.ts nor spectra-review.spec.ts is listed (Total: 1125 tests in 8 files)
- ok: CI=1 PW_UX_STRESS=1, chromium, both files: both are listed (Total: 143 tests in 2 files)

LIST: both listings as expected in 2 s

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
| index.html at the root | pull_request | develop | index.html | true | true | rendered=true: index.html can change rendered output |
| logo.png at the root | pull_request | develop | logo.png | true | true | rendered=true: logo.png can change rendered output |
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
| base SHA set, head SHA missing | pull_request | develop | (none) | true | true | rendered=true: base or head SHA missing |
| base SHA missing, head SHA set | pull_request | develop | docs/a.md | true | true | rendered=true: base or head SHA missing |
| unknown base SHA (git diff fails) | pull_request | develop | docs/a.md | true | true | fatal: Invalid symmetric difference expression 0000000000000000000000000000000000000000...d57341433e29b8ceb0db6ab636bb2ae216c5584f rendered=true: git diff failed |
| diverged: base advanced with src/element/y.ts, PR changes docs/a.md | pull_request | develop | docs/a.md | false | false | rendered=false: only docs, changesets, specs and unit tests changed |
| unrelated roots (no merge base) | pull_request | develop | docs/a.md | true | true | fatal: b6b2e9feef2ca57051cda20d83edd395fd580cf6...c611e97c70d4bf48362d51a98caa4acd28ffa2c4: no merge base rendered=true: git diff failed |

SUMMARY: wiring 40/40 assertions hold; listing as expected in 2 s (CI=1: Total: 1125 tests in 8 files; CI=1 PW_UX_STRESS=1: Total: 143 tests in 2 files); gate 48/48 cases as expected; change detection 47/47 scenarios as expected
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
- Whether a dispatch run on a pull request branch can replace a failed `pull_request` `browsers`
  check on the same SHA (R2-SEC-001). The owner verifies it on GitHub.

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

### The on-demand specs run on dispatch

Once `ci.yml` is on the default branch (see `on-demand-specs.md`), dispatch CI on a branch. Expected:
`on-demand-specs` runs both files and uploads `on-demand-specs-report`; `browsers` does not wait for
it.
