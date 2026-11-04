# Scoped TypeScript override for attw

## Why the RC was in the lockfile

`@arethetypeswrong/core@0.18.5` declares the exact dependency `typescript: 5.6.1-rc`. attw pairs it with
`ts-expose-internals` pinned to the same version, because it uses TypeScript internals. So
`pnpm-lock.yaml` resolved `typescript@5.6.1-rc`, a pre-release compiler. The project's own compiler is
`typescript@5.9.3` and is not affected.

## Change

`package.json` `pnpm.overrides` gets one scoped entry:

```json
"@arethetypeswrong/core>typescript": "5.6.3"
```

5.6.3 is the highest stable release of the 5.6 minor that attw is built against, so it is the lowest-risk
replacement. The lockfile changes are limited to: the new override line, `typescript@5.6.3` replacing
`typescript@5.6.1-rc` (package and snapshot entries), and the `typescript` line of the attw core snapshot.

## Alternatives rejected

- Global `typescript` override: would change the project compiler and affect every other package.
- Upgrading attw: `@arethetypeswrong/core` 0.18.5 is the latest version (dist-tags: `latest` = 0.18.5) and
  still pins `5.6.1-rc`. There is nothing newer to move to.
- Stable 5.9.x scoped override: only a fallback if the 5.6.x override broke `pnpm package:check`.

## Notes on how it was produced

- The registry facts (5.6.3 is the highest stable 5.6.x, its integrity hash, attw latest and its pin) came
  from a registry lookup, not from a local `pnpm view`. The lookup was marked medium confidence for "highest
  5.6.x" because the full package listing was too large to fetch.
- The task session had no shell, so `pnpm install --lockfile-only` could not be run and `pnpm --version`
  could not be read. The lockfile was edited by hand to the shape pnpm writes; the frozen install check
  below confirms pnpm accepts it. The repo's `packageManager` is `pnpm@10.19.0`.

## Checks

All run through the QA gate, all passed:

- `pnpm install --frozen-lockfile`: passed. The gate reported pnpm v9.15.9, not the repo's 10.19.0, so a
  frozen install under 10.19.0 should be confirmed in CI.
- `pnpm package:check` (build, publint, attw): passed, with the 5.6.3 override.
- `pnpm typecheck`: passed.
- `pnpm exec vitest run tests/unit/release-workflow.test.ts`: 68 tests passed.
- `pnpm exec prettier --check package.json docs/agent-work/ci-health`: passed.
- `grep -n '5.6.1-rc' pnpm-lock.yaml`: no matches.
