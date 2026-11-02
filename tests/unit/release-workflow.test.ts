// Static guard for two audit findings in .github/workflows/release.yml and package.json: the npm
// dist-tag must reach the publish command through env, and the unit tests must run once per release.
// Nothing here executes the workflow or the scripts; both files are only parsed.
// Not covered here: the behavioural dist-tag scenarios (design D7 allows static checks only) and
// the `node scripts/check-release-ready.mjs v0.1.0` scenario, which runs as a separate check.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

interface Step {
  run?: string;
  env?: Record<string, string>;
}

const workflowText = read('.github/workflows/release.yml');
const steps: Step[] = (parse(workflowText) as { jobs: { publish: { steps: Step[] } } }).jobs.publish
  .steps;
const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
const publishSteps = steps.filter((step) =>
  step.run?.includes('npm publish --access public --provenance'),
);
const publishStep = publishSteps[0];
const publishRun = publishStep?.run ?? '';
const distTagValue = '${{ steps.release.outputs.dist_tag }}';
const distTagName = Object.entries(publishStep?.env ?? {}).find(
  ([, value]) => value === distTagValue,
)?.[0];

describe('release workflow', () => {
  // [utest->req~release-dist-tag-env~1]
  it('has no expression interpolated into a run script', () => {
    const offenders = steps.filter((step) => step.run?.includes('${{')).map((step) => step.run);
    expect(offenders).toEqual([]);
  });

  // [utest->req~release-dist-tag-env~1]
  it('passes the dist tag to npm publish through an env variable', () => {
    expect(publishSteps).toHaveLength(1);
    expect(distTagName).toMatch(/^[A-Z_][A-Z0-9_]*$/);
    expect(publishRun).toMatch(
      new RegExp(
        `npm publish --access public --provenance --tag "(\\$${distTagName}|\\$\\{${distTagName}\\})"(\\s|$)`,
      ),
    );
    expect(publishRun).not.toContain('steps.release');
  });

  // [utest->req~release-dist-tag-env~1]
  it('rejects any dist tag other than latest and next before publishing', () => {
    expect(distTagName).toBeDefined();
    const notArmEnd = '(?:(?!;;|esac)[\\s\\S])*?';
    const guard = new RegExp(
      `case\\s+"\\$\\{?${distTagName}\\}?"\\s+in\\s+latest\\|next\\)\\s*;;\\s*\\*\\)${notArmEnd}\\bexit 1\\s*;;\\s*esac`,
    );
    const match = guard.exec(publishRun);
    const publishAt = publishRun.indexOf('npm publish');
    expect(match).not.toBeNull();
    expect((match?.index ?? Infinity) + (match?.[0].length ?? 0)).toBeLessThanOrEqual(publishAt);
  });

  // [utest->req~release-single-unit-test-run~1]
  it('runs the unit tests once, in the workflow and not in prepublishOnly', () => {
    expect(scripts.prepublishOnly).toBe('pnpm package:check');
    const commandLines = steps.flatMap((step) =>
      (step.run ?? '').split('\n').map((line) => line.trim()),
    );
    expect(commandLines.filter((line) => line === 'pnpm test')).toHaveLength(1);
    expect(commandLines).toContain('pnpm test:browser');
  });

  // [utest->req~release-check-substrings-kept~1]
  it('keeps what scripts/check-release-ready.mjs requires and forbids', () => {
    const checker = read('scripts/check-release-ready.mjs');
    const list = /const requiredWorkflowContent = \[([^\]]*)\]/u.exec(checker)?.[1] ?? '';
    const required = [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1] ?? '');
    const expected = [
      'release:',
      'workflow_call:',
      'id-token: write',
      'gh release view "$RELEASE_TAG"',
      'npm publish --access public --provenance',
    ];
    for (const content of expected) {
      expect(workflowText).toContain(content);
      expect(required).toContain(content);
    }
    for (const forbidden of [/\bsecrets\./, /\bNPM_TOKEN\b/, /\bNODE_AUTH_TOKEN\b/]) {
      expect(workflowText).not.toMatch(forbidden);
    }
  });
});
