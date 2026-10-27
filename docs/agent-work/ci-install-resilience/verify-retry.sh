#!/usr/bin/env bash
# Verifies the bounded retry of the 'Install browsers' step of
# .github/workflows/ci.yml with PATH stubs. It touches nothing outside a temp
# dir: `sudo`, `pnpm` and `sleep` are stubs, /etc is never written.
# timeout-minutes, ATTEMPTS, ATTEMPT_TIMEOUT and the run script are read from
# the workflow's own step node.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
workflow="$root/.github/workflows/ci.yml"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

command -v timeout > /dev/null || { echo "FAIL: coreutils timeout not found"; exit 1; }
real_sleep="$(command -v sleep)"

# Extract the step: run script, timeout-minutes and env.
node - "$root" "$workflow" "$work/step.sh" "$work/step.conf" <<'NODE'
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const [root, workflow, out, conf] = process.argv.slice(2);
const YAML = createRequire(path.join(root, 'package.json'))('yaml');
const doc = YAML.parse(fs.readFileSync(workflow, 'utf8'));
const steps = Object.values(doc.jobs ?? {}).flatMap((j) => j.steps ?? []);
const found = steps.filter((s) => s.name === 'Install browsers');
if (found.length !== 1) {
  console.error(`expected one 'Install browsers' step, found ${found.length}`);
  process.exit(1);
}
const step = found[0];
const env = step.env ?? {};
const fail = (m) => { console.error(m); process.exit(1); };
if (!/^\d+$/.test(String(step['timeout-minutes']))) fail('step has no numeric timeout-minutes');
if (!/^\d+$/.test(String(env.ATTEMPTS))) fail('step env has no numeric ATTEMPTS');
if (!/^\d+[sm]$/.test(String(env.ATTEMPT_TIMEOUT))) fail('step env ATTEMPT_TIMEOUT is not Ns or Nm');
if (env.INSTALL !== '${{ matrix.install }}') fail('step env INSTALL is not ${{ matrix.install }}');
fs.writeFileSync(out, step.run);
fs.writeFileSync(conf, [
  `STEP_MINUTES=${step['timeout-minutes']}`,
  `WF_ATTEMPTS=${env.ATTEMPTS}`,
  `WF_ATTEMPT_TIMEOUT=${env.ATTEMPT_TIMEOUT}`,
].join('\n') + '\n');
NODE

bash -n "$work/step.sh"
echo "PASS: bash -n on the extracted script"

# shellcheck disable=SC1091
. "$work/step.conf"
case "$WF_ATTEMPT_TIMEOUT" in
  *m) attempt_secs=$(( ${WF_ATTEMPT_TIMEOUT%m} * 60 )) ;;
  *s) attempt_secs=${WF_ATTEMPT_TIMEOUT%s} ;;
esac

failed=0
# Budget invariant: the step timeout must exceed the worst case by 30 s: every
# attempt (timeout + 15 s kill grace) plus, per retry, the pkill wait (5 s),
# the dpkg repair (60 s) and the sleep (10 s).
need=$(( WF_ATTEMPTS * (attempt_secs + 15) + (WF_ATTEMPTS - 1) * (5 + 60 + 10) ))
have=$(( STEP_MINUTES * 60 ))
if [ "$have" -ge $(( need + 30 )) ]; then
  echo "PASS: budget ${need}s worst case + 30s <= step timeout ${have}s (${WF_ATTEMPTS} attempts x ${WF_ATTEMPT_TIMEOUT})"
else
  echo "FAIL: budget ${need}s worst case + 30s > step timeout ${have}s"
  failed=1
fi

# Stubs. Everything they record goes to $STUB_DIR.
mkdir "$work/bin"
cat > "$work/bin/sudo" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/sudo.log"
# Like the real pkill when nothing matches: the step must survive it under -e.
[ "${1:-}" = pkill ] && exit 1
if [ "${1:-}" = tee ]; then
  cat > "$STUB_DIR/tee.$(basename "$2")"
else
  cat >> "$STUB_DIR/sudo.stdin"
fi
EOF
cat > "$work/bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$work/bin/pnpm" <<EOF
#!/usr/bin/env bash
n=\$(( \$(cat "\$STUB_DIR/count" 2>/dev/null || echo 0) + 1 ))
echo "\$n" > "\$STUB_DIR/count"
printf '%s\n' "\$@" > "\$STUB_DIR/pnpm.args"
case "\$PNPM_MODE" in
  ok) exit 0 ;;
  fail-once) [ "\$n" -ge 2 ] && exit 0 || exit 1 ;;
  fail) exit 1 ;;
  hang) exec "$real_sleep" 30 ;;
esac
EOF
chmod +x "$work/bin/"*

expect_apt='Acquire::Retries "3";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
DPkg::Lock::Timeout "60";'
expect_pnpm='exec
playwright
install
--with-deps
firefox
webkit'

# run_case NAME EXPECTED_EXIT PNPM_MODE ATTEMPT_TIMEOUT EXPECTED_WARNINGS EXPECT_ERROR MAX_SECONDS EXPECTED_DPKG_RUNS ATTEMPT_EXIT_CODE
# The workflow's ATTEMPTS is used; ATTEMPT_TIMEOUT is overridden by the caller
# only for the hang case (pass "-" to keep the workflow's value).
run_case() {
  local name="$1" want_rc="$2" mode="$3" at="$4" want_warn="$5" want_err="$6" max="$7" want_dpkg="$8" want_code="${9:-}"
  local stub_dir="$work/case-$name" rc=0 start end warn err calls dpkg problems=""
  [ "$at" = "-" ] && at="$WF_ATTEMPT_TIMEOUT"
  mkdir "$stub_dir"
  start=$SECONDS
  PATH="$work/bin:$PATH" STUB_DIR="$stub_dir" PNPM_MODE="$mode" INSTALL="firefox webkit" \
    ATTEMPTS="$WF_ATTEMPTS" ATTEMPT_TIMEOUT="$at" bash -eo pipefail "$work/step.sh" < /dev/null > "$stub_dir/out" 2>&1 || rc=$?
  end=$SECONDS
  warn=$(grep -c '^::warning::' "$stub_dir/out" || true)
  err=$(grep -c '^::error::' "$stub_dir/out" || true)
  calls=$(cat "$stub_dir/count" 2>/dev/null || echo 0)
  dpkg=$(grep -cx 'timeout 60s dpkg --configure -a' "$stub_dir/sudo.log" || true)

  [ "$rc" = "$want_rc" ] || problems="$problems exit $rc want $want_rc;"
  [ "$warn" = "$want_warn" ] || problems="$problems warnings $warn want $want_warn;"
  [ "$err" = "$want_err" ] || problems="$problems errors $err want $want_err;"
  [ $((end - start)) -le "$max" ] || problems="$problems took $((end - start))s max $max;"
  [ "$dpkg" = "$want_dpkg" ] || problems="$problems dpkg repairs $dpkg want $want_dpkg;"
  [ "$(head -n1 "$stub_dir/sudo.log")" = "tee /etc/apt/apt.conf.d/99ci-resilience" ] \
    || problems="$problems first sudo call is not the apt config tee;"
  [ "$(cat "$stub_dir/tee.99ci-resilience" 2>/dev/null)" = "$expect_apt" ] || problems="$problems apt config content differs;"

  # Leftover root apt processes are stopped (TERM, then KILL) before each
  # repair, never on a first-attempt success; the mirror switch happens from
  # attempt 2 on, after the first repair.
  local t k d term kill mirrors first_term first_kill first_dpkg first_mirror
  term=$(grep -cx 'pkill -TERM -x apt-get' "$stub_dir/sudo.log" || true)
  kill=$(grep -cx 'pkill -KILL -x apt-get' "$stub_dir/sudo.log" || true)
  mirrors=$(grep -cx 'tee /etc/apt/apt-mirrors.txt' "$stub_dir/sudo.log" || true)
  [ "$term" = "$want_dpkg" ] || problems="$problems pkill TERM apt-get $term want $want_dpkg;"
  [ "$kill" = "$want_dpkg" ] || problems="$problems pkill KILL apt-get $kill want $want_dpkg;"
  [ "$mirrors" = "$want_dpkg" ] || problems="$problems mirror switches $mirrors want $want_dpkg;"
  if [ "$want_dpkg" -gt 0 ]; then
    for p in apt dpkg; do
      for s in TERM KILL; do
        grep -qx "pkill -$s -x $p" "$stub_dir/sudo.log" || problems="$problems missing pkill -$s -x $p;"
      done
      t=$(grep -nx "pkill -TERM -x $p" "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
      k=$(grep -nx "pkill -KILL -x $p" "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
      d=$(grep -nx 'timeout 60s dpkg --configure -a' "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
      { [ "${t:-0}" -gt 0 ] && [ "${t:-0}" -lt "${k:-0}" ] && [ "${k:-0}" -lt "${d:-0}" ]; } \
        || problems="$problems order for $p is not TERM, KILL, repair;"
    done
    first_term=$(grep -nx 'pkill -TERM -x apt-get' "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
    first_kill=$(grep -nx 'pkill -KILL -x apt-get' "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
    first_dpkg=$(grep -nx 'timeout 60s dpkg --configure -a' "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
    first_mirror=$(grep -nx 'tee /etc/apt/apt-mirrors.txt' "$stub_dir/sudo.log" | head -n1 | cut -d: -f1)
    { [ "$first_term" -lt "$first_kill" ] && [ "$first_kill" -lt "$first_dpkg" ]; } \
      || problems="$problems order is not TERM, KILL, dpkg repair;"
    [ "$first_dpkg" -lt "$first_mirror" ] || problems="$problems mirror switched before the first retry;"
    [ "$(cat "$stub_dir/tee.apt-mirrors.txt" 2>/dev/null)" = 'http://archive.ubuntu.com/ubuntu/' ] \
      || problems="$problems mirror content differs;"
  fi
  [ "$(cat "$stub_dir/pnpm.args" 2>/dev/null)" = "$expect_pnpm" ] || problems="$problems pnpm args differ;"
  if [ "$want_warn" -gt 0 ]; then
    grep -q "^::warning::.*exit code ${want_code} " "$stub_dir/out" || problems="$problems warning lacks exit code $want_code;"
  fi

  if [ -z "$problems" ]; then
    echo "PASS: $name (exit $rc, warnings $warn, errors $err, pnpm calls $calls, dpkg repairs $dpkg, $((end - start))s)"
  else
    echo "FAIL: $name:$problems"
    sed 's/^/    /' "$stub_dir/out"
    failed=1
  fi
}

# Cleanup, repair and mirror switch run once per retry: 0 when the first
# attempt works, 1 for fail-once, (ATTEMPTS - 1) when every attempt fails.
retries_all=$(( WF_ATTEMPTS - 1 ))
[ "$retries_all" -ge 1 ] || { echo "FAIL: workflow ATTEMPTS must be at least 2"; exit 1; }

run_case first-attempt-ok 0 ok - 0 0 5 0
run_case fail-once-then-ok 0 fail-once - 1 0 5 1 1
run_case always-fails 1 fail - "$WF_ATTEMPTS" 1 5 "$retries_all" 1
run_case hangs-timeout-fires 1 hang 1s "$WF_ATTEMPTS" 1 15 "$retries_all" 124

[ "$failed" = 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
