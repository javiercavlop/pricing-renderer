import { readFile } from 'node:fs/promises';

const requestedTag = process.argv.slice(2).find((argument) => argument !== '--');

if (!requestedTag) {
  throw new Error('Pass the immutable release tag, for example: pnpm release:check -- v0.1.0');
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const readme = await readFile('README.md', 'utf8');
const releaseWorkflow = await readFile('.github/workflows/release.yml', 'utf8');
const expectedTag = `v${packageJson.version}`;

const failures = [];

if (packageJson.name !== 'pricing-renderer') {
  failures.push('package.json must keep the public package name pricing-renderer');
}

if (requestedTag !== expectedTag) {
  failures.push(`release tag ${requestedTag} does not match ${expectedTag}`);
}

const forbiddenReadmeMarkers = [
  'npm-pending%20demo%20approval',
  '**Pre-release status:**',
  '**Not published yet:**',
];

for (const marker of forbiddenReadmeMarkers) {
  if (readme.includes(marker)) {
    failures.push(`README still contains pre-release marker: ${marker}`);
  }
}

const requiredReadmeContent = [
  'actions/workflows/release.yml/badge.svg',
  'https://img.shields.io/npm/v/pricing-renderer.svg?logo=npm',
  'npm install pricing-renderer',
  `npm install pricing-renderer@${packageJson.version}`,
  'https://www.npmjs.com/package/pricing-renderer',
  `https://github.com/javiercavlop/pricing-renderer/releases/tag/${expectedTag}`,
];

for (const content of requiredReadmeContent) {
  if (!readme.includes(content)) {
    failures.push(`README is missing release information: ${content}`);
  }
}

const requiredWorkflowContent = [
  'release:',
  'workflow_call:',
  'id-token: write',
  'gh release view "$RELEASE_TAG"',
  'npm publish --access public --provenance',
];

for (const content of requiredWorkflowContent) {
  if (!releaseWorkflow.includes(content)) {
    failures.push(`release workflow is missing required OIDC/CD behavior: ${content}`);
  }
}

const forbiddenWorkflowPatterns = [
  [/\bNPM_TOKEN\b/u, 'an npm token'],
  [/\bNODE_AUTH_TOKEN\b/u, 'a Node authentication token'],
  [/\bsecrets\./u, 'a GitHub Actions secret'],
];

for (const [pattern, description] of forbiddenWorkflowPatterns) {
  if (pattern.test(releaseWorkflow)) {
    failures.push(`release workflow must not reference ${description}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Release documentation is not ready:\n- ${failures.join('\n- ')}`);
}

console.info(
  `${packageJson.name}@${packageJson.version} documentation is ready for ${requestedTag}.`,
);
