# Handoff: prop-20261101-3 (reject `//host` and `/\host` in `isSafeLink`)

- Status: waiting on the coordinator (plan ready; Q1 and Q2 to confirm, no CRP sent). Updated: 2026-11-01.
- Branch / head: planner task `task/317c535772c14874`, base `a82cd88`. PR: none.

## Goal

`isSafeLink` stops accepting values that browsers read as another host while they look like a same-host path
(`//host`, `/\host`, also with tab, CR or LF between the leading characters). This serves INTENT O3.

## State (with evidence)

- The proposal is approved by the owner. The intake reads the approval as the choice of the hardening (Q1).
- The intake is written: `docs/agent-work/prop-20261101-3/intake.md`, with slices S0, T1, I1 and D1.
- Defect confirmed:
  - `src/core/view-model.ts:604` accepts any leading `/`;
  - `:602` trims only the ends, so `/<TAB>/host` passes too.
- The export is at `src/core/index.ts:44`. The proposal's `:32` is stale.
- The behaviour is pinned at `tests/unit/cta-href.test.ts:23` and documented at `docs/events.md:170`.
- Three call sites change together:
  - `src/element/cta.ts:103`;
  - `src/element/renderers.ts:812` (`docUrl`);
  - `src/element/renderers.ts:1534` (`metadata.url`).
  - No fixture or example uses a `//` or `/\` link.
- PR 73 (the add-react-headless spec) is merged (`09363ed`). Its change is not archived. Its
  `req~react-slot-href-safe~1` delegates to `isSafeLink` and needs no text change.
- Browser parsing per the WHATWG URL Standard (lookup, medium confidence, https://url.spec.whatwg.org/#url-parsing):
  - tab, CR and LF are removed everywhere;
  - `\` acts as `/` for special schemes.
- No code, test, spec or acceptance file was changed.

## Decisions

- Four slices: spec (S0), tests (T1), code (I1) and docs (D1). Reason: one capability, but
  `docs/events.md` is shared with the add-react-headless chain, so its edit is separate and can be serialized.
- T1, I1 and D1 land in one PR. Reason: T1 is red by design, and the docs must not contradict the code in
  develop.
- The tab, CR and LF removal applies only to the new two-leading-slash test. Reason: then no value that is
  rejected today becomes accepted.
- The `pricing-action` detail keeps the raw `href` (`cta.ts:109`). Reason: it is out of the proposal's scope,
  and today's behaviour for `javascript:` is the same.
- No feature flag. Reason: one behaviour slice, and a compatibility option would be a new public API (Q3).
- I1 risk is medium (score 5). It is high (8) if link validation counts as a security risk area. The panel
  includes the security-auditor either way.

## Ruled out

- Editing `src/core/index.ts` or adding `isSameOriginPath`. These are proposal alternatives that the approval
  set aside (Q1).
- Removing tab, CR and LF before every check. That would accept values such as `ht<TAB>tps://x`, which are
  rejected today.
- Editing the add-react-headless notes in this change. Its lead owns them (Q4).

## Open questions and risks

- Q1: does the approval choose the hardening? Assumed yes. A CRP with four options goes out only if not.
- Q2: changeset bump. Recommended: `minor`, as in `.changeset/current-selection-plan-cta.md:2`, for a named
  behaviour change. The coordinator or owner decides.
- Q3: a `//host` escape hatch. Recommended: no. A CRP goes out only if the owner wants one.
- Q4: stale notes after the merge. Who updates them is the coordinator's decision:
  - `openspec/changes/add-react-headless/tasks.md:385-386,482-488`;
  - `docs/agent-work/phase3-react-headless/handoff.md:14`.
- Risk: hosts that use protocol-relative links lose them. The changeset names `https://` as the replacement.
- Risk: `docs/events.md` is shared with P3-11 → P3-15b. Serialize D1.
- G5, G7 and G10 are not defined in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator confirms Q1 and Q2 and creates task contracts from the intake's slices. It also confirms
   that `pnpm exec openspec` is available for G1 and that no in-flight task owns `tests/unit/cta-href.test.ts`,
   `src/core/view-model.ts` or `docs/events.md`.
2. A specifier runs S0 (`openspec/changes/safe-link-same-host-paths`), then G1 and G2.
3. A test-designer runs T1 with the red-before check on `cta-href.test.ts`. Then I1 (medium panel with the
   security-auditor) and D1 land in the same PR.

## Evidence

- Files read:
  - `src/core/view-model.ts:585-614`, `src/core/index.ts`, `src/core/config.ts:15-44`;
  - `src/element/cta.ts:85-114`, `src/element/renderers.ts:805-819,1528-1542`;
  - `tests/unit/cta-href.test.ts`, `tests/unit/change-flow-element.test.ts:488-517`,
    `tests/browser/plan-cta.spec.ts:310-349`;
  - `docs/events.md:155-184`, `docs/api-reference.md:90-109`;
  - `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:155-194`,
    `openspec/changes/add-react-headless/specs/composition/spec.md:410-444`,
    `openspec/changes/add-react-headless/tasks.md:375-494`;
  - `docs/agent-work/phase3-react-headless/handoff.md`, `package.json:1-3,125-153`.
- Lookup: the WHATWG URL Standard answer, sources https://url.spec.whatwg.org/ and
  https://url.spec.whatwg.org/#url-parsing.
- Checks: none registered for this task, and none run.
