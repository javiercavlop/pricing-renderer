# Pricing2Yaml compatibility

## Version policy

| Input                  | Behavior                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| Pricing2Yaml 3.1       | Fully normalized, validated, resolved, and rendered                 |
| Another 3.x            | Compatible subset rendered with a warning; unknown fields preserved |
| Non-3.x major          | Blocking diagnostic and recoverable error UI                        |
| Explicit adapter match | Adapter runs first, then the converted 3.x value is validated       |

The project targets the
[Pricing2Yaml 3.1 specification](https://sphere-docs.vercel.app/docs/2.0.1/api/pricing-description-languages/Pricing2Yaml/versions/pricing2yaml-v31-specification).
Pricing4TS-compatible objects are accepted structurally, but an already resolved
object may no longer contain the formulas required for interactive variable
controls. In that case the renderer displays resolved values and emits a
diagnostic rather than presenting a non-functional control.

## Rendered information

The normalized/rendered subset covers:

- metadata: SaaS name, syntax/version, creation date, URL, tags, currency;
- billing periods and explicit multipliers;
- primitive variables and explicitly configured array/object controls;
- plans, privacy, description, prices, units, features, and usage limits;
- feature descriptions, tags, types/subtypes, defaults, documentation links,
  integrations, automation, expressions, and render flags;
- usage-limit units, periods, tracking, linked features, defaults, and render
  flags;
- add-on availability, dependencies, exclusions, features, usage-limit values,
  usage-limit extensions, units, and subscription constraints;
- fixed, textual, and expression-based prices;
- unknown `custom` content preserved for host extensions.

Catalog mode exposes additional technical metadata. Commercial mode focuses on
decision-making content while retaining a detailed comparison and add-ons.

## Expression subset

Supported:

- `#variable` references;
- number, string, boolean, null, array, and object literals;
- `+`, `-`, `*`, `/`, `%`, exponentiation;
- comparisons and equality;
- logical operators and ternaries;
- safe array/object property access;
- allow-listed `Math` functions;
- `concat`;
- explicitly supplied extension functions.

Blocked:

- `eval`, `Function`, globals, imports, assignment, updates;
- prototype, constructor, or arbitrary method access;
- calls not present in the built-in or host allow-list;
- excessive source length, AST depth, or complexity.

Expressions resolve variables first. Billing multiplier is applied second and
add-on quantity third.

## Value semantics

- `0` and `false` remain meaningful values.
- YAML `.inf` is preserved where the schema permits it and usage limits render
  as the localized `Unlimited` label (`Ilimitado` in the bundled Spanish
  catalog).
- No billing duration is inferred from a free-form label.
- A textual or failed price contributes no invented numeric amount.
- Numeric known portions remain visible and `requiresQuote` is true.
- Add-on feature/limit effects are not multiplied unless the source language
  defines that semantic.

## Diagnostics

Diagnostics contain a stable `code`, `severity`, English source `message`,
optional YAML `path`, and optional serializable `details`. Applications should
branch on `code`, not on message text.

Important version codes:

- `PR_VERSION_INVALID`
- `PR_VERSION_UNSUPPORTED_MAJOR`
- `PR_VERSION_BEST_EFFORT`
- `PR_VERSION_ADAPTED`
- `PR_VERSION_ADAPTER_FAILED`

Parser and remote-loader codes are documented through tests and the generated
declarations.

## Adding compatibility

Do not silently reinterpret unknown semantics. Start with an explicit adapter,
fixtures from the relevant specification, and warnings for partial support.
Promote a version to built-in support only after parsing, calculation, browser,
accessibility, and documentation coverage are complete.
