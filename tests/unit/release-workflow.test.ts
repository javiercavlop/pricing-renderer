// Static guard for two audit findings in .github/workflows/release.yml and package.json: the npm
// dist-tag must reach the publish command through env, and the unit tests must run once per release.
// Nothing here executes the workflow or the scripts; both files are only parsed.
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
const publishStep = steps.find((step) => step.run?.includes('npm publish'));
const publishRun = publishStep?.run ?? '';

describe('release workflow', () => {
  // [utest->req~release-dist-tag-env~1]
  it('has no expression interpolated into a run script', () => {
    const offenders = steps.filter((step) => step.run?.includes('${{')).map((step) => step.run);
    expect(offenders).toEqual([]);
  });

  // [utest->req~release-dist-tag-env~1]
  it('passes the dist tag to npm publish through an env variable', () => {
    expect(publishStep).toBeDefined();
    const entry = Object.entries(publishStep?.env ?? {}).find(
      ([, value]) => value === '${{ steps.release.outputs.dist_tag }}',
    );
    expect(entry).toBeDefined();
    const name = entry?.[0] ?? '';
    expect(publishRun).toMatch(new RegExp(`--tag\\s+"?\\$\\{?${name}\\}?"?(\\s|$)`));
    expect(publishRun).not.toContain('steps.release');
  });

  // [utest->req~release-dist-tag-env~1]
  it('rejects any dist tag other than latest and next before publishing', () => {
    const publishAt = publishRun.indexOf('npm publish');
    const guardAt = publishRun.search(/latest\|next\)|\[\s[^\]]*\b(latest|next)\b[^\]]*\]/);
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(guardAt).toBeLessThan(publishAt);
    expect(publishRun.slice(0, publishAt)).toContain('exit 1');
  });

  // [utest->req~release-single-unit-test-run~1]
  it('runs the unit tests once, in the workflow and not in prepublishOnly', () => {
    expect(scripts.prepublishOnly ?? '').not.toContain('pnpm test');
    if (scripts.prepublishOnly !== undefined) {
      expect(scripts.prepublishOnly).toContain('pnpm package:check');
    }
    const unitTestSteps = steps.filter((step) => step.run?.trim() === 'pnpm test');
    expect(unitTestSteps).toHaveLength(1);
  });

  // [utest->req~release-check-substrings-kept~1]
  it('keeps what scripts/check-release-ready.mjs requires and forbids', () => {
    const checker = read('scripts/check-release-ready.mjs');
    const list = /const requiredWorkflowContent = \[([^\]]*)\]/u.exec(checker)?.[1] ?? '';
    const required = [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1] ?? '');
    expect(required).toHaveLength(5);
    for (const content of required) {
      expect(workflowText).toContain(content);
    }
    for (const forbidden of ['secrets.', 'NPM_TOKEN', 'NODE_AUTH_TOKEN']) {
      expect(workflowText).not.toContain(forbidden);
    }
  });
});
