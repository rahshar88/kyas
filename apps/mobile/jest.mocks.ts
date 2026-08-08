/**
 * Native module mocks.
 *
 * Runs in `setupFilesAfterEnv` rather than `setupFiles`, because `jest.mock` needs the test
 * framework to be installed. Environment variables stay in jest.setup.ts, which must run
 * earlier still — src/config/env.ts validates at import time.
 */

// AsyncStorage is a native module; without its official in-memory mock every test that
// touches the registration draft fails with "NativeModule: AsyncStorage is null".
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SecureStore backs the session store. An in-memory stand-in keeps the chunking logic under
// test without a keychain.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

export {};
