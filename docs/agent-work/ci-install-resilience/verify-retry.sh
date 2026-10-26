#!/usr/bin/env bash
# Verifies the bounded retry of the 'Install browsers' step of
# .github/workflows/ci.yml with PATH stubs. It touches nothing outside a temp
# dir: `sudo`, `pnpm` and `sleep` are stubs, /etc is never written.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
workflow="$root/.github/workflows/ci.yml"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

command -v timeout > /dev/null || { echo "FAIL: coreutils timeout not found"; exit 1; }
real_sleep="$(command -v sleep)"

# Extract the run script of the step.
node - "$root" "$workflow" "$work/step.sh" <<'NODE'
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const [root, workflow, out] = process.argv.slice(2);
const YAML = createRequire(path.join(root, 'package.json'))('yaml');
const doc = YAML.parse(fs.readFileSync(workflow, 'utf8'));
const steps = Object.values(doc.jobs ?? {}).flatMap((j) => j.steps ?? []);
const found = steps.filter((s) => s.name === 'Install browsers');
if (found.length !== 1) {
  console.error(`expected one 'Install browsers' step, found ${found.length}`);
  process.exit(1);
}
fs.writeFileSync(out, found[0].run);
NODE

bash -n "$work/step.sh"
echo "PASS: bash -n on the extracted script"

# Stubs.
mkdir "$work/bin"
cat > "$work/bin/sudo" <<'EOF'
#!/usr/bin/env bash
cat > /dev/null
EOF
cat > "$work/bin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$work/bin/pnpm" <<EOF
#!/usr/bin/env bash
n=\$(( \$(cat "\$STUB_DIR/count" 2>/dev/null || echo 0) + 1 ))
echo "\$n" > "\$STUB_DIR/count"
case "\$PNPM_MODE" in
  ok) exit 0 ;;
  fail-once) [ "\$n" -ge 2 ] && exit 0 || exit 1 ;;
  fail) exit 1 ;;
  hang) exec "$real_sleep" 30 ;;
esac
EOF
chmod +x "$work/bin/"*

failed=0
# run_case NAME EXPECTED_EXIT PNPM_MODE ATTEMPT_TIMEOUT EXPECTED_WARNINGS EXPECT_ERROR MAX_SECONDS
run_case() {
  local name="$1" want_rc="$2" mode="$3" at="$4" want_warn="$5" want_err="$6" max="$7"
  local stub_dir="$work/case-$name" rc=0 start end warn err calls
  mkdir "$stub_dir"
  start=$SECONDS
  PATH="$work/bin:$PATH" STUB_DIR="$stub_dir" PNPM_MODE="$mode" INSTALL="firefox webkit" \
    ATTEMPTS=2 ATTEMPT_TIMEOUT="$at" bash -eo pipefail "$work/step.sh" > "$stub_dir/out" 2>&1 || rc=$?
  end=$SECONDS
  warn=$(grep -c '^::warning::' "$stub_dir/out" || true)
  err=$(grep -c '^::error::' "$stub_dir/out" || true)
  calls=$(cat "$stub_dir/count" 2>/dev/null || echo 0)
  if [ "$rc" = "$want_rc" ] && [ "$warn" = "$want_warn" ] && [ "$err" = "$want_err" ] \
    && [ $((end - start)) -le "$max" ]; then
    echo "PASS: $name (exit $rc, warnings $warn, errors $err, pnpm calls $calls, $((end - start))s)"
  else
    echo "FAIL: $name (exit $rc want $want_rc, warnings $warn want $want_warn, errors $err want $want_err, $((end - start))s max $max)"
    sed 's/^/    /' "$stub_dir/out"
    failed=1
  fi
}

run_case first-attempt-ok 0 ok 4m 0 0 5
run_case fail-once-then-ok 0 fail-once 4m 1 0 5
run_case always-fails 1 fail 4m 2 1 5
run_case hangs-timeout-fires 1 hang 1s 2 1 10

[ "$failed" = 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
