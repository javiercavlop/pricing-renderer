# Release workflow: npm CLI without a global install

## Finding

The `publish` job in `.github/workflows/release.yml` holds `id-token: write`
and ran `npm install --global npm@11.18.0`. That pulls registry code into the
OIDC job with no integrity check beyond what npm itself provides (audit
finding 1).

## Change

- The global npm install step and its risk comment are removed.
- A step `Require an OIDC-capable npm CLI` compares `npm --version` with
  `NPM_MIN_VERSION` (11.5.1, the first npm with trusted publishing) and fails
  the job with an error if the bundled npm is older.
- The job comment states that the npm CLI is the one bundled with Node.
- Nothing else changed: no job split, dist-tag mapping, guard, publish step or
  action SHAs.

## Why a version gate

Pinning another global npm would keep downloading and running registry code in
the OIDC job. Node 24.0.0 bundled npm 11.3.0, but the latest Node 24.x bundles
11.19.1, and `node-version: 24` resolves to the latest 24.x. A gate adds no
download and fails closed if that ever stops being true.

## Residual risk

The bundled npm comes from the Node distribution fetched by setup-node, which
is still trusted without a separate check. `node-version: 24` resolves to the
latest 24.x, so the npm version is not pinned and can change between releases;
the gate only guarantees the minimum.

## Check result

Check 3 runs the gate script from the workflow against a fake `npm` for
11.3.0, 11.5.0 and 10.9.9 (must fail) and 11.5.1, 11.19.1 and 12.0.0 (must
pass). Result: passed. 11.3.0, 11.5.0 and 10.9.9 exited 1 with the error
message; 11.5.1, 11.19.1 and 12.0.0 exited 0.

## Not run

The workflow itself was not run and nothing was released.
