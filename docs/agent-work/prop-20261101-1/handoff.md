Goal: Add-on marker per cell follows availableFor (UX-7).
State: S0, T1, I1 all integrated; head about to be pushed. I1 checks pass locally (unit suite 1464 tests, lint/typecheck). Browser spec unproven until PR CI.
Decisions: no flag, no public API change (addOnProvidesForPlan exported from view-model.ts only, not from core/index). Q1 not triggered (R9 counts hold).
Next: push, open PR, follow CI (browser spec expectedRows 32 assumption is the risk), review panel (low: reviewer), set_review_package, lead_ready.
Evidence: tasks 99e83e187b7249be (I1), earlier S0/T1 integrated.
