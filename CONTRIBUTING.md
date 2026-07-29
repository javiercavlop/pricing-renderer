# Contributing

The source, API, documentation, test names, and commit messages are written in
English.

1. Use Node.js 22+ and the pnpm version declared in `package.json`.
2. Create a focused branch from `main`.
3. Add tests for every behavior change.
4. Run `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and
   `pnpm package:check`.
5. Add a Changeset when public behavior or package output changes.

Core code must not import DOM, Lit, React, or the YAML parser. UI behavior belongs
in the element layer and reusable pricing semantics belong in core.

Never evaluate Pricing2Yaml expressions using `eval`, `Function`, dynamic module
loading, or global object access.
