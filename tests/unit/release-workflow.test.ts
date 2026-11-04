// Static guard for the audit findings in .github/workflows/release.yml and package.json: the npm
// dist-tag must reach the publish command through env, the dist-tag mapping must write `next` only
// for isPrerelease `true`, `latest` only for `false` and fail on anything else, and the unit tests
// must run once per release. Nothing here executes the workflow or the scripts; both files are only
// parsed and the shell text is analysed as text.
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
  id?: string;
  run?: string;
  env?: Record<string, string>;
}

// Removes shell comments so that a commented-out command is never counted as a command. Full-line
// comments go away, and so does a trailing `#` that follows whitespace outside quotes. Quote state
// is carried across lines, `\#` is an escape and `$#` or `${#x}` are not comments. Limit: heredocs
// and `$(...)` nesting are not modelled; a `#` after whitespace inside a heredoc body is removed.
function stripComments(script: string): string {
  let quote: '"' | "'" | null = null;
  return script
    .split('\n')
    .map((line) => {
      if (quote === null && line.trimStart().startsWith('#')) return '';
      let kept = '';
      for (let index = 0; index < line.length; index += 1) {
        const char = line.charAt(index);
        if (quote === "'") {
          if (char === "'") quote = null;
        } else if (char === '\\') {
          kept += char + line.charAt(index + 1);
          index += 1;
          continue;
        } else if (quote === '"') {
          if (char === '"') quote = null;
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === '#' && (index === 0 || /\s/u.test(line.charAt(index - 1)))) {
          break;
        }
        kept += char;
      }
      return kept.trimEnd();
    })
    .join('\n');
}

// The guard that rejects every dist tag other than latest and next, as text in a publish script.
function distTagGuard(name: string): RegExp {
  const notArmEnd = '(?:(?!;;|esac)[\\s\\S])*?';
  return new RegExp(
    `case\\s+"\\$\\{?${name}\\}?"\\s+in\\s+latest\\|next\\)\\s*;;\\s*\\*\\)${notArmEnd}\\bexit 1\\s*;;\\s*esac`,
  );
}

// One branch of a case or an if/elif/else; `selector` is null for the default branch.
interface Arm {
  selector: string | null;
  body: string;
}

interface Mapping {
  arms: Arm[];
  start: number;
  end: number;
}

function findCaseMapping(code: string, variables: Set<string>): Mapping | undefined {
  for (const match of code.matchAll(/\bcase\s+"?\$\{?(\w+)\}?"?\s+in\b([\s\S]*?)\besac\b/gu)) {
    if (!variables.has(match[1] ?? '')) continue;
    const arms = (match[2] ?? '').split(';;').flatMap((chunk): Arm[] => {
      const arm = /^\s*\(?\s*([^)]*?)\s*\)([\s\S]*)$/u.exec(chunk);
      if (!arm) return [];
      const selector = (arm[1] ?? '').replace(/^["']|["']$/gu, '');
      return [{ selector: selector === '*' ? null : selector, body: arm[2] ?? '' }];
    });
    return { arms, start: match.index, end: match.index + match[0].length };
  }
  return undefined;
}

// Limit: a nested if inside an arm ends the mapping early.
function findIfMapping(code: string, variables: Set<string>): Mapping | undefined {
  const markers = [
    ...code.matchAll(
      /\b(?:(?:if|elif)\s+\[\s+"\$\{?(\w+)\}?"\s+==?\s+"?(\w+)"?\s+\]\s*;\s*then|else|fi)\b/gu,
    ),
  ];
  const first = markers.findIndex(
    (marker) => marker[0].startsWith('if') && variables.has(marker[1] ?? ''),
  );
  if (first < 0) return undefined;
  const arms: Arm[] = [];
  let selector: string | null = markers[first]?.[2] ?? '';
  let bodyStart = (markers[first]?.index ?? 0) + (markers[first]?.[0].length ?? 0);
  for (const marker of markers.slice(first + 1)) {
    arms.push({ selector, body: code.slice(bodyStart, marker.index) });
    bodyStart = marker.index + marker[0].length;
    if (marker[0] === 'fi') {
      return { arms, start: markers[first]?.index ?? 0, end: bodyStart };
    }
    selector = marker[0] === 'else' ? null : (marker[2] ?? '');
  }
  return undefined;
}

interface DistTagWrite {
  value: string;
  toOutput: boolean;
}

function distTagWrites(text: string): DistTagWrite[] {
  return text.split('\n').flatMap((line) =>
    [...line.matchAll(/\bdist_tag=["']?(\$?\{?\w+\}?)/gu)].map((match) => ({
      value: match[1] ?? '',
      toOutput: line.includes('GITHUB_OUTPUT'),
    })),
  );
}

// Analyses the script of the step that reads isPrerelease. Returns the problems found; an empty
// list means: next is written only for the literal true, latest only for the literal false, the
// default branch has a real `exit 1` command and writes no dist_tag, and an assignment inside a
// branch reaches $GITHUB_OUTPUT only after the case or if, which the default branch never reaches.
function distTagMappingProblems(script: string): string[] {
  const code = stripComments(script);
  const readPattern = /\b(\w+)=(?:"\$\(|\$\()[^)]*\.isPrerelease/gu;
  const variables = new Set([...code.matchAll(readPattern)].map((match) => match[1] ?? ''));
  const mapping = findCaseMapping(code, variables) ?? findIfMapping(code, variables);
  if (!mapping) {
    return ['no case or if/elif/else mapping on a variable assigned from the .isPrerelease read'];
  }
  const problems: string[] = [];
  const expected: Record<string, string> = { true: 'next', false: 'latest' };
  for (const selector of ['true', 'false']) {
    if (!mapping.arms.some((arm) => arm.selector === selector)) {
      problems.push(`no branch selected by the literal ${selector}`);
    }
  }
  let assignedInArm = false;
  for (const arm of mapping.arms) {
    const writes = distTagWrites(arm.body);
    if (arm.selector === null) {
      if (writes.length > 0) problems.push('the default branch writes dist_tag');
      if (!/(?:^\s*|[;&]\s*)exit\s+1\b/mu.test(arm.body)) {
        problems.push('the default branch has no exit 1 command');
      }
      continue;
    }
    const allowed = expected[arm.selector];
    for (const write of writes) {
      if (write.value !== allowed) {
        problems.push(`the branch "${arm.selector}" writes dist_tag=${write.value}`);
      }
      if (!write.toOutput) assignedInArm = true;
    }
    if (allowed !== undefined && !writes.some((write) => write.value === allowed)) {
      problems.push(`the branch "${arm.selector}" does not write dist_tag=${allowed}`);
    }
  }
  if (mapping.arms.every((arm) => arm.selector !== null)) {
    problems.push('no default branch (* or else) that fails');
  }
  if (distTagWrites(code.slice(0, mapping.start)).length > 0) {
    problems.push('dist_tag is written before the mapping');
  }
  const after = distTagWrites(code.slice(mapping.end));
  for (const write of after) {
    if (!/^\$\{?dist_tag\}?$/u.test(write.value)) {
      problems.push(`dist_tag=${write.value} is written after the mapping`);
    }
  }
  if (assignedInArm && !after.some((write) => write.toOutput)) {
    problems.push('dist_tag is assigned in a branch but never appended to $GITHUB_OUTPUT after it');
  }
  return problems;
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
const releaseSteps = steps.filter((step) => step.id === 'release');
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
    const code = stripComments(publishRun);
    const match = distTagGuard(distTagName ?? '').exec(code);
    const publishAt = code.indexOf('npm publish');
    expect(match).not.toBeNull();
    expect((match?.index ?? Infinity) + (match?.[0].length ?? 0)).toBeLessThanOrEqual(publishAt);
  });

  // [utest->req~release-dist-tag-env~1]
  it('does not accept a guard whose exit 1 is only in a comment', () => {
    const publish = [
      'case "$DIST_TAG" in',
      '  latest|next) ;;',
      '  *)',
      '    echo "::error::Unexpected npm dist-tag: $DIST_TAG"',
      '    # exit 1',
      '    ;;',
      'esac',
      'npm publish --access public --provenance --tag "$DIST_TAG"',
    ].join('\n');
    expect(distTagGuard('DIST_TAG').test(publish)).toBe(true);
    expect(distTagGuard('DIST_TAG').test(stripComments(publish))).toBe(false);
    expect(distTagGuard('DIST_TAG').test(stripComments(publish.replace('# exit', 'exit')))).toBe(
      true,
    );
  });

  // [utest->req~release-dist-tag-prerelease-map~1]
  it('maps isPrerelease true to next and false to latest and fails on anything else', () => {
    expect(releaseSteps).toHaveLength(1);
    const problems = distTagMappingProblems(releaseSteps[0]?.run ?? '');
    expect(problems).toEqual([]);
  });

  describe('dist tag mapping analysis on fixture scripts', () => {
    const readLines = [
      'release_json="$(gh release view "$RELEASE_TAG" --json isDraft,isPrerelease,tagName)"',
      'is_prerelease="$(jq -r \'.isPrerelease\' <<<"$release_json")"',
    ];
    const failBranch = [
      '    echo "::error::Unexpected isPrerelease value: $is_prerelease"',
      '    exit 1',
    ];
    const output = ['echo "dist_tag=$dist_tag" >>"$GITHUB_OUTPUT"'];
    const next = 'dist_tag=next';
    const latest = 'dist_tag=latest';
    const direct = (tag: string): string => `echo "dist_tag=${tag}" >>"$GITHUB_OUTPUT"`;
    const caseScript = (trueArm: string, falseArm: string, other: string[], after: string[]) =>
      [
        ...readLines,
        'case "$is_prerelease" in',
        `  true) ${trueArm} ;;`,
        `  false) ${falseArm} ;;`,
        '  *)',
        ...other,
        '    ;;',
        'esac',
        ...after,
      ].join('\n');
    const ifScript = (trueArm: string, falseArm: string, other: string[], after: string[]) =>
      [
        ...readLines,
        'if [ "$is_prerelease" = "true" ]; then',
        `  ${trueArm}`,
        'elif [ "$is_prerelease" = "false" ]; then',
        `  ${falseArm}`,
        'else',
        ...other,
        'fi',
        ...after,
      ].join('\n');
    const mapped = (other: string[], after: string[]): string =>
      caseScript(next, latest, other, after);

    // [utest->req~release-dist-tag-prerelease-map~1]
    it.each([
      ['case, assignment then one output write', mapped(failBranch, output)],
      ['case, direct output writes', caseScript(direct('next'), direct('latest'), failBranch, [])],
      [
        'if/elif/else, assignment then one output write',
        ifScript(next, latest, failBranch, output),
      ],
      [
        'if/elif/else, direct output writes',
        ifScript(direct('next'), direct('latest'), failBranch, []),
      ],
      [
        'false listed first, quoted selectors and comments',
        [
          ...readLines,
          '# case "$is_prerelease" in true) dist_tag=latest ;; esac',
          'case "$is_prerelease" in',
          '  "false") dist_tag=latest ;; # stable',
          '  "true") dist_tag=next ;;',
          '  *)',
          '    echo "::error::bad # value $is_prerelease"',
          '    exit 1 # fail before publishing',
          '    ;;',
          'esac',
          ...output,
        ].join('\n'),
      ],
    ])('accepts %s', (_name, script) => {
      expect(distTagMappingProblems(script)).toEqual([]);
    });

    // [utest->req~release-dist-tag-prerelease-map~1]
    it.each([
      [
        'the base-style else writing latest',
        [
          ...readLines,
          'if [ "$(jq -r \'.isPrerelease\' <<<"$release_json")" = "true" ]; then',
          `  ${direct('next')}`,
          'else',
          `  ${direct('latest')}`,
          'fi',
        ].join('\n'),
        /no case or if\/elif\/else mapping/u,
      ],
      [
        'an if/else whose else writes latest',
        [
          ...readLines,
          'if [ "$is_prerelease" = "true" ]; then',
          `  ${direct('next')}`,
          'else',
          `  ${direct('latest')}`,
          'fi',
        ].join('\n'),
        /default branch writes dist_tag/u,
      ],
      [
        'a case whose default arm only has exit 1 in a comment',
        mapped([failBranch[0] ?? '', '    # exit 1'], output),
        /no exit 1 command/u,
      ],
      [
        'an if whose else only has exit 1 in a comment',
        ifScript(next, latest, [failBranch[0] ?? '', '  # exit 1'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm whose exit 1 is only text in an echo',
        mapped(['    echo "exit 1"'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm that assigns latest and exits',
        mapped([`    ${latest}`, '    exit 1'], output),
        /default branch writes dist_tag/u,
      ],
      [
        'a default arm that appends latest to the output',
        mapped([direct('latest'), '    exit 1'], output),
        /default branch writes dist_tag/u,
      ],
      [
        'a default arm that does not exit',
        mapped(['    echo "unexpected"'], output),
        /no exit 1 command/u,
      ],
      [
        'a case without a default arm',
        [
          ...readLines,
          'case "$is_prerelease" in',
          `  true) ${next} ;;`,
          `  false) ${latest} ;;`,
          'esac',
          ...output,
        ].join('\n'),
        /no default branch/u,
      ],
      [
        'latest written under true',
        caseScript(latest, latest, failBranch, output),
        /"true" writes dist_tag=latest/u,
      ],
      [
        'next written under false',
        caseScript(next, next, failBranch, output),
        /"false" writes dist_tag=next/u,
      ],
      [
        'swapped tags in an if/elif/else',
        ifScript(direct('latest'), direct('next'), failBranch, []),
        /"true" writes dist_tag=latest/u,
      ],
      [
        'an output write placed before the mapping',
        [...output, mapped(failBranch, [])].join('\n'),
        /written before the mapping/u,
      ],
      ['assignments never appended to the output', mapped(failBranch, []), /never appended/u],
      [
        'a latest write after the mapping',
        mapped(failBranch, [direct('latest')]),
        /dist_tag=latest is written after the mapping/u,
      ],
      [
        'a mapping on a variable that does not hold the isPrerelease read',
        mapped(failBranch, output).replace('case "$is_prerelease"', 'case "$other"'),
        /no case or if\/elif\/else mapping/u,
      ],
    ])('rejects %s', (_name, script, problem) => {
      expect(distTagMappingProblems(script).join('\n')).toMatch(problem);
    });
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
