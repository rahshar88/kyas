import expo from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Shared flat ESLint config for the KyaScene monorepo.
 *
 * `eslint-config-prettier` must stay last so it can switch off stylistic rules that
 * would otherwise fight `prettier --check` in CI.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      '**/*.tsbuildinfo',
      '**/expo-env.d.ts',
      // Deno, not Node. ESLint cannot resolve `jsr:` or `npm:` specifiers, and the globals
      // differ. `deno check` validates this directory instead — see supabase/functions/deno.json.
      'supabase/functions/**',
    ],
  },
  ...expo,
  prettier,
  {
    rules: {
      /* Spec §6.4: screens must surface typed AppError codes, never raw backend
         messages, and §14.3 forbids logging personal data. A stray console.log is the
         usual way both rules get broken, so warn on everything except the channels our
         error reporter actually uses. */
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    /* eslint-config-expo registers only the Node resolver, which cannot follow the
       `@/*` path alias declared in apps/mobile/tsconfig.json. Without this, every
       first-party import in the app is reported as unresolved. */
    files: ['apps/mobile/**/*.{ts,tsx,js,jsx}'],
    settings: {
      'import/resolver': {
        typescript: { project: 'apps/mobile/tsconfig.json' },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
      },
    },
  },
  {
    /* Build tooling and Jest config run in Node, not in the React Native runtime, so
       they need Node globals rather than Expo's browser-flavoured set. */
    files: ['scripts/**/*.{js,mjs,cjs}', '**/*.config.{js,mjs,cjs}', 'apps/mobile/jest.setup.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // These scripts report progress to a developer or to CI; that is their output.
      'no-console': 'off',
    },
  },
];
