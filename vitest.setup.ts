import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react only self-registers its afterEach(cleanup) when it detects a
// global `afterEach`. This project imports test globals explicitly (no `globals: true`
// in vitest.config.mts), so DOM isn't unmounted between tests unless we do it here.
afterEach(() => {
  cleanup();
});
