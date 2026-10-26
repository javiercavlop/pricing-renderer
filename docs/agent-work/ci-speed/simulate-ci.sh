#!/usr/bin/env bash
# Runs the real scripts of .github/workflows/ci.yml outside GitHub Actions:
#   (w) asserts the job wiring around them (needs, if, outputs, env, shell, matrix);
#   (a) the `browsers` gate script for every combination of job results;
#   (b) the `changes` detection script against a temporary git repository.
# Exits non-zero on the first wrong outcome. Writes only under $TMPDIR.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="$root/.github/workflows/ci.yml"
playwright_config="$root/playwright.config.ts"
work="$(mktemp -d "${TMPDIR:-/tmp}/simulate-ci.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# Isolate git from the caller: no user or system config (diff.renames,
# core.quotepath, ...) and no repository taken from the environment.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE GIT_CEILING_DIRECTORIES \
  GIT_CONFIG GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT GIT_EXTERNAL_DIFF GIT_DIFF_OPTS
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_NOSYSTEM=1
mkdir -p "$work/home"

# (w) Wiring assertions, then extract the step scripts and their env maps with
# the yaml package of the repository. Each env map is written as
# "NAME<TAB>expression" lines.
node - "$root" "$workflow" "$playwright_config" "$work" <<'NODE'
const { createRequire } = require('node:module');
const { isDeepStrictEqual } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const [root, workflow, playwrightConfig, work] = process.argv.slice(2);
const YAML = createRequire(path.join(root, 'package.json'))('yaml');
const doc = YAML.parse(fs.readFileSync(workflow, 'utf8'));
const jobs = doc.jobs ?? {};
const failures = [];
const passed = [];
const assert = (ok, label, actual) => {
  if (ok) {
    passed.push(label);
  } else {
    failures.push(`${label} (actual: ${JSON.stringify(actual)})`);
  }
};

const gateJob = jobs.browsers ?? {};
const gate = (gateJob.steps ?? [])[0] ?? {};
const changesJob = jobs.changes ?? {};
const filter = (changesJob.steps ?? []).find((step) => step.id === 'filter') ?? {};
const shardsJob = jobs['browser-shards'] ?? {};

assert(gateJob.if === 'always()', "jobs.browsers.if is 'always()'", gateJob.if);
const gateNeeds = Array.isArray(gateJob.needs) ? [...gateJob.needs].sort() : gateJob.needs;
assert(
  isDeepStrictEqual(gateNeeds, ['browser-shards', 'changes']),
  'jobs.browsers.needs is exactly [changes, browser-shards]',
  gateJob.needs,
);
const gateEnv = {
  NEEDS_CHANGES: '${{ needs.changes.result }}',
  RENDERED: '${{ needs.changes.outputs.rendered }}',
  NEEDS_SHARDS: '${{ needs.browser-shards.result }}',
};
assert(
  isDeepStrictEqual(gate.env, gateEnv),
  'the gate step env is exactly NEEDS_CHANGES, RENDERED, NEEDS_SHARDS from needs',
  gate.env,
);
assert(gate.shell === 'bash', "the gate step has shell 'bash'", gate.shell);
assert(typeof gate.run === 'string', 'jobs.browsers.steps[0] has a run script', gate.run);
assert(
  changesJob.outputs?.rendered === '${{ steps.filter.outputs.rendered }}',
  'jobs.changes.outputs.rendered is steps.filter.outputs.rendered',
  changesJob.outputs?.rendered,
);
assert(
  shardsJob.if === "needs.changes.outputs.rendered == 'true'",
  "jobs.browser-shards.if is needs.changes.outputs.rendered == 'true'",
  shardsJob.if,
);
assert(shardsJob.needs === 'changes', "jobs.browser-shards.needs is 'changes'", shardsJob.needs);
assert(filter.shell === 'bash', "the filter step has shell 'bash'", filter.shell);
assert(typeof filter.run === 'string', 'jobs.changes has a step with id filter and a run script', filter.run);
const filterEnv = {
  EVENT_NAME: '${{ github.event_name }}',
  BASE_REF: '${{ github.base_ref }}',
  BASE_SHA: '${{ github.event.pull_request.base.sha }}',
  HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
};
assert(
  isDeepStrictEqual(filter.env, filterEnv),
  'the filter step env is exactly EVENT_NAME, BASE_REF, BASE_SHA, HEAD_SHA from github',
  filter.env,
);
const runsWithExpressions = [];
for (const [jobId, job] of Object.entries(jobs)) {
  (job.steps ?? []).forEach((step, index) => {
    if (typeof step.run === 'string' && step.run.includes('${{')) {
      runsWithExpressions.push(`jobs.${jobId}.steps[${index}]`);
    }
  });
}
assert(runsWithExpressions.length === 0, 'no run: script of any job contains ${{', runsWithExpressions);

// Project names: the `name: '...'` entries after `projects:` in the config.
const configText = fs.readFileSync(playwrightConfig, 'utf8');
const projectsAt = configText.indexOf('projects:');
const projects =
  projectsAt < 0
    ? []
    : [...configText.slice(projectsAt).matchAll(/name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
assert(projects.length > 0, 'playwright.config.ts declares at least one project', projects);
const include = shardsJob.strategy?.matrix?.include ?? [];
const shardProjects = new Set(
  include.flatMap((entry) =>
    [...String(entry.args ?? '').matchAll(/--project=(\S+)/g)].map((m) => m[1]),
  ),
);
const missing = projects.filter((name) => !shardProjects.has(name));
assert(
  missing.length === 0,
  `every Playwright project (${projects.join(', ')}) is in the args of a browser-shards matrix entry`,
  { missing, shardProjects: [...shardProjects] },
);

console.log('## Wiring of jobs.changes, jobs.browser-shards and jobs.browsers');
console.log();
for (const label of passed) console.log(`- ok: ${label}`);
for (const label of failures) console.log(`- WIRING FAILED: ${label}`);
console.log();
if (failures.length > 0) {
  console.error(`WIRING FAILED: ${failures.length} assertion(s) failed, see above`);
  process.exit(1);
}
console.log(`WIRING: ${passed.length}/${passed.length} assertions hold`);
console.log();
const envLines = (env) =>
  Object.entries(env)
    .map(([name, expression]) => `${name}\t${expression}\n`)
    .join('');
fs.writeFileSync(path.join(work, 'gate.sh'), gate.run);
fs.writeFileSync(path.join(work, 'gate.env'), envLines(gate.env));
fs.writeFileSync(path.join(work, 'changes.sh'), filter.run);
fs.writeFileSync(path.join(work, 'changes.env'), envLines(filter.env));
NODE

# Test values keyed by the expression the workflow maps to each env name.
declare -A test_values
env_args=()
# build_env <env map file>: fills env_args with NAME=value for every entry of
# the map, taking the value of its expression from test_values.
build_env() {
  local name expression
  env_args=()
  while IFS=$'\t' read -r name expression; do
    if [ -z "${test_values[$expression]+set}" ]; then
      echo "no test value for the expression $expression (env $name)" >&2
      exit 1
    fi
    env_args+=("$name=${test_values[$expression]}")
  done < "$1"
}

# GitHub runs `shell: bash` steps as `bash --noprofile --norc -eo pipefail {0}`.
# The step gets a clean environment plus the env map of the step.
run_step() {
  local script="$1"
  shift
  env -i PATH="$PATH" HOME="$work/home" GIT_CONFIG_GLOBAL=/dev/null \
    GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_NOSYSTEM=1 "$@" "${env_args[@]}" \
    bash --noprofile --norc -eo pipefail "$script"
}

# (a) Gate script.
echo "## Gate: jobs.browsers.steps[0].run"
echo
echo "| needs.changes.result | needs.changes.outputs.rendered | needs.browser-shards.result | expected | actual | gate output |"
echo "| --- | --- | --- | --- | --- | --- |"
gate_cases=0
for needs_changes in success failure cancelled skipped; do
  for rendered in true false ''; do
    for needs_shards in success failure cancelled skipped; do
      expected=fail
      if [ "$needs_changes" = success ]; then
        if [ "$needs_shards" = success ] ||
          { [ "$needs_shards" = skipped ] && [ "$rendered" = false ]; }; then
          expected=pass
        fi
      fi
      test_values=(
        ['${{ needs.changes.result }}']="$needs_changes"
        ['${{ needs.changes.outputs.rendered }}']="$rendered"
        ['${{ needs.browser-shards.result }}']="$needs_shards"
      )
      build_env "$work/gate.env"
      if output="$(run_step "$work/gate.sh" 2>&1)"; then
        actual=pass
      else
        actual=fail
      fi
      output="${output//$'\n'/ }"
      echo "| $needs_changes | ${rendered:-(empty)} | $needs_shards | $expected | $actual | $output |"
      if [ "$expected" != "$actual" ]; then
        echo "MISMATCH: changes=$needs_changes rendered='$rendered' shards=$needs_shards expected $expected, got $actual" >&2
        exit 1
      fi
      gate_cases=$((gate_cases + 1))
    done
  done
done
echo

# (b) Changes script.
repo="$work/repo"
mkdir -p "$repo"
git_sim() {
  git -C "$repo" -c user.name=simulate-ci -c user.email=simulate-ci@example.invalid \
    -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"
}
git_sim init --quiet --initial-branch=develop
for file in base.txt src/element/x.ts src/x.ts docs/a.md tests/browser/a.spec.ts \
  examples/vanilla/index.html; do
  mkdir -p "$repo/$(dirname "$file")"
  echo base > "$repo/$file"
done
git_sim add -A
git_sim commit --quiet -m base
base_sha="$(git_sim rev-parse HEAD)"

# Each head_* helper creates one commit on top of the base and prints its SHA.
# head_with <files...>: adds or modifies the files.
head_with() {
  git_sim checkout --quiet --detach "$base_sha"
  local file
  for file in "$@"; do
    mkdir -p "$repo/$(dirname "$file")"
    echo "change" > "$repo/$file"
  done
  git_sim add -A
  git_sim commit --quiet -m "head: $*"
  git_sim rev-parse HEAD
}
# head_rm <files...>: deletes the files.
head_rm() {
  git_sim checkout --quiet --detach "$base_sha"
  git_sim rm --quiet -- "$@"
  git_sim commit --quiet -m "head: delete $*"
  git_sim rev-parse HEAD
}
# head_mv <from> <to>: moves a file.
head_mv() {
  git_sim checkout --quiet --detach "$base_sha"
  mkdir -p "$repo/$(dirname "$2")"
  git_sim mv -- "$1" "$2"
  git_sim commit --quiet -m "head: move $1 to $2"
  git_sim rev-parse HEAD
}

echo "## Change detection: the step with id filter of jobs.changes"
echo
echo "| scenario | github.event_name | github.base_ref | files | expected | actual | script output |"
echo "| --- | --- | --- | --- | --- | --- | --- |"
changes_cases=0
# check <scenario> <event> <base_ref> <base_sha> <head_sha> <expected> <files...>
check() {
  local scenario="$1" event="$2" base_ref="$3" b_sha="$4" h_sha="$5" expected="$6"
  shift 6
  local out_file="$work/github_output"
  : > "$out_file"
  test_values=(
    ['${{ github.event_name }}']="$event"
    ['${{ github.base_ref }}']="$base_ref"
    ['${{ github.event.pull_request.base.sha }}']="$b_sha"
    ['${{ github.event.pull_request.head.sha }}']="$h_sha"
  )
  build_env "$work/changes.env"
  local output
  if ! output="$(cd "$repo" && run_step "$work/changes.sh" GITHUB_OUTPUT="$out_file" 2>&1)"; then
    echo "FAILED: scenario '$scenario': the changes script exited non-zero: $output" >&2
    exit 1
  fi
  local actual
  actual="$(sed -n 's/^rendered=//p' "$out_file" | tail -n 1)"
  output="${output//$'\n'/ }"
  echo "| $scenario | $event | ${base_ref:-(empty)} | ${*:-(none)} | $expected | ${actual:-(none)} | $output |"
  if [ "$(grep -c '^rendered=' "$out_file")" != 1 ]; then
    echo "FAILED: scenario '$scenario': expected exactly one rendered= line in GITHUB_OUTPUT" >&2
    exit 1
  fi
  if [ "$actual" != "$expected" ]; then
    echo "FAILED: scenario '$scenario': expected rendered=$expected, got rendered=$actual" >&2
    exit 1
  fi
  changes_cases=$((changes_cases + 1))
}

# scenario <name> <expected> <files...>: a pull request into develop that adds
# or modifies the files.
scenario() {
  local name="$1" expected="$2"
  shift 2
  local h_sha
  h_sha="$(head_with "$@")"
  check "$name" pull_request develop "$base_sha" "$h_sha" "$expected" "$@"
}

# Skipped (rendered=false).
scenario "docs only" false docs/a.md
scenario "docs, changeset and unit test" false docs/a.md .changeset/x.md tests/unit/y.test.ts
scenario "README only" false README.md
scenario "image under docs" false docs/img/a.png
scenario "nested YAML under docs" false docs/a/b/c.yml
scenario "changeset config" false .changeset/config.json
scenario "OpenSpec metadata" false openspec/changes/x/.openspec.yaml
scenario "LICENSE" false LICENSE
scenario "Dependabot config" false .github/dependabot.yml
scenario "docs file name with a space" false 'docs/a b.md'
scenario "nested unit test" false tests/unit/sub/dir/y.test.ts

# Run (rendered=true).
scenario "source file" true src/element/x.ts
scenario "docs and source" true docs/a.md src/element/x.ts
scenario "example README" true examples/vanilla/README.md
scenario "workflow" true .github/workflows/ci.yml
scenario "Playwright config" true playwright.config.ts
scenario "package.json" true package.json
scenario "lockfile" true pnpm-lock.yaml
scenario "browser test" true tests/browser/a.spec.ts
scenario "SPECTRA fixture" true tests/fixtures/spectra/a/b.yml
scenario "Markdown under src" true src/README.md
scenario "Markdown under tests/fixtures" true tests/fixtures/stress/README.md
scenario "upper-case .MD at the root" true README.MD
scenario "Docs/ with a capital D" true Docs/a.png
scenario "tsconfig.json" true tsconfig.json
scenario ".prettierignore" true .prettierignore
scenario ".gitignore" true .gitignore
scenario "visual baseline" true tests/browser/a.spec.ts-snapshots/b.png
scenario "source file name with a space" true 'src/a b.ts'
scenario "non-ASCII name under docs (quoted by git)" true 'docs/é.md'

# Deletions and moves.
# (The SHA is assigned first so that a failing helper stops the script.)
h_sha="$(head_rm src/element/x.ts)"
check "delete source file" pull_request develop "$base_sha" "$h_sha" true 'delete src/element/x.ts'
h_sha="$(head_rm tests/browser/a.spec.ts)"
check "delete browser test" pull_request develop "$base_sha" "$h_sha" true \
  'delete tests/browser/a.spec.ts'
h_sha="$(head_rm examples/vanilla/index.html)"
check "delete example page" pull_request develop "$base_sha" "$h_sha" true \
  'delete examples/vanilla/index.html'
h_sha="$(head_rm docs/a.md)"
check "delete docs page" pull_request develop "$base_sha" "$h_sha" false 'delete docs/a.md'
h_sha="$(head_mv src/x.ts docs/x.md)"
check "source moved into docs" pull_request develop "$base_sha" "$h_sha" true \
  src/x.ts '->' docs/x.md
h_sha="$(head_mv examples/vanilla/index.html docs/index.html)"
check "example moved into docs" pull_request develop "$base_sha" "$h_sha" true \
  examples/vanilla/index.html '->' docs/index.html

# Events, targets and broken input.
docs_sha="$(head_with docs/a.md)"
check "push, docs only" push '' "$base_sha" "$docs_sha" true docs/a.md
check "pull request into main, docs only" pull_request main "$base_sha" "$docs_sha" true docs/a.md
check "empty diff" pull_request develop "$base_sha" "$base_sha" true
check "missing SHAs" pull_request develop '' '' true
check "unknown base SHA (git diff fails)" pull_request develop \
  0000000000000000000000000000000000000000 "$docs_sha" true docs/a.md

# Diverged history: the base branch gained a source file after the pull request
# forked. BASE_SHA is the advanced base tip; three-dot diffs from the merge base,
# so only the pull request's own docs change counts.
advanced_sha="$(head_with src/element/y.ts)"
check "diverged: base advanced with src/element/y.ts, PR changes docs/a.md" pull_request develop \
  "$advanced_sha" "$docs_sha" false docs/a.md

# Unrelated roots: no merge base, so the three-dot diff fails.
git_sim checkout --quiet --orphan sim-unrelated
git_sim rm -r --quiet --cached -- .
git_sim clean -fdq
mkdir -p "$repo/docs"
echo unrelated > "$repo/docs/a.md"
git_sim add -A
git_sim commit --quiet -m "unrelated root"
unrelated_sha="$(git_sim rev-parse HEAD)"
check "unrelated roots (no merge base)" pull_request develop "$base_sha" "$unrelated_sha" true \
  docs/a.md
echo

echo "SUMMARY: gate $gate_cases/$gate_cases cases as expected; change detection $changes_cases/$changes_cases scenarios as expected"
