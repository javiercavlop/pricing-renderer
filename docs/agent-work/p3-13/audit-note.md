# Audit note: react-router in examples/react (P3-13)

Date: 2026-11-04.

## Dependency

- Package: `react-router`, pinned to the exact version `7.18.5` in `examples/react/package.json`
  (no range), by owner decision CRP-P3-D a.
- Why this line: 7.18.5 is at or above the patched versions 7.18.0 (GHSA-chx6-hx7r-mcp5,
  GHSA-337j-9hxr-rhxg, GHSA-wrjc-x8rr-h8h6) and 7.18.2 (GHSA-qwww-vcr4-c8h2) of the July 2026
  advisories. Only the declarative (library)
  mode is used: `BrowserRouter`, `Routes`, `Route`, `Link`, `useSearchParams`, `useNavigate`. No
  data router, no framework or server-rendering mode.
- Licence: MIT (`pnpm --filter pricing-renderer-react-demo licenses list --prod`).
- Peers: `react >=18` (the example uses 19.2.8); `react-dom` optional. Node `>=20`.
- Scope: a dependency of the private example only. The published package does not depend on it.

## Transitive packages added to the lockfile

`pnpm --filter pricing-renderer-react-demo list --prod --depth 3` shows two direct dependencies of
`react-router` that were not in the lockfile before:

| Package             | Version | Licence |
| ------------------- | ------- | ------- |
| `cookie`            | 1.1.1   | MIT     |
| `set-cookie-parser` | 2.7.3   | MIT     |

The importer `examples/react` in `pnpm-lock.yaml` also gained `@types/node` `^24.1.0` (a
devDependency used by `vite.config.ts` under `tsc --noEmit`, the same range as `examples/next`), which
already resolved to 24.13.3 in the lockfile.

## Audit

Command: `pnpm audit --audit-level high`

Result (summary lines of the check output; exit code 0):

```text
2 vulnerabilities found
Severity: 2 moderate
```

No high or critical advisory. The check output does not name the two moderate advisories, so this
note does not attribute them to any package; the worker could not run a plain `pnpm audit`.

## Not verified

The browser smoke was NOT run by the worker (no shell). The CTA link and the review flow are
verified by typecheck (`tsc --noEmit`), the example build and lint only, not in a browser.
