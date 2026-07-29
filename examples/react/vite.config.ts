import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')],
    },
  },
});
