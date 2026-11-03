# Proposal: pass the dist-tag through `env` and run the unit tests once in the release workflow

Change `harden-release-workflow`. Proposal P-20261030-1 (kind security, size S, risk medium),
approved by the owner. Planner intake: `docs/agent-work/prop-20261030-1/intake.md` (slice S0,
evidence E1-E8); handoff: `docs/agent-work/prop-20261030-1/handoff.md`. Line numbers are at base
`a82cd88`.

## Why

INTENT link: **O4, "supply-chain and CI health"**, signal "Release workflow findings"
(`INTENT.md:88-90`, `ROADMAP.md:180-181`). The audit of `.github/workflows/release.yml`
(`docs/audit-report.md:88-129`) lists four findings; findings 3 and 4 are still open
(`docs/audit-report.md:127-129`):

- Finding 4, `dist_tag` interpolated into `run`. The publish step (`release.yml:130-131`) runs
  `npm publish --access public --provenance --tag "${{ steps.release.outputs.dist_tag }}"`. The value
  is only `next` or `latest` today (`:58-62`), so it is not exploitable, but a later change to that
  step would turn the expression into a template injection in the job that holds `id-token: write`
  (`:33-35`). `RELEASE_TAG` already comes in through `env` (`:36-37`).
- Finding 3, `prepublishOnly` repeats work. `package.json:147` is `pnpm test && pnpm package:check`.
  The publish job already ran `pnpm test` (`release.yml:109-110`) and `pnpm package:check`
  (`:112-113`), so `npm publish` runs the unit tests a second time.
- Nothing guards the workflow before the release: `scripts/check-release-ready.mjs` runs only inside
  the publish job (`release.yml:94-95`), and no test reads `release.yml` (intake, E8). Every fix must
  keep what that script requires (`check-release-ready.mjs:51-75`), or the release fails.

No living spec covers the release workflow (`openspec/` has only change folders), so this change
adds the capability `release-workflow`.

## What changes

- The publish step receives the npm dist-tag only through a step `env` variable mapped from
  `steps.release.outputs.dist_tag`; no `run` script of the publish job contains a `${{ ... }}`
  expression.
- The publish step fails before `npm publish` when the dist-tag is not exactly `latest` or `next`.
- `scripts.prepublishOnly` becomes `pnpm package:check`, so `npm publish` no longer runs the unit
  tests; the publish job runs `pnpm test` exactly once.
- `release.yml` keeps every substring that `scripts/check-release-ready.mjs` requires and gains no
  `secrets.`, `NPM_TOKEN` or `NODE_AUTH_TOKEN` reference.

## Impact

- Capability: `release-workflow` (ADDED): `req~release-dist-tag-env~1`,
  `req~release-single-unit-test-run~1` and `req~release-check-substrings-kept~1`.
- Code areas: `.github/workflows/release.yml` (the publish step, `:130-131`), `package.json`
  (`scripts.prepublishOnly` only, `:147`), `docs/audit-report.md` (findings 3 and 4 and "Open
  items"). One new static unit test, `tests/unit/release-workflow.test.ts`.
- Public API, published files and package contents: unchanged. `prepublishOnly` is not a consumer
  surface, so **no changeset** is needed.
- Release: **nothing is released** by this change: no `changeset version`, tag or npm publish. The
  release stays on hold (`ROADMAP.md:139-148`), so the changed workflow is first exercised in the
  owner's next release. Until then only the static test and `node scripts/check-release-ready.mjs`
  guard it (design.md, "Risks").
- Risks and their mitigations: design.md, "Risks".

## Out of scope

- **Audit finding 1** (`npm install --global npm@11.18.0` without an integrity check,
  `release.yml:88-89`, `docs/audit-report.md:90-93,120-122`). Its fix changes the publish toolchain
  and waits for an owner decision (intake Q1 and Q3). It is out of this change for now. After the
  owner decides, this change is amended with the requirement `req~release-npm-cli-verified~1`, and
  its test and implementation slices follow (tasks.md, "Pending owner decision").
- **Audit finding 2** (the whole pipeline in the publishing job, `docs/audit-report.md:94-99`). It is
  accepted on purpose (`release.yml:24-32`, `docs/audit-report.md:123-126`); splitting verify and
  publish needs its own owner approval.
- Any release, version bump, tag or npm publish.
- A workflow linter in CI, a blocking `audit` job, and changes to `ci.yml`, `.npmrc`,
  `scripts/check-release-ready.mjs` or the Trusted Publisher configuration.
- Editing `INTENT.md` or `ROADMAP.md` (followup for a doc-steward task).
