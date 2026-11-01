# Intake: P-20261031-3, archive the merged OpenSpec changes into `openspec/specs/`

- Origin: proposal P-20261031-3 (kind maintenance, size M, risk low), approved by the owner. Planner
  intake, 2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/7f44e976adbd4210`. Every `file:line` below is at this
  base.
- INTENT link: O3, "a stable public API and package across the integrations" (`INTENT.md:62`,
  `ROADMAP.md:11`).
- Nothing in `src/`, `tests/` or `package.json` changes. No changeset, no release.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, `openspec/specs/` does not exist. **R.** Glob `openspec/*` finds no file, and glob
  `openspec/**/*` finds only `openspec/changes/**`.
- E2, "PR 73 will add a fifth unarchived change". **P, stale.** `add-react-headless` is already in this
  worktree (`openspec/changes/add-react-headless/`, commit `09363ed` "Spec: add-react-headless ... (#73)").
  There are five open change folders today. `add-react-headless` is not done: 2 of 21 boxes are ticked
  (`openspec/changes/add-react-headless/tasks.md:65,69`), so it stays out of scope (non-goals).
- E3, A3 and A4 depend on the archive. **R.** `docs/agent-work/pending-phases/plan.md:516`
  ("`openspec/specs/**`: A1 first, then the deltas of A3 or A4").
- E4, task boxes. **R.** Counted with `^- \[[ x]\]`:
  - `phase1a-design-systems/tasks.md`: 11 boxes, 0 ticked (`:33-106`).
  - `variable-describedby-and-ids/tasks.md`: 4 boxes, 0 ticked (`:29,38,51,61`).
  - `enforce-load-limits/tasks.md`: 5 boxes, 1 ticked (S0 at `:29`; T1, I1, T2, I2 open at
    `:37,47,63,74`).
  - `add-subscription-change-flow/tasks.md`: 30 boxes, 30 ticked; no `- [ ]` left.
- E5, the work is merged. **R** for the code; the PR numbers are partly verified.
  - Phase 1a: all 18 files named in `plan.md:29-69` exist (glob). The requirement revisions match the
    tags, for example `req~host-dark-class~2` at `src/styles/theme.css:48` and
    `req~tokens-shadcn-overlay~2` at `src/styles/tokens-shadcn.css:12`. PR 65, commit `e68e0bc`:
    `ROADMAP.md:158`.
  - `variable-describedby-and-ids`: `[impl->req~variable-field-describedby~1]` at
    `src/element/renderers.ts:550`, `[impl->req~element-instance-ids~2]` at `renderers.ts:93` and
    `src/element/pricing-renderer-element.ts:221`, utest tags in
    `tests/unit/variable-field-describedby.test.ts:164` and `tests/unit/element-instance-ids.test.ts:145,222,302,332`,
    `tests/browser/element-instance-ids.spec.ts:6`. Changesets `.changeset/variable-field-describedby.md`
    and `.changeset/injective-instance-ids.md` exist. **No file in the repository names PR #69**; the
    number comes from the proposal only.
  - `enforce-load-limits`: `[impl->...]` at `src/yaml/load.ts:29,203`, utest tags at
    `tests/unit/load-timeout.test.ts:76`, `tests/unit/load-stream-max-bytes.test.ts:84`,
    `tests/unit/load-reload-pending.test.ts:1`. Changesets `load-stream-max-bytes.md` and
    `load-timeout-every-step.md` exist. #70 is commit `85bb102` (`plan.md:4`).
  - `add-subscription-change-flow`: PR 63, commit `2b79e45` (`ROADMAP.md:162`).
- E6, slice A1 and the followup. **R.** `plan.md:217-225` (A1) and `plan.md:598-600` (archive the
  others). N-spec is still open: `plan.md:586`.
- E7, the `openspec` CLI. **P.** It is not in `package.json` (no `openspec` in `package.json`, grep).
  One task ran `openspec validate --strict` in the lab (`docs/agent-work/phase3-react-headless/handoff.md:6`),
  but the argv and version were not recorded, and no task has run `openspec archive` yet.

## Facts the proposal does not mention

- F1. Every delta is `## ADDED Requirements` only (grep `^## ` in `openspec/changes/**/specs/**`), so
  `openspec archive` creates each living spec. Nothing is merged into an existing spec.
- F2. No capability name appears in two changes. The 13 target directories are disjoint:
  - phase1a: `design-tokens`, `state-attributes`, `react-style-prop`, `theme-files`, `density`, `docs`;
  - `variable-describedby-and-ids`: `variable-field-describedby`, `element-instance-ids`;
  - `enforce-load-limits`: `load-limits`;
  - `add-subscription-change-flow`: `selection-comparison`, `current-selection`, `change-review`,
    `space-adapter`, `plan-cta`;
  - the out-of-scope `add-react-headless` uses six more names, which collide with none of these.
- F3. The `## Purpose` placeholder. Lookup (OpenSpec `main`, `src/core/specs-apply.ts`,
  `src/core/validation/validator.ts` and `constants.ts`; confidence medium) reports:
  - Without a base spec, the archive writes `# <cap> Specification`, then `## Purpose` with a
    generated placeholder, then `## Requirements`.
  - `validate --strict` turns the warnings PURPOSE_IS_PLACEHOLDER and PURPOSE_TOO_BRIEF (under 50
    characters) into errors.
  - None of the deltas has a `## Purpose` (F1 grep).
  - So every slice must write one Purpose paragraph per new living spec after the archive, or the
    strict specs check fails.
- F4. More archive behaviour, from the same lookup:
  - The change moves to `openspec/changes/archive/YYYY-MM-DD-<id>/`, using the local date.
  - Unchecked tasks only give a warning, and `--yes` continues past it.
  - The archive fails if the target folder exists.
  - Before it writes, it validates the rebuilt spec, and on failure it changes no file.
- F5. Prettier. `format:check` is `prettier --check .` (`package.json:136`).
  - `.prettierignore:13-14` ignores `openspec/changes/add-subscription-change-flow/`. Its comment says:
    "remove this entry when the change is archived".
  - After the archive, its specs live in `openspec/specs/{5 caps}/` and in
    `openspec/changes/archive/<date>-add-subscription-change-flow/`. Prettier checks both paths unless
    `.prettierignore` changes.
  - The other three changes are not ignored today, so their text already passes prettier.
- F6. CI. `ci.yml:130` lists `openspec/*` as a docs-only path, so A1-A3 skip the browser shards. The
  root `.prettierignore` matches the `*)` branch at `ci.yml:135-136`, so A4 runs the browser shards.
  That costs CI time and is not a risk.
- F7. Path references to the moved change folders:
  - test comments: `tests/unit/change-review-i18n.test.ts:4`, `tests/browser/plan-cta.spec.ts:17`,
    `tests/browser/current-selection.spec.ts:19`, `tests/browser/change-review-data.spec.ts:16`,
    `tests/browser/change-review-ui.spec.ts:20`, `tests/browser/helpers/change-flow.ts:4`,
    `tests/browser/helpers/change-review.ts:10`;
  - `ROADMAP.md:163`, `docs/adr/0001-space-adapter-subpath.md:8` and
    `openspec/changes/add-react-headless/design.md:66`;
  - planner notes under `docs/agent-work/`.

  These are comments and prose only. No code or test reads a file under `openspec/` (grep `openspec`
  in `src/`, `tests/`, `package.json` and `.github/` finds comments and `ci.yml:130` only).
- F8. The project has no OpenFastTrace check (no `oft`, `openfasttrace` or `trace` in `package.json`
  or `.github/workflows/*.yml`). G6 is not applicable. The archive keeps every requirement id unchanged.
- F9. Spec sizes (lines), copied unchanged into `openspec/specs/`:
  - phase1a: 671;
  - `variable-describedby-and-ids`: 128;
  - `enforce-load-limits`: 156;
  - `add-subscription-change-flow`: 1576.

## Objective

Each of the four merged changes has its tasks ticked against the merged files, is archived under
`openspec/changes/archive/`, and has its requirements in living specs under `openspec/specs/`. The
specs pass `openspec validate --specs --strict`, and `format:check` stays green. The requirement
text and ids are copied unchanged.

## Scope

- Tick the open boxes of `phase1a-design-systems`, `variable-describedby-and-ids` and
  `enforce-load-limits`. Each one gets a merge note citing the commit, the tag lines or the changesets
  of E5.
- Recorded deviations, written as notes and not as edits of the task text:
  - phase1a I4 names `.changeset/density.md`, but the merged file is `.changeset/design-density.md`;
  - D1 shipped `.changeset/design-systems-docs.md`;
  - E1's "documented in `docs/design-systems.md`" now holds (`docs/design-systems.md:215`, "### Theme
    builder").
- Run `openspec archive <id> --yes` per change.
- Write one `## Purpose` paragraph (at least 50 characters) per new living spec. Take the wording
  from the change's `proposal.md` (for phase1a, `proposal.md:48-59`). It is non-normative and adds no
  SHALL.
- In A4 only, replace `.prettierignore:13-14` (F5).

## Non-goals

- `add-react-headless`: it is in progress (E2). Unticked P3-1T/P3-1I boxes after #74 belong to that
  change's lead.
- Changing, rewording or re-revisioning any requirement, including the `req~review-ui-limits~1` note
  at `add-subscription-change-flow/tasks.md:251-257`.
- Editing the accepted ADR 0001, the test comments or the ROADMAP for the moved paths (F7).
  The archived folder keeps the files, so the references stay findable (followups).
- An `openspec validate` job in CI (followup f7ae16edeef84583; a `ci.yml` change, O4).
- The backlog items of the proposal:
  - the loader error text and `src` reflection (F1/F2 of the 1b intake, which need a CRP);
  - the `add-react-headless` revision references (PR 73);
  - `isSafeLink`.

## Slices

Each slice is one PR into `develop`, with role doc-steward and **operation `archive`**. Living specs
change only in such a task. Order:

- C0, the coordinator's precondition;
- then A1;
- then A2, A3 and A4 in parallel. Their owned paths are disjoint.

A1 goes first so that the Purpose and prettier handling (F3, F5) is proven on one change before it is
repeated.

The ~300-line limit counts authored lines: ticks, notes, Purpose paragraphs and `.prettierignore`.
The copied living-spec text (F9) is generated by the CLI and is reviewed by an equivalence diff, not
line by line. `openspec archive` is atomic per change, so A4 cannot be split by capability.

Check argument arrays (C0 confirms each name and flag with `--help` against the installed version):

- `install`: `["pnpm", "install", "--frozen-lockfile"]`
- `cli`: `["pnpm", "exec", "openspec", "--version"]`
- `archive-help`: `["pnpm", "exec", "openspec", "archive", "--help"]`
- `val(<id>)`: `["pnpm", "exec", "openspec", "validate", "<id>", "--strict"]` (precedent
  `plan.md:202`)
- `arch(<id>)`: `["pnpm", "exec", "openspec", "archive", "<id>", "--yes"]`
- `specs`: `["pnpm", "exec", "openspec", "validate", "--specs", "--strict"]`
- `fmt`: `["pnpm", "run", "format:check"]`

### C0. CLI precondition (coordinator, no files)

- Register and run `cli` and `archive-help`. Record the version in A1's contract.
- If the CLI is missing, stop: see Q1. Nothing else starts.

### A1. Archive `phase1a-design-systems`

- Depends on: C0.
- Owns:
  - `openspec/changes/phase1a-design-systems/**` (ticks, then moved);
  - `openspec/changes/archive/*-phase1a-design-systems/**`;
  - `openspec/specs/{design-tokens,state-attributes,react-style-prop,theme-files,density,docs}/**`.
- Read-only: `plan.md:27-69`, `ROADMAP.md:157-158`, the files of E5.
- Steps:
  1. Tick the 11 boxes and add one merge note: PR 65, `e68e0bc`, and the deviations listed in Scope.
  2. Run `val(phase1a-design-systems)`.
  3. Run `arch(phase1a-design-systems)`.
  4. Replace the 6 Purpose placeholders.
  5. Run `specs` and `fmt`.
- Requirements: the 30 ids of the six phase1a deltas (grep `^### Requirement:`), unchanged.
- Checks: install, `val(phase1a-design-systems)`, `arch(phase1a-design-systems)`, `specs`, `fmt`.
- Expected diff: about 40 authored lines and 671 copied lines.
- Risk **low**, score 0: spec text only, no code, no public API, no external input. Budget 30
  turns.

### A2. Archive `variable-describedby-and-ids`

- Depends on: A1 merged.
- Owns:
  - `openspec/changes/variable-describedby-and-ids/**`;
  - `openspec/changes/archive/*-variable-describedby-and-ids/**`;
  - `openspec/specs/{variable-field-describedby,element-instance-ids}/**`.
- Steps: as in A1. Tick the 4 boxes. The note cites the tag lines and changesets of E5 and says that
  the PR number was not verified from the repository.
- Requirements: `req~variable-field-describedby~1` and `req~element-instance-ids~2`, unchanged.
- Checks: install, `val(variable-describedby-and-ids)`, `arch(variable-describedby-and-ids)`, `specs`,
  `fmt`.
- Expected diff: about 20 authored lines and 128 copied lines.
- Risk **low**, score 0. Budget 20 turns.

### A3. Archive `enforce-load-limits`

- Depends on: A1 merged. It runs in parallel with A2 and A4.
- Owns:
  - `openspec/changes/enforce-load-limits/**`;
  - `openspec/changes/archive/*-enforce-load-limits/**`;
  - `openspec/specs/load-limits/**`.
- Steps: as in A1. Tick T1, I1, T2 and I2. The note cites #70 (`85bb102`), the tag lines and the
  changesets of E5.
- Requirements: `req~fetch-max-bytes-while-reading~1` and `req~load-timeout-covers-every-step~1`,
  unchanged.
- Checks: install, `val(enforce-load-limits)`, `arch(enforce-load-limits)`, `specs`, `fmt`.
- Expected diff: about 20 authored lines and 156 copied lines.
- Risk **low**, score 0. Budget 20 turns.

### A4. Archive `add-subscription-change-flow`

- Depends on: A1 merged. It runs in parallel with A2 and A3.
- Owns:
  - `openspec/changes/add-subscription-change-flow/**`;
  - `openspec/changes/archive/*-add-subscription-change-flow/**`;
  - `openspec/specs/{selection-comparison,current-selection,change-review,space-adapter,plan-cta}/**`;
  - `.prettierignore`, lines 13-14 only.
- Steps:
  1. Run `val(add-subscription-change-flow)`. Its boxes are all ticked already.
  2. Run `arch(add-subscription-change-flow)`.
  3. Replace the 5 Purpose placeholders.
  4. In `.prettierignore`, replace the entry and its comment. The new entry ignores
     `openspec/changes/archive/` (archived changes are never edited) and the five living spec
     directories. The comment keeps the original reason: requirement tables and ids are validated by
     openspec, not reformatted.
  5. Run `specs` and `fmt`.
- Requirements: the 113 ids of the five deltas, unchanged.
- Checks: install, `val(add-subscription-change-flow)`, `arch(add-subscription-change-flow)`, `specs`,
  `fmt`.
- CI runs the browser shards (F6). They are expected to stay green, because no rendered file changes.
- Expected diff: about 20 authored lines and 1576 copied lines.
- Risk **low**, score 0. The only non-spec file is `.prettierignore`, and the check covers it. Budget
  30 turns.

## Gates per slice

| Gate | C0 | A1 | A2 | A3 | A4 |
|---|---|---|---|---|---|
| G1 openspec validate --strict | - | change before, specs after | same | same | same |
| G2 EPIC | - | N/A: accepted text, unchanged | N/A | N/A | N/A |
| G3 red before | - | N/A, no test | N/A | N/A | N/A |
| G4 frozen tests | - | N/A | N/A | N/A | N/A |
| G5, G7, G10 | registry | registry | registry | registry | registry |
| G6 trace | - | N/A: no OFT check (F8); ids unchanged | N/A | N/A | N/A |
| G8 mutation | - | N/A | N/A | N/A | N/A |
| G9 dependencies | - | N/A: no new dependency (unless Q1 b) | N/A | N/A | N/A |
| G11 review | - | one reviewer | one reviewer | one reviewer | one reviewer |
| G12 ui-qa | - | N/A | N/A | N/A | N/A |
| G13 | - | how-to-review | how-to-review | how-to-review | how-to-review |

- "Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies
  its own registry.
- What the G11 reviewer checks:
  - for each capability, the `### Requirement:` blocks in `openspec/specs/<cap>/spec.md` equal those
    in `openspec/changes/archive/<date>-<id>/specs/<cap>/spec.md`;
  - every tick has a merge note;
  - the Purpose adds no SHALL.
- The G13 how-to-review gives the equivalence command, run per capability:
  `diff <(sed -n '/^### Requirement:/,$p' openspec/specs/<cap>/spec.md) <(sed -n '/^### Requirement:/,$p' openspec/changes/archive/<date>-<id>/specs/<cap>/spec.md)`.
  Its output is expected to be empty.

## Feature flags

None. No behaviour changes, and each slice is complete by itself.

## Risks

- R1. The installed CLI may differ from the behaviour in F3/F4, which comes from `main` (confidence
  medium). Mitigations:
  - `archive-help` in C0;
  - A1 goes first;
  - per F4, a failed archive changes no file.
- R2. The archive's output may not match prettier (blank lines, wrapping), so `fmt` fails.
  - Mitigation for A1-A3: register `["pnpm", "exec", "prettier", "--write", <owned living spec paths>]`
    and rerun `fmt`. Only whitespace may change; the reviewer checks the equivalence diff with `-w`.
  - Mitigation for A4: the ignore entry of F5.
- R3. A Purpose paragraph could add an obligation without review. Mitigations: it is one descriptive
  paragraph, worded from `proposal.md`, and G11 rejects a SHALL in it.
- R4. Archive date folders. Two slices archived on the same local date never collide, because the
  folder names differ by change id.
- R5. Readers follow stale paths (F7). The files keep their names inside the archive folder. The
  followups fix the references.
- R6. Another in-flight task may edit one of these change folders. None is expected: the changes are
  merged and only `add-react-headless` is active. Mitigation: the coordinator checks the open task
  contracts before each slice.

## Open questions

- Q1 (coordinator; a CRP only if the CLI is missing). Is `openspec` available in the lab, and which
  version? It is N-spec at `plan.md:586`.
  - (a) Available: go. **Expected**, given `phase3-react-headless/handoff.md:6`.
  - (b) Missing: an owner CRP to add `@fission-ai/openspec` as a pinned devDependency through the
    lockfile check (O4, supply chain).
  - (c) Missing: archive by hand with no G1. **Not recommended.**
- Q2 (coordinator, no CRP). Keep the phase1a capability name `docs` in the living tree.
  **Recommended: keep.** A rename would change the accepted change. The name is generic, so a later
  docs capability should pick a specific name.
- Q3 (coordinator, no CRP). A2-A4 in parallel or in sequence after A1. **Recommended: parallel**,
  because the paths are disjoint (F2).
- No question needs an owner CRP unless Q1 resolves to (b).
