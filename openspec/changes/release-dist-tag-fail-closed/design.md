# Design: release-dist-tag-fail-closed

Decisions come from the planner intake (`docs/agent-work/prop-20261103-1/intake.md`, "Scope",
"Slices", "Risks", "Open questions"). Line numbers are at base `c0c926d`.

## Context

- `release.yml` has one job, `jobs.publish`, with `id-token: write` (`:33-35`). Its first step
  (`id: release`, `:39-62`) reads the GitHub Release with
  `gh release view "$RELEASE_TAG" --json isDraft,isPrerelease,tagName` (`:44-46`) into
  `release_json`.
- The `isDraft` and `tagName` checks (`:48-56`) fail closed. The dist-tag choice (`:58-62`) does
  not: `if [ "$(jq -r '.isPrerelease' <<<"$release_json")" = "true" ]` writes `dist_tag=next`, and
  the `else` branch writes `dist_tag=latest`.
- The step has no `shell:` key, so it runs as `bash -e {0}`, without `pipefail`. A failing
  command substitution inside `[ ... ]` does not stop the step; it yields an empty string.
- The publish step (`:133-144`) gets the value through `env: DIST_TAG` and its guard accepts
  `latest|next` (`:137-143`). A wrong `latest` passes it.
- `tests/unit/release-workflow.test.ts` reads `release.yml` statically. Its guard regex
  (`:59-61`) matches a `*)` arm that holds `# exit 1` (intake, E5). No case reads the `release`
  step.
- `scripts/check-release-ready.mjs:51-57` requires the substring `gh release view "$RELEASE_TAG"`.

## Decisions

### D1. One new change, one ADDED requirement

`harden-release-workflow` is merged but unarchived and still waits on the owner's finding-1
decision (its tasks.md S1, T2, I2). Amending it would mix a decided fix with a pending one. A new
change adds `req~release-dist-tag-prerelease-map~1` to `release-workflow`. Both deltas are ADDED
only, so either archive order works; archiving `harden-release-workflow` first keeps the history
readable.

### D2. Explicit mapping after a plain assignment

The `release` step replaces `:58-62` with:

```sh
is_prerelease="$(jq -r '.isPrerelease' <<<"$release_json")"
case "$is_prerelease" in
  true) dist_tag=next ;;
  false) dist_tag=latest ;;
  *)
    echo "::error::Unexpected isPrerelease value: $is_prerelease"
    exit 1
    ;;
esac
echo "dist_tag=$dist_tag" >>"$GITHUB_OUTPUT"
```

Reasons:

- Under `bash -e`, a failed `jq` in a plain assignment stops the step: that path is fail-closed
  too. If `jq` succeeds but prints anything other than `true` or `false`, the `*)` arm stops it.
- Only the literal `false` selects `latest`; the default arm writes nothing and exits 1.
- A single `echo "dist_tag=$dist_tag" >>"$GITHUB_OUTPUT"` after the `case` is reached only when
  one of the two literal arms set the variable, so no output is written on failure.
- The step keeps `gh release view "$RELEASE_TAG"` (required by `check-release-ready.mjs:51-57`)
  and adds no `${{ ... }}` to any `run` script (`req~release-dist-tag-env~1`).
- I1 adds `# [impl->req~release-dist-tag-prerelease-map~1]` above the step, like `:109,131-132`.

The exact shell form is the implementer's choice within the requirement; an `if/elif/else` with
the same three outcomes is equivalent (R2).

Options considered:

- Keep the `if ... else` and only add `set -o pipefail`: does not help, a substitution inside `[`
  is not a pipeline and the `else` still writes `latest`. Rejected.
- Rely on `bash -e` alone with the plain assignment: catches a failing `jq` but not `null`, an
  empty field or other text. Rejected.
- `jq -e '.isPrerelease'`: exits non-zero for `false` and `null` alike, so a mapping built on its
  exit status still has to tell them apart, and a naive `if jq -e ...; then next; else latest`
  maps `null` to `latest`. Rejected.
- Explicit `case` on the value with a failing default arm. **Chosen.**

### D3. Tests stay static, with comment stripping

T1 extends `tests/unit/release-workflow.test.ts` without executing any workflow script (design D7
of `harden-release-workflow`). It selects the step with `id: release`, removes full-line `#`
comments from its `run` and asserts the mapping (spec, "Static" scenarios). The same stripping is
applied to the publish step's `run` before the existing guard regex, and a fixture case shows that
a `*)` arm holding only `# exit 1` does not count as a guard.

Options considered:

- Execute the step script in bash with a stubbed `gh` and real `jq`: stronger, but it amends D7
  and needs `bash` and `jq` in the lab. Rejected for this change (intake Q2).
- Static matching only. **Chosen.** The behavioural scenarios of the spec are checked by reading
  which literal selects each branch.

### D4. `req~release-dist-tag-env~1` is not modified

Its text already says the guard "fails the step before `npm publish`". A commented-out `exit 1`
does not fail the step, so the existing requirement already excludes it. Only its test is
tightened (D3); the requirement keeps revision 1 and is not re-added in this delta.

### D5. No feature flag, no ADR, no changeset

A CI-only change with no runtime behaviour to switch, no new dependency and no consumer-visible
file or API.

## Requirement notes

- "Publish job": `jobs.publish` of `.github/workflows/release.yml`. "`release` step": the step of
  `jobs.publish.steps` with `id: release`.
- "Write `dist_tag=...`": append the line to `$GITHUB_OUTPUT`. "Before `npm publish`": the step
  fails, so the job stops and the publish step does not run.
- "Value read": the text that the step obtains for `isPrerelease` from the GitHub Release (with
  `jq -r`, `true`, `false`, `null` or other text; empty if the read fails without stopping the
  step).
- "Exactly": case-sensitive, no surrounding whitespace.
- "Writes no `dist_tag` output": no line starting with `dist_tag=` is appended to
  `$GITHUB_OUTPUT` by the step.
- "Default branch": a `*)` arm of a `case`, or the final `else` of an `if/elif/else`.
- "A command, not text inside a comment": after removing full-line `#` comments, the failing arm
  still contains `exit 1` (or another non-zero `exit`).

## Risks

- R1. Nothing exercises `release.yml` before the owner's next release. A mistake in the new
  mapping (for example a typo in the `true` arm) would stop that release. The stop happens before
  `npm publish` and the run can be repeated (`docs/releasing.md:43`); it is still a delay.
  Mitigation: the red-first static case of T1, the security-auditor review, and
  `node scripts/check-release-ready.mjs v0.1.0` as an I1 check.
- R2. Static matching of shell text is brittle: a valid rewrite may fail T1. Mitigation: T1
  accepts both the `case` and the `if/elif/else` forms. If static matching proves too fragile,
  executing the script (D3, rejected option) is the fallback, as a coordinator decision.
- R3. File contention with the pending finding-1 slices of `harden-release-workflow`, which own the
  same `release.yml`, test file and `docs/audit-report.md`. Mitigation: the coordinator serializes
  them; this change goes first because it needs no owner decision.
- R4. `gh release view --json isPrerelease` is assumed to return a JSON boolean, so `jq -r` prints
  `true` or `false`. This is not verified against the gh documentation. If it ever returned
  something else, the step fails closed and nothing is published under a wrong tag.

## Migration

None. Nothing is released by this change; no stored data, option, published file or API changes.

## Open questions

None for the owner. Intake Q1 (new change) and Q2 (static tests) are decided as D1 and D3.
