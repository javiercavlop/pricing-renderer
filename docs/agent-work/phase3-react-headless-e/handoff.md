## State

- PR 91 (feat/react-headless-e). Local head a774035 = 073a77c + c49ed490 (hydration spec of current behaviour, probe removed) + d4e2c153 (docs limitation in react.md/nextjs.md/architecture.md, openspec open item, examples/next /pricing uses next/dynamic ssr:false).
- Coordinator option C: wrapper fix is a separate change 'wrapper SSR hydration fix'. P3-13 React example is pending (react-router changes pnpm-lock.yaml; owned by ci-health-audit-ts-release; CRP-P3-D (a): exact pin, audit, licence report).

## Facts

- define before/after x hydrate update/task: 1 recoverable hydration error, host replaced, final DOM complete (chromium, firefox, webkit). before/sync: 0 errors, host kept. after/sync not observed (expected 0, spec asserts 0; CI will confirm; correct the spec and docs if different).
- Cause: Lit renders light DOM before React hydrates the empty server tag. Fix in src/react.

## Next

1. Push, wait for green CI (browser specs; after/sync may need correction).
2. Panel round 2: reviewer plus test-reviewer, security-auditor (examples/next changed).
3. set_review_package, lead_ready; summary lists P3-13 pending and followup 'wrapper SSR hydration fix' with the facts.
