## State

- PR 91 (feat/react-headless-e) open, head 71ea21e before this checkpoint. Panel round 1: reviewer changes-requested (0 blocker, 3 major, 6 minor, 2 nit), test-reviewer approve (4 minor followups), security-auditor approve (3 minor, 3 nit).
- CI on 71ea21e: format:check failed on this handoff file; fixed by running prettier on the agent-work files in the next task.

## Round 1 majors

- R1-REV-001: docs must say a relative src gets no provider headers or credentials (the origin filter needs an absolute URL; the loader needs one too).
- R1-REV-002: docs/react.md says hydration cannot mismatch. The reviewer suspects a mismatch when the element is defined and Lit has rendered before hydration. To be tested in a browser spec first.
- R1-REV-003: format:check.

## Decisions

- P3-13 React example is NOT in this PR (coordinator option C): react-router changes pnpm-lock.yaml, owned by ci-health-audit-ts-release. Own change after that merge; owner decision CRP-P3-D (a): react-router exact pin in examples/react, pnpm audit and licence report recorded.
- Redirect wording, one text for both docs: fetch drops Authorization on a cross-origin redirect but keeps other custom headers (WHATWG Fetch HTTP-redirect fetch, via lookup, medium confidence).
- No changeset: docs, private examples and tests only.

## Risks

- If the hydration mismatch is real, it is a library or integration defect (element light DOM rendered before React hydrates). Then decide: document the limit and the safe ordering, or escalate for a src change (outside this PR's intent).

## Next

1. Integrate the fix tasks, push, wait for green CI.
2. Panel round 2 on the new head.
3. set_review_package, lead_ready; summary lists P3-13 pending.
