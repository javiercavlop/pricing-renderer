#!/usr/bin/env bash
# Runs the real scripts of .github/workflows/ci.yml outside GitHub Actions:
#   (a) the `browsers` gate script for every combination of job results;
#   (b) the `changes` detection script against a temporary git repository.
# Exits non-zero on the first wrong outcome. Writes only under $TMPDIR.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflow="$root/.github/workflows/ci.yml"
work="$(mktemp -d "${TMPDIR:-/tmp}/simulate-ci.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# GitHub runs `shell: bash` steps as `bash --noprofile --norc -eo pipefail {0}`.
run_step() {
  bash --noprofile --norc -eo pipefail "$@"
}

# Extract the step scripts with the yaml package of the repository.
node - "$root" "$workflow" "$work" <<'NODE'
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const [root, workflow, work] = process.argv.slice(2);
const YAML = createRequire(path.join(root, 'package.json'))('yaml');
const doc = YAML.parse(fs.readFileSync(workflow, 'utf8'));
const gate = doc.jobs.browsers.steps[0].run;
const filter = doc.jobs.changes.steps.find((step) => step.id === 'filter');
if (typeof gate !== 'string' || !filter || typeof filter.run !== 'string') {
  console.error('could not find jobs.browsers.steps[0].run or the changes step with id filter');
  process.exit(1);
}
fs.writeFileSync(path.join(work, 'gate.sh'), gate);
fs.writeFileSync(path.join(work, 'changes.sh'), filter.run);
NODE

# (a) Gate script.
echo "## Gate: jobs.browsers.steps[0].run"
echo
echo "| NEEDS_CHANGES | RENDERED | NEEDS_SHARDS | expected | actual | gate output |"
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
      if output="$(NEEDS_CHANGES="$needs_changes" RENDERED="$rendered" NEEDS_SHARDS="$needs_shards" \
        run_step "$work/gate.sh" 2>&1)"; then
        actual=pass
      else
        actual=fail
      fi
      output="${output//$'\n'/ }"
      echo "| $needs_changes | ${rendered:-(empty)} | $needs_shards | $expected | $actual | $output |"
      if [ "$expected" != "$actual" ]; then
        echo "MISMATCH: NEEDS_CHANGES=$needs_changes RENDERED='$rendered' NEEDS_SHARDS=$needs_shards expected $expected, got $actual" >&2
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
echo base > "$repo/base.txt"
mkdir -p "$repo/examples/vanilla"
echo base > "$repo/examples/vanilla/index.html"
git_sim add -A
git_sim commit --quiet -m base
base_sha="$(git_sim rev-parse HEAD)"

# Creates a commit on top of the base that adds the given files; prints its SHA.
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

echo "## Change detection: the step with id filter of jobs.changes"
echo
echo "| scenario | EVENT_NAME | BASE_REF | files | expected | actual | script output |"
echo "| --- | --- | --- | --- | --- | --- | --- |"
changes_cases=0
# check <scenario> <event> <base_ref> <base_sha> <head_sha> <expected> <files...>
check() {
  local scenario="$1" event="$2" base_ref="$3" b_sha="$4" h_sha="$5" expected="$6"
  shift 6
  local out_file="$work/github_output"
  : > "$out_file"
  local output
  if ! output="$(cd "$repo" && EVENT_NAME="$event" BASE_REF="$base_ref" BASE_SHA="$b_sha" \
    HEAD_SHA="$h_sha" GITHUB_OUTPUT="$out_file" run_step "$work/changes.sh" 2>&1)"; then
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

# scenario <name> <expected> <files...>: a pull request into develop.
scenario() {
  local name="$1" expected="$2"
  shift 2
  local h_sha
  h_sha="$(head_with "$@")"
  check "$name" pull_request develop "$base_sha" "$h_sha" "$expected" "$@"
}

scenario "docs only" false docs/a.md
scenario "docs, changeset and unit test" false docs/a.md .changeset/x.md tests/unit/y.test.ts
scenario "README only" false README.md
scenario "source file" true src/element/x.ts
scenario "docs and source" true docs/a.md src/element/x.ts
scenario "example README" true examples/vanilla/README.md
scenario "workflow" true .github/workflows/ci.yml
scenario "Playwright config" true playwright.config.ts
scenario "package.json" true package.json
scenario "lockfile" true pnpm-lock.yaml
scenario "browser test" true tests/browser/a.spec.ts
scenario "SPECTRA fixture" true tests/fixtures/spectra/a/b.yml

docs_sha="$(head_with docs/a.md)"
check "push, docs only" push '' "$base_sha" "$docs_sha" true docs/a.md
check "pull request into main, docs only" pull_request main "$base_sha" "$docs_sha" true docs/a.md
git_sim checkout --quiet --detach "$base_sha"
mkdir -p "$repo/docs"
git_sim mv examples/vanilla/index.html docs/index.html
git_sim commit --quiet -m "head: move example page into docs"
moved_sha="$(git_sim rev-parse HEAD)"
check "example moved into docs" pull_request develop "$base_sha" "$moved_sha" true \
  examples/vanilla/index.html '->' docs/index.html
check "empty diff" pull_request develop "$base_sha" "$base_sha" true
check "missing SHAs" pull_request develop '' '' true
check "unknown base SHA (git diff fails)" pull_request develop \
  0000000000000000000000000000000000000000 "$docs_sha" true docs/a.md
echo

echo "SUMMARY: gate $gate_cases/$gate_cases cases as expected; change detection $changes_cases/$changes_cases scenarios as expected"
