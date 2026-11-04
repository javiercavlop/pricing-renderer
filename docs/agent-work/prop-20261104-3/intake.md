# Intake: P-20261104-3, unsafe `detail.href` in `pricing-action`

- Kind: security · Size: M · Proposal risk: medium · Owner: approved (2026-11-04).
- Owner note, quoted from the task: "Aprobada. Si al final hace falta decidir entre descartar o marcar el
  href inseguro, propón la opción más segura como recomendada." In English: "Approved. If in the end we
  must choose between dropping and flagging the unsafe href, propose the safest option as the
  recommendation."
- Base: `8ae591b`. Nothing implemented. No check was run, because this task has no registered checks and
  changes no code.

## Objective and INTENT link

The `pricing-action` detail must not hand an unsafe link to hosts. Today a plan CTA whose expanded `href`
fails `isSafeLink` is rendered as a button, but the event still carries the raw value.

- INTENT O3, "a stable public API and package across the integrations" (`INTENT.md:62`).
- A change to a public event field needs a CRP first (`INTENT.md:110-111`).
- The single next release would freeze the field's behaviour (`ROADMAP.md:169-176`), so the decision
  should come before it.

## Evidence (verified at `8ae591b`)

- E1. `src/element/cta.ts:102` expands the configured `href` into `eventHref`. `:103` keeps `href` only when
  `isSafeLink` accepts it. `:109` adds `eventHref` to every view, safe or not. The comment at `:36` says
  "safe or not, for the `pricing-action` detail".
- E2. `src/element/renderers.ts:361-362` passes `cta.eventHref` to `triggerAction`.
  `src/element/pricing-renderer-element.ts:771` puts any non-empty `href` into the detail.
- E3. The current behaviour is tested:
  - `tests/unit/cta-href.test.ts:38-42` expects `href` to be undefined and `eventHref` to be
    `//evil.example/pro%20plus%2Fx`.
  - `tests/unit/change-flow-element.test.ts:496-507` checks a safe `eventHref`. It does not check the
    unsafe `bad` case.
- E4. The type is `href?: string` (`src/element/events.ts:27`). It is re-exported from
  `pricing-renderer/react` (`src/react/index.ts:217`).
- E5. The docs:
  - `docs/events.md:124-125` only says "check it before you use it".
  - `docs/events.md:139-140` says only that an unsafe value "renders the CTA as a button".
  - `docs/api-reference.md:695-697` says the expanded value "reaches the event".
- E6. The pending changeset `.changeset/safe-link-other-host-paths.md:5` ends with "the `pricing-action`
  detail still carries the raw value".
- E7. CTAs can come from the pricing document itself. `src/core/view-model.ts:273` merges
  `getPricingRendererCustom(pricing)` into the presentation. A third-party or remote pricing can
  therefore supply `javascript:` or `//host` values.
- E8. The summary action never carries an `href`: `src/element/renderers.ts:1468` passes `undefined`.
- E9. The plan for the add-react-headless slots already uses only the safe link:
  - `data-href` is "the safe expanded link, absent for a button"
    (`openspec/changes/add-react-headless/specs/composition/spec.md:207`).
  - The React context re-checks it (`req~react-slot-href-safe~1`, `:426-427`).
  - `triggerPlanAction` dispatches "the `pricing-action` that activating that plan's built-in CTA
    dispatches" (`:268`), so it inherits whatever `planCtaView` gives.
  - `triggerPlanAction` is not in `src/` yet.
- E10. The rule "Additive only: no existing export, property, attribute, event field or part changes
  meaning" is in `openspec/changes/add-react-headless/tasks.md:15`. It binds that change. A new change
  that the owner approves through a CRP is not bound by it, but O3 and `INTENT.md:110-111` still apply.
- E11. No host code in the repository navigates on `detail.href`. A grep over `docs/`, `README.md`,
  `examples/` and `tests/` finds two uses:
  - `examples/vue/src/App.vue:39` records it for display after `preventDefault()` (`:34`);
  - `tests/browser/plan-cta.spec.ts:295` asserts a safe value.
  The docs examples build their own URL (`docs/events.md:183-195`).
- E12. The package is at `0.1.0` (`package.json:3`), and `CHANGELOG.md:3` has only 0.1.0. This intake did
  not check whether 0.1.0 already sent unsafe values in the event (no git history was read).
- E13. `req~cta-href-template-unsafe~1` and `req~cta-event-unchanged~1` are only in the unarchived change
  `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:177-209`. `openspec/specs/` has no
  `spec.md`.
- E14. `tests/unit/docs-examples.test.ts:69-74,128-131` reads the keys of `PricingActionDetail` from
  `src/element/events.ts`, and each key must appear in `docs/events.md`. A new detail field therefore
  needs a docs line in the same PR.

## Scope

- One CRP for the owner. It picks the behaviour of `detail.href` when the expanded value fails `isSafeLink`.
- One OpenSpec change (proposed id `harden-action-href`; the coordinator names it). It has a delta for the
  plan-cta capability, with one requirement for the chosen behaviour.
- One code PR with a test task and an implementer task (T/I): a failing test first, then the change, the
  docs and a changeset.

## Non-goals

- `isSafeLink` itself. Since #79 (`f3302b2`) it rejects `//host` and `/\host`. An `https://` link to another
  host stays safe (`docs/events.md:172-173`).
- Same-host enforcement, an allow-list of hosts, or rewriting values.
- The rendered link and the button fallback (`req~cta-href-template-unsafe~1`), which stay as they are.
- The summary action (E8), `docUrl` and `metadata.url` (#82).
- The add-react-headless slots and React context (E9). They already use only the safe link.
- The P-20261103-2 docs and plan notes. D1 there is still open, because `docs/events.md:124-125` is
  unchanged. See "Order".
- A release, `changeset version` or a publish (`ROADMAP.md:169-176`).

## CRP draft (for the coordinator)

- Question: if a plan CTA's expanded `href` fails `isSafeLink`, what should the `pricing-action` detail
  carry?
- Why now:
  - E1-E3: the raw value reaches every host. E7: pricing documents can supply it.
  - The single next release freezes the behaviour (`ROADMAP.md:170`).
- Options:
  - A) Omit `href` from the detail when the value is unsafe.
    - The unsafe value never reaches a host, and a host that navigates on `detail.href` without its own
      check stays safe.
    - A host that read the raw value of a button CTA gets no `href`. E11 found no such use in the
      repository; external hosts are unknown.
    - Cost S, risk low, reversible yes (before the release).
    - It changes the meaning of an existing field, so it is not additive (E10).
  - B) Keep the raw `href` and add `hrefSafe: boolean`.
    - Additive. Hosts that do not read `hrefSafe` stay exposed, as they are today.
    - Cost S-M, risk medium, reversible only by removing a public field.
    - It touches `events.ts`, `pricing-renderer-element.ts` and `renderers.ts`, which add-react-headless
      P3-11 also owns (`tasks.md:430-433`).
  - C) Omit `href` when unsafe (as in A) and add `hrefBlocked: true` in its place.
    - As safe as A. Hosts can still tell "a link was configured and rejected" from "no link".
    - It adds a public field and touches the same files as B.
    - Cost S-M, risk low-medium.
  - D) Docs only. This is P-20261103-2 D1: say "unchecked" and tell hosts to use `isSafeLink`.
    - The behaviour stays. The safety depends on every host.
    - Cost S, risk unchanged.
  - E) Do nothing.
- Recommended: A.
  - This follows the owner note's "safest option".
  - A and C are the only options in which an unsafe value never reaches a host. A also adds no public
    field, needs one source file (`src/element/cta.ts`) and touches no file of the P3-11 chain.
  - The proposal recommended B. B is additive but leaves every host that does not check exposed.
- Also ask the owner: is a value that is not exactly what was configured acceptable in a public field? Under
  A, `href` keeps its type `href?: string`, but it becomes "present only when the CTA has a safe `href`".
- Blocked meanwhile: S1 and S2 below. Continuing meanwhile: everything else, including P-20261103-2 D1
  (see Order).

## Slices

Each slice has one capability and is well under 300 diff lines. The size and the files below assume
option A. "Option B/C delta" lists what changes if the owner picks B or C.

### S1. Spec delta (specifier)

- Starts after the CRP answer. Model and effort: the role default. Budget: 15 turns.
- Owns `openspec/changes/<id>/proposal.md`, `design.md`, `tasks.md` and `specs/plan-cta/spec.md`.
- Read-only: this intake, `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:161-209`,
  `src/element/cta.ts:89-136`, `docs/events.md:96-178`.
- Requirement (EARS, the wording is a proposal), `req~cta-event-href-unsafe~1`: "IF the expanded `href` of
  a plan CTA fails `isSafeLink`, THEN the element SHALL dispatch its `pricing-action` detail without an
  `href` key."
- Scenario: the page of the "Plan id that looks like a script URL" scenario (`:183-186`) with a listener
  that records details. After a click on `Bad`, `'href' in detail` is `false`.
- Second scenario: `//evil.example/{planId}` gives no `href` key. `/checkout/{planId}` still gives
  `/checkout/pro%20plus%2Fx`.
- Capability placement: Q2.
- Checks: `["openspec","validate","<id>","--strict"]` (the lab provides the binary, as in
  `openspec/changes/add-react-headless/tasks.md:38-40`) and `["pnpm","run","format:check"]`.
- Expected diff: about 60-120 lines, all spec text.
- Risk: medium, score 4. Points: +3 for the security area, +3 for the public event field, -2 because it is
  spec only.

### S2. Event without an unsafe `href` (T/I pair in one PR)

- Starts after S1 is merged or approved (G1, G2). Budget: 15 turns per task.
- S2-T, test-designer, red before (G3). Owns:
  - `tests/unit/cta-href.test.ts`. `:38-42` changes to expect `eventHref` to be undefined for
    `//evil.example/{planId}`. Add a `javascript:` case and a `\x01//evil.example` case, and keep `:44-47`.
    Tag the tests `[utest->req~cta-event-href-unsafe~1]`.
  - `tests/browser/plan-cta.spec.ts:318-330`. In the "not safe renders as a button" test, record the details
    with the existing `recordActions` helper and assert no `href` key. This test is browser-only, so the CI
    `browser-shards` run verifies it, not `red(...)` (the G3 limit of
    `openspec/changes/add-react-headless/tasks.md:18-20`).
  - Red check: `["pnpm","exec","vitest","run","tests/unit/cta-href.test.ts"]`. It must fail on the base.
- S2-I, implementer, touches no test file (G4). Owns:
  - `src/element/cta.ts:36-37,101-109`. Set `eventHref` only when the expanded value is safe (equal to
    `href`), and update the doc comment at `:36`. Keep `eventHref` for the current-plan CTA, which is
    disabled and dispatches nothing (`:121-127`). Tag `[impl->req~cta-event-href-unsafe~1]`.
  - `docs/events.md:124-125,139-140`. The `href` bullet: present only when the expanded value is safe. The
    sentence at `:139-140`: "renders the CTA as a button and leaves `href` out of the detail".
  - `docs/api-reference.md:695-697`. Only a safe expanded value reaches the event.
  - `.changeset/safe-link-other-host-paths.md:5`. Remove the clause "the `pricing-action` detail still
    carries the raw value". The changeset is pending, so the CHANGELOG would otherwise contradict itself.
  - `.changeset/action-href-unsafe.md` (new, `minor`). It states the behaviour change in plain words: a host
    that read the raw value of a button CTA no longer gets it.
- Read-only: `src/element/renderers.ts:349-363`, `src/element/pricing-renderer-element.ts:752-785`,
  `src/core/view-model.ts:273,600-607`, `tests/unit/change-flow-element.test.ts:495-507`.
- Checks:
  - `["pnpm","install","--frozen-lockfile"]`
  - `["pnpm","run","typecheck"]`
  - `["pnpm","run","lint"]`
  - `["pnpm","run","test"]`
  - `["pnpm","run","format:check"]`
  - `["pnpm","run","package:check"]`
  - the red check above
  - the trace check of the lab (G6)
  - CI `browser-shards` with `plan-cta.spec.ts` green and the baselines unchanged
- Expected diff: about 70-110 lines.
  - Tests: about 40-60.
  - `cta.ts`: about 5.
  - Docs: about 10.
  - Changesets: about 10.
- Risk: high, score 8. Points: +3 for the security area (link sanitization), +3 for the public event-field
  behaviour, +2 for external input (pricing documents, E7). The higher of the contract level and the score
  wins, so the panel is the high-risk panel, with a security-auditor.
- Option B/C delta: S2-I also owns three more source files. S2-T also owns
  `tests/unit/docs-examples.test.ts` if its expectations change.
  - `src/element/events.ts:24-34` gets the new field.
  - `src/element/pricing-renderer-element.ts:752-777` and `src/element/renderers.ts:45-51,361-362` pass it.
  - Expected diff: about 120-180 lines.
  - These files are in the add-react-headless chains (`tasks.md:430-433`), so S2 is serialized against
    P3-11.

## Order and shared files

1. CRP (owner) → S1 → S2. There is no parallel slice inside this proposal.
2. `docs/events.md`:
   - P-20261103-2 D1 owns `:124-125` (`docs/agent-work/prop-20261103-2/intake.md:111`), and its sentence
     says that an unsafe value "still appears here" (`:135-138` there).
   - The add-react-headless chain P3-11 → P3-15b also edits the file (`tasks.md:445`).
   - Recommended order: D1, then S2, then P3-11. If the CRP is answered A or C before D1 merges, the
     coordinator rewords D1 change 6 to the new behaviour, or drops it and leaves `:124-125` to S2.
3. `docs/api-reference.md`: S2 comes before or after the chain B2b → B3b → U8 → P3-15b (`tasks.md:444`). It
   edits only `:695-697`.
4. `src/element/cta.ts` is in no add-react-headless shared-file list (`tasks.md:428-447`). That plan reads
   `planCtaView` for the slot attributes (`design.md:516`), so P3-11 should start from S2's head.

## Gates per slice

| Gate | S1 spec | S2 T/I |
|---|---|---|
| G1 openspec validate --strict | yes | N/A (S1 holds the spec) |
| G2 EPIC | yes | N/A |
| G3 red before | N/A | yes, `cta-href.test.ts`; browser part by CI |
| G4 frozen tests | N/A | yes, S2-I touches no test file |
| G5, G7, G10 | registry | registry |
| G6 trace | ids defined | `impl` and `utest` tags for `req~cta-event-href-unsafe~1` |
| G8 mutation | N/A, no code | yes, the `isSafeLink` branch in `cta.ts:101-109` |
| G9 dependencies | N/A | N/A, no dependency |
| G11 review | one reviewer and a security-auditor (medium) | high panel, with a security-auditor |
| G12 ui-qa | N/A | N/A, the rendered output is unchanged |
| G13 | how-to-review (spec text against E1-E3) | how-to-test: one API-style example, the recorded detail of a `javascript:` CTA, and a negative safe case |

G5, G7 and G10 are not defined in any file this intake read. The coordinator applies its own registry.

## Feature flags

None. The capability is one behaviour in one code slice, and S1 only adds spec text. A flag would keep the
unsafe value reachable, which defeats the purpose.

## Risks

- R1. An external host relied on the raw value of a button CTA. Mitigation: the changeset states the change;
  E11 found no use in the repository; there is no release before the owner says so.
- R2. `docs/events.md` collides with P-20261103-2 D1 and P3-11. Mitigation: the order above.
- R3. The spec placement is wrong because the plan-cta capability is not archived (E13). Mitigation: Q2.
- R4. Under B, hosts that ignore `hrefSafe` stay exposed. Mitigation: recommend A.

## Open questions

- Q1 (CRP, owner). The CRP draft above. Recommended: A.
- Q2 (coordinator, no CRP). Where should `req~cta-event-href-unsafe~1` live while the plan-cta capability
  exists only in `add-subscription-change-flow`?
  - Recommended: a new change with `## ADDED Requirements` in `specs/plan-cta/spec.md`, archived after
    `add-subscription-change-flow`.
  - This intake did not run `openspec validate` on that layout.
- Q3 (coordinator, no CRP). If A or C is chosen before P-20261103-2 D1 merges: reword D1 change 6, or drop it?
