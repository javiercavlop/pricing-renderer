# CI health plan

- Item 1, blocking audit (this task). The `audit` job in `ci.yml` no longer has
  `continue-on-error`. See `audit-job.md`.
- Item 2, TypeScript RC replaced by the scoped pnpm override
  `@arethetypeswrong/core>typescript` 5.6.3. Done, see `typescript-override.md`.
- Item 3a, `release.yml`: drop the global `npm install --global npm@11.18.0` from
  the job that holds `id-token: write`. Replace it with a fail-closed version
  gate: npm >= 11.5.1. Node 24.0.0 bundles npm 11.3.0, the latest 24.x bundles
  11.19.1, and trusted publishing needs >= 11.5.1.
- Item 3b, split `release.yml` into an unprivileged verify job and a minimal
  publish job that publishes a packed tarball. This needs
  `tests/unit/release-workflow.test.ts` changed: it reads `jobs.publish.steps`
  and requires `pnpm test` once and `pnpm test:browser` there. Pending a scope
  decision.
- Final step: update `docs/audit-report.md`.

## Constraints

- The release workflow is changed but never run.
- No release, version or publish.
- Pushing `.github/workflows` needs a broker token with Workflows: write.
- No changeset is needed for CI-only changes.
- No `src/**` or `tests/**` edits.
- `ROADMAP.md` is untouched.
