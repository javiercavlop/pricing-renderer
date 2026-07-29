import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const packageName = packageJson.name;
const packageVersion = packageJson.version;

if (typeof packageName !== 'string' || typeof packageVersion !== 'string') {
  throw new TypeError('package.json must contain string name and version fields.');
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);
const registryUrl = new URL(encodeURIComponent(packageName), 'https://registry.npmjs.org/');

function repositoryUrl(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url;
  return undefined;
}

function canonicalRepository(value) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

try {
  const response = await fetch(registryUrl, {
    headers: { accept: 'application/json' },
    signal: controller.signal,
  });

  if (response.status === 404) {
    console.info(
      `${packageName} is unclaimed and ${packageName}@${packageVersion} can be published.`,
    );
  } else if (!response.ok) {
    throw new Error(
      `Could not verify ${packageName}@${packageVersion} on npm (HTTP ${response.status}).`,
    );
  } else {
    const packument = await response.json();
    if (!packument || typeof packument !== 'object') {
      throw new Error(`npm returned invalid metadata for ${packageName}.`);
    }
    const latestVersion =
      typeof packument['dist-tags']?.latest === 'string'
        ? packument.versions?.[packument['dist-tags'].latest]
        : undefined;
    const expectedRepository = canonicalRepository(repositoryUrl(packageJson.repository));
    const publishedRepository = canonicalRepository(
      repositoryUrl(packument.repository) ?? repositoryUrl(latestVersion?.repository),
    );

    if (!expectedRepository || publishedRepository !== expectedRepository) {
      throw new Error(
        `${packageName} already exists on npm and does not identify this repository. Stop instead of renaming or publishing.`,
      );
    }
    if (packument.versions?.[packageVersion]) {
      throw new Error(
        `${packageName}@${packageVersion} already exists on npm. Published versions are immutable.`,
      );
    }
    console.info(
      `${packageName} belongs to this repository and version ${packageVersion} is available.`,
    );
  }
} finally {
  clearTimeout(timeout);
}
