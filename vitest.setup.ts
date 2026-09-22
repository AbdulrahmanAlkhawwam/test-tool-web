import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react only self-registers its afterEach(cleanup) when it detects a
// global `afterEach`. This project imports test globals explicitly (no `globals: true`
// in vitest.config.mts), so DOM isn't unmounted between tests unless we do it here.
afterEach(() => {
  cleanup();
});

// The default 1000ms findBy/waitFor timeout is tight when the full suite runs many files'
// worth of jsdom + React Query work in parallel workers; under that load a few extra mocked
// fetches in a chain (project → GitLab status → branches → tree, say) can occasionally miss
// it even though nothing is actually stuck. A longer ceiling avoids flaky failures here while
// still catching a genuinely broken/hanging query well before it's reached.
configure({ asyncUtilTimeout: 5000 });
