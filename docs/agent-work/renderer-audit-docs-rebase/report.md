# Audit documentation reconciliation

Reconciles the points of PR #31 with `develop` at 3bf8d20. The PR diff was not
available, so each point was compared with the current files. Nothing was run
for this task.

None of the points was already covered by `develop`.

- **`docs/audit-report.md`, corrected scope statement: applied.** Added a
  "Scope" section and replaced "workflows were out of scope".
- **Audit job and grouped Dependabot configuration: applied.** New "CI and
  Dependabot configuration" section, checked against `ci.yml` and
  `dependabot.yml`.
- **Clean audit marked as not verified: applied.** Stated as reported but
  **not verified**; no audit was run.
- **Global npm install kept open, only the other risk accepted: applied.**
  Item 1 stays open. Item 2 (whole pipeline in the publishing job) is the
  accepted one, per the comment in `release.yml`. Items 3 and 4 were re-checked
  against `release.yml` and `package.json` and are still open.
- **What the dependency update changed: applied, partly left open.** Current
  versions and overrides are listed from the package files and lockfile. The
  versions before the update and the reason for each override are **not
  verified**, because the repository files do not record them.
- **`renderer-ci-hardening/report.md` marked historical: applied.** Historical
  note, Dependabot note and a "Later changes" section; original content kept.
- **`THIRD_PARTY_NOTICES.md`, repeated license line: applied.** One MIT
  statement kept, with the license text and the copyright note.

No workflow, code or configuration file was changed.
