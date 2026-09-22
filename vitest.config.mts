import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // A test's own timeout must exceed testing-library's asyncUtilTimeout (raised in vitest.setup.ts):
    // otherwise a test with a couple of slow-under-load findBy/waitFor calls can hit vitest's default
    // 5000ms test timeout before either of testing-library's own (longer) timeouts ever gets to fire.
    testTimeout: 15000,
  },
});
