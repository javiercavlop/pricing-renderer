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
// comments go away, and so does a trailing `#` that follows whitespace or one of `;&|()` outside
// quotes. Quote state is carried across lines, `\#` is an escape and `$#` or `${#x}` are not
// comments. Limit: heredocs and `$(...)` nesting are not modelled; a `#` after whitespace inside a
// heredoc body is removed.
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
        } else if (char === '#' && (index === 0 || /[\s;&|()]/u.test(line.charAt(index - 1)))) {
          break;
        }
        kept += char;
      }
      return kept.trimEnd();
    })
    .join('\n');
}

// Text without its quoted strings, so that words inside a message are never read as commands.
function blankQuoted(text: string): string {
  return text.replace(/"(?:\\[\s\S]|[^"\\])*"|'[^']*'/gu, '""');
}

// An `exit 1` that starts a command (line start or after `;`), in text without quoted strings.
const exitCommand = /(?:^|;)\s*exit\s+1\b/mu;
// Syntax that makes a command conditional or nested: a compound-command keyword or `{` at the
// start of a command, or a line that ends in `&&` or `|` (the next line then depends on it).
const conditionalSyntax =
  /(?:^|[;&|(])\s*(?:\{|(?:if|then|elif|else|fi|case|esac|while|until|for|do|done)\b)|(?:&&|\|)[ \t]*$/mu;

// The guard that rejects every dist tag other than latest and next, in a publish script whose
// comments are already removed. Returns the match, or null when the script has no such case or the
// `*)` arm lacks an unconditional `exit 1` command (a word in a message or a conditional exit does
// not count).
function distTagGuard(name: string, code: string): RegExpExecArray | null {
  const notArmEnd = '(?:(?!;;|esac)[\\s\\S])*';
  const match = new RegExp(
    `case\\s+"\\$\\{?${name}\\}?"\\s+in\\s+latest\\|next\\)\\s*;;\\s*\\*\\)(${notArmEnd});;\\s*esac`,
  ).exec(code);
  const arm = blankQuoted(match?.[1] ?? '');
  return match && exitCommand.test(arm) && !conditionalSyntax.test(arm) ? match : null;
}

// One branch of a case or an if/elif/else; `selector` is null for the default branch.
interface Arm {
  selector: string | null;
  body: string;
}

interface Mapping {
  variable: string;
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
    return {
      variable: match[1] ?? '',
      arms,
      start: match.index,
      end: match.index + match[0].length,
    };
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
      return {
        variable: markers[first]?.[1] ?? '',
        arms,
        start: markers[first]?.index ?? 0,
        end: bodyStart,
      };
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
    [...line.matchAll(/\bdist_tag=["']?([^\s"';&|]*)/gu)].map((match) => ({
      value: match[1] ?? '',
      toOutput: line.includes('GITHUB_OUTPUT'),
    })),
  );
}

// The filter argument of an .isPrerelease read: the quoted string that holds `.isPrerelease`, or
// the bare word.
function isPrereleaseFilter(read: string): string {
  const quoted =
    /'([^']*\.isPrerelease[^']*)'/u.exec(read) ?? /"([^"]*\.isPrerelease[^"]*)"/u.exec(read);
  return (quoted?.[1] ?? /[^\s)"'<]*\.isPrerelease[^\s)"'<]*/u.exec(read)?.[0] ?? '').trim();
}

// Analyses the script of the step that reads isPrerelease. Returns the problems found; an empty
// list means: the read filter is exactly `.isPrerelease` with no default and the variable is not
// reassigned before the mapping, next is written only for the literal true, latest only for the
// literal false, the default branch echoes an ::error:: annotation, has an unconditional real
// `exit 1` command (not after `if`, `then`, `&&`, `||`, and not inside a nested if or case) and
// writes no dist_tag, and an assignment inside a branch reaches $GITHUB_OUTPUT only after the case
// or if, which the default branch never reaches.
// Limit: text matching, not a shell parser. Not recognised, so a script using them fails with
// "no case or if/elif/else mapping" or a branch problem: the words else/fi inside messages in the
// if form, `[[ ]]`, `then` on its own line, `!=` conditions, an arm that sets another variable
// before the output, `printf` writes and `|| exit 1`. The conditional exit check looks for
// keywords and a trailing `&&` or `|` after quoted strings are blanked; a jq filter that holds a
// quote, or an exit hidden behind a function or an eval, is not modelled.
function distTagMappingProblems(script: string): string[] {
  const code = stripComments(script);
  const readPattern = /\b(\w+)=(?:"\$\(|\$\()(?:\\\n|[^\n])*?\.isPrerelease(?:\\\n|[^\n])*/gu;
  const reads = [...code.matchAll(readPattern)];
  const variables = new Set(reads.map((match) => match[1] ?? ''));
  const mapping = findCaseMapping(code, variables) ?? findIfMapping(code, variables);
  if (!mapping) {
    return [
      'no case or if/elif/else mapping on a variable assigned from the .isPrerelease read ' +
        '(extend distTagMappingProblems or switch to a behavioural test, design D3/R2)',
    ];
  }
  const problems: string[] = [];
  if (reads.some((read) => /\/\/|\|\|/u.test(read[0]))) {
    problems.push('the .isPrerelease read supplies a fallback value (// or ||)');
  }
  if (reads.some((read) => isPrereleaseFilter(read[0]) !== '.isPrerelease')) {
    problems.push('the jq filter of the .isPrerelease read is not exactly .isPrerelease');
  }
  let lastRead: (typeof reads)[number] | undefined;
  for (const read of reads) {
    if (read[1] === mapping.variable && read.index + read[0].length <= mapping.start) {
      lastRead = read;
    }
  }
  if (lastRead) {
    const between = code.slice(lastRead.index + lastRead[0].length, mapping.start);
    const reassigned = new RegExp(
      `(?:^|[\\s;&|(])${mapping.variable}=|\\$\\{${mapping.variable}:?[-=]`,
      'mu',
    );
    if (reassigned.test(between)) {
      problems.push('the variable is reassigned or defaulted between the read and the mapping');
    }
  }
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
      if (!/\becho\s+["']?::error::/u.test(arm.body)) {
        problems.push('the default branch has no ::error:: annotation');
      }
      const armCommands = blankQuoted(arm.body);
      if (!exitCommand.test(armCommands)) {
        problems.push('the default branch has no exit 1 command');
      } else if (conditionalSyntax.test(armCommands)) {
        problems.push('the default branch has a conditional or nested exit 1');
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
  it('has no expression interpolated into a run script', () => {
    const offenders = steps.filter((step) => step.run?.includes('${{')).map((step) => step.run);
    expect(offenders).toEqual([]);
  });

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

  it('rejects any dist tag other than latest and next before publishing', () => {
    expect(distTagName).toBeDefined();
    const code = stripComments(publishRun);
    const match = distTagGuard(distTagName ?? '', code);
    const publishAt = code.indexOf('npm publish');
    expect(match).not.toBeNull();
    expect((match?.index ?? Infinity) + (match?.[0].length ?? 0)).toBeLessThanOrEqual(publishAt);
  });

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
    expect(distTagGuard('DIST_TAG', stripComments(publish))).toBeNull();
    const uncommented = stripComments(publish.replace('# exit', 'exit'));
    expect(distTagGuard('DIST_TAG', uncommented)).not.toBeNull();
  });

  it('does not accept a guard whose exit 1 is a comment right after a semicolon', () => {
    const publish = [
      'case "$DIST_TAG" in',
      '  latest|next) ;;',
      '  *)',
      '    echo "::error::bad";# exit 1',
      '    ;;',
      'esac',
      'npm publish --access public --provenance --tag "$DIST_TAG"',
    ].join('\n');
    expect(distTagGuard('DIST_TAG', stripComments(publish))).toBeNull();
  });

  it('does not accept a guard whose exit 1 follows a semicolon inside a trailing comment', () => {
    const publish = [
      'case "$DIST_TAG" in',
      '  latest|next) ;;',
      '  *)',
      '    echo "::error::bad" # note; exit 1',
      '    ;;',
      'esac',
      'npm publish --access public --provenance --tag "$DIST_TAG"',
    ].join('\n');
    expect(distTagGuard('DIST_TAG', publish)).not.toBeNull();
    expect(distTagGuard('DIST_TAG', stripComments(publish))).toBeNull();
  });

  it.each([
    ['an exit command after a semicolon', '*) echo bad; exit 1 ;;', true],
    ['an exit command on its own line', '*)\n    echo bad\n    exit 1\n    ;;', true],
    ['exit 1 only as words of a command', '*) echo bad exit 1 ;;', false],
    ['exit 1 only inside a quoted message', '*) echo "bad; exit 1" ;;', false],
    ['an exit 1 behind &&', '*) [ -n "$DIST_TAG" ] && exit 1 ;;', false],
    ['an exit 1 behind ||', '*) [ -z "$DIST_TAG" ] || exit 1 ;;', false],
    [
      'an exit 1 after && at the end of a line',
      '*)\n    [ -n "$DIST_TAG" ] &&\n    exit 1\n    ;;',
      false,
    ],
    ['an exit 1 inside an if', '*)\n    if [ -n "$DIST_TAG" ]; then exit 1; fi\n    ;;', false],
    [
      'an exit 1 inside a multi-line if',
      '*)\n    if [ -n "$DIST_TAG" ]\n    then\n      exit 1\n    fi\n    ;;',
      false,
    ],
  ])('distTagGuard on a guard with %s', (_name, arm, accepted) => {
    const publish = [
      'case "$DIST_TAG" in',
      '  latest|next) ;;',
      `  ${arm}`,
      'esac',
      'npm publish --access public --provenance --tag "$DIST_TAG"',
    ].join('\n');
    expect(distTagGuard('DIST_TAG', stripComments(publish)) !== null).toBe(accepted);
  });

  it.each([
    ['a # inside double quotes', 'echo "a # b"; exit 1', 'echo "a # b"; exit 1'],
    ['$# and ${#x} and an escaped #', 'echo $# ${#x} a\\#b', 'echo $# ${#x} a\\#b'],
    ['a comment after whitespace', 'x # exit 1', 'x'],
    ['a quote closed on a later line', 'echo "a\nb # c" # d', 'echo "a\nb # c"'],
    ['a comment right after a semicolon', 'foo;# exit 1', 'foo;'],
    ['a comment right after a pipe and an ampersand', 'a|# b\nc&&# d', 'a|\nc&&'],
  ])('stripComments keeps %s as expected', (_name, input, expected) => {
    expect(stripComments(input)).toBe(expected);
  });

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
    const errorLine = '    echo "::error::Unexpected isPrerelease value: $is_prerelease"';
    const exitLine = '    exit 1';
    const failBranch = [errorLine, exitLine];
    const withRead = (script: string, read: string): string =>
      script.replace(readLines[1] ?? '', () => read);
    const output = ['echo "dist_tag=$dist_tag" >>"$GITHUB_OUTPUT"'];
    const next = 'dist_tag=next';
    const latest = 'dist_tag=latest';
    const direct = (tag: string): string => `echo "dist_tag=${tag}" >>"$GITHUB_OUTPUT"`;
    const caseScript = (
      trueArm: string,
      falseArm: string,
      other: string[],
      after: string[],
      between: string[] = [],
    ) =>
      [
        ...readLines,
        ...between,
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
    const mapped = (other: string[], after: string[], between: string[] = []): string =>
      caseScript(next, latest, other, after, between);
    const caseArms = (arms: string[]): string =>
      [
        ...readLines,
        'case "$is_prerelease" in',
        ...arms,
        '  *)',
        ...failBranch,
        '    ;;',
        'esac',
        ...output,
      ].join('\n');

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
        mapped([errorLine, '    # exit 1'], output),
        /no exit 1 command/u,
      ],
      [
        'an if whose else only has exit 1 in a comment',
        ifScript(next, latest, [errorLine, '  # exit 1'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm whose exit 1 is only inside a quoted message',
        mapped([errorLine, '    echo "failed; exit 1"'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm whose exit 1 is conditional',
        mapped([errorLine, '    [ -n "$is_prerelease" ] && exit 1'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm without an ::error:: annotation',
        mapped([exitLine], output),
        /no ::error:: annotation/u,
      ],
      [
        'a default arm that writes an empty dist_tag to the output',
        mapped([errorLine, '    echo "dist_tag=" >>"$GITHUB_OUTPUT"', exitLine], output),
        /default branch writes dist_tag/u,
      ],
      [
        'a default arm that writes dist_tag through a command substitution',
        mapped([errorLine, '    echo "dist_tag=$(printf latest)"', exitLine], output),
        /default branch writes dist_tag/u,
      ],
      [
        'a read with a jq alternative operator',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r \'.isPrerelease // false\' <<<"$release_json")"',
        ),
        /fallback value/u,
      ],
      [
        'a read with an || fallback',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r \'.isPrerelease\' <<<"$release_json" || echo false)"',
        ),
        /fallback value/u,
      ],
      [
        'a ${var:-} default between the read and the mapping',
        mapped(failBranch, output, ['is_prerelease="${is_prerelease:-false}"']),
        /reassigned or defaulted/u,
      ],
      [
        'a := default between the read and the mapping',
        mapped(failBranch, output, [': "${is_prerelease:=false}"']),
        /reassigned or defaulted/u,
      ],
      [
        'a reassignment between the read and the mapping',
        mapped(failBranch, output, ['is_prerelease=false']),
        /reassigned or defaulted/u,
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
        'a case with only a true arm',
        caseArms([`  true) ${next} ;;`]),
        /no branch selected by the literal false/u,
      ],
      [
        'a case with only a false arm',
        caseArms([`  false) ${latest} ;;`]),
        /no branch selected by the literal true/u,
      ],
      [
        'a true arm that writes nothing',
        caseArms(['  true) : ;;', `  false) ${latest} ;;`]),
        /does not write dist_tag=next/u,
      ],
      [
        'a false arm that writes nothing',
        caseArms([`  true) ${next} ;;`, '  false) : ;;']),
        /does not write dist_tag=latest/u,
      ],
      [
        'one arm for true|false that writes next',
        caseArms([`  true|false) ${next} ;;`]),
        /no branch selected/u,
      ],
      [
        'a read filter that compares with true',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r \'.isPrerelease == true\' <<<"$release_json")"',
        ),
        /not exactly \.isPrerelease/u,
      ],
      [
        'a read filter with if ... then',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r \'if .isPrerelease then "true" else "false" end\' <<<"$release_json")"',
        ),
        /not exactly \.isPrerelease/u,
      ],
      [
        'a read filter with and true',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r \'.isPrerelease and true\' <<<"$release_json")"',
        ),
        /not exactly \.isPrerelease/u,
      ],
      [
        'a read filter in double quotes that is not exact',
        withRead(
          mapped(failBranch, output),
          'is_prerelease="$(jq -r ".isPrerelease == true" <<<"$release_json")"',
        ),
        /not exactly \.isPrerelease/u,
      ],
      [
        'a default arm whose exit 1 is after then on the same line',
        mapped([errorLine, '    if [ -n "$is_prerelease" ]; then exit 1; fi'], output),
        /no exit 1 command/u,
      ],
      [
        'a default arm whose exit 1 is inside a multi-line if',
        mapped(
          [errorLine, '    if [ -n "$is_prerelease" ]', '    then', '      exit 1', '    fi'],
          output,
        ),
        /conditional or nested/u,
      ],
      [
        'a default arm whose exit 1 is after && at the end of a line',
        mapped([errorLine, '    [ -n "$is_prerelease" ] &&', '      exit 1'], output),
        /conditional or nested/u,
      ],
      [
        'a default arm whose exit 1 is after || at the end of a line',
        mapped([errorLine, '    [ -z "$is_prerelease" ] ||', '      exit 1'], output),
        /conditional or nested/u,
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

  it('runs the unit tests once, in the workflow and not in prepublishOnly', () => {
    expect(scripts.prepublishOnly).toBe('pnpm package:check');
    const commandLines = steps.flatMap((step) =>
      (step.run ?? '').split('\n').map((line) => line.trim()),
    );
    expect(commandLines.filter((line) => line === 'pnpm test')).toHaveLength(1);
    expect(commandLines).toContain('pnpm test:browser');
  });

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
