# ADR 0002: Release trust model and supply-chain gates

- Status: accepted for now; the split of the publish job is open to the owner
- Date: 2026-11-04
- Deciders: the change lead and the coordinator for items (b) and (c). For item (a) the
  coordinator chose to defer the split in this PR. The owner has NOT decided it: a proposal
  is being raised for the owner.
- Change: PR 90 (CI health)

## Context and problem statement

The audit (`docs/audit-report.md`, findings 1 and 2) found two weaknesses in the release
and CI supply chain:

- The single `publish` job in `.github/workflows/release.yml` holds `id-token: write`
  and also runs install, unit tests and browser tests beside the OIDC token. Any
  dependency or test code that runs in that job can request the token.
- The previous `release.yml` installed a global npm from the registry inside that same
  job, so registry code ran next to the OIDC token before anything was published.

Separately, the CI `audit` job did not block, so a high advisory could pass unnoticed.

## Decision (a): publish job layout

Considered options:

- Keep one `publish` job (kept for now).
- Split into an unprivileged `verify` job (`contents: read`, no `id-token`) and a minimal
  `publish` job that publishes a packed tarball (deferred).

Decision: the single job is kept. The split is deferred and described in
`docs/agent-work/ci-health/release-split-deferred.md`.

Consequences:

- The remaining OIDC exposure is accepted for now.
- Revisit when the owner approves the split or a real release becomes possible.
- The split would need changes to `tests/unit/release-workflow.test.ts` and to the
  openspec release-workflow requirements.

## Decision (b): npm CLI source

Considered options:

- A pinned global npm install (rejected: it pulls registry code into the OIDC job).
- `npm pack` of npm with an SRI hash check (rejected: more machinery).
- The npm bundled with Node plus a fail-closed minimum-version gate (chosen).

Decision: `actions/setup-node` with `node-version: 24` and a gate in `release.yml`
(`NPM_MIN_VERSION: 11.5.1`) that fails the job when the bundled npm is older.

Consequences:

- npm is not pinned. `node-version: 24` and the runner tool cache decide the Node build:
  the runner may use a cached Node 24.x, not necessarily the newest. The npm version can
  therefore change between releases, and the gate only guarantees the minimum.
- The gate has no static test yet. This is a follow-up for the owner of
  `tests/unit/release-workflow.test.ts`.

## Decision (c): blocking audit

Considered options:

- Keep the `audit` job advisory (`continue-on-error`).
- Make it blocking and remedy findings in a fixed order (chosen).

Decision: the CI `audit` job (`pnpm audit --audit-level high`) is blocking, with no
`continue-on-error`. Remedies, in order:

1. A dependency update.
2. A documented pnpm override.
3. As a last resort, and only with owner approval, a single GHSA waiver in
   `pnpm.auditConfig.ignoreGhsas`, with a follow-up id and a review date recorded in
   `docs/audit-report.md`.

Consequences:

- The result depends on the live advisory database, so a new advisory can fail unrelated
  PRs.
- The scoped override of typescript under `@arethetypeswrong/core` in `package.json`
  `pnpm.overrides` is a documented override of this kind: typescript 5.6.3 replaces the
  `5.6.1-rc` pin that the latest attw (0.18.5) still carries. It is removed when attw
  ships a stable pin.

## Open questions (not decided here)

- ARC-004: is `audit` a required status check in branch protection? This is not visible
  from the repository; the comments in `ci.yml` call only `browsers` required. For the
  owner.
- Should a scheduled audit run exist, so that a new advisory shows up apart from unrelated
  PRs? For the owner.
