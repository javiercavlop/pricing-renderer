import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedDirectories = [resolve(projectRoot, 'dist'), resolve(projectRoot, '.tsbuildinfo')];

for (const directory of generatedDirectories) {
  if (!directory.startsWith(`${projectRoot}/`)) {
    throw new Error('Refusing to clean a directory outside the project.');
  }
  await rm(directory, { recursive: true, force: true });
}
