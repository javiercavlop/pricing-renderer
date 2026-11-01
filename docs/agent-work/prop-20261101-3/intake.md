# Intake: P-20261101-3, reject `//host` and `/\host` in `isSafeLink`

- Origin: proposal P-20261101-3 (kind security, size S, risk medium), approved by the owner. The proposal calls
  the hardening "an open owner decision". This intake reads the approval as the owner's answer that picks the
  proposed first slice over the three alternatives. The coordinator confirms that reading (Q1). Planner
  intake, 2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/317c535772c14874`. Every `file:line` below is at this base.
- INTENT link: O3, "a stable public API and package across the integrations" (`INTENT.md`, section "O3").
- No release: the code slice adds one pending changeset. Nobody versions or publishes.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, the regex accepts any leading `/`. **R.** `src/core/view-model.ts:600-605`:
  - `:602` lower-cases the value and calls `String.prototype.trim()`, which removes leading and trailing tab,
    CR and LF only. It does not remove them from inside the value.
  - `:603` blocks four schemes.
  - `:604` is the allowlist `/^(?:https?:|mailto:|\/|\.\/|\.\.\/|#)/`. Any value whose first character is
    `/` passes, so `//evil.example`, `/\evil.example` and `/<TAB>/evil.example` all return `true`.
- E2, exported from `src/core/index.ts:32`. **P.** It is exported, but the line is `src/core/index.ts:44`.
  Lines `:39-47` re-export named members of `view-model.ts`. `docs/api-reference.md:101` lists it as "Validate
  a renderable link scheme".
- E3, a test pins the behaviour. **R.** `tests/unit/cta-href.test.ts:17-28` expects `'//evil.example'` (`:23`)
  to be accepted. It is tagged `[utest->req~cta-href-template-unsafe~1]` (`:16`). The test name says "also
  //host". `/\host` and the tab, CR and LF variants have no case.
- E4, `docs/events.md:170` documents it. **R.** "a value starting with `/` (this includes `//host` URLs)".
- E5, open followups. **R** for the files in this repository:
  - `docs/agent-work/phase3-react-headless/handoff.md:14`;
  - `openspec/changes/add-react-headless/tasks.md:482-488`, which names `/\host` and the missing removal of tab,
    CR and LF;
  - the link notes at `tasks.md:384-387,400-401,408-410`.
  - The task ids 8f2ca6c3, d629f0eb and 93f6efac do not appear in any file this intake read. They are not
    verified.
- E6, browser behaviour. **R** by the WHATWG URL Standard ("URL parsing", https://url.spec.whatwg.org/#url-parsing).
  An external lookup answered with medium confidence:
  - The basic URL parser removes every ASCII tab or newline from the input. It also strips leading and trailing
    C0 controls and spaces.
  - For special schemes, `\` acts like `/` in the relative and relative-slash states. So `/\evil.example`
    resolves to the host `evil.example` against an http(s) base. The lookup inferred this from the parser
    steps; the spec has no literal example of it.
- E7, not in the proposal: three call sites, not just the CTA. If `isSafeLink` gets stricter, all three change:
  - plan CTA links: `src/element/cta.ts:102-103`;
  - comparison-row `docUrl`, from the pricing YAML: `src/element/renderers.ts:812`;
  - `metadata.url`, from the pricing YAML: `src/element/renderers.ts:1534`.
  - The two YAML links open in a new tab (`target="_blank"`). No fixture or example uses a `//` or `/\` link:
    a grep of `(docUrl|url|href)\s*:\s*['"]?/[/\\]` outside `node_modules` returned 0 matches.
- E8, not in the proposal: the unsafe value still reaches the event. `cta.ts:109` puts `eventHref` (the
  expanded, unchecked value) into the `pricing-action` detail, even when `href` is dropped. After the fix, a
  `//evil.example` CTA renders as a button, but `detail.href` is still `//evil.example`. That is today's
  behaviour for `javascript:` too. It stays out of scope (non-goals).
- E9, prior art. `src/core/config.ts:24-35` already rejects a `pricingPath` that starts with `//`.
- E10, spec location. `req~cta-href-template-unsafe~1` lives only in the unarchived change
  `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:177-186`. `openspec/specs/` has no
  `spec.md`. The React requirement `req~react-slot-href-safe~1`
  (`openspec/changes/add-react-headless/specs/composition/spec.md:424-441`) delegates to `isSafeLink`. It
  picks up the fix without a text change.

## Objective

A value that `isSafeLink` accepts because it starts with `/` names a path on the current host. Browsers read
`//host` and `/\host` as another host, also when tab, CR or LF characters sit between those leading
characters, so `isSafeLink` returns `false` for them. Absolute `http:` and `https:` links to other hosts stay
accepted on purpose.

## Scope

- A new OpenSpec change (proposed id `safe-link-same-host-paths`) with one ADDED requirement on `isSafeLink`.
- `isSafeLink` (`src/core/view-model.ts:600-605`): remove every U+0009, U+000A and U+000D from a copy of the
  trimmed, lower-cased value. Return `false` when that copy starts with two characters that are each `/` or
  `\`. The scheme blocklist and the allowlist still test the value as today (`:602-604`). So no value that is
  rejected today becomes accepted.
- Tests: the `//evil.example` case moves from accepted to rejected, red first, and the new variants are added.
- `docs/events.md:169-171`: the "(this includes `//host` URLs)" wording changes.
- One changeset that names the behaviour change.

## Non-goals

- The `pricing-action` detail `href` (E8). Hosts that navigate with `detail.href` still check it themselves.
  If that should change, it needs its own proposal.
- Absolute `http(s)://other.host` links. They stay accepted (proposal caveat).
- A separate `isSameOriginPath` export, or an option that restores `//host` (the alternatives the approval
  set aside; see Q1 and Q3).
- Editing `openspec/changes/add-react-headless/**` or `openspec/changes/add-subscription-change-flow/**`.
  Their leads own them (Q4).
- Stripping leading C0 controls other than tab, CR and LF. A value such as `\x01//host` already fails the
  allowlist at `:604`.

## Slices

Order: S0, then T1, then I1 and D1. T1 is red by design, so it never merges into develop alone. T1, I1 and D1
land together in the change's PR into develop. Owned files are disjoint across slices.

### S0. Spec delta (specifier)

- Owns: `openspec/changes/safe-link-same-host-paths/**` (proposal.md, design.md, tasks.md,
  `specs/safe-link/spec.md`).
- Read-only: `src/core/view-model.ts:600-605`, `src/element/cta.ts:89-112`,
  `src/element/renderers.ts:805-817,1529-1542`,
  `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:161-186`, this intake.
- Requirements (EARS, proposed ids):
  - `req~safe-link-other-host-path~1`. IF a value, after `trim()`, lower-casing and the removal of every
    U+0009, U+000A and U+000D, starts with two characters that are each `/` or `\`, THEN `isSafeLink` SHALL
    return `false`.
    - Scenarios: `//evil.example`, `/\evil.example`, `\/evil.example`, `\\evil.example`,
      `/<TAB>/evil.example`, `/<LF>/evil.example`, `/<CR>\evil.example`, `  //evil.example`. All return `false`.
  - `req~safe-link-allowed~1`. WHERE no rejection rule applies, `isSafeLink` SHALL return `true` exactly for
    values that start with `http:`, `https:`, `mailto:`, a single `/` not followed by `/` or `\`, `./`, `../`
    or `#`.
    - Scenarios: the current accept list without `//evil.example`, plus `/checkout//x` and `/a\b`.
  - design.md records:
    - the three call sites (E7);
    - the unchanged event detail (E8);
    - why the removal of tab, CR and LF applies only to the two-leading-slash test (no widening).
- Checks: G1 `["pnpm", "exec", "openspec", "validate", "safe-link-same-host-paths", "--strict"]`. `openspec`
  is not a `package.json` script (`package.json:130-148`), so the coordinator confirms that the CLI is
  available.
- Expected diff: about 70-100 lines of docs.
- Risk low (docs only, score 0). Budget 20 turns.

### T1. Red-first tests (test-designer)

- Depends on: S0 (requirement ids).
- Owns: `tests/unit/cta-href.test.ts`.
- Read-only: the S0 delta, `src/core/view-model.ts`, `src/element/cta.ts`,
  `tests/unit/change-flow-element.test.ts:495-507` (the `viewModelOf`/`planOf` pattern to copy).
- Cases:
  1. Amend `:17-30`. Remove `'//evil.example'` from the accepted list and retitle the test without "also
     //host". Add `/checkout//x`. Tag `[utest->req~safe-link-allowed~1]` next to the existing tag.
  2. New, red. Every S0 rejection scenario returns `false`. Tag `[utest->req~safe-link-other-host-path~1]`.
  3. New, red, element level. A plan CTA with `href: '//evil.example/{planId}'` gives `planCtaView(...).href`
     `undefined`, and `eventHref` stays `//evil.example/<plan>` (E8 kept). Tag both new ids and
     `req~cta-href-template-unsafe~1`. It builds the view model in this file, so T1 owns one file only.
  4. Keep `:33-45` as they are.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/cta-href.test.ts"]`.
  - Red before (G3): the same argv, `type: red_before`, `expect_exit: [1]`, `expect_pattern: "AssertionError"`,
    `overlay: ["tests/unit/cta-href.test.ts"]`. Cases 2 and 3 must fail on the base.
  - `["pnpm", "exec", "prettier", "--check", "tests/unit/cta-href.test.ts"]`.
  - `["pnpm", "run", "lint"]`, `["pnpm", "run", "typecheck"]`.
- Expected diff: about 40-70 lines in tests.
- Risk low (tests only, score 0). Budget 25 turns.

### I1. Reject other-host paths in `isSafeLink` (implementer)

- Depends on: S0 and T1 frozen (G4).
- Owns:
  - `src/core/view-model.ts`, limited to `isSafeLink` at `:600-605`;
  - `.changeset/safe-link-other-host-paths.md`.
- Read-only: `tests/unit/cta-href.test.ts`, `src/core/index.ts` (no change: the export stays as it is).
- Change:
  - Inside `isSafeLink`, after the blocklist line, add
    `if (/^[/\\]{2}/.test(normalized.replace(/[\t\n\r]/g, ''))) return false;`.
  - Add `// [impl->req~safe-link-other-host-path~1] [impl->req~safe-link-allowed~1]`.
  - No other line changes.
- Changeset: the bump level is Q2. The text is in user terms: "`isSafeLink`, and so plan CTA links, row
  documentation links and the metadata URL, now reject values that start with `//` or `/\` (also with tab or
  newline characters between them). Browsers read them as links to another host. Use an absolute `https://`
  URL instead. Such a CTA now renders as a button. The `pricing-action` detail still carries the value."
- Expected diff: about 3-5 code lines plus the changeset.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/cta-href.test.ts"]`
  - `["pnpm", "run", "test"]`, `["pnpm", "run", "typecheck"]`, `["pnpm", "run", "lint"]`
  - `["pnpm", "exec", "prettier", "--check", "src/core/view-model.ts", ".changeset/safe-link-other-host-paths.md"]`
  - CI browser shards on the PR. `tests/browser/plan-cta.spec.ts:318-330` must stay green; it tests a
    `javascript:` value only.
- Risk **medium**. Score 5:
  - a change in the documented behaviour of an exported function: +3;
  - external input, because `docUrl` and `metadata.url` come from pricing documents: +2;
  - one module, under 200 lines, no dependency, no concurrency.
  - If the coordinator counts link validation as a security risk area (+3), the score is 8 (high) and the high
    panel applies.
  - The medium panel must include the security-auditor, as the proposal's kind is security.
- Budget 20 turns.

### D1. Events guide wording (doc-steward)

- Depends on: S0. Lands with I1.
- Owns: `docs/events.md`, limited to `:169-174`.
- Change: replace "a value starting with `/` (this includes `//host` URLs)" with "a value starting with a
  single `/` (a path on the same host; `//host` and `/\host` are not safe)". Add one sentence: an absolute
  `https://` link to another host is still safe, and a host that needs same-host links checks the `href`
  itself.
- `docs/api-reference.md:101` ("Validate a renderable link scheme") stays correct, so D1 does not touch it.
- Shared file: `docs/events.md` is in the add-react-headless chain "P3-11 → P3-15b"
  (`openspec/changes/add-react-headless/tasks.md:445`). The coordinator serializes D1 with that chain.
- Checks: `["pnpm", "exec", "prettier", "--check", "docs/events.md"]`. The `docs` check of the
  add-react-headless plan (`tasks.md:411,420`) applies if the registry has it.
- Expected diff: about 4-8 lines.
- Risk low (docs only, score 0). Budget 10 turns.

## Gates per slice

| Gate | S0 | T1 | I1 | D1 |
|---|---|---|---|---|
| G1 openspec validate --strict | yes | - | re-run if the delta changes | - |
| G2 EPIC | yes | - | - | - |
| G3 red before | - | yes (`cta-href.test.ts`) | - | - |
| G4 frozen tests | - | - | T1 | - |
| G5, G7, G10 | registry | registry | registry | registry |
| G6 trace | ids | utest | impl | - |
| G8 mutation | - | - | if registered (the regex is a good mutation target) | - |
| G9 dependencies | N/A | N/A | N/A (no new dependency) | N/A |
| G11 review | one reviewer | test-reviewer | medium panel with security-auditor (high if score 8) | one reviewer |
| G12 ui-qa | N/A | N/A | N/A (no visual change for documents without such links; no baseline change) | N/A |
| G13 | how-to-review | - | how-to-test (see below) | how-to-review |

"Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies its own
registry.

I1 how-to-test for G13: in the demo, set `presentation.ctas` to
`[{ id: 'x', label: 'Go', planId: <a plan>, href: '//example.org/{planId}' }]`. That plan's CTA is a `BUTTON`
with no `href`. With `href: '/checkout/{planId}'` it is an `A`. A `pricing-action` listener still sees
`detail.href`.

## Feature flags

None. There is one behaviour slice (I1), complete by itself. S0 and D1 are docs, and T1 lands with I1. A flag
or option that restores `//host` would be a new public option, and Q3 recommends against it.

## Risks

- R1. A host or pricing that relies on protocol-relative links loses them. Its CTAs render as buttons, and its
  doc or metadata links disappear.
  - No fixture or example in this repository uses one (E7).
  - Mitigation: the changeset names the change and the replacement (`https://`).
- R2. `docs/events.md` is shared with the add-react-headless chain (P3-11 → P3-15b). Mitigation: the
  coordinator serializes D1.
- R3. The add-react-headless notes go stale after the merge:
  - `tasks.md:385-386`, "(a protocol-relative `//host` value is accepted today)";
  - `tasks.md:482-488`, the followup;
  - `docs/agent-work/phase3-react-headless/handoff.md:14`.
  - "May point to another host" stays true, because `https://other.host` is still accepted.
  - Mitigation: Q4.
- R4. Hosts still get the raw value in `pricing-action` `detail.href` (E8). Mitigation: D1 says a host that
  needs same-host links checks the value. A followup proposal can decide whether the detail should drop
  unsafe values.
- R5. `/<TAB>/host` is handled only for the two-leading-slash test. Other parts of the value keep today's
  checks, so nothing that is rejected today becomes accepted. `ht<TAB>tps://x` stays rejected, as today. It
  is not worth a wider change.

## Open questions

- Q1 (coordinator; a CRP only if the reading is wrong). Does the owner's approval of P-20261101-3 choose the
  hardening over the three alternatives (document only, a separate `isSameOriginPath`, do nothing)? This
  intake assumes yes. If not, send a CRP with those four options. Recommended: harden, as planned here.
- Q2 (coordinator; a CRP if the owner wants to decide it). The changeset bump. The package is `0.1.0`
  (`package.json:3`). `.changeset/current-selection-plan-cta.md:2` used `minor` for a change that included a
  named "Behavior change".
  - Recommended: `minor`, because this changes documented behaviour of an exported function.
  - `patch` is possible if the project treats it as a security fix.
- Q3 (CRP only if the owner wants an escape hatch). An option to keep accepting `//host` for hosts that rely
  on it. Recommended: no. `https://host` covers the same need, and an option is a new public API (O3).
- Q4 (coordinator, no CRP). Who updates the add-react-headless notes (R3)?
  - If PR 73's change is still open, its lead updates `tasks.md:385-386,482-488` after I1 merges.
  - If it has been archived, a doc-steward followup does it.
  - This intake does not own those files.
