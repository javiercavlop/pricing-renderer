# Proposal: choose the release dist-tag fail-closed

Change `release-dist-tag-fail-closed`. Proposal P-20261103-1 (kind reliability, size S, risk
medium), approved by the owner. Planner intake: `docs/agent-work/prop-20261103-1/intake.md`
("Objective", "Scope", slices S0, T1 and I1, "Risks"). Line numbers are at base `c0c926d`.

Owner and coordinator decisions taken in the intake (Q1, Q2):

- This is a **new change**, not an amendment of `harden-release-workflow`. That change is merged
  but unarchived and still waits on the owner's decision about audit finding 1.
- Tests **stay static**, as design D7 of `harden-release-workflow` requires
  (`openspec/changes/harden-release-workflow/design.md:87-93`).

## Why

INTENT link: **O4, "supply-chain and CI health"** (`INTENT.md:77-90`). The audit report records the
item as open (`docs/audit-report.md:139-142`): the step that picks the dist-tag "selects `latest` for
any `isPrerelease` value other than `true`, including a failed `jq` read".

- How the tag is chosen today. The `release` step (`id: release`, `release.yml:39-62`) runs
  `if [ "$(jq -r '.isPrerelease' <<<"$release_json")" = "true" ]`, writes `dist_tag=next` in that
  branch and `dist_tag=latest` in the `else` branch (`:58-62`). Any value other than `true` (an
  empty string, `null` for a missing field, `True`, any other text) ends up as `latest`.
- Why a failed read is not caught. The step has no `shell:` key, so it runs as `bash -e {0}`,
  without `pipefail`. A command substitution used as an argument of `[ ... ]` does not trigger
  `-e`: a failing `jq` leaves an empty string and the `else` branch writes `latest`.
- Why the publish guard does not help. The guard of the publish step (`release.yml:137-143`,
  `req~release-dist-tag-env~1`) accepts `latest|next`, so a wrong `latest` passes it and the
  package is published as the default version consumers install.
- The static test also counts a commented-out `exit 1` as a guard (intake, E5): its regex
  matches `# exit 1` inside the `*)` arm.

## What changes

- The `release` step writes `dist_tag=next` only when the `isPrerelease` value read is exactly
  `true`, and `dist_tag=latest` only when it is exactly `false`.
- For any other value the step writes an `::error::` annotation, writes no `dist_tag` output and
  exits non-zero, so the publish job stops before `npm publish`.
- The static test of the release workflow checks the mapping and ignores comments when it looks
  for a failing exit, both in the `release` step and in the existing publish guard.
- `docs/audit-report.md` records the open item as resolved.

## Impact

- Capability: `release-workflow` (ADDED): `req~release-dist-tag-prerelease-map~1`.
  `req~release-dist-tag-env~1` stays at revision 1 and is not modified (design.md D4).
- Code areas: `.github/workflows/release.yml` (only the `release` step, `:39-62`),
  `docs/audit-report.md` (`:112-114`, `:139-142`), `tests/unit/release-workflow.test.ts`.
- Public API, published files and package contents: unchanged. No changeset, no ADR, no feature
  flag.
- Release: **nothing is released** by this change. The changed step runs first in the owner's next
  release; a wrong value then stops the job before `npm publish` instead of publishing under
  `latest`.
- Risks and their mitigations: design.md, "Risks".

## Out of scope

- **Audit finding 1** (`npm install --global npm@11.18.0` without an integrity check). It stays
  with the pending S1, T2 and I2 of `harden-release-workflow` and the owner's decision.
- **Audit finding 2** (the whole pipeline in the publishing job). It stays accepted
  (`release.yml:24-32`).
- Any release, `changeset version`, version bump, tag or npm publish.
- `ci.yml`, `.npmrc`, `docs/releasing.md`, `scripts/check-release-ready.mjs`.
- Editing `INTENT.md` or `ROADMAP.md` (followups for a doc-steward task, intake "Open questions").
- Executing the workflow script in a test with a stubbed `gh` (design.md D3).
