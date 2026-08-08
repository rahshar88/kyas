const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '../..');

const shared = {
  // `setupFiles`, not `setupFilesAfterEnv`: env vars must exist before any module under
  // test imports src/config/env.ts, which validates at import time.
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Native module mocks need the test framework, so they run after the environment is up.
  setupFilesAfterEnv: ['<rootDir>/jest.mocks.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // `packages` is included so @kyascene/ui's token tests run in the same suite as the app.
  // Workspace packages are symlinked, and Jest resolves them to their real paths under
  // packages/*, so they never match the preset's `/node_modules/` transform-ignore rules
  // and are transformed like first-party source. That is also why this config does not
  // override `transformIgnorePatterns` — jest-expo's default already handles the pnpm
  // store layout, and replacing it silently drops packages such as expo-modules-core.
  roots: ['<rootDir>/src', '<rootDir>/app', path.join(workspaceRoot, 'packages')],
  testPathIgnorePatterns: ['/node_modules/', '/\\.expo/', '/ios/', '/android/'],
};

/**
 * Two projects, both native. The bare `jest-expo` preset also registers web and node
 * projects, which would require `react-native-web` — deliberately absent per §4.7.
 */
module.exports = {
  projects: [
    { displayName: 'ios', preset: 'jest-expo/ios', ...shared },
    { displayName: 'android', preset: 'jest-expo/android', ...shared },
  ],
};
