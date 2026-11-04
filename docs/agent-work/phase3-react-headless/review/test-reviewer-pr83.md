# Test reviewer, PR 83, round 1

Verdict: approve.

## Findings

- R1-TST-001 (minor): the falsy `variablesEnabled` table lacked `false`. Fixed: added.
- R1-TST-002 (minor): no element-level deselect test for the dependsOn chain. Fixed: added.
- R1-TST-003 (nit): none needed.
- R1-TST-004 (nit): no test for an id of exactly 64 units ending in a high surrogate. Done: added, passing against the current code.
- R1-TST-005 (nit): left as a nit.
- R1-TST-006 (nit): left as a nit.
