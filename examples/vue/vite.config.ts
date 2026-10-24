import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'pricing-renderer',
        },
      },
    }),
  ],
  server: {
    fs: {
      allow: [resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')],
    },
  },
});
