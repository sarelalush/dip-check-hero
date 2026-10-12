import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Local guards only: do not load the application's server/plugins or call providers.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
    'react-native': fileURLToPath(new URL('./mobile/node_modules/react-native/index.js', import.meta.url)),
  } },
  test: {
    environment: 'node',
    include: ['tests/service-safeguards.test.ts', 'tests/consent-and-request-guards.test.ts', 'tests/consent-screen-guards.test.tsx', 'tests/deletion-worker-guards.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
